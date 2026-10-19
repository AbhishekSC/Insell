import PropertyPost from "../models/PropertyPost.model.js";
import "../models/User.model.js";
import redisClient from "../config/redisClient.config.js";
import { logger } from "../utils/logger.js";

const HOT_FEED_CACHE_TTL_SECONDS = 10 * 60; // 10 minutes cache

/**
 * Calculates a dynamic engagement & time-decay "Hotness" score for a property post.
 * Favors recent posts with high view/like/save activity and active boosts.
 */
export function calculateHotnessScore(post) {
  if (!post) return 0;

  const likes = Array.isArray(post.likedBy) ? post.likedBy.length : Number(post.likesCount || 0);
  const saves = Array.isArray(post.savedBy) ? post.savedBy.length : Number(post.savesCount || 0);
  const views = Number(post.viewCount || post.views || 0);
  const isBoosted = Boolean(
    post.isBoosted &&
    post.boostExpiresAt &&
    new Date(post.boostExpiresAt).getTime() > Date.now()
  );

  // Time elapsed in hours since publication
  const createdAtMs = post.createdAt ? new Date(post.createdAt).getTime() : Date.now();
  const hoursAgo = Math.max(0, (Date.now() - createdAtMs) / (1000 * 60 * 60));

  // Weighted engagement numerator
  const engagement = (views * 1) + (likes * 3) + (saves * 4) + (isBoosted ? 60 : 0);

  // Gravity/decay denominator (Hacker News style decay)
  const decay = Math.pow(hoursAgo + 2, 1.35);

  return parseFloat((engagement / decay).toFixed(4));
}

/**
 * Retrieves the top hot, engagement-ranked property listings for a given city from Redis cache.
 * If cache misses, computes the ranked list from MongoDB and warms Redis.
 *
 * @param {string} city - Target city name (e.g. 'Ratlam', 'Indore')
 * @param {number} [limit=20] - Max posts to return
 * @returns {Promise<Array>} Ranked hot posts
 */
export async function getHotPostsByCity(city = "", limit = 20) {
  const normalizedCity = String(city || "").trim().toLowerCase();
  const cacheKey = `feed:hot:city:${normalizedCity || "all"}:${limit}`;

  // 1. Try reading from Redis cache
  try {
    const cached = await redisClient.get(cacheKey);
    if (cached) {
      logger.info(`⚡ Redis Cache HIT for hot feed (${normalizedCity || "all"})`);
      return JSON.parse(cached);
    }
  } catch (err) {
    logger.warn("Redis read error in HotFeedCacheService:", err);
  }

  // 2. Cache miss: Query MongoDB for candidate posts
  const query = {
    isDeleted: { $ne: true },
    isBlocked: { $ne: true },
    status: "PUBLISHED",
  };

  if (normalizedCity) {
    query.city = new RegExp(`^${normalizedCity}$`, "i");
  }

  const candidatePosts = await PropertyPost.find(query)
    .populate("author", "fullName profilePic activeRole primaryRole city isVerified isOwnerVerified ratingAvg ratingCount responseRate")
    .limit(100)
    .lean();

  // 3. Compute hotness score and sort descending
  const scoredPosts = candidatePosts.map((post) => {
    const hotnessScore = calculateHotnessScore(post);
    const likedBy = Array.isArray(post.likedBy) ? post.likedBy.map((item) => String(item)) : [];
    const savedBy = Array.isArray(post.savedBy) ? post.savedBy.map((item) => String(item)) : [];

    return {
      ...post,
      hotnessScore,
      likesCount: likedBy.length,
      savesCount: savedBy.length,
    };
  });

  scoredPosts.sort((a, b) => b.hotnessScore - a.hotnessScore);
  const topHotPosts = scoredPosts.slice(0, limit);

  // 4. Warm Redis cache
  try {
    if (topHotPosts.length > 0) {
      await redisClient.setEx(cacheKey, HOT_FEED_CACHE_TTL_SECONDS, JSON.stringify(topHotPosts));
      logger.info(`💾 Cached ${topHotPosts.length} hot posts in Redis for (${normalizedCity || "all"})`);
    }
  } catch (err) {
    logger.warn("Redis write error in HotFeedCacheService:", err);
  }

  return topHotPosts;
}

/**
 * Invalidates the hot feed cache for a specific city.
 */
export async function invalidateHotCityCache(city = "") {
  try {
    const normalizedCity = String(city || "").trim().toLowerCase();
    const pattern = `feed:hot:city:${normalizedCity || "all"}:*`;
    for await (const key of redisClient.scanIterator({ MATCH: pattern, COUNT: 50 })) {
      await redisClient.del(key);
    }
  } catch (err) {
    logger.warn("Error invalidating hot feed cache:", err);
  }
}

/**
 * Background worker task: pre-computes engagement & time-decay rankings
 * for all top active cities and the global feed.
 * Runs every 2 minutes via BullMQ, keeping the feed 100% warm in Redis.
 */
export async function rebuildHotFeeds() {
  try {
    logger.info("🔥 [FeedRankingWorker] Pre-computing hot feeds...");

    const activeCities = await PropertyPost.distinct("city", {
      isDeleted: { $ne: true },
      isBlocked: { $ne: true },
      status: "PUBLISHED",
    });

    const citiesToPrecompute = ["", ...(activeCities || []).filter(Boolean).slice(0, 15)];

    for (const city of citiesToPrecompute) {
      const normalizedCity = String(city || "").trim().toLowerCase();
      const cacheKey = `feed:hot:city:${normalizedCity || "all"}:20`;

      const query = {
        isDeleted: { $ne: true },
        isBlocked: { $ne: true },
        status: "PUBLISHED",
      };

      if (normalizedCity) {
        query.city = new RegExp(`^${normalizedCity}$`, "i");
      }

      const candidatePosts = await PropertyPost.find(query)
        .populate("author", "fullName profilePic activeRole primaryRole city isVerified isOwnerVerified ratingAvg ratingCount responseRate")
        .limit(100)
        .lean();

      if (!candidatePosts || candidatePosts.length === 0) continue;

      const scoredPosts = candidatePosts.map((post) => {
        const hotnessScore = calculateHotnessScore(post);
        const likedBy = Array.isArray(post.likedBy) ? post.likedBy.map((item) => String(item)) : [];
        const savedBy = Array.isArray(post.savedBy) ? post.savedBy.map((item) => String(item)) : [];

        return {
          ...post,
          hotnessScore,
          likesCount: likedBy.length,
          savesCount: savedBy.length,
        };
      });

      scoredPosts.sort((a, b) => b.hotnessScore - a.hotnessScore);
      const topHotPosts = scoredPosts.slice(0, 20);

      await redisClient.setEx(cacheKey, HOT_FEED_CACHE_TTL_SECONDS, JSON.stringify(topHotPosts));
    }

    logger.info(`🔥 [FeedRankingWorker] Pre-computed hot feeds for ${citiesToPrecompute.length} cities.`);
  } catch (error) {
    logger.warn("🔥 [FeedRankingWorker] Error pre-computing hot feeds:", error?.message);
  }
}
