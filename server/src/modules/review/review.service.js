import * as repository from "./review.repository.js";
import * as NotificationService from "../../services/NotificationService.js";
import { NotificationChannel } from "../../services/NotificationService.js";

async function recomputeUserRating(userId) {
  const stats = await repository.aggregateUserRating(userId);
  const { avg = 0, count = 0 } = stats[0] || {};
  await repository.updateUserRating(userId, avg, count);
}

export async function createReview({ offerId, reviewerId, rating, comment, reviewerFullName }) {
  const offer = await repository.findOfferById(offerId);
  if (!offer) {
    return { error: { status: 404, message: "Offer not found" } };
  }

  if (offer.status !== "accepted") {
    return { error: { status: 400, message: "Reviews can only be left on accepted offers" } };
  }

  const isBuyer = String(offer.buyer) === String(reviewerId);
  const isOwner = String(offer.owner) === String(reviewerId);
  if (!isBuyer && !isOwner) {
    return { error: { status: 403, message: "You're not a party to this offer" } };
  }

  const revieweeId = isBuyer ? offer.owner : offer.buyer;

  let review;
  try {
    review = await repository.createReview({
      offer: offer._id,
      post: offer.post._id,
      reviewer: reviewerId,
      reviewee: revieweeId,
      rating,
      comment,
    });
  } catch (error) {
    if (error?.code === 11000) {
      return { error: { status: 409, message: "You've already reviewed this deal" } };
    }
    throw error;
  }

  await recomputeUserRating(revieweeId);

  await NotificationService.send({
    recipientId: revieweeId,
    actorId: reviewerId,
    type: "review_received",
    title: `${reviewerFullName} left you a ${rating}-star review`,
    message: `${reviewerFullName} left you a ${rating}-star review for "${offer.post.title}"`,
    pushBody: comment || `${rating}-star review`,
    channels: [NotificationChannel.IN_APP, NotificationChannel.REALTIME, NotificationChannel.FIREBASE],
  });

  return { review };
}

export async function getUserReviews({ userId, page, limit }) {
  const skip = (page - 1) * limit;

  const [reviews, total, user] = await Promise.all([
    repository.findReviewsByUser(userId, skip, limit),
    repository.countReviewsByUser(userId),
    repository.findUserRatingSummary(userId),
  ]);

  return {
    reviews,
    ratingAvg: user?.ratingAvg || 0,
    ratingCount: user?.ratingCount || 0,
    pagination: { page, totalPages: Math.ceil(total / limit), total },
  };
}
