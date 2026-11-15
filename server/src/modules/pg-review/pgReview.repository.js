import PGReview, { REVIEW_CATEGORIES } from "../../models/PGReview.model.js";
import PropertyPost from "../../models/PropertyPost.model.js";

export async function findByPgId(pgId, { page = 1, limit = 20 } = {}) {
  const skip = (page - 1) * limit;
  const [reviews, total] = await Promise.all([
    PGReview.find({ pg: pgId })
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .populate("reviewer", "fullName profilePic")
      .lean(),
    PGReview.countDocuments({ pg: pgId }),
  ]);
  return { reviews, total };
}

export async function findByReviewerAndPg(reviewerId, pgId) {
  return PGReview.findOne({ reviewer: reviewerId, pg: pgId }).lean();
}

export async function create(data) {
  return PGReview.create(data);
}

export async function deleteById(reviewId) {
  return PGReview.findByIdAndDelete(reviewId);
}

export async function markHelpful(reviewId, userId) {
  return PGReview.findByIdAndUpdate(
    reviewId,
    { $addToSet: { helpful: userId } },
    { new: true }
  ).lean();
}

export async function computeAggregateRatings(pgId) {
  const pipeline = [
    { $match: { pg: pgId } },
    {
      $group: {
        _id: null,
        count: { $sum: 1 },
        ...Object.fromEntries(
          REVIEW_CATEGORIES.map((c) => [c, { $avg: `$categoryRatings.${c}` }])
        ),
      },
    },
  ];
  const [result] = await PGReview.aggregate(pipeline);
  if (!result) return null;

  const avgRatings = {};
  for (const c of REVIEW_CATEGORIES) {
    avgRatings[c] = Math.round((result[c] || 0) * 10) / 10;
  }
  return { avgRatings, reviewCount: result.count };
}

export async function updatePgAggregateRatings(pgId, avgRatings, reviewCount) {
  return PropertyPost.findByIdAndUpdate(pgId, {
    "postMeta.pgHostel.avgRatings": avgRatings,
    "postMeta.pgHostel.reviewCount": reviewCount,
  });
}

export async function findPgPost(pgId) {
  return PropertyPost.findById(pgId).select("postType author").lean();
}
