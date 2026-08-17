import User from "../models/User.model.js";
import PropertyPost, { BLOCK_REASON_CODES } from "../models/PropertyPost.model.js";
import PostReport from "../models/PostReport.model.js";
import Notification from "../models/Notification.model.js";
import { logger } from "../utils/logger.js";
import { sendSuccessResponse, sendErrorResponse } from "../utils/responseHandler.js";

const ADMIN_POST_FIELDS =
  "title price city listingType propertyType mediaUrls author status isDeleted isBlocked blockedAt blockedBy blockReasonCode blockNote createdAt";

const ADMIN_USER_FIELDS =
  "fullName email mobileNumber city location primaryRole activeRole isVerified isAdmin isBlocked blockedAt createdAt profilePic";

// List platform users for the admin dashboard — search, filter, paginate,
// newest accounts first.
export const getAdminUsers = async (req, res) => {
  try {
    const page = Math.max(1, Number.parseInt(req.query.page, 10) || 1);
    const limit = Math.min(50, Math.max(1, Number.parseInt(req.query.limit, 10) || 20));
    const skip = (page - 1) * limit;
    const search = String(req.query.search || "").trim();
    const status = String(req.query.status || "all"); // all | blocked | active
    const role = String(req.query.role || "").trim();

    const conditions = [];

    if (search) {
      const searchRegex = new RegExp(search.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i");
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

    const query = conditions.length > 0 ? { $and: conditions } : {};

    const [users, total] = await Promise.all([
      User.find(query).select(ADMIN_USER_FIELDS).sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
      User.countDocuments(query),
    ]);

    return sendSuccessResponse(res, 200, "Users fetched successfully", {
      users,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.max(1, Math.ceil(total / limit)),
      },
    });
  } catch (error) {
    logger.error("Error fetching admin user list:", error);
    return sendErrorResponse(res, 500, "Internal Server Error");
  }
};

// Toggle a user's platform-wide block status.
export const toggleUserBlock = async (req, res) => {
  try {
    const { id: targetUserId } = req.params;
    const adminId = req.user._id;

    if (String(targetUserId) === String(adminId)) {
      return sendErrorResponse(res, 400, "You cannot block your own account");
    }

    const targetUser = await User.findById(targetUserId).select("isBlocked isAdmin fullName");

    if (!targetUser) {
      return sendErrorResponse(res, 404, "User not found");
    }

    if (targetUser.isAdmin) {
      return sendErrorResponse(res, 400, "Admin accounts cannot be blocked");
    }

    targetUser.isBlocked = !targetUser.isBlocked;
    targetUser.blockedAt = targetUser.isBlocked ? new Date() : null;
    await targetUser.save();

    logger.info(`User ${targetUserId} ${targetUser.isBlocked ? "blocked" : "unblocked"} by admin ${adminId}`);

    return sendSuccessResponse(res, 200, `User ${targetUser.isBlocked ? "blocked" : "unblocked"} successfully`, {
      userId: targetUser._id,
      isBlocked: targetUser.isBlocked,
      blockedAt: targetUser.blockedAt,
    });
  } catch (error) {
    logger.error("Error toggling user block status:", error);
    return sendErrorResponse(res, 500, "Internal Server Error");
  }
};

// List marketplace posts for the admin moderation dashboard — search,
// filter by moderation status, paginate, newest first. Deleted posts are
// excluded entirely; that's a separate, already-final state.
export const getAdminPosts = async (req, res) => {
  try {
    const page = Math.max(1, Number.parseInt(req.query.page, 10) || 1);
    const limit = Math.min(50, Math.max(1, Number.parseInt(req.query.limit, 10) || 20));
    const skip = (page - 1) * limit;
    const search = String(req.query.search || "").trim();
    const status = String(req.query.status || "all"); // all | blocked | active

    const conditions = [{ isDeleted: { $ne: true } }];

    if (search) {
      const searchRegex = new RegExp(search.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i");
      conditions.push({ $or: [{ title: searchRegex }, { city: searchRegex }, { locality: searchRegex }] });
    }

    if (status === "blocked") {
      conditions.push({ isBlocked: true });
    } else if (status === "active") {
      conditions.push({ isBlocked: { $ne: true } });
    }

    const query = { $and: conditions };

    const [posts, total] = await Promise.all([
      PropertyPost.find(query)
        .select(ADMIN_POST_FIELDS)
        .populate("author", "fullName email profilePic")
        .populate("blockedBy", "fullName")
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      PropertyPost.countDocuments(query),
    ]);

    return sendSuccessResponse(res, 200, "Posts fetched successfully", {
      posts,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.max(1, Math.ceil(total / limit)),
      },
    });
  } catch (error) {
    logger.error("Error fetching admin post list:", error);
    return sendErrorResponse(res, 500, "Internal Server Error");
  }
};

// Block a post: hides it from every public read path (see the isBlocked
// filters added to propertyPost.controller.js) without deleting it — the
// owner can still see it on their own profile, badged as blocked, with the
// reason. Notifies the owner.
export const blockPost = async (req, res) => {
  try {
    const { id: postId } = req.params;
    const adminId = req.user._id;
    const { reasonCode, note } = req.body || {};

    if (!BLOCK_REASON_CODES.includes(reasonCode)) {
      return sendErrorResponse(res, 400, "A valid reason is required");
    }

    const post = await PropertyPost.findById(postId).select("title author isDeleted isBlocked");
    if (!post || post.isDeleted) {
      return sendErrorResponse(res, 404, "Post not found");
    }

    if (post.isBlocked) {
      return sendErrorResponse(res, 400, "Post is already blocked");
    }

    post.isBlocked = true;
    post.blockedAt = new Date();
    post.blockedBy = adminId;
    post.blockReasonCode = reasonCode;
    post.blockNote = String(note || "").trim().slice(0, 1000);
    await post.save();

    const pendingReports = await PostReport.find({ post: postId, status: "PENDING" }).select("reporter").lean();

    await PostReport.updateMany(
      { post: postId, status: "PENDING" },
      { $set: { status: "ACTION_TAKEN", reviewedAt: new Date(), reviewedBy: adminId } }
    );

    logger.info(`Post ${postId} blocked by admin ${adminId} (reason: ${reasonCode})`);

    try {
      await Notification.create({
        recipient: post.author,
        actor: adminId,
        type: "post_blocked",
        message: `Your post "${post.title}" was blocked by our moderation team`,
        actualMessage: post.blockNote || undefined,
        propertyPost: post._id,
      });
    } catch (error) {
      logger.error("Failed to notify user of post block (non-fatal):", { message: error.message });
    }

    // Let everyone who reported this post know it was acted on — closes the
    // loop without naming the other reporters or the owner to each other.
    try {
      await Notification.insertMany(
        pendingReports.map((report) => ({
          recipient: report.reporter,
          type: "post_report_resolved",
          message: `The post you reported ("${post.title}") was blocked by our moderation team. Thanks for the report.`,
          propertyPost: post._id,
        }))
      );
    } catch (error) {
      logger.error("Failed to notify reporters of post block (non-fatal):", { message: error.message });
    }

    return sendSuccessResponse(res, 200, "Post blocked successfully", {
      postId: post._id,
      isBlocked: post.isBlocked,
      blockedAt: post.blockedAt,
      blockReasonCode: post.blockReasonCode,
      blockNote: post.blockNote,
    });
  } catch (error) {
    logger.error("Error blocking post:", error);
    return sendErrorResponse(res, 500, "Internal Server Error");
  }
};

// Unblock a post, restoring it to every public read path. Clears the block
// fields rather than keeping the last reason around as if it still applied.
export const unblockPost = async (req, res) => {
  try {
    const { id: postId } = req.params;
    const adminId = req.user._id;

    const post = await PropertyPost.findById(postId).select("title author isDeleted isBlocked");
    if (!post || post.isDeleted) {
      return sendErrorResponse(res, 404, "Post not found");
    }

    if (!post.isBlocked) {
      return sendErrorResponse(res, 400, "Post is not blocked");
    }

    post.isBlocked = false;
    post.blockedAt = null;
    post.blockedBy = null;
    post.blockReasonCode = null;
    post.blockNote = "";
    await post.save();

    logger.info(`Post ${postId} unblocked by admin ${adminId}`);

    try {
      await Notification.create({
        recipient: post.author,
        actor: adminId,
        type: "post_unblocked",
        message: `Your post "${post.title}" is visible again`,
        propertyPost: post._id,
      });
    } catch (error) {
      logger.error("Failed to notify user of post unblock (non-fatal):", { message: error.message });
    }

    return sendSuccessResponse(res, 200, "Post unblocked successfully", {
      postId: post._id,
      isBlocked: post.isBlocked,
    });
  } catch (error) {
    logger.error("Error unblocking post:", error);
    return sendErrorResponse(res, 500, "Internal Server Error");
  }
};

// List reported posts for the moderation dashboard, grouped by post — a post
// with 5 reports shows as one row, not five. Reporting a post never blocks it
// automatically; the admin reviews and decides (see dismissPostReports/blockPost).
export const getAdminReports = async (req, res) => {
  try {
    const page = Math.max(1, Number.parseInt(req.query.page, 10) || 1);
    const limit = Math.min(50, Math.max(1, Number.parseInt(req.query.limit, 10) || 20));
    const skip = (page - 1) * limit;
    const search = String(req.query.search || "").trim();
    const status = String(req.query.status || "pending"); // pending | reviewed | all

    const matchStage = {};
    if (status === "pending") {
      matchStage.status = "PENDING";
    } else if (status === "reviewed") {
      matchStage.status = { $in: ["DISMISSED", "ACTION_TAKEN"] };
    }

    if (search) {
      const searchRegex = new RegExp(search.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i");
      const matchingPosts = await PropertyPost.find({ title: searchRegex }).select("_id").lean();
      matchStage.post = { $in: matchingPosts.map((p) => p._id) };
    }

    const [grouped, totalAgg] = await Promise.all([
      PostReport.aggregate([
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
      ]),
      PostReport.aggregate([{ $match: matchStage }, { $group: { _id: "$post" } }, { $count: "total" }]),
    ]);

    const postIds = grouped.map((g) => g._id);
    const posts = await PropertyPost.find({ _id: { $in: postIds } })
      .select("title price city mediaUrls author isBlocked isDeleted")
      .populate("author", "fullName email")
      .lean();
    const postMap = new Map(posts.map((p) => [String(p._id), p]));

    const reports = grouped
      .map((g) => {
        const counts = {};
        g.reasonCodes.forEach((code) => {
          counts[code] = (counts[code] || 0) + 1;
        });
        const topReason = Object.entries(counts).sort((a, b) => b[1] - a[1])[0]?.[0] || null;

        return {
          postId: g._id,
          post: postMap.get(String(g._id)) || null,
          reportCount: g.reportCount,
          pendingCount: g.pendingCount,
          topReason,
          latestReportAt: g.latestReportAt,
        };
      })
      .filter((entry) => entry.post);

    const total = totalAgg[0]?.total || 0;

    return sendSuccessResponse(res, 200, "Reports fetched successfully", {
      reports,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.max(1, Math.ceil(total / limit)),
      },
    });
  } catch (error) {
    logger.error("Error fetching admin reports:", error);
    return sendErrorResponse(res, 500, "Internal Server Error");
  }
};

// Detail view for a single reported post — the post plus every individual
// report against it, so the admin has full context before acting.
export const getAdminReportDetail = async (req, res) => {
  try {
    const { postId } = req.params;

    const post = await PropertyPost.findById(postId)
      .select(ADMIN_POST_FIELDS)
      .populate("author", "fullName email profilePic")
      .populate("blockedBy", "fullName")
      .lean();

    if (!post) {
      return sendErrorResponse(res, 404, "Post not found");
    }

    const reports = await PostReport.find({ post: postId })
      .populate("reporter", "fullName email profilePic")
      .populate("reviewedBy", "fullName")
      .sort({ createdAt: -1 })
      .lean();

    return sendSuccessResponse(res, 200, "Report detail fetched successfully", { post, reports });
  } catch (error) {
    logger.error("Error fetching report detail:", error);
    return sendErrorResponse(res, 500, "Internal Server Error");
  }
};

// Dismiss every pending report against a post — the admin reviewed and found
// no violation, so the post stays exactly as it is.
export const dismissPostReports = async (req, res) => {
  try {
    const { postId } = req.params;
    const adminId = req.user._id;

    const result = await PostReport.updateMany(
      { post: postId, status: "PENDING" },
      { $set: { status: "DISMISSED", reviewedAt: new Date(), reviewedBy: adminId } }
    );

    if (result.matchedCount === 0) {
      return sendErrorResponse(res, 400, "No pending reports for this post");
    }

    logger.info(`Reports for post ${postId} dismissed by admin ${adminId}`);

    return sendSuccessResponse(res, 200, "Reports dismissed successfully");
  } catch (error) {
    logger.error("Error dismissing reports:", error);
    return sendErrorResponse(res, 500, "Internal Server Error");
  }
};
