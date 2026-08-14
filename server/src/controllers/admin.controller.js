import User from "../models/User.model.js";
import { logger } from "../utils/logger.js";
import { sendSuccessResponse, sendErrorResponse } from "../utils/responseHandler.js";

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
