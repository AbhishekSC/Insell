import mongoose from "mongoose";
import { AD_CATEGORIES } from "../../models/Advertisement.model.js";
import {
  debitCoins,
  getOrCreateWallet,
  updateTransactionReference,
} from "../../services/wallet.service.js";
import {
  CATEGORY_WEIGHTS,
  CITY_MATCH_BONUS,
  CTR_QUALITY_MIN,
  CTR_QUALITY_MAX,
  CTR_BASELINE,
  FATIGUE_PENALTY_PER_VIEW,
  FEED_DB_LIMIT,
  FEED_MAX_LIMIT,
  FEED_DEFAULT_LIMIT,
  ADMIN_PAGE_MAX_LIMIT,
  ADMIN_PAGE_DEFAULT_LIMIT,
  ADMIN_ALLOWED_UPDATE_FIELDS,
  FREQ_CAP_MIN,
  FREQ_CAP_MAX,
  FREQ_CAP_DEFAULT,
  VALID_INTENTS,
  VALID_STATUSES,
  AD_COIN_PLANS,
  COIN_COST_PER_DAY_FALLBACK,
  COIN_COST_MIN,
  RUPEE_PER_COIN,
} from "./advertisement.constants.js";
import {
  getUserIdentifier,
  batchGetImpressionCounts,
  incrementImpressionCount,
  incrementImpressionInDb,
  incrementClickInDb,
  addHiddenAdForUser,
  findActiveAds,
  findAdsPaginated,
  createAd,
  updateAdById,
  deleteAdById,
  findAdsByUser,
  findUserOwnedAd,
} from "./advertisement.repository.js";
import { toAdminAdDto, toCampaignDto } from "./advertisement.dto.js";

// ── Scoring ──────────────────────────────────────────────────────────

/**
 * Calculates a relevance and quality score for an ad.
 * - Base relevance by category (Real Estate > Loans > Interiors > Lifestyle)
 * - City match bonus (+0.4)
 * - CTR Quality multiplier (higher CTR = higher score)
 * - Anti-fatigue penalty for ads seen earlier today by this user
 */
