import User from "../../models/User.model.js";
import PropertyPost from "../../models/PropertyPost.model.js";
import PostReport from "../../models/PostReport.model.js";
import Notification from "../../models/Notification.model.js";
import Announcement from "../../models/Announcement.model.js";
import Feedback from "../../models/Feedback.model.js";
import redisClient from "../../config/redisClient.config.js";
import { logger } from "../../utils/logger.js";
import {
  ADMIN_USER_FIELDS,
  ADMIN_POST_FIELDS,
} from "./admin.constants.js";

// ── Users ──────────────────────────────────────────────────────────────

export async function findUsers(query, { skip, limit }) {
  return User.find(query)
    .select(ADMIN_USER_FIELDS)
    .sort({ createdAt: -1 })
    .skip(skip)
    .limit(limit)
    .lean();
}

export async function countUsers(query) {
  return User.countDocuments(query);
}

export async function findUserById(id, select) {
  return User.findById(id).select(select);
}

export async function countLiveUsers(cutoff) {
  return User.countDocuments({ lastActiveAt: { $gte: cutoff } });
}

export async function findRecipientIds(conditions) {
  const recipients = await User.find(conditions).select("_id").lean();
  return recipients.map((u) => u._id);
}

// ── Posts ───────────────────────────────────────────────────────────────

export async function findPosts(query, { skip, limit }) {
  return PropertyPost.find(query)
    .select(ADMIN_POST_FIELDS)
    .populate("author", "fullName email profilePic")
    .populate("blockedBy", "fullName")
    .sort({ createdAt: -1 })
    .skip(skip)
    .limit(limit)
    .lean();
}

export async function countPosts(query) {
  return PropertyPost.countDocuments(query);
}

export async function findPostById(id, select) {
  if (select) {
    return PropertyPost.findById(id).select(select);
  }
  return PropertyPost.findById(id);
}

export async function findPostByIdPopulated(postId) {
  return PropertyPost.findById(postId)
    .select(ADMIN_POST_FIELDS)
    .populate("author", "fullName email profilePic")
    .populate("blockedBy", "fullName")
    .lean();
}

// ── Reports ────────────────────────────────────────────────────────────

export async function findPendingReportsByPost(postId) {
  return PostReport.find({ post: postId, status: "PENDING" }).select("reporter").lean();
}

export async function resolveReportsByPost(postId, adminId) {
  return PostReport.updateMany(
    { post: postId, status: "PENDING" },
    { $set: { status: "ACTION_TAKEN", reviewedAt: new Date(), reviewedBy: adminId } }
  );
}

export async function dismissReportsByPost(postId, adminId) {
  return PostReport.updateMany(
    { post: postId, status: "PENDING" },
    { $set: { status: "DISMISSED", reviewedAt: new Date(), reviewedBy: adminId } }
  );
}

export async function aggregateGroupedReports(matchStage, { skip, limit }) {
  return PostReport.aggregate([
    { $match: matchStage },
    {
      $group: {
        _id: "$post",
        reportCount: { $sum: 1 },
        pendingCount: { $sum: { $cond: [{ $eq: ["$status", "PENDING"] }, 1, 0] } },
        latestReportAt: { $max: "$createdAt" },
        reasonCodes: { $push: "$reasonCode" },
      },
    },
    { $sort: { latestReportAt: -1 } },
    { $skip: skip },
    { $limit: limit },
  ]);
}

export async function aggregateReportTotal(matchStage) {
  return PostReport.aggregate([
    { $match: matchStage },
    { $group: { _id: "$post" } },
    { $count: "total" },
  ]);
}

export async function findReportsByPost(postId) {
  return PostReport.find({ post: postId })
    .populate("reporter", "fullName email profilePic")
    .populate("reviewedBy", "fullName")
    .sort({ createdAt: -1 })
    .lean();
}

export async function findPostsByTitle(searchRegex) {
  return PropertyPost.find({ title: searchRegex }).select("_id").lean();
}

export async function findPostsByIds(postIds, select) {
  return PropertyPost.find({ _id: { $in: postIds } })
    .select(select)
    .populate("author", "fullName email")
    .lean();
}

// ── Feedback ───────────────────────────────────────────────────────────

export async function findFeedback(filter, { skip, limit }) {
  return Feedback.find(filter)
    .populate("reporter", "fullName email profilePic")
    .populate("resolvedBy", "fullName")
    .sort({ createdAt: -1 })
    .skip(skip)
    .limit(limit)
    .lean();
}

export async function countFeedback(filter) {
  return Feedback.countDocuments(filter);
}

export async function resolveFeedbackById(id, adminId) {
  return Feedback.findByIdAndUpdate(
    id,
    { $set: { status: "RESOLVED", resolvedAt: new Date(), resolvedBy: adminId } },
    { new: true }
  );
}

// ── Announcements ──────────────────────────────────────────────────────

export async function createAnnouncementRecord(data) {
  return Announcement.create(data);
}

export async function findAnnouncements({ skip, limit }) {
  return Announcement.find()
    .populate("sentBy", "fullName email")
    .sort({ createdAt: -1 })
    .skip(skip)
    .limit(limit)
    .lean();
}

export async function countAnnouncements() {
  return Announcement.countDocuments();
}

// ── Notifications ──────────────────────────────────────────────────────

export async function createNotification(data) {
  return Notification.create(data).catch(() => {});
}

// ── Property Verifications ─────────────────────────────────────────────

export async function findPropertyVerifications(queryFilter, { skip, limit }) {
  return PropertyPost.find(queryFilter)
    .select("title listingType propertyType postType price city locality mediaUrls postMeta author createdAt updatedAt")
    .populate("author", "fullName email mobileNumber profilePic activeRole primaryRole isVerified")
    .populate("postMeta.residential.electricityBillVerifiedBy", "fullName email profilePic")
    .sort({ updatedAt: -1, createdAt: -1 })
    .skip(skip)
    .limit(limit)
    .lean();
}

// ── Coin Transactions ──────────────────────────────────────────────────

export async function findCoinTransactions(filter, { skip, limit }) {
  const CoinTransaction = (await import("../../models/CoinTransaction.model.js")).default;
  return CoinTransaction.find(filter)
    .populate("user", "fullName email profilePic")
    .sort({ createdAt: -1 })
    .skip(skip)
    .limit(limit)
    .lean();
}

export async function countCoinTransactions(filter) {
  const CoinTransaction = (await import("../../models/CoinTransaction.model.js")).default;
  return CoinTransaction.countDocuments(filter);
}

export async function aggregateTotalCoinsGranted(filter) {
  const CoinTransaction = (await import("../../models/CoinTransaction.model.js")).default;
  return CoinTransaction.aggregate([
    { $match: filter },
    { $group: { _id: null, total: { $sum: "$amount" } } },
  ]);
}

// ── Cache ──────────────────────────────────────────────────────────────

export async function invalidateFeedCache() {
  try {
    const feedKeys = await redisClient.keys("property:feed:*");
    if (feedKeys.length > 0) {
      await redisClient.del(feedKeys);
      return feedKeys.length;
    }
    return 0;
  } catch (cacheError) {
    logger.warn("Redis feed cache invalidation error:", cacheError);
    return 0;
  }
}

export async function invalidatePostDetailCache(postId) {
  try {
    await redisClient.del(`post:${postId}:detail`);
    const keys = await redisClient.keys("property:feed:*");
    if (keys.length > 0) await redisClient.del(keys);
  } catch (e) {
    logger.warn("Cache invalidate error:", e);
  }
}
