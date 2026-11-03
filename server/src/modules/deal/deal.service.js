import * as NotificationService from "../../services/NotificationService.js";
import { logger } from "../../utils/logger.js";
import * as repo from "./deal.repository.js";
import { CHANNELS, GEO_FENCE_RADIUS_METERS } from "./deal.constants.js";
import { serializeDeal } from "./deal.dto.js";

export function modeForPost(post) {
  const lt = String(post?.listingType || "").toLowerCase();
  const pt = String(post?.postType || "").toUpperCase();
  return lt === "rent" || lt === "lease" || pt === "PROPERTY_RENT" ? "RENT" : "BUY";
}

export function stagesFor(deal) {
  return repo.DEAL_STAGES[deal.mode] || repo.DEAL_STAGES.BUY;
}

export function nextStageKey(deal) {
  const keys = stagesFor(deal).map((s) => s.key);
  const done = new Set(deal.completedStages || []);
  return keys.find((k) => !done.has(k)) || null;
}

export function nextStageKeyFromSet(modeStages, doneSet) {
  return modeStages.map((s) => s.key).find((k) => !doneSet.has(k)) || null;
}

export function isDuplicateRequestIdError(err) {
  return err?.code === 11000 && /history\.requestId/.test(err?.message || "");
}

export async function reloadSerialized(dealId) {
  const d = await repo.findDealByIdPopulated(dealId);
  return d ? serializeDeal(d) : null;
}

export async function notifyCounterparty(deal, actorId, actorName, type, title, message) {
  const recipientId = String(deal.buyer) === String(actorId) ? deal.owner : deal.buyer;
  return NotificationService.send({
    recipientId,
    actorId,
    type,
    title,
    message,
    pushBody: actorName ? `${actorName}: ${title}` : title,
    data: { propertyPost: deal.post, offer: deal.offer, deal: deal._id },
    channels: CHANNELS,
  }).catch((e) => logger.error("deal notify failed (non-fatal):", e));
}

export async function reopenListing(deal, actorId) {
  await repo.reopenPropertyListing(deal.post);
  await repo.declineOffer(deal.offer, actorId);
}

export async function ensureDealForOffer(offerId, { session } = {}) {
  const existing = await repo.findDealByOffer(offerId, session);
  if (existing) return existing;

  const offer = await repo.findOfferByIdPopulated(offerId, session);
  if (!offer || offer.status !== "accepted" || !offer.post) return null;

  const mode = modeForPost(offer.post);
  try {
    const [created] = await repo.createDeal(
      {
        post: offer.post._id,
        offer: offer._id,
        buyer: offer.buyer,
        owner: offer.owner,
        agreedPrice: offer.currentPrice,
        mode,
        status: "ACTIVE",
        currentStage: nextStageKey({ mode, completedStages: ["agreed"] }),
        completedStages: ["agreed"],
        history: [{ action: "create", stage: "agreed", by: offer.owner, message: "Offer accepted" }],
      },
      session,
    );
    return created;
  } catch (err) {
    if (err?.code === 11000) return repo.findDealByOffer(offerId, session);
    throw err;
  }
}

export function haversineDistanceMeters(lat1, lon1, lat2, lon2) {
  const R = 6371e3;
  const phi1 = (lat1 * Math.PI) / 180;
  const phi2 = (lat2 * Math.PI) / 180;
  const deltaPhi = ((lat2 - lat1) * Math.PI) / 180;
  const deltaLambda = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(deltaPhi / 2) * Math.sin(deltaPhi / 2) +
    Math.cos(phi1) * Math.cos(phi2) * Math.sin(deltaLambda / 2) * Math.sin(deltaLambda / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return Math.round(R * c);
}

export async function computeGeoVerification(category, reqLat, reqLng, postId) {
  let geoVerified = false;
  let inspectionDistanceMeters = null;
  let inspectionCoordinates = null;

  if (category === "SITE_INSPECTION" && reqLat != null && reqLng != null && !isNaN(reqLat) && !isNaN(reqLng)) {
    inspectionCoordinates = { lat: reqLat, lng: reqLng };
    const post = await repo.findPropertyPostCoordinates(postId);
    if (post && post.latitude != null && post.longitude != null) {
      inspectionDistanceMeters = haversineDistanceMeters(reqLat, reqLng, post.latitude, post.longitude);
      geoVerified = inspectionDistanceMeters <= GEO_FENCE_RADIUS_METERS;
    } else {
      geoVerified = true;
    }
  }

  return { geoVerified, inspectionDistanceMeters, inspectionCoordinates };
}

export async function notifyBothParties(deal, actorId, type, title, message) {
  for (const recipientId of [deal.buyer, deal.owner]) {
    await NotificationService.send({
      recipientId,
      actorId,
      type,
      title,
      message,
      data: { propertyPost: deal.post, deal: deal._id },
      channels: CHANNELS,
    }).catch(() => {});
  }
}
