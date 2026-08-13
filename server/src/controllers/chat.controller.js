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
    
    // Get current user with friends list
    const currentUser = await User.findById(currentUserId).select('friends').lean();
    const friendIds = currentUser?.friends?.map(id => String(id)) || [];
    
    // Get all users (in production, this would be actual conversations from Stream)
    // For now, we'll return a prioritized list of potential connections
    const allUsers = await User.find({
      _id: { $ne: currentUserId }
    })
      .select('fullName profilePic activeRole primaryRole city')
      .lean();
    
    // Calculate priority score for each user
    const prioritizedUsers = allUsers.map(user => {
      const userId = String(user._id);
      const isFriend = friendIds.includes(userId);
      const isVerified = ['Broker', 'Seller', 'Landlord'].includes(user.activeRole || user.primaryRole);
      
      let priorityScore = 0;
      let priorityLevel = 'normal';
      
      // Priority scoring
      if (isFriend && isVerified) {
        priorityScore = 100;
        priorityLevel = 'high';
      } else if (isFriend) {
        priorityScore = 70;
        priorityLevel = 'medium';
      } else if (isVerified) {
        priorityScore = 50;
        priorityLevel = 'medium';
      }
      
      return {
        ...user,
        priorityScore,
        priorityLevel,
        isFriend,
        isVerified
      };
    });
    
    // Sort by priority score
    const sortedUsers = prioritizedUsers.sort((a, b) => b.priorityScore - a.priorityScore);
    
    return sendSuccessResponse(res, {
      conversations: sortedUsers,
      total: sortedUsers.length
    });
  } catch (error) {
    logger.error("Error getting prioritized conversations:", error);
    return sendErrorResponse(res, "Failed to get conversations", 500);
  }
}
