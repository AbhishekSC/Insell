import { sendErrorResponse, sendSuccessResponse } from "../../utils/responseHandler.js";
import { logger } from "../../utils/logger.js";
import * as repo from "./offer.repository.js";
import {
  formatMoney,
  findReplayedHistoryEntry,
  isDuplicateRequestIdError,
  sendOfferReceivedNotification,
  sendOfferCounteredNotification,
  sendOfferDeclinedNotification,
  sendOfferAcceptedNotification,
  sendCloseActiveOffersNotifications,
  enqueueOfferAcceptedFanout,
  ensureDealForAcceptedOffer,
} from "./offer.service.js";

export async function createOffer(req, res) {
  try {
    const { postId } = req.params;
    const buyerId = req.user?._id;
    const proposedPrice = Number(req.body?.price);
    const message = String(req.body?.message || "").trim().slice(0, 500);
    const requestId = req.body?.requestId ? String(req.body.requestId) : undefined;

    if (!buyerId) {
      return sendErrorResponse(res, 401, "Unauthorized");
    }

    if (!Number.isFinite(proposedPrice) || proposedPrice <= 0) {
      return sendErrorResponse(res, 400, "A valid price is required");
    }

    if (requestId) {
      const replay = await repo.findReplayByRequestId(postId, buyerId, requestId);
      if (replay) {
        return sendSuccessResponse(res, 200, "Offer already submitted", { offer: replay });
      }
    }

    const post = await repo.findPostById(postId);
    if (!post || post.isDeleted) {
      return sendErrorResponse(res, 404, "Post not found");
    }

    if (String(post.author) === String(buyerId)) {
      return sendErrorResponse(res, 400, "You can't make an offer on your own post");
    }

    if (post.status !== "PUBLISHED") {
      return sendErrorResponse(res, 400, "This post is no longer accepting offers");
    }

    const existing = await repo.findExistingActiveOffer(postId, buyerId);
    if (existing) {
      return sendErrorResponse(res, 409, "You already have an active offer on this post");
    }

    let offer;
    try {
      offer = await repo.createOfferInTransaction(postId, buyerId, post.author, post.price, proposedPrice, message, requestId);
    } catch (txError) {
      if (txError.code === "ALREADY_ACCEPTED") {
        return sendErrorResponse(res, 409, "This property already has an accepted offer");
      }
      if (isDuplicateRequestIdError(txError)) {
        const winner = await repo.findReplayByRequestId(postId, buyerId, requestId);
        return sendSuccessResponse(res, 200, "Offer already submitted", { offer: winner });
      }
      throw txError;
    }

    await sendOfferReceivedNotification(post.author, buyerId, req.user.fullName, proposedPrice, post, offer._id, message || `Offer: ${formatMoney(proposedPrice)}`);

    return sendSuccessResponse(res, 201, "Offer submitted successfully", { offer });
  } catch (error) {
    logger.error("Error creating offer:", error);
    return sendErrorResponse(res, 500, "Failed to submit offer");
  }
}

export async function getPostOffers(req, res) {
  try {
    const { postId } = req.params;
    const userId = req.user?._id;

    const post = await repo.findPostById(postId);
    if (!post || post.isDeleted) {
      return sendErrorResponse(res, 404, "Post not found");
    }

    if (String(post.author) !== String(userId)) {
      return sendErrorResponse(res, 403, "You can only view offers on your own posts");
    }

    const offers = await repo.findPostOffers(postId);

    const acceptedOfferIds = offers.filter((o) => o.status === "accepted").map((o) => o._id);
    const reviewedOfferIds = await repo.getReviewedOfferIds(acceptedOfferIds, userId);
    const offersWithReviewStatus = offers.map((o) => ({
      ...o,
      reviewedByMe: reviewedOfferIds.has(String(o._id)),
    }));

    return sendSuccessResponse(res, 200, "Offers fetched successfully", { offers: offersWithReviewStatus });
  } catch (error) {
    logger.error("Error fetching post offers:", error);
    return sendErrorResponse(res, 500, "Failed to fetch offers");
  }
}

export async function getMyOfferForPost(req, res) {
  try {
    const { postId } = req.params;
    const buyerId = req.user?._id;

    const offer = await repo.findMyOffer(postId, buyerId);

    let offerWithReviewStatus = offer;
    if (offer?.status === "accepted") {
      const alreadyReviewed = await repo.checkReviewExists(offer._id, buyerId);
      offerWithReviewStatus = { ...offer, reviewedByMe: Boolean(alreadyReviewed) };
    }

    return sendSuccessResponse(res, 200, "Offer fetched successfully", { offer: offerWithReviewStatus || null });
  } catch (error) {
    logger.error("Error fetching my offer for post:", error);
    return sendErrorResponse(res, 500, "Failed to fetch offer");
  }
}

