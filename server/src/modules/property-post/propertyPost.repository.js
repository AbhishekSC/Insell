import mongoose from "mongoose";
import PropertyPost from "../../models/PropertyPost.model.js";
import PostReport, { REPORT_REASON_CODES } from "../../models/PostReport.model.js";
import User from "../../models/User.model.js";
import Offer from "../../models/Offer.model.js";
import VisitRequest from "../../models/VisitRequest.model.js";
import redisClient from "../../config/redisClient.config.js";
import { logger } from "../../utils/logger.js";
import {
  AUTHOR_POPULATE_FIELDS,
  AUTHOR_DETAIL_POPULATE_FIELDS,
  MAP_PINS_PROJECTION,
  MAP_PINS_CACHE_KEY,
  MAP_PINS_CACHE_TTL,
  PSF_BOUNDS,
  PRICE_INSIGHT_MIN_SAMPLE,
  NEAR_ME_MAX_METERS,
} from "./propertyPost.constants.js";

export { REPORT_REASON_CODES };

// ── Core CRUD ───────────────────────────────────────────────────────────

export async function createPost(data) {
  return PropertyPost.create(data);
}

export async function findPostById(id, options = {}) {
  const query = PropertyPost.findById(id);
  if (options.select) query.select(options.select);
  if (options.populate) query.populate(options.populate);
  if (options.lean !== false) query.lean();
  return query;
}

export async function findPostByIdMutable(id) {
  return PropertyPost.findById(id);
}

export async function findPostByIdPopulated(id) {
  return PropertyPost.findById(id)
    .populate("author", AUTHOR_POPULATE_FIELDS)
    .lean();
}

export async function findPostByIdDetailPopulated(id) {
  return PropertyPost.findById(id)
    .populate("author", AUTHOR_DETAIL_POPULATE_FIELDS)
    .lean();
}

export async function softDeletePost(post, userId) {
  post.isDeleted = true;
  post.deletedAt = new Date();
  post.deletedBy = userId;
  return post.save();
}

export async function updatePostFields(id, update, options = {}) {
  return PropertyPost.updateOne({ _id: id }, update, options);
}

export async function expireBoosts() {
  return PropertyPost.updateMany(
    { isBoosted: true, boostExpiresAt: { $lte: new Date() } },
    { $set: { isBoosted: false } },
  );
}

// ── Feed queries ────────────────────────────────────────────────────────

export async function findFeedPosts(filter, { sort, skip, limit, lean = true }) {
  const query = PropertyPost.find(filter)
    .sort(sort)
    .limit(limit)
    .populate("author", AUTHOR_POPULATE_FIELDS);
  if (skip > 0) query.skip(skip);
  return lean ? query.lean() : query;
}

export async function countPosts(filter) {
  return PropertyPost.countDocuments(filter);
}

export async function findMyPosts(userId, { page, limit }) {
  return PropertyPost.find({ author: userId, isDeleted: { $ne: true } })
    .sort({ createdAt: -1 })
    .skip((page - 1) * limit)
    .limit(limit)
    .select("title price city locality listingType propertyType status mediaUrls createdAt updatedAt isBoosted boostExpiresAt areaSqft bedrooms bathrooms furnishing author visibility")
    .populate("author", "fullName profilePic activeRole primaryRole city isVerified isOwnerVerified")
    .lean();
}

export async function findLatestPost() {
  return PropertyPost.findOne({
    isDeleted: { $ne: true },
    isBlocked: { $ne: true },
    $and: [
      { $or: [{ status: "PUBLISHED" }, { status: { $exists: false } }, { status: null }] },
      { $or: [{ visibility: "PUBLIC" }, { visibility: { $exists: false } }, { visibility: null }] },
    ],
  })
    .sort({ createdAt: -1 })
    .select("createdAt")
    .lean();
}

// ── Near Me (geo) ───────────────────────────────────────────────────────

export async function findNearbyPosts(point, geoFilter) {
  return PropertyPost.aggregate([
    {
      $geoNear: {
        near: { type: "Point", coordinates: point },
        distanceField: "distanceMeters",
        maxDistance: NEAR_ME_MAX_METERS,
        spherical: true,
        query: geoFilter,
      },
    },
    { $limit: 300 },
  ]);
}

export async function populateAuthors(posts) {
  return PropertyPost.populate(posts, {
    path: "author",
    select: AUTHOR_POPULATE_FIELDS,
  });
}

// ── Similar properties ──────────────────────────────────────────────────

