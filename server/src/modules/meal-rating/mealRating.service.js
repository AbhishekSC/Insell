import * as repo from "./mealRating.repository.js";
import PropertyPost from "../../models/PropertyPost.model.js";
import { logger } from "../../utils/logger.js";

export async function rateMeal(raterId, data) {
  const pg = await PropertyPost.findById(data.pgId).select("postType author").lean();
  if (!pg) return { error: { status: 404, message: "PG/Hostel not found" } };
  if (pg.postType !== "PG_HOSTEL") {
    return { error: { status: 400, message: "Meal ratings are only for PG/Hostel listings" } };
  }

  const rating = await repo.create({
    pg: data.pgId,
    rater: raterId,
    date: data.date || new Date(),
    mealType: data.mealType,
    rating: data.rating,
    comment: data.comment || "",
    photo: data.photo || "",
  });

  logger.info(`[MEAL RATING] User ${raterId} rated ${data.mealType} at PG ${data.pgId}: ${data.rating}/5`);
  return { rating };
}

export async function getDailyRatings(pgId, date) {
  return repo.findByPgAndDate(pgId, date || new Date());
}

export async function getMonthlyBreakdown(pgId, month, year) {
  const breakdown = await repo.findByPgMonthly(pgId, month, year);
  const result = {};
  for (const item of breakdown) {
    result[item._id] = {
      avgRating: Math.round(item.avgRating * 10) / 10,
      totalRatings: item.count,
    };
  }
  return result;
}

export async function getFoodScore(pgId) {
  return repo.getOverallFoodScore(pgId);
}

export async function getFoodTrend(pgId) {
  const trend = await repo.getFoodTrend(pgId);
  return trend.map((t) => ({
    month: t._id.month,
    year: t._id.year,
    avgRating: Math.round(t.avgRating * 10) / 10,
    totalRatings: t.count,
  }));
}
