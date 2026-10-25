import Advertisement, { AD_CATEGORIES } from "../models/Advertisement.model.js";
import User from "../models/User.model.js";
import { redisClient } from "../config/redis.js";
import { sendSuccessResponse, sendErrorResponse } from "../utils/responseHandler.js";
import { logger } from "../utils/logger.js";
import {
  debitCoins,
  getOrCreateWallet,
  updateTransactionReference,
} from "../services/wallet.service.js";

const getTodayDateString = () => new Date().toISOString().slice(0, 10);

const getUserIdentifier = (req) => {
  if (req.user?._id) return `u:${req.user._id}`;
  const ip = req.headers["x-forwarded-for"]?.split(",")[0] || req.socket?.remoteAddress || "anon";
  return `ip:${ip}`;
};

const getImpressionCount = async (userKey, adId) => {
  const today = getTodayDateString();
  const key = `ad:freq:${userKey}:${adId}:${today}`;
  try {
    const val = await redisClient.get(key);
    return Number.parseInt(val, 10) || 0;
  } catch {
    return 0;
  }
};

const incrementImpressionCount = async (userKey, adId) => {
  const today = getTodayDateString();
  const key = `ad:freq:${userKey}:${adId}:${today}`;
  try {
    const count = await redisClient.incr(key);
    if (count === 1) {
      await redisClient.expire(key, 86400); // 24 hours
    }
    return count;
  } catch {
    return 1;
  }
};

/**
 * Calculates a relevance and quality score for an ad.
 * - Base relevance by category (Real Estate > Loans > Interiors > Lifestyle)
 * - City match bonus (+0.4)
 * - CTR Quality multiplier (higher CTR = higher score)
 * - Anti-fatigue penalty for ads seen earlier today by this user
 */
export const calculateAdScore = ({ ad, userCity, viewsToday = 0 }) => {
  const categoryWeights = {
    "Real Estate": 1.5,
    "Home Loans & Finance": 1.3,
    "Interiors & Services": 1.2,
    "Lifestyle & Entertainment": 0.9,
  };
  let relevance = categoryWeights[ad.adCategory] || 1.0;

  if (
    userCity &&
    ad.targetCity &&
    String(ad.targetCity).trim().toLowerCase() === String(userCity).trim().toLowerCase()
  ) {
    relevance += 0.4;
  }

  // CTR quality multiplier (baseline ~1.5% CTR gives ~1.0 multiplier)
  const ctr =
    ad.impressionsCount && ad.impressionsCount > 0
      ? (ad.clicksCount / ad.impressionsCount) * 100
      : 1.5;
  const quality = Math.min(2.5, Math.max(0.5, (ctr + 0.5) / 2));

  // Anti-fatigue penalty for ads seen earlier today (0.4 penalty per view)
  const fatigue = Math.max(0, viewsToday) * 0.4;

  const score = relevance * quality - fatigue;
  return Number(score.toFixed(3));
};

/**
 * Smoothly interleaves ads to prevent generic lifestyle ads (movies, drinks)
 * from overwhelming the real estate and property feed.
 * Ratio: up to 2 Core (Property/Loans/Interiors) : 1 Lifestyle.
 */
export const balanceAdFeed = (scoredAds, limit = 10) => {
  const coreAds = [];
  const lifestyleAds = [];

  for (const item of scoredAds) {
    if (item.ad?.adCategory === "Lifestyle & Entertainment") {
      lifestyleAds.push(item);
    } else {
      coreAds.push(item);
    }
  }

  coreAds.sort((a, b) => b.score - a.score);
  lifestyleAds.sort((a, b) => b.score - a.score);

  const result = [];
  let coreIdx = 0;
  let lifeIdx = 0;

  while ((coreIdx < coreAds.length || lifeIdx < lifestyleAds.length) && result.length < limit) {
    let added = 0;
    // Add up to 2 core property/services ads
    for (let i = 0; i < 2 && coreIdx < coreAds.length && result.length < limit; i++) {
      result.push(coreAds[coreIdx++].ad);
      added++;
    }
    // Add 1 lifestyle ad
    if (lifeIdx < lifestyleAds.length && result.length < limit) {
      result.push(lifestyleAds[lifeIdx++].ad);
      added++;
    }
    // If no more core ads available, continue with lifestyle ads
    if (coreIdx >= coreAds.length && lifeIdx < lifestyleAds.length && result.length < limit) {
      result.push(lifestyleAds[lifeIdx++].ad);
      added++;
    }
    if (added === 0) break;
  }

  return result;
};