export async function findSimilarCandidates(ref, priceLo, priceHi) {
  return PropertyPost.find({
    _id: { $ne: ref._id },
    isDeleted: { $ne: true },
    isBlocked: { $ne: true },
    status: "PUBLISHED",
    visibility: "PUBLIC",
    $or: [
      { postType: ref.postType },
      { propertyType: ref.propertyType },
      { city: ref.city || "__none__" },
      { price: { $gte: priceLo, $lte: priceHi } },
    ],
  })
    .sort({ createdAt: -1 })
    .limit(120)
    .populate("author", "fullName profilePic isVerified isOwnerVerified")
    .lean();
}

// ── Comparison ──────────────────────────────────────────────────────────

export async function findPostsForComparison(propertyIds) {
  return PropertyPost.find({
    _id: { $in: propertyIds },
    isDeleted: { $ne: true },
    isBlocked: { $ne: true },
  })
    .populate("author", "fullName profilePic isVerified isOwnerVerified")
    .lean();
}

export async function findSimilarForRecommendation(propertyIds, commonCities, commonTypes, avgPrice) {
  return PropertyPost.find({
    _id: { $nin: propertyIds },
    isDeleted: { $ne: true },
    isBlocked: { $ne: true },
    status: "PUBLISHED",
    visibility: "PUBLIC",
    $or: [
      { city: { $in: commonCities } },
      { propertyType: { $in: commonTypes } },
      { price: { $gte: avgPrice * 0.7, $lte: avgPrice * 1.3 } },
    ],
  })
    .populate("author", "fullName profilePic")
    .limit(6)
    .lean();
}

// ── User-reported posts ─────────────────────────────────────────────────

export async function getUserReportedPostIds(userId) {
  if (!userId) return new Set();
  const cacheKey = `user:${userId}:reported_posts`;
  try {
    const exists = await redisClient.exists(cacheKey);
    if (exists) {
      const ids = await redisClient.sMembers(cacheKey);
      return new Set(ids.filter((id) => id !== "__init__"));
    }
    const reports = await PostReport.find({ reporter: userId }).select("post").lean();
    const idStrings = reports.map((r) => String(r.post));
    const toAdd = idStrings.length > 0 ? idStrings : ["__init__"];
    await redisClient.sAdd(cacheKey, toAdd);
    await redisClient.expire(cacheKey, 86400);
    return new Set(idStrings);
  } catch (err) {
    logger.warn("Error reading reported posts cache:", err?.message);
    const reports = await PostReport.find({ reporter: userId }).select("post").lean();
    return new Set(reports.map((r) => String(r.post)));
  }
}

export async function addToReportedPostsCache(userId, postId) {
  try {
    const cacheKey = `user:${userId}:reported_posts`;
    const exists = await redisClient.exists(cacheKey);
    if (exists) {
      await redisClient.sAdd(cacheKey, String(postId));
      await redisClient.expire(cacheKey, 86400);
    }
  } catch {}
}

// ── Social graph ────────────────────────────────────────────────────────

export async function getUserSocialGraph(userId) {
  if (!userId) return { viewer: null, friends: new Set(), communityIds: new Set() };
  const cacheKey = `user:${userId}:social_graph`;
  try {
    const cached = await redisClient.get(cacheKey);
    if (cached) {
      const data = JSON.parse(cached);
      return {
        viewer: data.viewer,
        friends: new Set(data.friends || []),
        communityIds: new Set(data.communityIds || []),
      };
    }
  } catch (err) {
    logger.warn("Error reading social graph cache:", err?.message);
  }

  const me = await User.findById(userId).select("friends communities workLocation").lean();
  const friendsArr = (me?.friends || []).map(String);
  const communitiesArr = (me?.communities || []).map(String);

  try {
    await redisClient.setEx(
      cacheKey,
      300,
      JSON.stringify({ viewer: me, friends: friendsArr, communityIds: communitiesArr }),
    );
  } catch {}

  return {
    viewer: me,
    friends: new Set(friendsArr),
    communityIds: new Set(communitiesArr),
  };
}

export async function invalidateUserSocialGraph(userId) {
  if (!userId) return;
  try {
    await redisClient.del(`user:${userId}:social_graph`);
  } catch {}
}

// ── Social proof aggregations ───────────────────────────────────────────

