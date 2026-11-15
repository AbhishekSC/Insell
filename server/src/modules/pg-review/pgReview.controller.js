import * as service from "./pgReview.service.js";
import { sendSuccessResponse, sendErrorResponse } from "../../utils/responseHandler.js";
import { logger } from "../../utils/logger.js";

export async function createReview(req, res) {
  try {
    const result = await service.createReview(req.user._id, req.params.pgId, req.body);
    if (result.error) {
      return sendErrorResponse(res, result.error.status, result.error.message);
    }
    return sendSuccessResponse(res, 201, "Review submitted successfully", { review: result.review });
  } catch (error) {
    logger.error("Error creating PG review:", error);
    return sendErrorResponse(res, 500, "Failed to submit review");
  }
}

export async function getReviews(req, res) {
  try {
    const page = Math.max(1, Number(req.query.page) || 1);
    const limit = Math.min(50, Math.max(1, Number(req.query.limit) || 20));
    const { reviews, total } = await service.getReviews(req.params.pgId, { page, limit });
    return sendSuccessResponse(res, 200, "PG reviews retrieved", {
      reviews,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.max(1, Math.ceil(total / limit)),
      },
    });
  } catch (error) {
    logger.error("Error fetching PG reviews:", error);
    return sendErrorResponse(res, 500, "Failed to retrieve reviews");
  }
}

export async function getRatingSummary(req, res) {
  try {
    const summary = await service.getRatingSummary(req.params.pgId);
    return sendSuccessResponse(res, 200, "Rating summary retrieved", summary);
  } catch (error) {
    logger.error("Error fetching rating summary:", error);
    return sendErrorResponse(res, 500, "Failed to retrieve rating summary");
  }
}

export async function markHelpful(req, res) {
  try {
    const result = await service.markHelpful(req.params.reviewId, req.user._id);
    if (result.error) {
      return sendErrorResponse(res, result.error.status, result.error.message);
    }
    return sendSuccessResponse(res, 200, "Marked as helpful", result);
  } catch (error) {
    logger.error("Error marking review helpful:", error);
    return sendErrorResponse(res, 500, "Failed to mark review as helpful");
  }
}

export async function deleteReview(req, res) {
  try {
    const result = await service.deleteReview(req.params.reviewId, req.user._id);
    if (result.error) {
      return sendErrorResponse(res, result.error.status, result.error.message);
    }
    return sendSuccessResponse(res, 200, "Review deleted");
  } catch (error) {
    logger.error("Error deleting PG review:", error);
    return sendErrorResponse(res, 500, "Failed to delete review");
  }
}
