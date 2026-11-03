import { sendErrorResponse, sendSuccessResponse } from "../../utils/responseHandler.js";
import { logger } from "../../utils/logger.js";
import * as commentService from "./comment.service.js";

export async function createComment(req, res) {
  try {
    const { postId } = req.params;
    const { content, parentCommentId } = req.body;
    const userId = req.user?._id;

    if (!userId) {
      return sendErrorResponse(res, 401, "Unauthorized");
    }

    if (!content || content.trim().length === 0) {
      return sendErrorResponse(res, 400, "Comment content is required");
    }

    const result = await commentService.createComment({
      postId,
      content,
      parentCommentId,
      userId,
      userFullName: req.user.fullName,
    });

    if (result.error) {
      return sendErrorResponse(res, result.error.status, result.error.message);
    }

    return sendSuccessResponse(res, 201, "Comment created successfully", result.data);
  } catch (error) {
    logger.error("Error creating comment:", error);
    return sendErrorResponse(res, 500, "Failed to create comment");
  }
}

export async function getPostComments(req, res) {
  try {
    const { postId } = req.params;
    const page = Math.max(1, Number.parseInt(req.query.page, 10) || 1);
    const limit = Math.min(50, Math.max(1, Number.parseInt(req.query.limit, 10) || 20));

    const result = await commentService.getPostComments({ postId, page, limit });

    if (result.error) {
      return sendErrorResponse(res, result.error.status, result.error.message);
    }

    return sendSuccessResponse(res, 200, "Comments fetched successfully", result.data);
  } catch (error) {
    logger.error("Error fetching comments:", error);
    return sendErrorResponse(res, 500, "Failed to fetch comments");
  }
}

export async function deleteComment(req, res) {
  try {
    const { commentId } = req.params;
    const userId = req.user?._id;

    if (!userId) {
      return sendErrorResponse(res, 401, "Unauthorized");
    }

    const result = await commentService.deleteComment({ commentId, userId });

    if (result.error) {
      return sendErrorResponse(res, result.error.status, result.error.message);
    }

    return sendSuccessResponse(res, 200, "Comment deleted successfully");
  } catch (error) {
    logger.error("Error deleting comment:", error);
    return sendErrorResponse(res, 500, "Failed to delete comment");
  }
}

export async function likeComment(req, res) {
  try {
    const { commentId } = req.params;
    const userId = req.user?._id;

    if (!userId) {
      return sendErrorResponse(res, 401, "Unauthorized");
    }

    const result = await commentService.likeComment({ commentId, userId });

    if (result.error) {
      return sendErrorResponse(res, result.error.status, result.error.message);
    }

    return sendSuccessResponse(res, 200, "Comment like status updated", result.data);
  } catch (error) {
    logger.error("Error toggling comment like:", error);
    return sendErrorResponse(res, 500, "Failed to toggle comment like");
  }
}

export async function getCommentReplies(req, res) {
  try {
    const { commentId } = req.params;
    const page = Math.max(1, Number.parseInt(req.query.page, 10) || 1);
    const limit = Math.min(50, Math.max(1, Number.parseInt(req.query.limit, 10) || 20));

    const result = await commentService.getCommentReplies({ commentId, page, limit });

    if (result.error) {
      return sendErrorResponse(res, result.error.status, result.error.message);
    }

    return sendSuccessResponse(res, 200, "Replies fetched successfully", result.data);
  } catch (error) {
    logger.error("Error fetching comment replies:", error);
    return sendErrorResponse(res, 500, "Failed to fetch replies");
  }
}

export async function trackReplyView(req, res) {
  try {
    const { commentId } = req.params;
    const { postId } = req.body;
    const userId = req.user?._id;

    if (!userId) {
      return sendErrorResponse(res, 401, "Unauthorized");
    }

    await commentService.trackReplyView({ commentId, postId, userId });

    return sendSuccessResponse(res, 200, "Reply view tracked successfully");
  } catch (error) {
    logger.error("Error tracking reply view:", error);
    return sendErrorResponse(res, 500, "Failed to track reply view");
  }
}