export async function respondToOffer(req, res) {
  try {
    const { offerId } = req.params;
    const userId = req.user?._id;
    const action = String(req.body?.action || "").trim();
    const message = String(req.body?.message || "").trim().slice(0, 500);
    const requestId = req.body?.requestId ? String(req.body.requestId) : undefined;

    if (!["counter", "accept", "decline"].includes(action)) {
      return sendErrorResponse(res, 400, "Invalid action");
    }

    const offer = await repo.findOfferByIdPopulated(offerId);
    if (!offer) {
      return sendErrorResponse(res, 404, "Offer not found");
    }

    const isBuyer = String(offer.buyer) === String(userId);
    const isOwner = String(offer.owner) === String(userId);
    if (!isBuyer && !isOwner) {
      return sendErrorResponse(res, 403, "You're not a party to this offer");
    }

    const replay = findReplayedHistoryEntry(offer, requestId);
    if (replay) {
      return sendSuccessResponse(res, 200, "Already processed", { offer });
    }

    const actorRole = isOwner ? "owner" : "buyer";
    const counterpartyId = isOwner ? offer.buyer : offer.owner;

    if (action === "counter") {
      const counterPrice = Number(req.body?.price);
      if (!Number.isFinite(counterPrice) || counterPrice <= 0) {
        return sendErrorResponse(res, 400, "A valid counter price is required");
      }

      let updated;
      try {
        updated = await repo.counterOffer(offerId, counterPrice, userId, actorRole, message, requestId);
      } catch (writeError) {
        if (isDuplicateRequestIdError(writeError)) {
          const winner = await repo.findOfferByIdPopulated(offerId);
          return sendSuccessResponse(res, 200, "Already processed", { offer: winner });
        }
        throw writeError;
      }

      if (!updated) {
        const replayed = requestId ? await repo.findOfferByRequestId(offerId, requestId) : null;
        if (replayed) {
          return sendSuccessResponse(res, 200, "Already processed", { offer: replayed });
        }
        return sendErrorResponse(res, 409, "This offer is no longer available for this action");
      }

      await sendOfferCounteredNotification(counterpartyId, userId, req.user.fullName, counterPrice, updated.post, updated._id, message || `Counter-offer: ${formatMoney(counterPrice)}`);

      return sendSuccessResponse(res, 200, "Counter-offer sent", { offer: updated });
    }

    if (action === "decline") {
      const newStatus = isBuyer ? "withdrawn" : "declined";
      let updated;
      try {
        updated = await repo.declineOffer(offerId, newStatus, userId, offer.currentPrice, actorRole, isBuyer, message, requestId);
      } catch (writeError) {
        if (isDuplicateRequestIdError(writeError)) {
          const winner = await repo.findOfferByIdPopulated(offerId);
          return sendSuccessResponse(res, 200, "Already processed", { offer: winner });
        }
        throw writeError;
      }

      if (!updated) {
        const replayed = requestId ? await repo.findOfferByRequestId(offerId, requestId) : null;
        if (replayed) {
          return sendSuccessResponse(res, 200, "Already processed", { offer: replayed });
        }
        return sendErrorResponse(res, 409, "This offer is no longer available for this action");
      }

      if (isOwner) {
        await sendOfferDeclinedNotification(counterpartyId, userId, req.user.fullName, updated.currentPrice, updated.post, updated._id);
      }

      return sendSuccessResponse(res, 200, "Offer closed", { offer: updated });
    }

    // action === "accept"
    let acceptedOffer;
    let declinedOffers = [];
    try {
      ({ acceptedOffer, declinedOffers } = await repo.acceptOfferInTransaction(offerId, userId, offer.currentPrice, actorRole, message, requestId));
    } catch (txError) {
      if (txError.isConflict) {
        const replayed = requestId ? await repo.findOfferByRequestId(offerId, requestId) : null;
        if (replayed) {
          return sendSuccessResponse(res, 200, "Already processed", { offer: replayed });
        }
        return sendErrorResponse(res, 409, "You can't accept your own last proposal, or this offer is no longer available");
      }
      if (isDuplicateRequestIdError(txError)) {
        const winner = await repo.findOfferByIdPopulated(offerId);
        return sendSuccessResponse(res, 200, "Already processed", { offer: winner });
      }
      throw txError;
    }

    await sendOfferAcceptedNotification(counterpartyId, userId, req.user.fullName, acceptedOffer);

    enqueueOfferAcceptedFanout(acceptedOffer, declinedOffers);
    ensureDealForAcceptedOffer(acceptedOffer._id);

    return sendSuccessResponse(res, 200, "Offer accepted", { offer: acceptedOffer });
  } catch (error) {
    logger.error("Error responding to offer:", error);
    return sendErrorResponse(res, 500, "Failed to respond to offer");
  }
}

export async function closeActiveOffersForPost(postId, actorId) {
  const activeOffers = await repo.findActiveOffersForPost(postId);
  if (activeOffers.length === 0) return;

  const actor = actorId || activeOffers[0].owner;
  await repo.bulkDeclineOffers(activeOffers, actor);

  import("../../jobs/producers/fanout.producer.js")
    .then(({ enqueueCloseActiveOffers }) => enqueueCloseActiveOffers(postId, null))
    .catch(() => {
      sendCloseActiveOffersNotifications(activeOffers, postId, actor);
    });
}
