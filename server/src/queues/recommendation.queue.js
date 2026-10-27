import { Queue, Worker } from "bullmq";
import { getBullRedisConnection } from "../config/bullmq.config.js";
import redisClient from "../config/redisClient.config.js";
import { logger } from "../utils/logger.js";
import User from "../models/User.model.js";
import PersonalizationService from "../services/PersonalizationService.js";

const QUEUE_NAME = "recommendation_precompute_queue";
const REPEAT_INTERVAL_MS = 2 * 60 * 60 * 1000; // 2 hours
const CANDIDATE_POOL_SIZE = 50;
const CANDIDATE_TTL_SECONDS = 12 * 60 * 60; // 12 hours

let _queue = null;
let _worker = null;
let _isPrecomputing = false;

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function getRecommendationQueue() {
  if (!_queue) {
    const connection = getBullRedisConnection();
    if (!connection) return null;

    _queue = new Queue(QUEUE_NAME, {
      connection,
      defaultJobOptions: {
        attempts: 2,
        backoff: { type: "fixed", delay: 5000 },
        removeOnComplete: 20,
        removeOnFail: 20,
      },
    });

    _queue.on("error", (err) => {
      logger.warn(`[RecommendationQueue] Queue warning (non-fatal): ${err?.message || err}`);
    });
  }
  return _queue;
}

/**
 * Pre-computes and caches the candidate recommendation pool for a single user in Redis.
 * Stored as a Redis Sorted Set: key = user:${userId}:feed_candidates
 */
export async function precomputeUserRecommendations(userId) {
  if (!userId) return false;
  const uid = String(userId);
  const cacheKey = `user:${uid}:feed_candidates`;

  try {
    const recommendations = await PersonalizationService.getPersonalizedRecommendations(
      uid,
      CANDIDATE_POOL_SIZE
    );

    if (!Array.isArray(recommendations) || recommendations.length === 0) {
      return false;
    }

    const members = recommendations.map((post, idx) => ({
      score: Number(post.personalizationScore) || (CANDIDATE_POOL_SIZE - idx),
      value: String(post._id),
    }));

    // Atomically replace the candidate sorted set in Redis
    await redisClient.del(cacheKey);
    await redisClient.zAdd(cacheKey, members);
    await redisClient.expire(cacheKey, CANDIDATE_TTL_SECONDS);

    logger.info(`[RecommendationQueue] Pre-computed ${members.length} candidates for user ${uid}`);
    return true;
  } catch (err) {
    logger.warn(`[RecommendationQueue] Failed to precompute for user ${uid}: ${err?.message || err}`);
    return false;
  }
}

/**
 * Enqueue on-demand candidate pre-computation for a single user (e.g. on login or feed miss)
 */
export async function enqueueUserRecommendationPrecompute(userId) {
  if (!userId) return null;
  try {
    const q = getRecommendationQueue();
    if (!q) return null;
    return await q.add(
      "precompute-single-user",
      { userId: String(userId) },
      { jobId: `precompute:${userId}`, removeOnComplete: true }
    );
  } catch (err) {
    logger.warn(`[RecommendationQueue] Enqueue single user error: ${err?.message || err}`);
    return null;
  }
}

/**
 * Sweeps all users active in the past 7 days and precomputes their candidate pools.
 */
export async function sweepActiveUsersRecommendations() {
  if (_isPrecomputing) return;
  _isPrecomputing = true;

  try {
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const activeUsers = await User.find({
      lastActiveAt: { $gte: sevenDaysAgo },
      isDeleted: { $ne: true },
    })
      .select("_id")
      .limit(150)
      .lean();

    logger.info(`[RecommendationQueue] Starting periodic sweep for ${activeUsers.length} active users`);

    for (const u of activeUsers) {
      await precomputeUserRecommendations(u._id);
      await sleep(100); // Polite 100ms throttle between users to keep CPU low
    }

    logger.info(`[RecommendationQueue] Completed periodic sweep for active users`);
  } catch (err) {
    logger.warn(`[RecommendationQueue] Sweep error: ${err?.message || err}`);
  } finally {
    _isPrecomputing = false;
  }
}

/**
 * Initializes the recommendation worker and schedules the 2-hour repeatable job.
 */
export async function initRecommendationWorker() {
  if (_worker) return _worker;

  const connection = getBullRedisConnection();
  if (!connection) {
    logger.warn("[RecommendationQueue] Redis connection not ready; worker deferred.");
    return null;
  }

  const queue = getRecommendationQueue();
  if (queue) {
    try {
      await queue.add(
        "sweep-active-users",
        {},
        {
          repeat: { every: REPEAT_INTERVAL_MS },
          jobId: "recommendation_sweep_repeatable",
        }
      );
    } catch (schedErr) {
      logger.warn("[RecommendationQueue] Scheduling error (non-fatal):", schedErr?.message);
    }
  }

  _worker = new Worker(
    QUEUE_NAME,
    async (job) => {
      const { name, data } = job;
      if (name === "precompute-single-user") {
        await precomputeUserRecommendations(data?.userId);
      } else {
        await sweepActiveUsersRecommendations();
      }
    },
    {
      connection,
      concurrency: 1, // Strict single-concurrency for gentle background execution
    }
  );

  _worker.on("failed", (job, err) => {
    logger.warn(`[RecommendationQueue] Job ${job?.id} failed: ${err?.message || err}`);
  });

  _worker.on("error", (err) => {
    logger.warn(`[RecommendationQueue] Worker warning: ${err?.message || err}`);
  });

  logger.info("[RecommendationQueue] Worker started (2-hour sweep cycle)");
  return _worker;
}

export async function closeRecommendationQueue() {
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
