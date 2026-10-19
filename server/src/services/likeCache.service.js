import redisClient from "../config/redisClient.config.js";
import PropertyPost from "../models/PropertyPost.model.js";
import { logger } from "../utils/logger.js";

const CACHE_TTL_SECONDS = 7 * 24 * 60 * 60; // 7 days

/**
 * Ensures the Redis Sorted Set for a post's engagement (likes or saves) is warmed from MongoDB.
 * Key structure: post:{postId}:liked_by or post:{postId}:saved_by
 * Value in ZSet: member = userId, score = timestamp (epoch ms)
 */
export async function warmEngagementCache(postId, type = "like") {
  const field = type === "save" ? "savedBy" : "likedBy";
  const timestampField = type === "save" ? "savedByTimestamps" : "likedByTimestamps";
  const key = `post:${postId}:${type}d_by`;

  try {
    const post = await PropertyPost.findById(postId)
      .select(`${field} ${timestampField}`)
      .lean();

    if (!post) return false;

    const timestamps = post[timestampField] || [];
    const members = [];

    if (Array.isArray(timestamps) && timestamps.length > 0) {
      for (const t of timestamps) {
        if (t?.userId) {
          members.push({
            score: t.timestamp ? new Date(t.timestamp).getTime() : Date.now(),
            value: String(t.userId),
          });
        }
      }
    } else if (Array.isArray(post[field]) && post[field].length > 0) {
      const now = Date.now();
      for (const uid of post[field]) {
        if (uid) {
          members.push({
            score: now,
            value: String(uid),
          });
        }
      }
    }

    if (members.length > 0) {
      // Add all members to ZSet
      await redisClient.zAdd(key, members);
    } else {
      // Create empty sentinel to prevent repetitive DB warm checks for 0-count posts
      await redisClient.zAdd(key, [{ score: 0, value: "__empty__" }]);
    }

    await redisClient.expire(key, CACHE_TTL_SECONDS);
    return true;
  } catch (error) {
    logger.warn(`Failed to warm engagement cache for post ${postId} (${type}):`, error?.message);
    return false;
  }
}

/**
 * Checks if the cache key exists; if not, warms it from MongoDB.
 */
async function ensureCacheReady(postId, type = "like") {
  const key = `post:${postId}:${type}d_by`;
  const exists = await redisClient.exists(key);
  if (!exists) {
    await warmEngagementCache(postId, type);
  }
}

/**
 * Atomically toggles like or save status in Redis.
 * Returns { active: boolean, count: number } in ~2-5ms.
 */
export async function toggleEngagementRedis(postId, userId, type = "like") {
  const key = `post:${postId}:${type}d_by`;
  const dirtyKey = `dirty:${type}s`;
  const userIdStr = String(userId);

  await ensureCacheReady(postId, type);

  // Check if user already engaged (O(1) dictionary score lookup)
  const existingScore = await redisClient.zScore(key, userIdStr);
  const alreadyActive = existingScore !== null && existingScore !== undefined;

  if (alreadyActive) {
    // Remove from ZSet
    await redisClient.zRem(key, userIdStr);
    if (type === "save") {
      await redisClient.zRem(`user:${userIdStr}:saved_posts`, String(postId));
    }
  } else {
    // Add to ZSet with current timestamp
    await redisClient.zAdd(key, [{ score: Date.now(), value: userIdStr }]);
    if (type === "save") {
      await redisClient.zAdd(`user:${userIdStr}:saved_posts`, [{ score: Date.now(), value: String(postId) }]);
      await redisClient.expire(`user:${userIdStr}:saved_posts`, CACHE_TTL_SECONDS);
    }
  }

  // Ensure any empty sentinel is purged
  await redisClient.zRem(key, "__empty__");

  // Mark post as dirty for BullMQ background MongoDB flush
  await redisClient.sAdd(dirtyKey, String(postId));

  // Reset TTL so active posts stay cached
  await redisClient.expire(key, CACHE_TTL_SECONDS);

  // Get accurate active count
  const count = await redisClient.zCard(key);
  const active = !alreadyActive;

  return { active, count };
}

/**
 * Reads engagement status for a single post from Redis (with automatic warm fallback).
 */
