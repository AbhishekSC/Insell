import { getQueue, QUEUE_NAMES } from "../queues.js";
import { logger } from "../../utils/logger.js";

export async function enqueuePostEnrichment(postId, city) {
  try {
    const q = getQueue(QUEUE_NAMES.INGESTION);
    if (!q) return null;
    return await q.add("enrich-post", {
      postId: String(postId),
      city: String(city || ""),
    }, {
      jobId: `enrich:${postId}`,
      removeOnComplete: true,
    });
  } catch (err) {
    logger.warn(`Failed to enqueue post enrichment for ${postId}: ${err?.message}`);
    return null;
  }
}

export async function enqueuePriceDropFanout(postId, oldPrice) {
  try {
    const q = getQueue(QUEUE_NAMES.INGESTION);
    if (!q) return null;
    return await q.add("price-drop-fanout", {
      postId: String(postId),
      oldPrice: Number(oldPrice),
    }, {
      jobId: `price-drop:${postId}:${oldPrice}`,
      removeOnComplete: true,
    });
  } catch (err) {
    logger.warn(`Failed to enqueue price drop fanout for ${postId}: ${err?.message}`);
    return null;
  }
}

export async function enqueueEngagementFlush() {
  try {
    const q = getQueue(QUEUE_NAMES.INGESTION);
    if (!q) return null;
    return await q.add("flush-dirty-engagement", {}, {
      repeat: { every: 30_000 },
      jobId: "engagement_flush_repeatable",
    });
  } catch (err) {
    logger.warn(`Failed to schedule engagement flush: ${err?.message}`);
    return null;
  }
}

export async function enqueueHotFeedRebuild() {
  try {
    const q = getQueue(QUEUE_NAMES.INGESTION);
    if (!q) return null;
    return await q.add("rebuild-hot-feed", {}, {
      repeat: { every: 120_000 },
      jobId: "hot_feed_rebuild_repeatable",
    });
  } catch (err) {
    logger.warn(`Failed to schedule hot feed rebuild: ${err?.message}`);
    return null;
  }
}

export async function enqueueRecommendationSweep() {
  try {
    const q = getQueue(QUEUE_NAMES.INGESTION);
    if (!q) return null;
    return await q.add("sweep-active-users", {}, {
      repeat: { every: 2 * 60 * 60 * 1000 },
      jobId: "recommendation_sweep_repeatable",
    });
  } catch (err) {
    logger.warn(`Failed to schedule recommendation sweep: ${err?.message}`);
    return null;
  }
}

export async function enqueueUserRecommendationPrecompute(userId) {
  try {
    const q = getQueue(QUEUE_NAMES.INGESTION);
    if (!q) return null;
    return await q.add("precompute-single-user", {
      userId: String(userId),
    }, {
      jobId: `precompute:${userId}`,
      removeOnComplete: true,
    });
  } catch (err) {
    logger.warn(`Failed to enqueue recommendation precompute for ${userId}: ${err?.message}`);
    return null;
  }
}
