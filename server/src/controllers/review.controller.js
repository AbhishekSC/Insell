import Review from "../models/Review.model.js";
import Offer from "../models/Offer.model.js";
import User from "../models/User.model.js";
import { sendErrorResponse, sendSuccessResponse } from "../utils/responseHandler.js";
import { logger } from "../utils/logger.js";
import * as NotificationService from "../services/NotificationService.js";
import { NotificationChannel } from "../services/NotificationService.js";

async function recomputeUserRating(userId) {
  const stats = await Review.aggregate([
    { $match: { reviewee: userId } },
    { $group: { _id: "$reviewee", avg: { $avg: "$rating" }, count: { $sum: 1 } } },
  ]);
  const { avg = 0, count = 0 } = stats[0] || {};
  await User.updateOne({ _id: userId }, { $set: { ratingAvg: Math.round(avg * 10) / 10, ratingCount: count } });
}

export async function createReview(req, res) {
  try {
    const { offerId } = req.params;
    const reviewerId = req.user?._id;
    const rating = Number(req.body?.rating);
    const comment = String(req.body?.comment || "").trim().slice(0, 500);

    if (!Number.isInteger(rating) || rating < 1 || rating > 5) {
      return sendErrorResponse(res, 400, "Rating must be an integer between 1 and 5");
    }

    const offer = await Offer.findById(offerId).populate("post", "title");
    if (!offer) {
      return sendErrorResponse(res, 404, "Offer not found");
    }

    if (offer.status !== "accepted") {
      return sendErrorResponse(res, 400, "Reviews can only be left on accepted offers");
    }

    const isBuyer = String(offer.buyer) === String(reviewerId);
    const isOwner = String(offer.owner) === String(reviewerId);
    if (!isBuyer && !isOwner) {
      return sendErrorResponse(res, 403, "You're not a party to this offer");
    }

    const revieweeId = isBuyer ? offer.owner : offer.buyer;

    const review = await Review.create({
      offer: offer._id,
      post: offer.post._id,
      reviewer: reviewerId,
      reviewee: revieweeId,
      rating,
      comment,
    });

    await recomputeUserRating(revieweeId);

    await NotificationService.send({
      recipientId: revieweeId,
      actorId: reviewerId,
      type: "review_received",
      title: `${req.user.fullName} left you a ${rating}-star review`,
      message: `${req.user.fullName} left you a ${rating}-star review for "${offer.post.title}"`,
      pushBody: comment || `${rating}-star review`,
      data: { url: `/users/${revieweeId}` },
      channels: [NotificationChannel.IN_APP, NotificationChannel.REALTIME, NotificationChannel.FIREBASE],
    });

    return sendSuccessResponse(res, 201, "Review submitted successfully", { review });
  } catch (error) {
    if (error?.code === 11000) {
      return sendErrorResponse(res, 409, "You've already reviewed this deal");
    }
    logger.error("Error creating review:", error);
    return sendErrorResponse(res, 500, "Failed to submit review");
  }
}

export async function getUserReviews(req, res) {
  try {
    const { userId } = req.params;
    const page = Math.max(1, Number.parseInt(req.query.page, 10) || 1);
    const limit = Math.min(50, Math.max(1, Number.parseInt(req.query.limit, 10) || 20));
    const skip = (page - 1) * limit;

    const reviews = await Review.find({ reviewee: userId })
      .populate("reviewer", "fullName profilePic")
      .populate("post", "title price city mediaUrls")
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean();

    const total = await Review.countDocuments({ reviewee: userId });
    const user = await User.findById(userId).select("ratingAvg ratingCount").lean();

    return sendSuccessResponse(res, 200, "Reviews fetched successfully", {
      reviews,
      ratingAvg: user?.ratingAvg || 0,
      ratingCount: user?.ratingCount || 0,
      pagination: { page, totalPages: Math.ceil(total / limit), total },
    });
  } catch (error) {
    logger.error("Error fetching user reviews:", error);
    return sendErrorResponse(res, 500, "Failed to fetch reviews");
  }
}