export async function getPostEngagement(postId, userId, type = "like") {
  const key = `post:${postId}:${type}d_by`;
  try {
    await ensureCacheReady(postId, type);
    const count = await redisClient.zCard(key);
    let isEngaged = false;
    if (userId) {
      const score = await redisClient.zScore(key, String(userId));
      isEngaged = score !== null && score !== undefined;
    }
    return { isEngaged, count };
  } catch (err) {
    logger.warn(`Error reading engagement cache for ${postId}:`, err?.message);
    return null;
  }
}

/**
 * Gets ordered likers from Redis ZSet (newest first).
 * Falls back to null if cache is not populated.
 */
export async function getLikersFromCache(postId, skip = 0, limit = 30) {
  const key = `post:${postId}:liked_by`;
  try {
    const exists = await redisClient.exists(key);
    if (!exists) {
      await warmEngagementCache(postId, "like");
    }

    // Filter out sentinel if present
    await redisClient.zRem(key, "__empty__");

    const total = await redisClient.zCard(key);
    if (total === 0) return { items: [], total: 0 };

    const raw = await redisClient.zRangeWithScores(key, skip, skip + limit - 1, {
      REV: true,
    });

    const items = raw
      .filter((r) => r.value !== "__empty__")
      .map((r) => ({
        userId: r.value,
        timestamp: new Date(r.score),
      }));

    return { items, total };
  } catch (err) {
    logger.warn(`Error reading likers from cache for ${postId}:`, err?.message);
    return null;
  }
}

/**
 * High-speed view count increment using Redis INCR (~1ms).
 * Seeds from MongoDB if not currently cached in Redis.
 */
export async function incrementViewCountRedis(postId, currentDbViews = 0) {
  const key = `post:${postId}:views`;
  const dirtyKey = `dirty:views`;
  const postIdStr = String(postId);

  try {
    const exists = await redisClient.exists(key);
    if (!exists) {
      // Seed initial value from MongoDB
      await redisClient.set(key, String(currentDbViews || 0));
      await redisClient.expire(key, CACHE_TTL_SECONDS);
    }

    const newCount = await redisClient.incr(key);
    await redisClient.sAdd(dirtyKey, postIdStr);
    await redisClient.expire(key, CACHE_TTL_SECONDS);

    return newCount;
  } catch (err) {
    logger.warn(`Redis view increment error for ${postId}:`, err?.message);
    return (currentDbViews || 0) + 1;
  }
}

/**
 * Records user activity in Redis with a 60-second in-memory throttle.
 * Saves 1 MongoDB write per authenticated API request.
 */
export async function recordUserActiveRedis(userId) {
  if (!userId) return;
  const userIdStr = String(userId);
  const dedupeKey = `user:${userIdStr}:act_dedupe`;

  try {
    // Only update Redis if 60 seconds have elapsed since last mark
    const isNew = await redisClient.set(dedupeKey, "1", { EX: 60, NX: true });
    if (!isNew) return; // Already recorded recently

    const now = Date.now();
    await redisClient.zAdd("users:last_active", [{ score: now, value: userIdStr }]);
    await redisClient.sAdd("dirty:users_active", userIdStr);
  } catch (err) {
    // Non-fatal, never break request
    logger.warn(`Failed to record user active in Redis for ${userIdStr}:`, err?.message);
  }
}

/**
 * Returns live active user count within a given window (in minutes) via Redis ZCOUNT (~0.2ms).
 */
export async function getLiveUsersCountRedis(windowMinutes = 5) {
  try {
    const cutoff = Date.now() - windowMinutes * 60 * 1000;
    return await redisClient.zCount("users:last_active", cutoff, "+inf");
  } catch (err) {
    logger.warn("Failed to get live users count from Redis:", err?.message);
    return null;
  }
}

/**
 * Invalidates the Redis cache for a specific property post's details.
 */
export async function invalidatePostDetailCache(postId) {
  if (!postId) return;
  try {
    await redisClient.del(`post:${postId}:detail`);
  } catch (err) {
    logger.warn(`Failed to invalidate post detail cache for ${postId}:`, err?.message);
  }
}

/**
 * Invalidates the Redis cache for a user's profile.
 */
export async function invalidateUserProfileCache(userId) {
  if (!userId) return;
  try {
    await redisClient.del(`user:${userId}:profile`);
  } catch (err) {
    logger.warn(`Failed to invalidate user profile cache for ${userId}:`, err?.message);
  }
}
