import Advertisement from "../models/Advertisement.model.js";
import User from "../models/User.model.js";
import { redisClient } from "../config/redis.js";
import { sendSuccessResponse, sendErrorResponse } from "../utils/responseHandler.js";
import { logger } from "../utils/logger.js";

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
 * Public: Fetch active advertisements for marketplace feed.
 * Applies:
 * 1. City and Intent targeting
 * 2. User permanent dismissals (hiddenAds)
 * 3. Instagram-style Frequency Capping (max views per user per 24 hours)
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
      .limit(20)
      .lean();

    // Frequency capping check: filter out ads that hit today's cap for this user/IP
    const userKey = getUserIdentifier(req);
    const eligibleAds = [];

    for (const ad of ads) {
      const cap = ad.frequencyCap || 3;
      const viewsToday = await getImpressionCount(userKey, ad._id);
      if (viewsToday < cap) {
        eligibleAds.push(ad);
      }
    }

    const finalAds = eligibleAds.slice(0, Math.min(20, Math.max(1, Number.parseInt(limit, 10) || 10)));

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
    const { status, search } = req.query;

    const query = {};
    if (status && status !== "all") {
      query.status = status;
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
      ctaText = "Learn More",
      targetUrl,
      badgeText = "Sponsored",
      companyName = "",
      companyLogo = "",
      targetCity = "",
      targetIntent = "All",
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

    const ad = await Advertisement.create({
      title: title.trim(),
      description: description.trim(),
      mediaUrl: mediaUrl.trim(),
      ctaText: ctaText.trim() || "Learn More",
      targetUrl: targetUrl.trim(),
      badgeText: badgeText.trim() || "Sponsored",
      companyName: companyName.trim(),
      companyLogo: companyLogo.trim(),
      targetCity: targetCity.trim(),
      targetIntent: ["All", "Buy", "Rent", "Sell"].includes(targetIntent) ? targetIntent : "All",
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
      "ctaText",
      "targetUrl",
      "badgeText",
      "companyName",
      "companyLogo",
      "targetCity",
      "targetIntent",
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
      return sendErrorResponse(res, 400, "No image uploaded");
    }
    return sendSuccessResponse(res, 200, "Image uploaded successfully", { url: req.file.path });
  } catch (error) {
    logger.error("Error uploading ad image:", error);
    return sendErrorResponse(res, 500, "Internal Server Error");
  }
};