export const calculateAdScore = ({ ad, userCity, viewsToday = 0 }) => {
  let relevance = CATEGORY_WEIGHTS[ad.adCategory] || 1.0;

  if (
    userCity &&
    ad.targetCity &&
    String(ad.targetCity).trim().toLowerCase() === String(userCity).trim().toLowerCase()
  ) {
    relevance += CITY_MATCH_BONUS;
  }

  // CTR quality multiplier (baseline ~1.5% CTR gives ~1.0 multiplier)
  const ctr =
    ad.impressionsCount && ad.impressionsCount > 0
      ? (ad.clicksCount / ad.impressionsCount) * 100
      : CTR_BASELINE;
  const quality = Math.min(CTR_QUALITY_MAX, Math.max(CTR_QUALITY_MIN, (ctr + 0.5) / 2));

  // Anti-fatigue penalty for ads seen earlier today (0.4 penalty per view)
  const fatigue = Math.max(0, viewsToday) * FATIGUE_PENALTY_PER_VIEW;

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

// ── Public feed ──────────────────────────────────────────────────────

export const getActiveAdsForFeed = async (req) => {
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

  const ads = await findActiveAds(query);

  const userKey = getUserIdentifier(req);
  const impressionCounts = await batchGetImpressionCounts(userKey, ads);

  const scoredAds = [];
  for (let i = 0; i < ads.length; i++) {
    const ad = ads[i];
    const cap = ad.frequencyCap || 3;
    const viewsToday = impressionCounts[i];
    if (viewsToday < cap) {
      const score = calculateAdScore({ ad, userCity: city, viewsToday });
      scoredAds.push({ ad, score });
    }
  }

  const parsedLimit = Math.min(FEED_MAX_LIMIT, Math.max(1, Number.parseInt(limit, 10) || FEED_DEFAULT_LIMIT));
  const finalAds = balanceAdFeed(scoredAds, parsedLimit);

  return { ads: finalAds };
};

// ── Impression tracking ──────────────────────────────────────────────

export const recordAdImpression = async (id, req) => {
  // Acknowledge preview or mock impressions gracefully without hitting database
  if (!id || id === "admin-preview" || id === "preview" || !mongoose.Types.ObjectId.isValid(id)) {
    return { preview: true, data: { id, isPreview: true } };
  }

  const ad = await incrementImpressionInDb(id);
  if (!ad) return { notFound: true };

  // Increment user frequency counter in Redis
  const userKey = getUserIdentifier(req);
  await incrementImpressionCount(userKey, ad._id);

  return { data: { id: ad._id } };
};

// ── Click tracking ───────────────────────────────────────────────────

export const recordAdClick = async (id, targetUrl) => {
  // Acknowledge preview or mock clicks gracefully without hitting database
  if (!id || id === "admin-preview" || id === "preview" || !mongoose.Types.ObjectId.isValid(id)) {
    return { preview: true, data: { id, isPreview: true, targetUrl: targetUrl || null } };
  }

  const ad = await incrementClickInDb(id);
  if (!ad) return { notFound: true };

  return { data: { id: ad._id, targetUrl: ad.targetUrl } };
};

// ── Dismiss ──────────────────────────────────────────────────────────

export const dismissAd = async (id, user) => {
  // Acknowledge preview or mock dismissals gracefully without hitting database
  if (!id || id === "admin-preview" || id === "preview" || !mongoose.Types.ObjectId.isValid(id)) {
    return { preview: true };
  }

  if (user?._id) {
    await addHiddenAdForUser(user._id, id);
  }
  return {};
};

// ── Admin: list ──────────────────────────────────────────────────────

export const getAdminAdsList = async ({ page: rawPage, limit: rawLimit, status, search, category }) => {
  const page = Math.max(1, Number.parseInt(rawPage, 10) || 1);
  const limit = Math.min(ADMIN_PAGE_MAX_LIMIT, Math.max(1, Number.parseInt(rawLimit, 10) || ADMIN_PAGE_DEFAULT_LIMIT));
  const skip = (page - 1) * limit;

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

  const [ads, total] = await findAdsPaginated(query, { skip, limit });
  const enriched = ads.map(toAdminAdDto);

  return {
    advertisements: enriched,
    pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
  };
};

// ── Admin: create ────────────────────────────────────────────────────

export const createAdminAd = async (body, userId) => {
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
  } = body;

  if (!title?.trim()) return { validationError: "Title is required" };
  if (!description?.trim()) return { validationError: "Description is required" };
  if (!mediaUrl?.trim()) return { validationError: "Media banner image is required" };
  if (!targetUrl?.trim()) return { validationError: "Target link/URL is required" };

  const isVideo = mediaType === "video" || /\.(mp4|webm|mov)(\?|$)/i.test(mediaUrl || "") || (mediaUrl || "").includes("/video/upload/");
  const resolvedMediaType = isVideo ? "video" : "image";

  const ad = await createAd({
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
    targetIntent: VALID_INTENTS.includes(targetIntent) ? targetIntent : "All",
    adCategory: AD_CATEGORIES.includes(adCategory) ? adCategory : "Real Estate",
    status: VALID_STATUSES.includes(status) ? status : "active",
    frequencyCap: Math.max(FREQ_CAP_MIN, Math.min(FREQ_CAP_MAX, Number.parseInt(frequencyCap, 10) || FREQ_CAP_DEFAULT)),
    startDate: startDate ? new Date(startDate) : new Date(),
    endDate: endDate ? new Date(endDate) : null,
    createdBy: userId,
  });

  return { advertisement: ad };
};

// ── Admin: update ────────────────────────────────────────────────────

export const updateAdminAd = async (id, body) => {
  if (!id || !mongoose.Types.ObjectId.isValid(id)) return { invalidId: true };

  const updates = {};
  for (const key of ADMIN_ALLOWED_UPDATE_FIELDS) {
    if (body[key] !== undefined) {
      if (key === "startDate" || key === "endDate") {
        updates[key] = body[key] ? new Date(body[key]) : null;
      } else if (key === "frequencyCap") {
        updates[key] = Math.max(FREQ_CAP_MIN, Math.min(FREQ_CAP_MAX, Number.parseInt(body[key], 10) || FREQ_CAP_DEFAULT));
      } else if (key === "adCategory") {
        if (AD_CATEGORIES.includes(body.adCategory)) {
          updates.adCategory = body.adCategory;
        }
      } else if (typeof body[key] === "string") {
        updates[key] = body[key].trim();
      } else {
        updates[key] = body[key];
      }
    }
  }

  const ad = await updateAdById(id, updates);
  if (!ad) return { notFound: true };

  return { advertisement: ad };
};