/**
 * Public: Fetch active advertisements for marketplace feed.
 * Applies:
 * 1. City and Intent targeting
 * 2. User permanent dismissals (hiddenAds)
 * 3. Daily Frequency Capping (max views per user per 24 hours)
 * 4. Relevance & CTR Quality scoring + Anti-fatigue penalty
 * 5. Balanced feed distribution (Core property vs Lifestyle ads)
 */
export const getActiveAdvertisements = async (req, res) => {
  try {
    const { city, intent, limit = 10 } = req.query;
    const now = new Date();

    const query = {
      status: "active",
      startDate: { $lte: now },
      $or: [{ endDate: null }, { endDate: { $exists: false } }, { endDate: { $gte: now } }],
    };

    // Filter out permanently dismissed ads for logged-in user
    const userHiddenAds = (req.user?.hiddenAds || []).map(String);
    if (userHiddenAds.length > 0) {
      query._id = { $nin: userHiddenAds };
    }

    if (city && String(city).trim()) {
      const cityRegex = new RegExp(`^${String(city).trim()}$`, "i");
      query.$and = [
        {
          $or: [{ targetCity: "" }, { targetCity: { $exists: false } }, { targetCity: null }, { targetCity: cityRegex }],
        },
      ];
    }

    if (intent && ["Buy", "Rent", "Sell"].includes(intent)) {
      query.targetIntent = { $in: ["All", intent] };
    }

    const ads = await Advertisement.find(query)
      .sort({ updatedAt: -1 })
      .limit(50)
      .lean();

    // Frequency capping check & scoring
    const userKey = getUserIdentifier(req);
    const scoredAds = [];

    for (const ad of ads) {
      const cap = ad.frequencyCap || 3;
      const viewsToday = await getImpressionCount(userKey, ad._id);
      if (viewsToday < cap) {
        const score = calculateAdScore({
          ad,
          userCity: city,
          viewsToday,
        });
        scoredAds.push({ ad, score });
      }
    }

    const parsedLimit = Math.min(20, Math.max(1, Number.parseInt(limit, 10) || 10));
    const finalAds = balanceAdFeed(scoredAds, parsedLimit);

    return sendSuccessResponse(res, 200, "Active ads fetched successfully", { ads: finalAds });
  } catch (error) {
    logger.error("Error fetching active advertisements:", error);
    return sendErrorResponse(res, 500, "Internal Server Error");
  }
};

/**
 * Public: Record impression on an ad & update frequency cap.
 */
export const recordImpression = async (req, res) => {
  try {
    const { id } = req.params;
    const ad = await Advertisement.findByIdAndUpdate(
      id,
      { $inc: { impressionsCount: 1 } },
      { new: true, select: "_id impressionsCount frequencyCap" }
    );

    if (!ad) {
      return sendErrorResponse(res, 404, "Advertisement not found");
    }

    // Increment user frequency counter in Redis
    const userKey = getUserIdentifier(req);
    await incrementImpressionCount(userKey, ad._id);

    return sendSuccessResponse(res, 200, "Impression recorded", { id: ad._id });
  } catch (error) {
    logger.error("Error recording ad impression:", error);
    return sendErrorResponse(res, 500, "Internal Server Error");
  }
};

/**
 * Public: Record click on an ad.
 */
export const recordClick = async (req, res) => {
  try {
    const { id } = req.params;
    const ad = await Advertisement.findByIdAndUpdate(
      id,
      { $inc: { clicksCount: 1 } },
      { new: true, select: "_id clicksCount targetUrl" }
    );

    if (!ad) {
      return sendErrorResponse(res, 404, "Advertisement not found");
    }

    return sendSuccessResponse(res, 200, "Click recorded", {
      id: ad._id,
      targetUrl: ad.targetUrl,
    });
  } catch (error) {
    logger.error("Error recording ad click:", error);
    return sendErrorResponse(res, 500, "Internal Server Error");
  }
};

/**
 * Public/Auth: Dismiss an ad so user never sees it again.
 */
export const dismissAdvertisement = async (req, res) => {
  try {
    const { id } = req.params;
    if (req.user?._id) {
      await User.findByIdAndUpdate(req.user._id, { $addToSet: { hiddenAds: id } });
    }
    return sendSuccessResponse(res, 200, "Advertisement dismissed successfully");
  } catch (error) {
    logger.error("Error dismissing advertisement:", error);
    return sendErrorResponse(res, 500, "Internal Server Error");
  }
};

