import Advertisement from "../../models/Advertisement.model.js";
import User from "../../models/User.model.js";
import { redisClient } from "../../config/redis.js";
import { FREQ_CAP_TTL_SECONDS } from "./advertisement.constants.js";

// ── Helpers ──────────────────────────────────────────────────────────

const getTodayDateString = () => new Date().toISOString().slice(0, 10);

export const getUserIdentifier = (req) => {
  if (req.user?._id) return `u:${req.user._id}`;
  const ip = req.headers["x-forwarded-for"]?.split(",")[0] || req.socket?.remoteAddress || "anon";
  return `ip:${ip}`;
};

// ── Redis frequency-cap helpers ──────────────────────────────────────

export const getImpressionCount = async (userKey, adId) => {
  const today = getTodayDateString();
  const key = `ad:freq:${userKey}:${adId}:${today}`;
  try {
    const val = await redisClient.get(key);
    return Number.parseInt(val, 10) || 0;
  } catch {
    return 0;
  }
};

export const incrementImpressionCount = async (userKey, adId) => {
  const today = getTodayDateString();
  const key = `ad:freq:${userKey}:${adId}:${today}`;
  try {
    const count = await redisClient.incr(key);
    if (count === 1) {
      await redisClient.expire(key, FREQ_CAP_TTL_SECONDS);
    }
    return count;
  } catch {
    return 1;
  }
};

export const batchGetImpressionCounts = async (userKey, ads) => {
  const today = getTodayDateString();
  const impressionKeys = ads.map((ad) => `ad:freq:${userKey}:${ad._id}:${today}`);
  try {
    const results = await Promise.all(impressionKeys.map((k) => redisClient.get(k)));
    return results.map((val) => Number.parseInt(val, 10) || 0);
  } catch {
    return ads.map(() => 0);
  }
};

// ── MongoDB queries ──────────────────────────────────────────────────

export const findActiveAds = (query) =>
  Advertisement.find(query).sort({ updatedAt: -1 }).limit(50).lean();

export const incrementImpressionInDb = (id) =>
  Advertisement.findByIdAndUpdate(
    id,
    { $inc: { impressionsCount: 1 } },
    { new: true, select: "_id impressionsCount frequencyCap" }
  );

export const incrementClickInDb = (id) =>
  Advertisement.findByIdAndUpdate(
    id,
    { $inc: { clicksCount: 1 } },
    { new: true, select: "_id clicksCount targetUrl" }
  );

export const addHiddenAdForUser = (userId, adId) =>
  User.findByIdAndUpdate(userId, { $addToSet: { hiddenAds: adId } });

export const findAdsPaginated = (query, { skip, limit }) =>
  Promise.all([
    Advertisement.find(query)
      .populate("createdBy", "fullName email")
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean(),
    Advertisement.countDocuments(query),
  ]);

export const createAd = (data) => Advertisement.create(data);

export const updateAdById = (id, updates) =>
  Advertisement.findByIdAndUpdate(id, updates, { new: true, runValidators: true });

export const deleteAdById = (id) => Advertisement.findByIdAndDelete(id);

export const findAdsByUser = (userId) =>
  Advertisement.find({ createdBy: userId }).sort({ createdAt: -1 }).lean();

export const findUserOwnedAd = (id, userId) =>
  Advertisement.findOne({ _id: id, createdBy: userId });