// ── Admin: delete ────────────────────────────────────────────────────

export const deleteAdminAd = async (id) => {
  if (!id || !mongoose.Types.ObjectId.isValid(id)) return { invalidId: true };

  const ad = await deleteAdById(id);
  if (!ad) return { notFound: true };

  return { id };
};

// ── Upload banner ────────────────────────────────────────────────────

export const processUploadedMedia = (file) => {
  if (!file) return { noFile: true };
  const isVideo = file.mimetype?.startsWith("video/") || false;
  return { url: file.path, mediaType: isVideo ? "video" : "image" };
};

// ── User: create with coins ──────────────────────────────────────────

export const createAdWithCoins = async (body, user) => {
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
  } = body;

  if (!title || !description || !mediaUrl || !targetUrl) {
    return { validationError: "Title, description, banner image, and destination link are required" };
  }

  const isVideo = mediaType === "video" || /\.(mp4|webm|mov)(\?|$)/i.test(mediaUrl || "") || (mediaUrl || "").includes("/video/upload/");
  const resolvedMediaType = isVideo ? "video" : "image";

  const plan = AD_COIN_PLANS.find((p) => p.durationDays === Number(durationDays)) || {
    durationDays: Number(durationDays) || 3,
    coins: Math.max(COIN_COST_MIN, (Number(durationDays) || 3) * COIN_COST_PER_DAY_FALLBACK),
  };

  const costInCoins = plan.coins;

  // Atomically debit coins from user's CoinWallet and record ledger entry
  const debitResult = await debitCoins({
    userId: user._id,
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
    return {
      insufficientCoins: true,
      message: `Insufficient coins. You have ${debitResult.currentBalance} coins, but this ${plan.durationDays}-day campaign requires ${costInCoins} coins.`,
    };
  }

  const startDate = new Date();
  const endDate = new Date(Date.now() + plan.durationDays * 24 * 60 * 60 * 1000);

  const advertisement = await createAd({
    title: title.trim(),
    description: description.trim(),
    mediaUrl: mediaUrl.trim(),
    mediaType: resolvedMediaType,
    targetUrl: targetUrl.trim(),
    ctaText: ctaText.trim() || "Learn More",
    badgeText: badgeText?.trim() || "Ad",
    companyName: (companyName || user.fullName || "").trim(),
    targetCity: (targetCity || "").trim(),
    targetIntent: VALID_INTENTS.includes(targetIntent) ? targetIntent : "All",
    adCategory: AD_CATEGORIES.includes(adCategory) ? adCategory : "Real Estate",
    status: "active",
    startDate,
    endDate,
    frequencyCap: 3,
    coinsSpent: costInCoins,
    associatedPostId: associatedPostId || null,
    createdBy: user._id,
  });

  // Link transaction to created advertisement
  if (debitResult.transaction?._id) {
    await updateTransactionReference(debitResult.transaction._id, advertisement._id, "Advertisement");
  }

  return { advertisement, remainingCoins: debitResult.wallet.balance };
};

// ── User: my campaigns ───────────────────────────────────────────────

export const getUserCampaigns = async (userId) => {
  const [wallet, ads] = await Promise.all([
    getOrCreateWallet(userId),
    findAdsByUser(userId),
  ]);

  const now = Date.now();
  const formatted = ads.map((ad) => toCampaignDto(ad, now));

  return {
    campaigns: formatted,
    coinBalance: wallet.balance || 0,
    rupeeValue: Number(((wallet.balance || 0) * RUPEE_PER_COIN).toFixed(2)),
    plans: AD_COIN_PLANS,
  };
};

// ── User: toggle campaign status ─────────────────────────────────────

export const toggleCampaignStatus = async (id, userId) => {
  if (!id || !mongoose.Types.ObjectId.isValid(id)) return { invalidId: true };

  const ad = await findUserOwnedAd(id, userId);
  if (!ad) return { notFound: true };

  if (ad.endDate && new Date(ad.endDate).getTime() <= Date.now()) {
    return { expired: true };
  }

  ad.status = ad.status === "active" ? "paused" : "active";
  await ad.save();

  return { id: ad._id, status: ad.status };
};
