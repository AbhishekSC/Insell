import * as repo from "./pgReview.repository.js";
import { logger } from "../../utils/logger.js";

export async function createReview(reviewerId, pgId, data) {
  const pg = await repo.findPgPost(pgId);
  if (!pg) return { error: { status: 404, message: "PG/Hostel not found" } };
  if (pg.postType !== "PG_HOSTEL") {
    return { error: { status: 400, message: "This post is not a PG/Hostel listing" } };
  }
  if (String(pg.author) === String(reviewerId)) {
    return { error: { status: 400, message: "You cannot review your own PG" } };
  }

  const existing = await repo.findByReviewerAndPg(reviewerId, pgId);
  if (existing) {
    return { error: { status: 409, message: "You have already reviewed this PG" } };
  }

  const review = await repo.create({
    reviewer: reviewerId,
    pg: pgId,
    categoryRatings: data.categoryRatings,
    comment: data.comment || "",
    photos: data.photos,
    stayDurationMonths: data.stayDurationMonths,
    verifiedResident: data.verifiedResident || false,
  });

  await recalculateAggregates(pgId);

  logger.info(`[PG REVIEW] User ${reviewerId} reviewed PG ${pgId}`);
  return { review };
}

export async function getReviews(pgId, { page, limit }) {
  return repo.findByPgId(pgId, { page, limit });
}

export async function getRatingSummary(pgId) {
  const agg = await repo.computeAggregateRatings(pgId);
  if (!agg) return { avgRatings: null, reviewCount: 0 };
  return agg;
}

export async function markHelpful(reviewId, userId) {
  const updated = await repo.markHelpful(reviewId, userId);
  if (!updated) return { error: { status: 404, message: "Review not found" } };
  return { helpfulCount: (updated.helpful || []).length };
}

export async function deleteReview(reviewId, userId) {
  const review = await repo.findByReviewerAndPg(null, null);
  const existing = await (async () => {
    const r = await import("../../models/PGReview.model.js");
    return r.default.findById(reviewId).lean();
  })();
  if (!existing) return { error: { status: 404, message: "Review not found" } };
  if (String(existing.reviewer) !== String(userId)) {
    return { error: { status: 403, message: "You can only delete your own reviews" } };
  }

  await repo.deleteById(reviewId);
  await recalculateAggregates(existing.pg);
  return { deleted: true };
}

async function recalculateAggregates(pgId) {
  try {
    const agg = await repo.computeAggregateRatings(pgId);
    if (agg) {
      await repo.updatePgAggregateRatings(pgId, agg.avgRatings, agg.reviewCount);
    }
  } catch (err) {
    logger.warn(`[PG REVIEW] Failed to recalculate aggregates for ${pgId}: ${err.message}`);
  }
}
