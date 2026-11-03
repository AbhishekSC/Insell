import { BLOCK_REASON_CODES } from "../../models/PropertyPost.model.js";
import { logger } from "../../utils/logger.js";
import { getLiveUsersCountRedis } from "../../services/likeCache.service.js";
import { creditCoins, getOrCreateWallet } from "../../services/wallet.service.js";
import { pushRealtimeNotification } from "../../services/stream.service.js";
import * as NotificationService from "../../services/NotificationService.js";
import { NotificationChannel } from "../../services/NotificationService.js";
import { cloudinaryInstance, extractPublicIdFromUrl } from "../../config/cloudinary.js";
import * as repo from "./admin.repository.js";
import {
  VERIFIED_ROLES,
  LIVE_USERS_WINDOW_MINUTES,
  ANNOUNCEMENT_MAX_LENGTH,
  COIN_AMOUNT_MAX,
} from "./admin.constants.js";
import {
  toGroupedReportDTO,
  toVerificationCountsDTO,
} from "./admin.dto.js";

// ── Pagination helper ──────────────────────────────────────────────────

export function parsePagination(query) {
  const page = Math.max(1, Number.parseInt(query.page, 10) || 1);
  const limit = Math.min(50, Math.max(1, Number.parseInt(query.limit, 10) || 20));
  const skip = (page - 1) * limit;
  return { page, limit, skip };
}

function escapeRegex(str) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

// ── Users ──────────────────────────────────────────────────────────────

export async function listUsers(query) {
  const { page, limit, skip } = parsePagination(query);
  const search = String(query.search || "").trim();
  const status = String(query.status || "all");
  const role = String(query.role || "").trim();

  const conditions = [];

  if (search) {
    const searchRegex = new RegExp(escapeRegex(search), "i");
    conditions.push({ $or: [{ fullName: searchRegex }, { email: searchRegex }, { mobileNumber: searchRegex }] });
  }

  if (status === "blocked") {
    conditions.push({ isBlocked: true });
  } else if (status === "active") {
    conditions.push({ isBlocked: { $ne: true } });
  }

  if (role) {
    conditions.push({ $or: [{ primaryRole: role }, { activeRole: role }] });
  }

  const filter = conditions.length > 0 ? { $and: conditions } : {};

  const [users, total] = await Promise.all([
    repo.findUsers(filter, { skip, limit }),
    repo.countUsers(filter),
  ]);

  return { users, pagination: { page, limit, total } };
}

export async function toggleUserBlock({ targetUserId, adminId }) {
  if (String(targetUserId) === String(adminId)) {
    return { error: { status: 400, message: "You cannot block your own account" } };
  }

  const targetUser = await repo.findUserById(targetUserId, "isBlocked isAdmin fullName");
  if (!targetUser) {
    return { error: { status: 404, message: "User not found" } };
  }

  if (targetUser.isAdmin) {
    return { error: { status: 400, message: "Admin accounts cannot be blocked" } };
  }

  targetUser.isBlocked = !targetUser.isBlocked;
  targetUser.blockedAt = targetUser.isBlocked ? new Date() : null;
  await targetUser.save();

  logger.info(`User ${targetUserId} ${targetUser.isBlocked ? "blocked" : "unblocked"} by admin ${adminId}`);

  return { user: targetUser };
}

// ── Posts ───────────────────────────────────────────────────────────────

export async function listPosts(query) {
  const { page, limit, skip } = parsePagination(query);
  const search = String(query.search || "").trim();
  const status = String(query.status || "all");

  const conditions = [{ isDeleted: { $ne: true } }];

  if (search) {
    const searchRegex = new RegExp(escapeRegex(search), "i");
    conditions.push({ $or: [{ title: searchRegex }, { city: searchRegex }, { locality: searchRegex }] });
  }

  if (status === "blocked") {
    conditions.push({ isBlocked: true });
  } else if (status === "active") {
    conditions.push({ isBlocked: { $ne: true } });
  }

  const filter = { $and: conditions };

  const [posts, total] = await Promise.all([
    repo.findPosts(filter, { skip, limit }),
    repo.countPosts(filter),
  ]);

  return { posts, pagination: { page, limit, total } };
}

