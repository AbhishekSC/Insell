import User from "../models/User.model.js";
import PropertyPost, { BLOCK_REASON_CODES } from "../models/PropertyPost.model.js";
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
