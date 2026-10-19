import { Queue, Worker } from "bullmq";
import { getBullRedisConnection } from "../config/bullmq.config.js";
import redisClient from "../config/redisClient.config.js";
import PropertyPost from "../models/PropertyPost.model.js";
import { logger } from "../utils/logger.js";
import { rebuildHotFeeds } from "../services/HotFeedCacheService.js";

const QUEUE_NAME = "engagement_sync_queue";
const REPEAT_INTERVAL_MS = 30_000; // 30 seconds

let _queue = null;
let _worker = null;
let _isFlushing = false;

export function getEngagementSyncQueue() {
  if (!_queue) {
    const connection = getBullRedisConnection();
    if (!connection) return null;

    _queue = new Queue(QUEUE_NAME, {
      connection,
      defaultJobOptions: {
        attempts: 2,
        backoff: { type: "fixed", delay: 3000 },
        removeOnComplete: 20,
        removeOnFail: 20,
      },
    });

    _queue.on("error", (err) => {
      logger.warn(`EngagementSync Queue warning (non-fatal): ${err?.message || err}`);
    });
  }
  return _queue;
}

/**
 * Core synchronization: reads dirty post IDs from Redis and batch-persists to MongoDB.
 * Thread-safe / mutex-protected via _isFlushing flag.
 */
export async function flushEngagementToMongo() {
  if (_isFlushing) return;
  _isFlushing = true;

  try {
    for (const type of ["like", "save"]) {
      const dirtyKey = `dirty:${type}s`;
      const field = type === "save" ? "savedBy" : "likedBy";
      const timestampField = type === "save" ? "savedByTimestamps" : "likedByTimestamps";

      const dirtyPosts = await redisClient.sMembers(dirtyKey);
      if (!dirtyPosts || dirtyPosts.length === 0) continue;

      // Remove the dirty markers so any new likes during the batch write will be tracked in the next tick
      await redisClient.sRem(dirtyKey, dirtyPosts);

      const bulkOps = [];

      for (const postId of dirtyPosts) {
        if (!postId || postId === "null" || postId === "undefined") continue;

        const key = `post:${postId}:${type}d_by`;
        const exists = await redisClient.exists(key);
        if (!exists) continue;

        const raw = await redisClient.zRangeWithScores(key, 0, -1, { REV: true });
        const valid = raw.filter((r) => r.value && r.value !== "__empty__");

        const userIds = valid.map((r) => r.value);
        const timestamps = valid.map((r) => ({
          userId: r.value,
          timestamp: new Date(r.score),
        }));

        const updatePayload = {
          [field]: userIds,
          [timestampField]: timestamps,
        };

        if (type === "like") {
          updatePayload.likesCount = userIds.length;
        }

        bulkOps.push({
          updateOne: {
            filter: { _id: postId },
            update: { $set: updatePayload },
          },
        });
      }

      if (bulkOps.length > 0) {
        const result = await PropertyPost.bulkWrite(bulkOps, { ordered: false });
        logger.info(
          `[EngagementSync] Flushed ${result.modifiedCount || bulkOps.length}/${bulkOps.length} ${type} updates to MongoDB.`
        );
      }
    }

    // Flush dirty view counts
    const dirtyViews = await redisClient.sMembers("dirty:views");
    if (dirtyViews && dirtyViews.length > 0) {
      await redisClient.sRem("dirty:views", dirtyViews);
      const viewBulkOps = [];

      for (const postId of dirtyViews) {
        if (!postId || postId === "null" || postId === "undefined") continue;
        const countStr = await redisClient.get(`post:${postId}:views`);
        if (countStr !== null) {
          const viewCount = parseInt(countStr, 10) || 0;
          viewBulkOps.push({
            updateOne: {
              filter: { _id: postId },
              update: { $set: { viewCount } },
            },
          });
        }
      }

      if (viewBulkOps.length > 0) {
        const result = await PropertyPost.bulkWrite(viewBulkOps, { ordered: false });
        logger.info(
          `[EngagementSync] Flushed ${result.modifiedCount || viewBulkOps.length}/${viewBulkOps.length} views to MongoDB.`
        );
      }
    }

    // Flush dirty active users (lastActiveAt) in bulk
    const dirtyUsers = await redisClient.sMembers("dirty:users_active");
    if (dirtyUsers && dirtyUsers.length > 0) {
      await redisClient.sRem("dirty:users_active", dirtyUsers);
      const userBulkOps = [];

      for (const userId of dirtyUsers) {
        if (!userId || userId === "null" || userId === "undefined") continue;
        const score = await redisClient.zScore("users:last_active", userId);
        if (score !== null && score !== undefined) {
          userBulkOps.push({
            updateOne: {
              filter: { _id: userId },
              update: { $set: { lastActiveAt: new Date(score) } },
            },
          });
        }
      }

      if (userBulkOps.length > 0) {
        const User = (await import("../models/User.model.js")).default;
        const result = await User.bulkWrite(userBulkOps, { ordered: false });
        logger.info(
          `[EngagementSync] Flushed ${result.modifiedCount || userBulkOps.length}/${userBulkOps.length} user lastActiveAt updates to MongoDB.`
        );
      }
    }
  } catch (error) {
    logger.error("[EngagementSync] Error flushing engagement to MongoDB:", error);
  } finally {
    _isFlushing = false;
  }
}

/**
 * Initializes the BullMQ worker and schedules the 30-second repeatable sync job.
 */
export async function initEngagementSyncWorker() {
  if (_worker) return _worker;

  const connection = getBullRedisConnection();
  if (!connection) return null;

  const queue = getEngagementSyncQueue();
  if (queue) {
    // 1. 30-second repeatable engagement sync (likes, bookmarks, views, lastActiveAt)
    await queue.add(
      "flush-dirty-engagement",
      {},
      {
        repeat: { every: REPEAT_INTERVAL_MS },
        jobId: "engagement_flush_repeatable",
      }
    );

    // 2. 2-minute repeatable hot feed pre-computation
    await queue.add(
      "rebuild-hot-feed",
      {},
      {
        repeat: { every: 120_000 },
        jobId: "feed_ranking_repeatable",
      }
    );
  }

  _worker = new Worker(
    QUEUE_NAME,
    async (job) => {
      if (job?.name === "rebuild-hot-feed") {
        await rebuildHotFeeds();
      } else {
        await flushEngagementToMongo();
      }
    },
    {
      connection,
      concurrency: 1, // Only 1 job running at a time
    }
  );

  _worker.on("failed", (job, err) => {
    logger.warn(`Engagement sync job failed: ${err?.message || err}`);
  });

  _worker.on("error", (err) => {
    logger.warn(`Engagement sync worker warning (non-fatal): ${err?.message || err}`);
  });

  logger.info(`[EngagementSync] Worker started (every ${REPEAT_INTERVAL_MS / 1000}s flush)`);
  return _worker;
}

/**
 * Graceful shutdown: closes worker, queue, and runs a final flush to persist all in-flight engagement.
 */
export async function closeEngagementSyncQueue() {
  try {
    logger.info("[EngagementSync] Performing final flush before shutdown...");
    await flushEngagementToMongo();
  } catch (err) {
    logger.warn("[EngagementSync] Error during final shutdown flush:", err?.message);
  }

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
