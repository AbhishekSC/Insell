import { getQueue, QUEUE_NAMES } from "../queues.js";
import { logger } from "../../utils/logger.js";

export async function enqueueOfferAccepted(data) {
  try {
    const q = getQueue(QUEUE_NAMES.FANOUT);
    if (!q) return null;
    return await q.add("offer-accepted", data, {
      jobId: `offer-accepted:${data.offerId}`,
    });
  } catch (err) {
    logger.warn(`Failed to enqueue offer-accepted fanout: ${err?.message}`);
    return null;
  }
}

export async function enqueueCloseActiveOffers(postId, acceptedOfferId) {
  try {
    const q = getQueue(QUEUE_NAMES.FANOUT);
    if (!q) return null;
    return await q.add("close-active-offers", {
      postId: String(postId),
      acceptedOfferId: String(acceptedOfferId),
    });
  } catch (err) {
    logger.warn(`Failed to enqueue close-active-offers: ${err?.message}`);
    return null;
  }
}

export async function enqueuePriceDropAlerts(postId, oldPrice) {
  try {
    const q = getQueue(QUEUE_NAMES.FANOUT);
    if (!q) return null;
    return await q.add("price-drop-alerts", {
      postId: String(postId),
      oldPrice: Number(oldPrice),
    }, {
      jobId: `price-drop:${postId}:${oldPrice}`,
    });
  } catch (err) {
    logger.warn(`Failed to enqueue price-drop-alerts: ${err?.message}`);
    return null;
  }
}

export async function enqueueBulkNotify(recipientIds, notificationData) {
  try {
    const q = getQueue(QUEUE_NAMES.FANOUT);
    if (!q) return null;
    return await q.add("bulk-notify", {
      recipientIds: recipientIds.map(String),
      notification: notificationData,
    });
  } catch (err) {
    logger.warn(`Failed to enqueue bulk-notify: ${err?.message}`);
    return null;
  }
}

export async function enqueueBroadcast(data) {
  try {
    const q = getQueue(QUEUE_NAMES.FANOUT);
    if (!q) return null;
    return await q.add("broadcast", data);
  } catch (err) {
    logger.warn(`Failed to enqueue broadcast: ${err?.message}`);
    return null;
  }
}

export async function enqueueDealNudge(dealIds) {
  try {
    const q = getQueue(QUEUE_NAMES.FANOUT);
    if (!q) return null;
    return await q.add("deal-nudge", {
      dealIds: dealIds.map(String),
    });
  } catch (err) {
    logger.warn(`Failed to enqueue deal-nudge: ${err?.message}`);
    return null;
  }
}