export async function aggregateFriendViews(friends, postIds) {
  if (friends.size === 0) return [];
  return User.aggregate([
    { $match: { _id: { $in: [...friends] }, "viewedPosts.post": { $in: postIds } } },
    { $project: { fullName: 1, profilePic: 1, viewedPosts: { $filter: { input: "$viewedPosts", as: "v", cond: { $in: ["$$v.post", postIds] } } } } },
    { $unwind: "$viewedPosts" },
    { $group: { _id: "$viewedPosts.post", viewers: { $push: { name: "$fullName", avatar: "$profilePic" } } } },
  ]);
}

export async function aggregateCommunitySaves(communityIds, postIds) {
  if (communityIds.size === 0) return [];
  return User.aggregate([
    { $match: { communities: { $in: [...communityIds] }, savedPosts: { $in: postIds } } },
    { $project: { matched: { $setIntersection: ["$savedPosts", postIds] } } },
    { $unwind: "$matched" },
    { $group: { _id: "$matched", count: { $sum: 1 } } },
  ]);
}

export async function aggregateInquiryStats(postObjectIds) {
  if (postObjectIds.length === 0) return { visitStats: [], offerStats: [] };
  const oneWeekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
  const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);

  const [visitStats, offerStats] = await Promise.all([
    VisitRequest.aggregate([
      { $match: { post: { $in: postObjectIds }, createdAt: { $gte: oneWeekAgo } } },
      { $group: { _id: "$post", today: { $sum: { $cond: [{ $gte: ["$createdAt", oneDayAgo] }, 1, 0] } }, week: { $sum: 1 } } },
    ]).catch(() => []),
    Offer.aggregate([
      { $match: { post: { $in: postObjectIds }, createdAt: { $gte: oneWeekAgo } } },
      { $group: { _id: "$post", today: { $sum: { $cond: [{ $gte: ["$createdAt", oneDayAgo] }, 1, 0] } }, week: { $sum: 1 } } },
    ]).catch(() => []),
  ]);

  return { visitStats, offerStats };
}

export async function findUsersByIds(ids, select = "fullName profilePic isOwnerVerified") {
  if (!ids || ids.length === 0) return [];
  return User.find({ _id: { $in: [...ids] } }).select(select).lean();
}

// ── Post detail supporting queries ──────────────────────────────────────

export async function countActiveOffers(postId) {
  return Offer.countDocuments({ post: postId, status: { $in: ["pending", "countered"] } });
}

export async function countSellerListings(authorId) {
  return PropertyPost.countDocuments({
    author: authorId,
    status: "PUBLISHED",
    visibility: "PUBLIC",
    isDeleted: { $ne: true },
    isBlocked: { $ne: true },
  });
}

export async function checkActiveDeal(postId) {
  const Deal = (await import("../../models/Deal.model.js")).default;
  return Deal.findOne({ post: postId, status: "ACTIVE" });
}

// ── Price benchmark ─────────────────────────────────────────────────────

export async function findPriceBenchmarkListings(cityKey, propertyType, wantRent) {
  const rentMatch = { $or: [{ listingType: /^(rent|lease)$/i }, { postType: "PROPERTY_RENT" }] };
  const buyMatch = { listingType: { $not: /^(rent|lease)$/i }, postType: { $ne: "PROPERTY_RENT" } };

  return PropertyPost.find({
    isDeleted: { $ne: true },
    isBlocked: { $ne: true },
    status: "PUBLISHED",
    visibility: "PUBLIC",
    city: new RegExp(`^${cityKey.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`, "i"),
    propertyType,
    price: { $gt: 0 },
    areaSqft: { $gt: 0 },
    ...(wantRent ? rentMatch : buyMatch),
  })
    .select("price areaSqft bedrooms")
    .limit(500)
    .lean();
}

// ── Verified user IDs ───────────────────────────────────────────────────

export async function getVerifiedUserIds() {
  const CACHE_KEY = "verified_user_ids";
  const CACHE_TTL = 300;
  try {
    const cached = await redisClient.get(CACHE_KEY);
    if (cached) return JSON.parse(cached);
  } catch {}

  const verifiedUsers = await User.find({
    $or: [
      { activeRole: { $in: ["Broker", "Seller", "Landlord"] } },
      { primaryRole: { $in: ["Broker", "Seller", "Landlord"] } },
    ],
  }).select("_id").lean();
  const ids = verifiedUsers.map((u) => String(u._id));

  try {
    await redisClient.setEx(CACHE_KEY, CACHE_TTL, JSON.stringify(ids));
  } catch {}
  return ids;
}

// ── Report creation ─────────────────────────────────────────────────────

export async function createReport({ postId, userId, reasonCode, description }) {
  return PostReport.create({
    post: postId,
    reporter: userId,
    reasonCode,
    description: String(description || "").trim().slice(0, 1000),
  });
}