export async function blockPost({ postId, adminId, reasonCode, note }) {
  if (!BLOCK_REASON_CODES.includes(reasonCode)) {
    return { error: { status: 400, message: "A valid reason is required" } };
  }

  const post = await repo.findPostById(postId, "title author isDeleted isBlocked");
  if (!post || post.isDeleted) {
    return { error: { status: 404, message: "Post not found" } };
  }

  if (post.isBlocked) {
    return { error: { status: 400, message: "Post is already blocked" } };
  }

  post.isBlocked = true;
  post.blockedAt = new Date();
  post.blockedBy = adminId;
  post.blockReasonCode = reasonCode;
  post.blockNote = String(note || "").trim().slice(0, 1000);
  await post.save();

  const pendingReports = await repo.findPendingReportsByPost(postId);
  await repo.resolveReportsByPost(postId, adminId);

  logger.info(`Post ${postId} blocked by admin ${adminId} (reason: ${reasonCode})`);

  // Notify the post owner
  try {
    await NotificationService.send({
      recipientId: post.author,
      actorId: adminId,
      type: "post_blocked",
      realtimeEventType: "post_moderation_notice",
      title: "Post blocked",
      message: `Your post "${post.title}" was blocked by our moderation team`,
      data: { propertyPost: post._id, actualMessage: post.blockNote || undefined },
      channels: [NotificationChannel.IN_APP, NotificationChannel.REALTIME, NotificationChannel.FIREBASE],
    });
  } catch (error) {
    logger.error("Failed to notify user of post block (non-fatal):", { message: error.message });
  }

  // Notify reporters
  try {
    await Promise.allSettled(
      pendingReports.map((report) =>
        NotificationService.send({
          recipientId: report.reporter,
          type: "post_report_resolved",
          realtimeEventType: "post_moderation_notice",
          title: "Report resolved",
          message: `The post you reported ("${post.title}") was blocked by our moderation team. Thanks for the report.`,
          data: { propertyPost: post._id },
          channels: [NotificationChannel.IN_APP, NotificationChannel.REALTIME, NotificationChannel.FIREBASE],
        })
      )
    );
  } catch (error) {
    logger.error("Failed to notify reporters of post block (non-fatal):", { message: error.message });
  }

  // Invalidate feed cache
  const invalidated = await repo.invalidateFeedCache();
  if (invalidated > 0) {
    logger.info(`Invalidated ${invalidated} property feed cache entries after post ${postId} blocked`);
  }

  return { post };
}

export async function unblockPost({ postId, adminId }) {
  const post = await repo.findPostById(postId, "title author isDeleted isBlocked");
  if (!post || post.isDeleted) {
    return { error: { status: 404, message: "Post not found" } };
  }

  if (!post.isBlocked) {
    return { error: { status: 400, message: "Post is not blocked" } };
  }

  post.isBlocked = false;
  post.blockedAt = null;
  post.blockedBy = null;
  post.blockReasonCode = null;
  post.blockNote = "";
  await post.save();

  logger.info(`Post ${postId} unblocked by admin ${adminId}`);

  try {
    await NotificationService.send({
      recipientId: post.author,
      actorId: adminId,
      type: "post_unblocked",
      realtimeEventType: "post_moderation_notice",
      title: "Post restored",
      message: `Your post "${post.title}" is visible again`,
      data: { propertyPost: post._id },
      channels: [NotificationChannel.IN_APP, NotificationChannel.REALTIME, NotificationChannel.FIREBASE],
    });
  } catch (error) {
    logger.error("Failed to notify user of post unblock (non-fatal):", { message: error.message });
  }

  const invalidated = await repo.invalidateFeedCache();
  if (invalidated > 0) {
    logger.info(`Invalidated ${invalidated} property feed cache entries after post ${postId} unblocked`);
  }

  return { post };
}

// ── Reports ────────────────────────────────────────────────────────────

