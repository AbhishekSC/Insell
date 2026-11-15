import * as service from "./mealRating.service.js";
import { sendSuccessResponse, sendErrorResponse } from "../../utils/responseHandler.js";
import { logger } from "../../utils/logger.js";

export async function rateMeal(req, res) {
  try {
    const result = await service.rateMeal(req.user._id, req.body);
    if (result.error) return sendErrorResponse(res, result.error.status, result.error.message);
    return sendSuccessResponse(res, 201, "Meal rated", { rating: result.rating });
  } catch (error) {
    if (error.code === 11000) {
      return sendErrorResponse(res, 409, "You have already rated this meal today");
    }
    logger.error("Error rating meal:", error);
    return sendErrorResponse(res, 500, "Failed to rate meal");
  }
}

export async function getDailyRatings(req, res) {
  try {
    const date = req.query.date || new Date().toISOString().split("T")[0];
    const ratings = await service.getDailyRatings(req.params.pgId, date);
    return sendSuccessResponse(res, 200, "Daily meal ratings", { ratings, date });
  } catch (error) {
    logger.error("Error fetching daily ratings:", error);
    return sendErrorResponse(res, 500, "Failed to retrieve daily ratings");
  }
}

export async function getMonthlyBreakdown(req, res) {
  try {
    const month = Number(req.query.month) || new Date().getMonth() + 1;
    const year = Number(req.query.year) || new Date().getFullYear();
    const breakdown = await service.getMonthlyBreakdown(req.params.pgId, month, year);
    return sendSuccessResponse(res, 200, "Monthly meal breakdown", { breakdown, month, year });
  } catch (error) {
    logger.error("Error fetching monthly breakdown:", error);
    return sendErrorResponse(res, 500, "Failed to retrieve monthly breakdown");
  }
}

export async function getFoodScore(req, res) {
  try {
    const score = await service.getFoodScore(req.params.pgId);
    return sendSuccessResponse(res, 200, "Food score (last 30 days)", score);
  } catch (error) {
    logger.error("Error fetching food score:", error);
    return sendErrorResponse(res, 500, "Failed to retrieve food score");
  }
}

export async function getFoodTrend(req, res) {
  try {
    const trend = await service.getFoodTrend(req.params.pgId);
    return sendSuccessResponse(res, 200, "Food quality trend", { trend });
  } catch (error) {
    logger.error("Error fetching food trend:", error);
    return sendErrorResponse(res, 500, "Failed to retrieve food trend");
  }
}
