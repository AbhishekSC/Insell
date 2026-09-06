import mongoose from "mongoose";
import Offer from "../models/Offer.model.js";
import Review from "../models/Review.model.js";
import PropertyPost from "../models/PropertyPost.model.js";
import User from "../models/User.model.js";
import { sendErrorResponse, sendSuccessResponse } from "../utils/responseHandler.js";
import { logger } from "../utils/logger.js";
import * as NotificationService from "../services/NotificationService.js";
import { NotificationChannel } from "../services/NotificationService.js";
import { sendSystemMessageToDirectChannel } from "../services/stream.service.js";

const ACTIVE_STATUSES = ["pending", "countered"];

function formatMoney(amount) {
  const num = Number(amount) || 0;
  return `₹${num.toLocaleString("en-IN")}`;
}

// Every mutating offer action accepts an optional client-generated
// `requestId` (a UUID). If a request carrying a requestId that's already
// recorded on this offer's history arrives again — a double-click, a
// network timeout followed by a client retry — it's a replay of a request
// we already processed, not a new action. Returning the existing state
// instead of reprocessing means a retry can never create a second history
// entry, a second notification, or a second Stream/friendship side effect.
function findReplayedHistoryEntry(offer, requestId) {
  if (!requestId || !offer?.history?.length) return null;
  return offer.history.find((h) => h.requestId === requestId) || null;
}

// The application-level replay check above has a genuine gap under true
// concurrency: two requests carrying the identical requestId can both read
// "not yet processed" before either write lands (classic check-then-act).
// The `history.requestId` unique index on the Offer model is what actually
// closes that — whichever write reaches MongoDB first wins, and the second
// gets a duplicate-key error (code 11000) instead of a corrupted double
// mutation. This is that error, recognized so callers can turn it into a
// clean idempotent response instead of a raw 500.
function isDuplicateRequestIdError(error) {
  return error?.code === 11000 && Object.keys(error.keyPattern || {}).includes("history.requestId");
}