export async function listReports(query) {
  const { page, limit, skip } = parsePagination(query);
  const search = String(query.search || "").trim();
  const status = String(query.status || "pending");

  const matchStage = {};
  if (status === "pending") {
    matchStage.status = "PENDING";
  } else if (status === "reviewed") {
    matchStage.status = { $in: ["DISMISSED", "ACTION_TAKEN"] };
  }

  if (search) {
    const searchRegex = new RegExp(escapeRegex(search), "i");
    const matchingPosts = await repo.findPostsByTitle(searchRegex);
    matchStage.post = { $in: matchingPosts.map((p) => p._id) };
  }

  const [grouped, totalAgg] = await Promise.all([
    repo.aggregateGroupedReports(matchStage, { skip, limit }),
    repo.aggregateReportTotal(matchStage),
  ]);

  const postIds = grouped.map((g) => g._id);
  const posts = await repo.findPostsByIds(
    postIds,
    "title price city mediaUrls author isBlocked isDeleted"
  );
  const postMap = new Map(posts.map((p) => [String(p._id), p]));

  const reports = grouped
    .map((g) => toGroupedReportDTO(g, postMap))
    .filter((entry) => entry.post);

  const total = totalAgg[0]?.total || 0;

  return { reports, pagination: { page, limit, total } };
}

export async function getReportDetail(postId) {
  const post = await repo.findPostByIdPopulated(postId);
  if (!post) {
    return { error: { status: 404, message: "Post not found" } };
  }

  const reports = await repo.findReportsByPost(postId);
  return { post, reports };
}

export async function dismissPostReports({ postId, adminId }) {
  const result = await repo.dismissReportsByPost(postId, adminId);
  if (result.matchedCount === 0) {
    return { error: { status: 400, message: "No pending reports for this post" } };
  }

  logger.info(`Reports for post ${postId} dismissed by admin ${adminId}`);
  return { success: true };
}

// ── Feedback ───────────────────────────────────────────────────────────

export async function listFeedback(query) {
  const { page, limit, skip } = parsePagination(query);
  const status = String(query.status || "all");

  const filter = {};
  if (status === "OPEN" || status === "RESOLVED") {
    filter.status = status;
  }

  const [items, total] = await Promise.all([
    repo.findFeedback(filter, { skip, limit }),
    repo.countFeedback(filter),
  ]);

  return { items, pagination: { page, limit, total } };
}

export async function resolveFeedback({ id, adminId }) {
  const feedback = await repo.resolveFeedbackById(id, adminId);
  if (!feedback) {
    return { error: { status: 404, message: "Feedback not found" } };
  }
  return { feedback };
}

// ── Announcements ──────────────────────────────────────────────────────

export async function createAnnouncement({ message, role, city, verifiedOnly, image, adminId }) {
  if (!message) {
    return { error: { status: 400, message: "Message is required" } };
  }
  if (message.length > ANNOUNCEMENT_MAX_LENGTH) {
    return { error: { status: 400, message: "Message must be 240 characters or fewer" } };
  }

  const conditions = { isBlocked: { $ne: true } };
  if (role) conditions.activeRole = role;
  if (city) conditions.city = new RegExp(`^${escapeRegex(city)}$`, "i");
  if (verifiedOnly) conditions.activeRole = { $in: VERIFIED_ROLES };

  const recipientIds = await repo.findRecipientIds(conditions);

  if (recipientIds.length === 0) {
    return { error: { status: 400, message: "No users match this segment" } };
  }

  const announcement = await repo.createAnnouncementRecord({
    message,
    image: image || undefined,
    segment: { role, city, verifiedOnly },
    sentBy: adminId,
    recipientCount: recipientIds.length,
  });

  const now = new Date();
  const { enqueueBroadcast } = await import("../../jobs/producers/fanout.producer.js");
  enqueueBroadcast({
    recipientIds: recipientIds.map(String),
    notification: {
      actor: adminId,
      type: "admin_announcement",
      message,
      image: image || undefined,
      createdAt: now,
      updatedAt: now,
    },
    realtimeEvent: "admin_announcement",
  }).catch((err) => logger.warn("Failed to enqueue broadcast (non-fatal):", err?.message));

  logger.info(`Announcement sent by admin ${adminId} to ${recipientIds.length} users`);

  return { announcement };
}

