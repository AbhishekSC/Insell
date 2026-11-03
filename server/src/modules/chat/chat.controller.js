import { logger } from "../../utils/logger.js";
import {
  sendErrorResponse,
  sendSuccessResponse,
} from "../../utils/responseHandler.js";
import * as chatService from "./chat.service.js";

export async function getStreamToken(req, res) {
  try {
    const userId = req.user?._id || req.user?.id;

    if (!userId) {
      return sendErrorResponse(res, 401, "Unauthorized: Invalid user context");
    }

    const token = await chatService.createStreamToken(userId);

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

    const result = await chatService.getPrioritizedConversations(currentUserId, { limit, page });

    return sendSuccessResponse(res, {
      conversations: result.conversations,
      total: result.total,
      page: result.page,
      limit: result.limit,
    });
  } catch (error) {
    logger.error("Error getting prioritized conversations:", error);
    return sendErrorResponse(res, "Failed to get conversations", 500);
  }
}
