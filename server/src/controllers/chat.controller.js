import { generateStreamToken } from "../services/stream.service.js";
import { logger } from "../utils/logger.js";
import {
  sendErrorResponse,
  sendSuccessResponse,
} from "../utils/responseHandler.js";
import User from "../models/User.model.js";

export async function getStreamToken(req, res) {
  try {
    const userId = req.user?._id || req.user?.id;

    if (!userId) {
      return sendErrorResponse(res, 401, "Unauthorized: Invalid user context");
    }

    const token = await generateStreamToken(userId.toString());

    return sendSuccessResponse(res, 200, "Stream token generated successfully", {
      token,
    });
  } catch (error) {
    logger.error("Error generating stream token:", error);
    return sendErrorResponse(
      res,
      500,
      "Internal server error",
      { error: error.message },
      error
    );
  }
}

/**
 * Get prioritized conversations
 * Highlights conversations with verified users and friends
 */
export async function getPrioritizedConversations(req, res) {
  try {
    const currentUserId = req.user._id;
    const limit = Math.min(parseInt(req.query.limit) || 50, 100);
    const page = Math.max(parseInt(req.query.page) || 1, 1);
    const skip = (page - 1) * limit;

    const currentUser = await User.findById(currentUserId).select("friends").lean();
    const friendIds = currentUser?.friends || [];

    const verifiedRoles = ["Broker", "Seller", "Landlord"];

    let friendAndVerified = [];
    let friendOnly = [];
    let verifiedNonFriend = [];

    if (friendIds.length) {
      const [facetResult] = await User.aggregate([
        {
          $match: {
            _id: { $in: friendIds, $ne: currentUserId },
          },
        },
        { $project: { fullName: 1, profilePic: 1, activeRole: 1, primaryRole: 1, city: 1 } },
        {
          $facet: {
            friendAndVerified: [
              { $match: { $or: [{ activeRole: { $in: verifiedRoles } }, { primaryRole: { $in: verifiedRoles } }] } },
            ],
            friendOnly: [
              { $match: { activeRole: { $nin: verifiedRoles }, primaryRole: { $nin: verifiedRoles } } },
            ],
          },
        },
      ]);
      friendAndVerified = facetResult?.friendAndVerified || [];
      friendOnly = facetResult?.friendOnly || [];
    }

    const seenIds = [
      ...friendAndVerified.map((u) => u._id),
      ...friendOnly.map((u) => u._id),
      currentUserId,
    ];

    verifiedNonFriend = await User.find({
      _id: { $nin: seenIds },
      $or: [{ activeRole: { $in: verifiedRoles } }, { primaryRole: { $in: verifiedRoles } }],
    })
      .select("fullName profilePic activeRole primaryRole city")
      .limit(limit)
      .lean();

    const tag = (users, score, level, isFriend, isVerified) =>
      users.map((u) => ({ ...u, priorityScore: score, priorityLevel: level, isFriend, isVerified }));

    const sorted = [
      ...tag(friendAndVerified, 100, "high", true, true),
      ...tag(friendOnly, 70, "medium", true, false),
      ...tag(verifiedNonFriend, 50, "medium", false, true),
    ];

    const paged = sorted.slice(skip, skip + limit);

    return sendSuccessResponse(res, {
      conversations: paged,
      total: sorted.length,
      page,
      limit,
    });
  } catch (error) {
    logger.error("Error getting prioritized conversations:", error);
    return sendErrorResponse(res, "Failed to get conversations", 500);
  }
}