export async function listAnnouncements(query) {
  const { page, limit, skip } = parsePagination(query);

  const [announcements, total] = await Promise.all([
    repo.findAnnouncements({ skip, limit }),
    repo.countAnnouncements(),
  ]);

  return { announcements, pagination: { page, limit, total } };
}

// ── Live Users ─────────────────────────────────────────────────────────

export async function getLiveUsersCount() {
  const redisCount = await getLiveUsersCountRedis(LIVE_USERS_WINDOW_MINUTES);
  if (typeof redisCount === "number" && redisCount > 0) {
    return redisCount;
  }

  const cutoff = new Date(Date.now() - LIVE_USERS_WINDOW_MINUTES * 60 * 1000);
  return repo.countLiveUsers(cutoff);
}

// ── Coins / Wallet ─────────────────────────────────────────────────────

export async function adminCreditCoins({ userId, amount, reason, adminId, adminEmail }) {
  const coinAmount = Math.floor(Number(amount) || 0);
  if (coinAmount <= 0 || coinAmount > COIN_AMOUNT_MAX) {
    return { error: { status: 400, message: "Amount must be between 1 and 10,000 coins" } };
  }

  const targetUser = await repo.findUserById(userId, "fullName email");
  if (!targetUser) {
    return { error: { status: 404, message: "User not found" } };
  }

  const description = reason
    ? `Admin bonus: ${reason}`
    : `Bonus coins from admin`;

  const result = await creditCoins({
    userId,
    amount: coinAmount,
    category: "ADMIN_ADJUSTMENT",
    description,
    metadata: { grantedBy: adminId, reason: reason || "" },
  });

  logger.info(`Admin ${adminEmail} credited ${coinAmount} coins to ${targetUser.email} (${userId})`);

  const notifMessage = reason
    ? `🎉 You received ${coinAmount} bonus coins — ${reason}`
    : `🎉 ${coinAmount} bonus coins have been credited to your wallet!`;

  await repo.createNotification({
    recipient: userId,
    actor: adminId,
    type: "admin_announcement",
    message: notifMessage,
  });

  pushRealtimeNotification(userId, "admin_announcement").catch(() => {});

  return { userId, coinAmount, wallet: result.wallet, fullName: targetUser.fullName };
}

export async function getAdminUserWallet(userId) {
  const targetUser = await repo.findUserById(userId, "fullName email");
  if (!targetUser) {
    return { error: { status: 404, message: "User not found" } };
  }

  const wallet = await getOrCreateWallet(userId);
  return { wallet };
}

export async function getCoinHistory(query) {
  const { page, limit, skip } = parsePagination(query);
  const filter = { category: "ADMIN_ADJUSTMENT" };

  const [transactions, total, totalCoinsGranted] = await Promise.all([
    repo.findCoinTransactions(filter, { skip, limit }),
    repo.countCoinTransactions(filter),
    repo.aggregateTotalCoinsGranted(filter),
  ]);

  return {
    transactions,
    totalCoinsGranted: totalCoinsGranted[0]?.total || 0,
    pagination: { page, limit, total },
  };
}

// ── Property Verifications ─────────────────────────────────────────────

function buildBillBaseFilter() {
  return {
    isDeleted: { $ne: true },
    $or: [
      { "postMeta.residential.electricityBillUrl": { $exists: true, $ne: "" } },
      { "postMeta.electricityBillUrl": { $exists: true, $ne: "" } },
    ],
  };
}