export async function createOffer(req, res) {
  const session = await mongoose.startSession();
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

    // Idempotent replay check happens before touching anything else — a
    // retried "make an offer" click shouldn't 409 as a duplicate, it should
    // just hand back the offer that was already created for it.
    if (requestId) {
      const replay = await Offer.findOne({ post: postId, buyer: buyerId, "history.requestId": requestId });
      if (replay) {
        return sendSuccessResponse(res, 200, "Offer already submitted", { offer: replay });
      }
    }

    const post = await PropertyPost.findById(postId);
    if (!post || post.isDeleted) {
      return sendErrorResponse(res, 404, "Post not found");
    }

    if (String(post.author) === String(buyerId)) {
      return sendErrorResponse(res, 400, "You can't make an offer on your own post");
    }

    if (post.status !== "PUBLISHED") {
      return sendErrorResponse(res, 400, "This post is no longer accepting offers");
    }

    const existing = await Offer.findOne({
      post: postId,
      buyer: buyerId,
      status: { $in: ACTIVE_STATUSES.concat("accepted") },
    });
    if (existing) {
      return sendErrorResponse(res, 409, "You already have an active offer on this post");
    }

    // The property-level `offerStatus` flag, checked and flipped inside a
    // transaction on accept, is the actual source of truth — checking and
    // creating the offer inside a transaction here too means a createOffer
    // racing an in-flight accept transaction on the same post gets MongoDB's
    // own write-conflict detection instead of a window where both "succeed".
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
              owner: post.author,
              listedPrice: post.price,
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
    } catch (txError) {
      if (txError.code === "ALREADY_ACCEPTED") {
        return sendErrorResponse(res, 409, "This property already has an accepted offer");
      }
      if (isDuplicateRequestIdError(txError)) {
        const winner = await Offer.findOne({ post: postId, buyer: buyerId, "history.requestId": requestId });
        return sendSuccessResponse(res, 200, "Offer already submitted", { offer: winner });
      }
      throw txError;
    } finally {
      await session.endSession();
    }

    await NotificationService.send({
      recipientId: post.author,
      actorId: buyerId,
      type: "offer_received",
      title: `${req.user.fullName} made an offer of ${formatMoney(proposedPrice)} on your property`,
      message: `${req.user.fullName} made an offer of ${formatMoney(proposedPrice)} on your property: ${post.title}`,
      pushBody: message || `Offer: ${formatMoney(proposedPrice)}`,
      data: { propertyPost: post._id, offer: offer._id, url: `/property/${post._id}` },
      channels: [NotificationChannel.IN_APP, NotificationChannel.REALTIME, NotificationChannel.FIREBASE],
    });

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

    const post = await PropertyPost.findById(postId);
    if (!post || post.isDeleted) {
      return sendErrorResponse(res, 404, "Post not found");
    }

    if (String(post.author) !== String(userId)) {
      return sendErrorResponse(res, 403, "You can only view offers on your own posts");
    }

    const offers = await Offer.find({ post: postId })
      .populate("buyer", "fullName profilePic")
      .sort({ updatedAt: -1 })
      .lean();

    // Tells the client whether *this* viewer (the owner) has already
    // reviewed a given accepted offer, so a "Leave a review" button doesn't
    // stay up forever based on stale client-side state after a refresh.
    const acceptedOfferIds = offers.filter((o) => o.status === "accepted").map((o) => o._id);
    const reviewedOfferIds = acceptedOfferIds.length
      ? new Set(
          (await Review.find({ offer: { $in: acceptedOfferIds }, reviewer: userId }).select("offer").lean())
            .map((r) => String(r.offer))
        )
      : new Set();
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

    const offer = await Offer.findOne({ post: postId, buyer: buyerId })
      .sort({ createdAt: -1 })
      .lean();

    let offerWithReviewStatus = offer;
    if (offer?.status === "accepted") {
      const alreadyReviewed = await Review.exists({ offer: offer._id, reviewer: buyerId });
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

    const offer = await Offer.findById(offerId).populate("post", "title author price");
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

      // Conditional update, not read-then-write: the filter re-checks
      // status is still active at the moment of the write itself, closing
      // the race window where two near-simultaneous requests (e.g. two
      // browser tabs) both read "active" before either one's write lands.
      //
      // Note this status guard alone does NOT make two *distinct* counters
      // mutually exclusive the way it does for accept/decline — landing on
      // "countered" keeps the offer active, so a second, different counter
      // arriving right after is a legitimate next move in the negotiation,
      // not a race to reject. What must never happen is the identical
      // requestId applying twice — that's what the `history.requestId: $ne`
      // clause guards, catching the case a global unique index can't: it
      // only enforces uniqueness *across* documents, not between two
      // elements pushed into the *same* document's array under a genuine
      // concurrent double-submit.
      const filter = { _id: offerId, status: { $in: ACTIVE_STATUSES } };
      if (requestId) {
        filter["history.requestId"] = { $ne: requestId };
      }
      let updated;
      try {
        updated = await Offer.findOneAndUpdate(
          filter,
          {
            $set: { currentPrice: counterPrice, status: "countered", lastActionBy: userId },
            $push: { history: { price: counterPrice, message, actorRole, by: userId, action: "counter", requestId } },
          },
          { new: true }
        ).populate("post", "title author price");
      } catch (writeError) {
        if (isDuplicateRequestIdError(writeError)) {
          const winner = await Offer.findById(offerId).populate("post", "title author price");
          return sendSuccessResponse(res, 200, "Already processed", { offer: winner });
        }
        throw writeError;
      }

      if (!updated) {
        // The write didn't match — either the offer really did close in
        // the meantime, or (if a requestId was given) this exact requestId
        // just won a race a moment ago on another concurrent request. Tell
        // those two cases apart before answering, so a genuine concurrent
        // duplicate submit gets a clean 200 replay instead of a 409.
        const replayed = requestId ? await Offer.findOne({ _id: offerId, "history.requestId": requestId }) : null;
        if (replayed) {
          return sendSuccessResponse(res, 200, "Already processed", { offer: replayed });
        }
        return sendErrorResponse(res, 409, "This offer is no longer available for this action");
      }

      await NotificationService.send({
        recipientId: counterpartyId,
        actorId: userId,
        type: "offer_countered",
        title: `${req.user.fullName} countered with ${formatMoney(counterPrice)}`,
        message: `${req.user.fullName} countered your offer on "${updated.post.title}" with ${formatMoney(counterPrice)}`,
        pushBody: message || `Counter-offer: ${formatMoney(counterPrice)}`,
        data: { propertyPost: updated.post._id, offer: updated._id, url: `/property/${updated.post._id}` },
        channels: [NotificationChannel.IN_APP, NotificationChannel.REALTIME, NotificationChannel.FIREBASE],
      });

      return sendSuccessResponse(res, 200, "Counter-offer sent", { offer: updated });
    }

    if (action === "decline") {
      const newStatus = isBuyer ? "withdrawn" : "declined";
      const declineFilter = { _id: offerId, status: { $in: ACTIVE_STATUSES } };
      if (requestId) {
        declineFilter["history.requestId"] = { $ne: requestId };
      }
      let updated;
      try {
        updated = await Offer.findOneAndUpdate(
          declineFilter,
          {
            $set: { status: newStatus, lastActionBy: userId },
            $push: {
              history: {
                price: offer.currentPrice,
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
      } catch (writeError) {
        if (isDuplicateRequestIdError(writeError)) {
          const winner = await Offer.findById(offerId).populate("post", "title author price");
          return sendSuccessResponse(res, 200, "Already processed", { offer: winner });
        }
        throw writeError;
      }

      if (!updated) {
        const replayed = requestId ? await Offer.findOne({ _id: offerId, "history.requestId": requestId }) : null;
        if (replayed) {
          return sendSuccessResponse(res, 200, "Already processed", { offer: replayed });
        }
        return sendErrorResponse(res, 409, "This offer is no longer available for this action");
      }

      if (isOwner) {
        await NotificationService.send({
          recipientId: counterpartyId,
          actorId: userId,
          type: "offer_declined",
          title: `Your offer on "${updated.post.title}" was declined`,
          message: `${req.user.fullName} declined your offer of ${formatMoney(updated.currentPrice)} on "${updated.post.title}"`,
          data: { propertyPost: updated.post._id, offer: updated._id, url: `/property/${updated.post._id}` },
          channels: [NotificationChannel.IN_APP, NotificationChannel.REALTIME, NotificationChannel.FIREBASE],
        });
      }

      return sendSuccessResponse(res, 200, "Offer closed", { offer: updated });
    }

    // action === "accept" — atomic against (a) a racing action on this same
    // offer, (b) competing offers from other buyers on the same post, and
    // (c) a createOffer racing in from a brand-new buyer, via the property's
    // own `offerStatus` flag flipping inside this same transaction.
    // Everything that talks to an external service (Stream, push) happens
    // only after the transaction has committed, since those calls can't
    // participate in it and shouldn't be able to roll back a DB write that
    // already succeeded.
    //
    // Known narrow gap: the `price` recorded in this accept's history entry
    // comes from the pre-transaction read (`offer.currentPrice`), not a
    // value re-read inside the transaction. `status`/`currentPrice` on the
    // document itself are always correct (guarded by the filter below) —
    // only in the rare case of a counter landing in the few ms between this
    // read and the write could that one audit-log line show a stale price
    // snapshot. Not worth an aggregation-pipeline update for that.
    let acceptedOffer;
    let declinedOffers = [];
    const session = await mongoose.startSession();
    try {
      await session.withTransaction(async () => {
        const updated = await Offer.findOneAndUpdate(
          { _id: offerId, status: { $in: ACTIVE_STATUSES }, lastActionBy: { $ne: userId } },
          {
            $set: { status: "accepted" },
            $push: { history: { price: offer.currentPrice, message, actorRole, by: userId, action: "accept", requestId } },
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
    } catch (txError) {
      if (txError.isConflict) {
        // Accept transitions status OUT of ACTIVE_STATUSES on success, so a
        // genuine retry of the SAME accept (same requestId) always lands
        // here rather than hitting the duplicate-key path below — the
        // status filter fails first. Tell a real conflict apart from a
        // harmless replay before answering.
        const replayed = requestId ? await Offer.findOne({ _id: offerId, "history.requestId": requestId }) : null;
        if (replayed) {
          return sendSuccessResponse(res, 200, "Already processed", { offer: replayed });
        }
        return sendErrorResponse(res, 409, "You can't accept your own last proposal, or this offer is no longer available");
      }
      if (isDuplicateRequestIdError(txError)) {
        const winner = await Offer.findById(offerId).populate("post", "title author price");
        return sendSuccessResponse(res, 200, "Already processed", { offer: winner });
      }
      throw txError;
    } finally {
      await session.endSession();
    }

    await NotificationService.send({
      recipientId: counterpartyId,
      actorId: userId,
      type: "offer_accepted",
      title: `Your offer on "${acceptedOffer.post.title}" was accepted!`,
      message: `${req.user.fullName} accepted the offer of ${formatMoney(acceptedOffer.currentPrice)} on "${acceptedOffer.post.title}"`,
      data: { propertyPost: acceptedOffer.post._id, offer: acceptedOffer._id, url: `/property/${acceptedOffer.post._id}` },
      channels: [NotificationChannel.IN_APP, NotificationChannel.REALTIME, NotificationChannel.FIREBASE],
    });

    // Every other buyer who had an active offer on this post finds out the
    // property's no longer available, instead of their offer just silently
    // sitting there forever.
    for (const other of declinedOffers) {
      await NotificationService.send({
        recipientId: other.buyer,
        actorId: userId,
        type: "offer_declined",
        title: `"${acceptedOffer.post.title}" is no longer available`,
        message: `The owner accepted another offer on "${acceptedOffer.post.title}" — your offer of ${formatMoney(other.currentPrice)} is now closed`,
        data: { propertyPost: acceptedOffer.post._id, offer: other._id, url: `/property/${acceptedOffer.post._id}` },
        channels: [NotificationChannel.IN_APP, NotificationChannel.REALTIME, NotificationChannel.FIREBASE],
      });
    }

    await sendSystemMessageToDirectChannel(
      acceptedOffer.buyer,
      acceptedOffer.owner,
      `🤝 Offer accepted on "${acceptedOffer.post.title}" at ${formatMoney(acceptedOffer.currentPrice)} — let's connect and continue!`
    );

    // The Messages tab only lists existing friends/connections — completely
    // separate from Stream channel membership. Without this, the system
    // message above lands in a real channel that neither party can actually
    // find in their normal Messages list unless they were already friends.
    // An accepted offer is a stronger mutual signal than a friend request,
    // so connect them the same way accepting a friend request does.
    await User.findByIdAndUpdate(acceptedOffer.buyer, { $addToSet: { friends: acceptedOffer.owner } });
    await User.findByIdAndUpdate(acceptedOffer.owner, { $addToSet: { friends: acceptedOffer.buyer } });

    // Open the closing tracker (agreed → docs → agreement → payment → …).
    // Best-effort — the accept already succeeded; a missing Deal is created
    // lazily on the first read of /deals/post/:postId anyway.
    try {
      const { ensureDealForOffer } = await import("./deal.controller.js");
      await ensureDealForOffer(acceptedOffer._id);
    } catch (e) {
      logger.error("Failed to open deal for accepted offer (non-fatal):", e);
    }

    return sendSuccessResponse(res, 200, "Offer accepted", { offer: acceptedOffer });
  } catch (error) {
    logger.error("Error responding to offer:", error);
    return sendErrorResponse(res, 500, "Failed to respond to offer");
  }
}

// Called from propertyPost.controller.js when a post is unpublished,
// archived, or soft-deleted — open negotiations shouldn't just sit there
// forever pointing at a post that's no longer live. An already-accepted
// offer is left untouched: it represents a completed deal, not an open one.
export async function closeActiveOffersForPost(postId, actorId) {
  const activeOffers = await Offer.find({ post: postId, status: { $in: ACTIVE_STATUSES } });
  if (activeOffers.length === 0) return;

  for (const offer of activeOffers) {
    offer.status = "declined";
    offer.lastActionBy = actorId || offer.owner;
    offer.history.push({
      price: offer.currentPrice,
      message: "This listing was taken down",
      actorRole: "owner",
      by: actorId || offer.owner,
      action: "decline",
    });
    await offer.save();

    await NotificationService.send({
      recipientId: offer.buyer,
      actorId: actorId || offer.owner,
      type: "offer_declined",
      title: "A listing you offered on was taken down",
      message: `The listing you made an offer of ${formatMoney(offer.currentPrice)} on is no longer available`,
      data: { propertyPost: postId, offer: offer._id },
      channels: [NotificationChannel.IN_APP, NotificationChannel.REALTIME, NotificationChannel.FIREBASE],
    }).catch((error) => {
      logger.error("Failed to notify buyer of listing takedown (non-fatal):", error);
    });
  }
}
