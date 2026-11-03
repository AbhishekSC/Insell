import * as NotificationService from "../../services/NotificationService.js";
import { NotificationChannel } from "../../services/NotificationService.js";
import { logger } from "../../utils/logger.js";

export function formatMoney(amount) {
  const num = Number(amount) || 0;
  return `₹${num.toLocaleString("en-IN")}`;
}

export function findReplayedHistoryEntry(offer, requestId) {
  if (!requestId || !offer?.history?.length) return null;
  return offer.history.find((h) => h.requestId === requestId) || null;
}

export function isDuplicateRequestIdError(error) {
  return error?.code === 11000 && Object.keys(error.keyPattern || {}).includes("history.requestId");
}

export async function sendOfferReceivedNotification(recipientId, actorId, actorName, proposedPrice, post, offerId, pushMessage) {
  await NotificationService.send({
    recipientId,
    actorId,
    type: "offer_received",
    title: `${actorName} made an offer of ${formatMoney(proposedPrice)} on your property`,
    message: `${actorName} made an offer of ${formatMoney(proposedPrice)} on your property: ${post.title}`,
    pushBody: pushMessage || `Offer: ${formatMoney(proposedPrice)}`,
    data: { propertyPost: post._id, offer: offerId },
    channels: [NotificationChannel.IN_APP, NotificationChannel.REALTIME, NotificationChannel.FIREBASE],
  });
}

export async function sendOfferCounteredNotification(counterpartyId, userId, userName, counterPrice, post, offerId, pushMessage) {
  await NotificationService.send({
    recipientId: counterpartyId,
    actorId: userId,
    type: "offer_countered",
    title: `${userName} countered with ${formatMoney(counterPrice)}`,
    message: `${userName} countered your offer on "${post.title}" with ${formatMoney(counterPrice)}`,
    pushBody: pushMessage || `Counter-offer: ${formatMoney(counterPrice)}`,
    data: { propertyPost: post._id, offer: offerId },
    channels: [NotificationChannel.IN_APP, NotificationChannel.REALTIME, NotificationChannel.FIREBASE],
  });
}

export async function sendOfferDeclinedNotification(counterpartyId, userId, userName, currentPrice, post, offerId) {
  await NotificationService.send({
    recipientId: counterpartyId,
    actorId: userId,
    type: "offer_declined",
    title: `Your offer on "${post.title}" was declined`,
    message: `${userName} declined your offer of ${formatMoney(currentPrice)} on "${post.title}"`,
    data: { propertyPost: post._id, offer: offerId },
    channels: [NotificationChannel.IN_APP, NotificationChannel.REALTIME, NotificationChannel.FIREBASE],
  });
}

export async function sendOfferAcceptedNotification(counterpartyId, userId, userName, acceptedOffer) {
  await NotificationService.send({
    recipientId: counterpartyId,
    actorId: userId,
    type: "offer_accepted",
    title: `Your offer on "${acceptedOffer.post.title}" was accepted!`,
    message: `${userName} accepted the offer of ${formatMoney(acceptedOffer.currentPrice)} on "${acceptedOffer.post.title}"`,
    data: { propertyPost: acceptedOffer.post._id, offer: acceptedOffer._id },
    channels: [NotificationChannel.IN_APP, NotificationChannel.REALTIME, NotificationChannel.FIREBASE],
  });
}

export async function sendCloseActiveOffersNotifications(activeOffers, postId, actorId) {
  await Promise.allSettled(
    activeOffers.map((offer) =>
      NotificationService.send({
        recipientId: offer.buyer,
        actorId,
        type: "offer_declined",
        title: "A listing you offered on was taken down",
        message: `The listing you made an offer of ${formatMoney(offer.currentPrice)} on is no longer available`,
        data: { propertyPost: postId, offer: offer._id },
        channels: [NotificationChannel.IN_APP, NotificationChannel.REALTIME, NotificationChannel.FIREBASE],
      })
    )
  );
}

export function enqueueOfferAcceptedFanout(acceptedOffer, declinedOffers) {
  import("../../jobs/producers/fanout.producer.js")
    .then(({ enqueueOfferAccepted }) =>
      enqueueOfferAccepted({
        offerId: acceptedOffer._id,
        postId: acceptedOffer.post._id,
        buyerId: String(acceptedOffer.buyer),
        sellerId: String(acceptedOffer.owner),
        declinedOfferBuyerIds: declinedOffers.map((o) => String(o.buyer)),
        streamChannelData: {
          userId1: String(acceptedOffer.buyer),
          userId2: String(acceptedOffer.owner),
          message: `🤝 Offer accepted on "${acceptedOffer.post.title}" at ${formatMoney(acceptedOffer.currentPrice)} — let’s connect and continue!`,
        },
      })
    )
    .catch((e) => logger.warn("Failed to enqueue offer-accepted fanout (non-fatal):", e?.message));
}

export function enqueueCloseActiveOffersFanout(postId) {
  import("../../jobs/producers/fanout.producer.js")
    .then(({ enqueueCloseActiveOffers }) => enqueueCloseActiveOffers(postId, null))
    .catch(() => {});
}

export function ensureDealForAcceptedOffer(offerId) {
  import("../deal/deal.controller.js")
    .then(({ ensureDealForOffer }) => ensureDealForOffer(offerId))
    .catch((e) => logger.error("Failed to open deal for accepted offer (non-fatal):", e));
}