function buildVerificationStatusCondition(status) {
  if (status === "PENDING") {
    return {
      $or: [
        { "postMeta.residential.electricityBillStatus": "PENDING" },
        { "postMeta.residential.electricityBillStatus": { $exists: false } },
        { "postMeta.residential.electricityBillStatus": null },
        { "postMeta.residential.electricityBillStatus": "" },
      ],
    };
  } else if (status === "VERIFIED") {
    return {
      $or: [
        { "postMeta.residential.electricityBillStatus": "VERIFIED" },
        { "postMeta.electricityBillStatus": "VERIFIED" },
      ],
    };
  } else if (status === "REJECTED") {
    return {
      $or: [
        { "postMeta.residential.electricityBillStatus": "REJECTED" },
        { "postMeta.electricityBillStatus": "REJECTED" },
      ],
    };
  }
  return {};
}

export async function listPropertyVerifications(query) {
  const { page, limit, skip } = parsePagination(query);
  const status = String(query.status || "PENDING").toUpperCase();

  const billBaseFilter = buildBillBaseFilter();
  const statusCondition = status !== "ALL" ? buildVerificationStatusCondition(status) : {};
  const queryFilter = { ...billBaseFilter, ...statusCondition };

  const [posts, total, pendingCount, verifiedCount, rejectedCount] = await Promise.all([
    repo.findPropertyVerifications(queryFilter, { skip, limit }),
    repo.countPosts(queryFilter),
    repo.countPosts({ ...billBaseFilter, ...buildVerificationStatusCondition("PENDING") }),
    repo.countPosts({ ...billBaseFilter, ...buildVerificationStatusCondition("VERIFIED") }),
    repo.countPosts({ ...billBaseFilter, ...buildVerificationStatusCondition("REJECTED") }),
  ]);

  return {
    posts,
    counts: toVerificationCountsDTO({ pendingCount, verifiedCount, rejectedCount }),
    pagination: { page, limit, total },
  };
}

export async function reviewPropertyVerification({ postId, status, rejectionReason, verificationNote, adminId }) {
  if (!["VERIFIED", "REJECTED"].includes(status)) {
    return { error: { status: 400, message: "Status must be VERIFIED or REJECTED" } };
  }

  const post = await repo.findPostById(postId);
  if (!post || post.isDeleted) {
    return { error: { status: 404, message: "Property post not found" } };
  }

  if (!post.postMeta) post.postMeta = {};
  if (!post.postMeta.residential) post.postMeta.residential = {};

  post.postMeta.residential.electricityBillStatus = status;
  post.postMeta.residential.electricityBillVerifiedAt = new Date();
  post.postMeta.residential.electricityBillVerifiedBy = adminId;
  if (status === "REJECTED") {
    post.postMeta.residential.electricityBillRejectionReason = String(rejectionReason || "").trim();
    post.postMeta.residential.electricityBillVerificationNote = "";
  } else if (status === "VERIFIED") {
    post.postMeta.residential.electricityBillVerificationNote = String(verificationNote || "").trim();
    post.postMeta.residential.electricityBillRejectionReason = "";
  }

  // Backward-compat flat mirror
  post.postMeta.electricityBillStatus = status;

  post.markModified("postMeta");
  await post.save();

  await repo.invalidatePostDetailCache(postId);

  return { post };
}

// ── Bill Download ──────────────────────────────────────────────────────

export async function getPropertyBillDownloadUrl(postId) {
  const post = await repo.findPostById(postId, "postMeta title");
  if (!post) {
    return { error: { status: 404, message: "Property post not found" } };
  }

  const billUrl = post.postMeta?.residential?.electricityBillUrl || post.postMeta?.electricityBillUrl;
  if (!billUrl) {
    return { error: { status: 404, message: "No bill found for this property" } };
  }

  if (billUrl.includes("res.cloudinary.com")) {
    const publicId = extractPublicIdFromUrl(billUrl);
    const isPdf = /\.pdf$/i.test(billUrl);
    const format = isPdf ? "pdf" : (billUrl.split(".").pop() || "jpg");

    const signedDownloadUrl = cloudinaryInstance.utils.private_download_url(publicId, format, {
      resource_type: "image",
      type: "upload",
    });

    return { redirectUrl: signedDownloadUrl };
  }

  return { redirectUrl: billUrl };
}
