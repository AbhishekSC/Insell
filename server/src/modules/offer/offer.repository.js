import mongoose from "mongoose";
import Offer from "../../models/Offer.model.js";
import Review from "../../models/Review.model.js";
import PropertyPost from "../../models/PropertyPost.model.js";
import { ACTIVE_STATUSES } from "./offer.constants.js";

export function findReplayByRequestId(postId, buyerId, requestId) {
  return Offer.findOne({ post: postId, buyer: buyerId, "history.requestId": requestId });
}

export function findOfferByRequestId(offerId, requestId) {
  return Offer.findOne({ _id: offerId, "history.requestId": requestId });
}

export function findPostById(postId) {
  return PropertyPost.findById(postId);
}

export function findExistingActiveOffer(postId, buyerId) {
  return Offer.findOne({
    post: postId,
    buyer: buyerId,
    status: { $in: ACTIVE_STATUSES.concat("accepted") },
  });
}

export async function createOfferInTransaction(postId, buyerId, ownerId, listedPrice, proposedPrice, message, requestId) {
  const session = await mongoose.startSession();
  let offer;
  try {
    await session.withTransaction(async () => {
      const freshPost = await PropertyPost.findById(postId, null, { session });
      if (freshPost.offerStatus === "ACCEPTED") {
        throw Object.assign(new Error("ALREADY_ACCEPTED"), { code: "ALREADY_ACCEPTED" });
      }

      const [created] = await Offer.create(
        [
          {
            post: postId,
            buyer: buyerId,
            owner: ownerId,
            listedPrice,
            currentPrice: proposedPrice,
            status: "pending",
            lastActionBy: buyerId,
            history: [{ price: proposedPrice, message, actorRole: "buyer", by: buyerId, action: "offer", requestId }],
          },
        ],
        { session }
      );
      offer = created;
    });
  } finally {
    await session.endSession();
  }
  return offer;
}

export function findOfferByIdPopulated(offerId) {
  return Offer.findById(offerId).populate("post", "title author price");
}

export function counterOffer(offerId, counterPrice, userId, actorRole, message, requestId) {
  const filter = { _id: offerId, status: { $in: ACTIVE_STATUSES } };
  if (requestId) {
    filter["history.requestId"] = { $ne: requestId };
  }
  return Offer.findOneAndUpdate(
    filter,
    {
      $set: { currentPrice: counterPrice, status: "countered", lastActionBy: userId },
      $push: { history: { price: counterPrice, message, actorRole, by: userId, action: "counter", requestId } },
    },
    { new: true }
  ).populate("post", "title author price");
}

export function declineOffer(offerId, newStatus, userId, currentPrice, actorRole, isBuyer, message, requestId) {
  const filter = { _id: offerId, status: { $in: ACTIVE_STATUSES } };
  if (requestId) {
    filter["history.requestId"] = { $ne: requestId };
  }
  return Offer.findOneAndUpdate(
    filter,
    {
      $set: { status: newStatus, lastActionBy: userId },
      $push: {
        history: {
          price: currentPrice,
          message,
          actorRole,
          by: userId,
          action: isBuyer ? "withdraw" : "decline",
          requestId,
        },
      },
    },
    { new: true }
  ).populate("post", "title author price");
}

export async function acceptOfferInTransaction(offerId, userId, currentPrice, actorRole, message, requestId) {
  let acceptedOffer;
  let declinedOffers = [];
  const session = await mongoose.startSession();
  try {
    await session.withTransaction(async () => {
      const updated = await Offer.findOneAndUpdate(
        { _id: offerId, status: { $in: ACTIVE_STATUSES }, lastActionBy: { $ne: userId } },
        {
          $set: { status: "accepted" },
          $push: { history: { price: currentPrice, message, actorRole, by: userId, action: "accept", requestId } },
        },
        { new: true, session }
      ).populate("post", "title author price");

      if (!updated) {
        throw Object.assign(new Error("CONFLICT"), { isConflict: true });
      }
      acceptedOffer = updated;

      await PropertyPost.updateOne(
        { _id: updated.post._id },
        { $set: { offerStatus: "ACCEPTED" } },
        { session }
      );

      declinedOffers = await Offer.find(
        { post: updated.post._id, status: { $in: ACTIVE_STATUSES }, _id: { $ne: updated._id } },
        null,
        { session }
      );
      for (const other of declinedOffers) {
        other.status = "declined";
        other.lastActionBy = userId;
        other.history.push({
          price: other.currentPrice,
          message: "Another offer on this property was accepted",
          actorRole: "owner",
          by: updated.owner,
          action: "decline",
        });
        await other.save({ session });
      }
    });
  } finally {
    await session.endSession();
  }
  return { acceptedOffer, declinedOffers };
}

export function findPostOffers(postId) {
  return Offer.find({ post: postId })
    .populate("buyer", "fullName profilePic")
    .sort({ updatedAt: -1 })
    .lean();
}

export async function getReviewedOfferIds(offerIds, userId) {
  if (!offerIds.length) return new Set();
  return new Set(
    (await Review.find({ offer: { $in: offerIds }, reviewer: userId }).select("offer").lean())
      .map((r) => String(r.offer))
  );
}

export function findMyOffer(postId, buyerId) {
  return Offer.findOne({ post: postId, buyer: buyerId })
    .sort({ createdAt: -1 })
    .lean();
}

export function checkReviewExists(offerId, reviewerId) {
  return Review.exists({ offer: offerId, reviewer: reviewerId });
}

export function findActiveOffersForPost(postId) {
  return Offer.find({ post: postId, status: { $in: ACTIVE_STATUSES } }).lean();
}

export function bulkDeclineOffers(activeOffers, actorId) {
  return Offer.bulkWrite(
    activeOffers.map((offer) => ({
      updateOne: {
        filter: { _id: offer._id },
        update: {
          $set: { status: "declined", lastActionBy: actorId },
          $push: {
            history: {
              price: offer.currentPrice,
              message: "This listing was taken down",
              actorRole: "owner",
              by: actorId,
              action: "decline",
            },
          },
        },
      },
    })),
    { ordered: false }
  );
}