/**
 * Admin: List all advertisements with pagination, filters, and computed CTR.
 */
export const adminGetAdvertisements = async (req, res) => {
  try {
    const page = Math.max(1, Number.parseInt(req.query.page, 10) || 1);
    const limit = Math.min(50, Math.max(1, Number.parseInt(req.query.limit, 10) || 12));
    const skip = (page - 1) * limit;
    const { status, search, category } = req.query;

    const query = {};
    if (status && status !== "all") {
      query.status = status;
    }
    if (category && category !== "all" && AD_CATEGORIES.includes(category)) {
      query.adCategory = category;
    }
    if (search && String(search).trim()) {
      const term = String(search).trim();
      query.$or = [
        { title: { $regex: term, $options: "i" } },
        { description: { $regex: term, $options: "i" } },
        { companyName: { $regex: term, $options: "i" } },
        { targetCity: { $regex: term, $options: "i" } },
      ];
    }

    const [ads, total] = await Promise.all([
      Advertisement.find(query)
        .populate("createdBy", "fullName email")
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      Advertisement.countDocuments(query),
    ]);

    const enriched = ads.map((ad) => {
      const impressions = ad.impressionsCount || 0;
      const clicks = ad.clicksCount || 0;
      const ctr = impressions > 0 ? Number(((clicks / impressions) * 100).toFixed(2)) : 0;
      return { ...ad, ctr };
    });

    return sendSuccessResponse(res, 200, "Advertisements fetched successfully", {
      advertisements: enriched,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    logger.error("Error listing admin advertisements:", error);
    return sendErrorResponse(res, 500, "Internal Server Error");
  }
};

/**
 * Admin: Create a new advertisement.
 */
export const adminCreateAdvertisement = async (req, res) => {
  try {
    const {
      title,
      description,
      mediaUrl,
      mediaType,
      ctaText = "Learn More",
      targetUrl,
      badgeText = "Ad",
      companyName = "",
      companyLogo = "",
      targetCity = "",
      targetIntent = "All",
      adCategory = "Real Estate",
      status = "active",
      frequencyCap = 3,
      startDate,
      endDate,
    } = req.body;

    if (!title?.trim()) {
      return sendErrorResponse(res, 400, "Title is required");
    }
    if (!description?.trim()) {
      return sendErrorResponse(res, 400, "Description is required");
    }
    if (!mediaUrl?.trim()) {
      return sendErrorResponse(res, 400, "Media banner image is required");
    }
    if (!targetUrl?.trim()) {
      return sendErrorResponse(res, 400, "Target link/URL is required");
    }

    const isVideo = mediaType === "video" || /\.(mp4|webm|mov)(\?|$)/i.test(mediaUrl || "") || (mediaUrl || "").includes("/video/upload/");
    const resolvedMediaType = isVideo ? "video" : "image";

    const ad = await Advertisement.create({
      title: title.trim(),
      description: description.trim(),
      mediaUrl: mediaUrl.trim(),
      mediaType: resolvedMediaType,
      ctaText: ctaText.trim() || "Learn More",
      targetUrl: targetUrl.trim(),
      badgeText: badgeText.trim() || "Sponsored",
      companyName: companyName.trim(),
      companyLogo: companyLogo.trim(),
      targetCity: targetCity.trim(),
      targetIntent: ["All", "Buy", "Rent", "Sell"].includes(targetIntent) ? targetIntent : "All",
      adCategory: AD_CATEGORIES.includes(adCategory) ? adCategory : "Real Estate",
      status: ["active", "paused", "draft", "expired"].includes(status) ? status : "active",
      frequencyCap: Math.max(1, Math.min(50, Number.parseInt(frequencyCap, 10) || 3)),
      startDate: startDate ? new Date(startDate) : new Date(),
      endDate: endDate ? new Date(endDate) : null,
      createdBy: req.user._id,
    });

    return sendSuccessResponse(res, 201, "Advertisement created successfully", { advertisement: ad });
  } catch (error) {
    logger.error("Error creating advertisement:", error);
    return sendErrorResponse(res, 500, "Internal Server Error");
  }
};

/**
 * Admin: Update an existing advertisement.
 */
export const adminUpdateAdvertisement = async (req, res) => {
  try {
    const { id } = req.params;
    const allowed = [
      "title",
      "description",
      "mediaUrl",
      "mediaType",
      "ctaText",
      "targetUrl",
      "badgeText",
      "companyName",
      "companyLogo",
      "targetCity",
      "targetIntent",
      "adCategory",
      "status",
      "frequencyCap",
      "startDate",
      "endDate",
    ];

    const updates = {};
    for (const key of allowed) {
      if (req.body[key] !== undefined) {
        if (key === "startDate" || key === "endDate") {
          updates[key] = req.body[key] ? new Date(req.body[key]) : null;
        } else if (key === "frequencyCap") {
          updates[key] = Math.max(1, Math.min(50, Number.parseInt(req.body[key], 10) || 3));
        } else if (key === "adCategory") {
          if (AD_CATEGORIES.includes(req.body.adCategory)) {
            updates.adCategory = req.body.adCategory;
          }
        } else if (typeof req.body[key] === "string") {
          updates[key] = req.body[key].trim();
        } else {
          updates[key] = req.body[key];
        }
      }
    }

    const ad = await Advertisement.findByIdAndUpdate(id, updates, { new: true, runValidators: true });
    if (!ad) {
      return sendErrorResponse(res, 404, "Advertisement not found");
    }

    return sendSuccessResponse(res, 200, "Advertisement updated successfully", { advertisement: ad });
  } catch (error) {
    logger.error("Error updating advertisement:", error);
    return sendErrorResponse(res, 500, "Internal Server Error");
  }
};

/**
 * Admin: Delete an advertisement.
 */
export const adminDeleteAdvertisement = async (req, res) => {
  try {
    const { id } = req.params;
    const ad = await Advertisement.findByIdAndDelete(id);
    if (!ad) {
      return sendErrorResponse(res, 404, "Advertisement not found");
    }

    return sendSuccessResponse(res, 200, "Advertisement deleted successfully", { id });
  } catch (error) {
    logger.error("Error deleting advertisement:", error);
    return sendErrorResponse(res, 500, "Internal Server Error");
  }
};

/**
 * Admin: Upload ad banner image to Cloudinary.
 */
export const uploadAdvertisementImageController = async (req, res) => {
  try {
    if (!req.file) {
      return sendErrorResponse(res, 400, "No media file uploaded");
    }
    const isVideo = req.file.mimetype?.startsWith("video/") || false;
    return sendSuccessResponse(res, 200, "Media uploaded successfully", {
      url: req.file.path,
      mediaType: isVideo ? "video" : "image",
    });
  } catch (error) {
    logger.error("Error uploading ad media:", error);
    return sendErrorResponse(res, 500, "Internal Server Error");
  }
};

export const AD_COIN_PLANS = [
  { durationDays: 1, coins: 200, label: "1 Day", rupeeValue: 20 },
  { durationDays: 3, coins: 500, label: "3 Days", rupeeValue: 50, popular: true },
  { durationDays: 7, coins: 1000, label: "7 Days", rupeeValue: 100 },
  { durationDays: 14, coins: 1800, label: "14 Days", rupeeValue: 180 },
  { durationDays: 30, coins: 3500, label: "30 Days", rupeeValue: 350 },
];

/**
 * User: Create an advertisement using referral coins.
 */
export const createAdvertisementWithCoins = async (req, res) => {
  try {
    const {
      title,
      description,
      mediaUrl,
      mediaType,
      targetUrl,
      ctaText = "Learn More",
      badgeText = "Ad",
      companyName,
      targetCity = "",
      targetIntent = "All",
      adCategory = "Real Estate",
      durationDays = 3,
      associatedPostId,
    } = req.body;

    if (!title || !description || !mediaUrl || !targetUrl) {
      return sendErrorResponse(res, 400, "Title, description, banner image, and destination link are required");
    }

    const isVideo = mediaType === "video" || /\.(mp4|webm|mov)(\?|$)/i.test(mediaUrl || "") || (mediaUrl || "").includes("/video/upload/");
    const resolvedMediaType = isVideo ? "video" : "image";

    const plan = AD_COIN_PLANS.find((p) => p.durationDays === Number(durationDays)) || {
      durationDays: Number(durationDays) || 3,
      coins: Math.max(200, (Number(durationDays) || 3) * 160),
    };

    const costInCoins = plan.coins;

    // Atomically debit coins from user's CoinWallet and record ledger entry
    const debitResult = await debitCoins({
      userId: req.user._id,
      amount: costInCoins,
      category: "AD_CAMPAIGN_SPEND",
      description: `Launched ${plan.durationDays}-day Ad campaign: "${title.trim()}"`,
      referenceModel: "Advertisement",
      metadata: {
        durationDays: plan.durationDays,
        targetCity,
        targetIntent,
        adCategory,
      },
    });

    if (!debitResult.success) {
      return sendErrorResponse(
        res,
        400,
        `Insufficient coins. You have ${debitResult.currentBalance} coins, but this ${plan.durationDays}-day campaign requires ${costInCoins} coins.`
      );
    }

    const startDate = new Date();
    const endDate = new Date(Date.now() + plan.durationDays * 24 * 60 * 60 * 1000);

    const advertisement = await Advertisement.create({
      title: title.trim(),
      description: description.trim(),
      mediaUrl: mediaUrl.trim(),
      mediaType: resolvedMediaType,
      targetUrl: targetUrl.trim(),
      ctaText: ctaText.trim() || "Learn More",
      badgeText: badgeText?.trim() || "Ad",
      companyName: (companyName || req.user.fullName || "").trim(),
      targetCity: (targetCity || "").trim(),
      targetIntent: ["All", "Buy", "Rent", "Sell"].includes(targetIntent) ? targetIntent : "All",
      adCategory: AD_CATEGORIES.includes(adCategory) ? adCategory : "Real Estate",
      status: "active",
      startDate,
      endDate,
      frequencyCap: 3,
      coinsSpent: costInCoins,
      associatedPostId: associatedPostId || null,
      createdBy: req.user._id,
    });

    // Link transaction to created advertisement
    if (debitResult.transaction?._id) {
      await updateTransactionReference(debitResult.transaction._id, advertisement._id, "Advertisement");
    }

    return sendSuccessResponse(res, 201, "Campaign launched successfully!", {
      advertisement,
      remainingCoins: debitResult.wallet.balance,
    });
  } catch (error) {
    logger.error("Error creating advertisement with coins:", error);
    return sendErrorResponse(res, 500, "Internal Server Error");
  }
};

/**
 * User: Fetch my campaigns / Ad Tools dashboard.
 */
export const getMyCampaigns = async (req, res) => {
  try {
    const [wallet, ads] = await Promise.all([
      getOrCreateWallet(req.user._id),
      Advertisement.find({ createdBy: req.user._id }).sort({ createdAt: -1 }).lean(),
    ]);

    const now = Date.now();
    const formatted = ads.map((ad) => {
      const endMs = ad.endDate ? new Date(ad.endDate).getTime() : 0;
      const isExpired = endMs > 0 && endMs <= now;
      const daysRemaining = endMs > now ? Math.ceil((endMs - now) / (24 * 60 * 60 * 1000)) : 0;
      const ctr = ad.impressionsCount > 0 ? ((ad.clicksCount / ad.impressionsCount) * 100).toFixed(1) : "0.0";

      return {
        ...ad,
        isExpired,
        daysRemaining,
        ctr: `${ctr}%`,
      };
    });

    return sendSuccessResponse(res, 200, "Campaigns fetched successfully", {
      campaigns: formatted,
      coinBalance: wallet.balance || 0,
      rupeeValue: Number(((wallet.balance || 0) * 0.1).toFixed(2)),
      plans: AD_COIN_PLANS,
    });
  } catch (error) {
    logger.error("Error fetching user campaigns:", error);
    return sendErrorResponse(res, 500, "Internal Server Error");
  }
};

/**
 * User: Pause or resume their campaign.
 */
export const toggleMyCampaignStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const ad = await Advertisement.findOne({ _id: id, createdBy: req.user._id });

    if (!ad) {
      return sendErrorResponse(res, 404, "Campaign not found");
    }

    if (ad.endDate && new Date(ad.endDate).getTime() <= Date.now()) {
      return sendErrorResponse(res, 400, "Cannot toggle an expired campaign");
    }

    ad.status = ad.status === "active" ? "paused" : "active";
    await ad.save();

    return sendSuccessResponse(res, 200, `Campaign ${ad.status === "active" ? "resumed" : "paused"}`, {
      id: ad._id,
      status: ad.status,
    });
  } catch (error) {
    logger.error("Error toggling campaign status:", error);
    return sendErrorResponse(res, 500, "Internal Server Error");
  }
};
