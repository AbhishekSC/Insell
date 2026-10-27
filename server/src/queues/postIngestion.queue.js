import { Queue, Worker } from "bullmq";
import { getBullRedisConnection } from "../config/bullmq.config.js";
import redisClient from "../config/redisClient.config.js";
import { logger } from "../utils/logger.js";
import PropertyPost from "../models/PropertyPost.model.js";
import { invalidateHotCityCache } from "../services/HotFeedCacheService.js";
import { notifyTriggeredAlerts as notifyTriggeredPriceAlerts } from "../modules/price-alert/priceAlert.app.service.js";
import { notifyPriceChange } from "../controllers/propertyPost.controller.js";

const QUEUE_NAME = "post_ingestion_queue";

let _queue = null;
let _worker = null;

export function getPostIngestionQueue() {
  if (!_queue) {
    const connection = getBullRedisConnection();
    if (!connection) return null;

    _queue = new Queue(QUEUE_NAME, {
      connection,
      defaultJobOptions: {
        attempts: 3,
        backoff: { type: "exponential", delay: 2000 },
        removeOnComplete: 50,
        removeOnFail: 50,
      },
    });

    _queue.on("error", (err) => {
      logger.warn(`PostIngestion Queue warning (non-fatal): ${err?.message || err}`);
    });
  }
  return _queue;
}

/**
 * Enqueue a newly created post for background enrichment (cache invalidation, geo indexing, etc.)
 * Uses deterministic jobId to prevent duplicate enqueues for the same post.
 */
export async function enqueuePostEnrichment(postId, city) {
  try {
    const q = getPostIngestionQueue();
    if (!q) {
      if (city) invalidateHotCityCache(city).catch(() => {});
      return null;
    }
    return await q.add(
      "enrich-post",
      { postId: String(postId), city: String(city || "") },
      { jobId: `enrich:${postId}`, removeOnComplete: true }
    );
  } catch (err) {
    logger.warn(`Failed to enqueue post enrichment for ${postId}:`, err?.message);
    if (city) invalidateHotCityCache(city).catch(() => {});
    return null;
  }
}

/**
 * Enqueue price-drop notification fan-out to run asynchronously in BullMQ worker
 * Uses deterministic jobId based on postId and oldPrice to prevent duplicate fanouts.
 */
export async function enqueuePriceDropFanout(post, oldPrice) {
  try {
    const q = getPostIngestionQueue();
    if (!q) {
      notifyTriggeredPriceAlerts(post, oldPrice).catch(() => {});
      return null;
    }
    const safeOldPrice = Number(oldPrice);
    return await q.add(
      "price-drop-fanout",
      {
        postId: String(post._id),
        oldPrice: safeOldPrice,
      },
      { jobId: `price-drop:${post._id}:${safeOldPrice}`, removeOnComplete: true }
    );
  } catch (err) {
    logger.warn(`Failed to enqueue price drop fanout for ${post?._id}:`, err?.message);
    return null;
  }
}

/**
 * Initialize the Post Ingestion Worker with Idempotency Guarantees
 */
export function initPostIngestionWorker() {
  if (_worker) return _worker;

  const connection = getBullRedisConnection();
  if (!connection) {
    logger.warn("[PostIngestion] Redis connection not ready; worker deferred.");
    return null;
  }

  _worker = new Worker(
    QUEUE_NAME,
    async (job) => {
      const { name, data } = job;
      if (name === "enrich-post") {
        const { postId, city } = data;
        if (city) {
          await invalidateHotCityCache(city);
        }
        logger.info(`[PostIngestion] Successfully enriched and invalidated cache for post ${postId}`);
      } else if (name === "price-drop-fanout") {
        const { postId, oldPrice } = data;

        // Idempotency guard: prevent duplicate notification fanouts if job is retried
        const dedupKey = `idempotency:price_drop:${postId}:${oldPrice}`;
        const isFirstExecution = await redisClient.set(dedupKey, "locked", {
          EX: 3600, // 1 hour TTL
          NX: true, // Only set if key does not exist
        });

        if (!isFirstExecution) {
          logger.info(`[PostIngestion] Skipping duplicate price-drop fanout for ${postId} (already sent)`);
          return;
        }

        const post = await PropertyPost.findById(postId).lean();
        if (post) {
          const alertedUserIds = await notifyTriggeredPriceAlerts(post, oldPrice);
          await notifyPriceChange(post, oldPrice, new Set((alertedUserIds || []).map(String)));
          logger.info(`[PostIngestion] Successfully fanned out price drop notifications for post ${postId}`);
        }
      }
    },
    {
      connection,
      concurrency: 3,
    }
  );

  _worker.on("failed", (job, err) => {
    logger.warn(`Post ingestion job ${job?.id} failed: ${err?.message || err}`);
  });

  _worker.on("error", (err) => {
    logger.warn(`Post ingestion worker warning: ${err?.message || err}`);
  });

  logger.info("[PostIngestion] Worker started");
  return _worker;
}

export async function closePostIngestionQueue() {
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
}
