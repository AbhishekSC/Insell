import { Queue, Worker } from "bullmq";
import { getBullRedisConnection, closeBullConnection } from "../config/bullmq.config.js";
import { sendGenericEmail } from "../utils/emailClient.js";
import { sendPushNotification } from "../services/firebase.service.js";
import { pushRealtimeNotification } from "../services/stream.service.js";
import { logger } from "../utils/logger.js";

const QUEUE_NAME = "insell_notifications";

let _queue = null;
let _worker = null;

export function getNotificationQueue() {
  if (!_queue) {
    const connection = getBullRedisConnection();
    if (!connection) return null;

    _queue = new Queue(QUEUE_NAME, {
      connection,
      defaultJobOptions: {
        attempts: 3,
        backoff: {
          type: "exponential",
          delay: 2000,
        },
        removeOnComplete: 1000,
        removeOnFail: 5000,
      },
    });

    _queue.on("error", (err) => {
      logger.warn(`Notification Queue error (non-fatal): ${err?.message || err}`);
    });
  }
  return _queue;
}

export async function processNotificationJobData({ channel, payload }) {
  switch (channel) {
    case "EMAIL":
      return await sendGenericEmail(payload);

    case "FIREBASE": {
      const result = await sendPushNotification(payload.tokens, payload.message);
      const staleTokens = result?.staleTokens || [];
      if (staleTokens.length > 0 && payload.recipientId) {
        const User = (await import("../models/User.model.js")).default;
        await User.updateOne(
          { _id: payload.recipientId },
          { $pull: { fcmTokens: { token: { $in: staleTokens } } } }
        );
      }
      return result;
    }

    case "REALTIME":
      return await pushRealtimeNotification(payload.userId, payload.eventType);

    default:
      logger.warn(`Unknown notification job channel: ${channel}`);
  }
}

export function initNotificationWorker() {
  if (_worker) return _worker;

  const connection = getBullRedisConnection();
  if (!connection) return null;

  _worker = new Worker(
    QUEUE_NAME,
    async (job) => {
      await processNotificationJobData(job.data);
    },
    {
      connection,
      concurrency: 5,
    }
  );

  _worker.on("failed", (job, err) => {
    logger.warn(`Notification job ${job?.id} failed on attempt ${job?.attemptsMade}:`, err?.message);
  });

  _worker.on("error", (err) => {
    logger.warn(`Notification Worker error (non-fatal): ${err?.message || err}`);
  });

  return _worker;
}

export async function enqueueNotification(channel, payload, options = {}) {
  try {
    const q = getNotificationQueue();
    if (!q) {
      // Fallback: execute directly if Redis/Queue is unavailable
      return fallbackDirectExecution(channel, payload);
    }
    const addOptions = {};
    const dedupeKey = options.jobId || options.idempotencyKey;
    if (dedupeKey) {
      addOptions.jobId = String(dedupeKey);
    }
    await q.add(channel, { channel, payload }, addOptions);
    return true;
  } catch (error) {
    logger.warn(`Failed to enqueue ${channel} notification, falling back to direct send:`, error?.message);
    return fallbackDirectExecution(channel, payload);
  }
}

async function fallbackDirectExecution(channel, payload) {
  try {
    return await processNotificationJobData({ channel, payload });
  } catch (err) {
    logger.error(`Fallback direct execution failed for ${channel}:`, err?.message);
  }
}

export async function closeNotificationQueue() {
  if (_worker) {
    try {
      await _worker.close();
    } catch (_) {}
    _worker = null;
  }
  if (_queue) {
    try {
      await _queue.close();
    } catch (_) {}
    _queue = null;
  }
  await closeBullConnection();
}
