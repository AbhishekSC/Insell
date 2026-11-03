import { sendSuccessResponse, sendErrorResponse } from "../../utils/responseHandler.js";
import { logger } from "../../utils/logger.js";
import * as service from "./review.service.js";

export async function createReview(req, res) {
  try {
    const { offerId } = req.params;
    const reviewerId = req.user?._id;
    const rating = Number(req.body?.rating);
    const comment = String(req.body?.comment || "").trim().slice(0, 500);

    if (!Number.isInteger(rating) || rating < 1 || rating > 5) {
      return sendErrorResponse(res, 400, "Rating must be an integer between 1 and 5");
    }

    const result = await service.createReview({
      offerId,
      reviewerId,
      rating,
      comment,
      reviewerFullName: req.user.fullName,
    });

    if (result?.error) {
      return sendErrorResponse(res, result.error.status, result.error.message);
    }

    return sendSuccessResponse(res, 201, "Review submitted successfully", { review: result.review });
  } catch (error) {
    logger.error("Error creating review:", error);
    return sendErrorResponse(res, 500, "Failed to submit review");
  }
}

export async function getUserReviews(req, res) {
  try {
    const { userId } = req.params;
    const page = Math.max(1, Number.parseInt(req.query.page, 10) || 1);
    const limit = Math.min(50, Math.max(1, Number.parseInt(req.query.limit, 10) || 20));

    const result = await service.getUserReviews({ userId, page, limit });

    return sendSuccessResponse(res, 200, "Reviews fetched successfully", result);
  } catch (error) {
    logger.error("Error fetching user reviews:", error);
    return sendErrorResponse(res, 500, "Failed to fetch reviews");
  }
}