// ── Map pins ────────────────────────────────────────────────────────────

export async function findMapPins() {
  let pins;
  try {
    const cached = await redisClient.get(MAP_PINS_CACHE_KEY);
    if (cached) return { pins: JSON.parse(cached), cached: true };
  } catch {}

  pins = await PropertyPost.find({
    isDeleted: { $ne: true },
    isBlocked: { $ne: true },
    latitude: { $exists: true, $ne: null },
    longitude: { $exists: true, $ne: null },
  })
    .select(MAP_PINS_PROJECTION)
    .sort({ createdAt: -1 })
    .limit(500)
    .lean();

  pins = pins.map((p) => ({
    ...p,
    mediaUrls: p.mediaUrls?.length ? [p.mediaUrls[0]] : [],
  }));

  try {
    await redisClient.setEx(MAP_PINS_CACHE_KEY, MAP_PINS_CACHE_TTL, JSON.stringify(pins));
  } catch {}

  return { pins, cached: false };
}

// ── Offer aggregation for card signals ──────────────────────────────────

export async function aggregateOfferCounts(ids) {
  return Offer.aggregate([
    { $match: { post: { $in: ids.map((x) => new mongoose.Types.ObjectId(String(x))) }, status: { $in: ["pending", "countered"] } } },
    { $group: { _id: "$post", n: { $sum: 1 } } },
  ]);
}

export async function findPostsForCardSignals(ids) {
  return PropertyPost.find({ _id: { $in: ids }, isDeleted: { $ne: true } })
    .select("city propertyType postType listingType bedrooms price areaSqft postMeta")
    .lean();
}

// ── Likers ──────────────────────────────────────────────────────────────

export async function findLikerUsers(pageIds, currentUserId) {
  const FriendRequest = (await import("../../models/FriendRequest.model.js")).default;

  return Promise.all([
    User.find({ _id: { $in: pageIds }, isBlocked: { $ne: true } })
      .select("fullName profilePic isVerified isOwnerVerified city")
      .lean(),
    User.findById(currentUserId).select("friends").lean(),
    FriendRequest.find({
      status: "pending",
      $or: [
        { sender: currentUserId, receiver: { $in: pageIds } },
        { receiver: currentUserId, sender: { $in: pageIds } },
      ],
    }).select("sender receiver").lean(),
  ]);
}

// ── User view history ───────────────────────────────────────────────────

export function recordUserView(userId, postId) {
  User.updateOne({ _id: userId }, { $pull: { viewedPosts: { post: postId } } })
    .then(() => {
      User.updateOne(
        { _id: userId },
        { $push: { viewedPosts: { $each: [{ post: postId, viewedAt: new Date() }], $slice: -100 } } },
      ).catch(() => {});
    })
    .catch(() => {});
}

// ── "For You" precomputed candidates ────────────────────────────────────

export async function findForYouCandidates(candidateIds) {
  return PropertyPost.find({
    _id: { $in: candidateIds.map((id) => new mongoose.Types.ObjectId(id)) },
    isDeleted: { $ne: true },
    isBlocked: { $ne: true },
  })
    .populate("author", AUTHOR_POPULATE_FIELDS)
    .lean();
}

// ── Following feed ──────────────────────────────────────────────────────

export async function getFollowingIds(userId) {
  const user = await User.findById(userId).select("friends").lean();
  return user?.friends || [];
}

// ── Cache helpers ───────────────────────────────────────────────────────

export async function invalidateFeedCache() {
  try {
    const keys = await redisClient.keys("property:feed:*");
    if (keys.length > 0) {
      await redisClient.del(keys);
      logger.info(`Invalidated ${keys.length} property feed cache entries`);
    }
  } catch (cacheError) {
    logger.warn("Redis cache invalidation error:", cacheError);
  }
}

export async function invalidateUserFeedCache(userId) {
  try {
    const userFeedKeys = await redisClient.keys(`property:feed:*:${userId}:*`);
    if (userFeedKeys.length > 0) {
      await redisClient.del(userFeedKeys);
    }
  } catch {}
}

export async function getFromCache(key) {
  try {
    const cached = await redisClient.get(key);
    return cached ? JSON.parse(cached) : null;
  } catch {
    return null;
  }
}

export async function setCache(key, ttl, data) {
  try {
    await redisClient.setEx(key, ttl, JSON.stringify(data));
  } catch (err) {
    logger.warn("Redis cache write error:", err);
  }
}
