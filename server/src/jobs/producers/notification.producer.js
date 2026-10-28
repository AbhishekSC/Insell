import { getQueue, QUEUE_NAMES } from "../queues.js";
import { logger } from "../../utils/logger.js";

export async function enqueueNotification(channel, payload, options = {}) {
  try {
    const q = getQueue(QUEUE_NAMES.NOTIFICATION);
    if (!q) {
      logger.warn(`Notification queue unavailable, falling back to direct for ${channel}`);
      return null;
    }
    const addOptions = {};
    const dedupeKey = options.jobId || options.idempotencyKey;
    if (dedupeKey) addOptions.jobId = String(dedupeKey);

    await q.add(channel, { channel, payload }, addOptions);
    return true;
  } catch (err) {
    logger.warn(`Failed to enqueue ${channel} notification: ${err?.message}`);
    return null;
  }
}

export async function enqueueFirebasePush(recipientId, tokens, message) {
  return enqueueNotification("FIREBASE", { recipientId, tokens, message });
}

export async function enqueueRealtimeEvent(userId, eventType) {
  return enqueueNotification("REALTIME", { userId, eventType });
}
