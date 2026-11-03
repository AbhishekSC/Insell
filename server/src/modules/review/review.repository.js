import Review from "../../models/Review.model.js";
import Offer from "../../models/Offer.model.js";
import User from "../../models/User.model.js";

export async function aggregateUserRating(userId) {
  return Review.aggregate([
    { $match: { reviewee: userId } },
    { $group: { _id: "$reviewee", avg: { $avg: "$rating" }, count: { $sum: 1 } } },
  ]);
}

export async function updateUserRating(userId, avg, count) {
  return User.updateOne(
    { _id: userId },
    { $set: { ratingAvg: Math.round(avg * 10) / 10, ratingCount: count } },
  );
}

export async function findOfferById(offerId) {
  return Offer.findById(offerId).populate("post", "title");
}

export async function createReview(data) {
  return Review.create(data);
}

export async function findReviewsByUser(userId, skip, limit) {
  return Review.find({ reviewee: userId })
    .populate("reviewer", "fullName profilePic")
    .populate("post", "title price city mediaUrls")
    .sort({ createdAt: -1 })
    .skip(skip)
    .limit(limit)
    .lean();
}

export async function countReviewsByUser(userId) {
  return Review.countDocuments({ reviewee: userId });
}

export async function findUserRatingSummary(userId) {
  return User.findById(userId).select("ratingAvg ratingCount").lean();
}
