import redisClient from "../../config/redisClient.config.js";
import { logger } from "../../utils/logger.js";

const CANDIDATE_POOL_SIZE = 200;
const CANDIDATE_TTL_SECONDS = 12 * 60 * 60;

export async function precomputeUserRecommendations(userId) {
  if (!userId) return false;
  const uid = String(userId);
  const cacheKey = `user:${uid}:feed_candidates`;

  try {
    const PersonalizationService = (await import("../../services/PersonalizationService.js")).default;

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

    await redisClient.del(cacheKey);
    await redisClient.zAdd(cacheKey, members);
    await redisClient.expire(cacheKey, CANDIDATE_TTL_SECONDS);

    logger.info(`[Ingestion] Pre-computed ${members.length} candidates for user ${uid}`);
    return true;
  } catch (err) {
    logger.warn(`[Ingestion] Failed to precompute for user ${uid}: ${err?.message || err}`);
    return false;
  }
}
