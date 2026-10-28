import redisClient from "../../config/redisClient.config.js";
import { logger } from "../../utils/logger.js";
import { rebuildHotFeeds } from "../../services/HotFeedCacheService.js";
import { invalidateHotCityCache } from "../../services/HotFeedCacheService.js";

let _isFlushing = false;
let _isPrecomputing = false;

async function flushEngagementToMongo() {
  if (_isFlushing) return;
  _isFlushing = true;

  try {
    const PropertyPost = (await import("../../models/PropertyPost.model.js")).default;

    for (const type of ["like", "save"]) {
      const dirtyKey = `dirty:${type}s`;
      const field = type === "save" ? "savedBy" : "likedBy";
      const timestampField = type === "save" ? "savedByTimestamps" : "likedByTimestamps";

      const dirtyPosts = await redisClient.sMembers(dirtyKey);
      if (!dirtyPosts || dirtyPosts.length === 0) continue;

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

        const updatePayload = { [field]: userIds, [timestampField]: timestamps };
        if (type === "like") updatePayload.likesCount = userIds.length;

        bulkOps.push({
          updateOne: {
            filter: { _id: postId },
            update: { $set: updatePayload },
          },
        });
      }

      if (bulkOps.length > 0) {
        const result = await PropertyPost.bulkWrite(bulkOps, { ordered: false });
        logger.info(`[Ingestion] Flushed ${result.modifiedCount || bulkOps.length}/${bulkOps.length} ${type} updates`);
      }
    }

    const dirtyViews = await redisClient.sMembers("dirty:views");
    if (dirtyViews && dirtyViews.length > 0) {
      await redisClient.sRem("dirty:views", dirtyViews);
      const viewBulkOps = [];

      for (const postId of dirtyViews) {
        if (!postId || postId === "null" || postId === "undefined") continue;
        const countStr = await redisClient.get(`post:${postId}:views`);
        if (countStr !== null) {
          viewBulkOps.push({
            updateOne: {
              filter: { _id: postId },
              update: { $set: { viewCount: parseInt(countStr, 10) || 0 } },
            },
          });
        }
      }

      if (viewBulkOps.length > 0) {
        const result = await PropertyPost.bulkWrite(viewBulkOps, { ordered: false });
        logger.info(`[Ingestion] Flushed ${result.modifiedCount || viewBulkOps.length}/${viewBulkOps.length} views`);
      }
    }

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
        const User = (await import("../../models/User.model.js")).default;
        const result = await User.bulkWrite(userBulkOps, { ordered: false });
        logger.info(`[Ingestion] Flushed ${result.modifiedCount || userBulkOps.length}/${userBulkOps.length} user activity`);
      }
    }
  } catch (error) {
    logger.error("[Ingestion] Error flushing engagement:", error);
  } finally {
    _isFlushing = false;
  }
}

async function sweepActiveUsersRecommendations() {
  if (_isPrecomputing) return;
  _isPrecomputing = true;

  try {
    const User = (await import("../../models/User.model.js")).default;
    const { precomputeUserRecommendations } = await import("./recommendation.helpers.js");

    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const activeUsers = await User.find({
      lastActiveAt: { $gte: sevenDaysAgo },
      isDeleted: { $ne: true },
    })
      .select("_id")
      .limit(150)
      .lean();

    logger.info(`[Ingestion] Starting recommendation sweep for ${activeUsers.length} active users`);

    for (const u of activeUsers) {
      await precomputeUserRecommendations(u._id);
      await new Promise((r) => setTimeout(r, 100));
    }

    logger.info("[Ingestion] Completed recommendation sweep");
  } catch (err) {
    logger.warn(`[Ingestion] Sweep error: ${err?.message || err}`);
  } finally {
    _isPrecomputing = false;
  }
}

export async function processIngestionJob(job) {
  const { name, data } = job;

  switch (name) {
    case "flush-dirty-engagement":
      return await flushEngagementToMongo();

    case "rebuild-hot-feed":
      return await rebuildHotFeeds();

    case "enrich-post": {
      const { city } = data;
      if (city) await invalidateHotCityCache(city);
      logger.info(`[Ingestion] Enriched post ${data.postId}`);
      return;
    }

    case "price-drop-fanout": {
      const { postId, oldPrice } = data;
      const dedupKey = `idempotency:price_drop:${postId}:${oldPrice}`;
      const isFirstExecution = await redisClient.set(dedupKey, "locked", { EX: 3600, NX: true });
      if (!isFirstExecution) {
        logger.info(`[Ingestion] Skipping duplicate price-drop fanout for ${postId}`);
        return;
      }
      const PropertyPost = (await import("../../models/PropertyPost.model.js")).default;
      const { notifyTriggeredAlerts } = await import("../../modules/price-alert/priceAlert.app.service.js");
      const { notifyPriceChange } = await import("../../controllers/propertyPost.controller.js");
      const post = await PropertyPost.findById(postId).lean();
      if (post) {
        const alertedUserIds = await notifyTriggeredAlerts(post, oldPrice);
        await notifyPriceChange(post, oldPrice, new Set((alertedUserIds || []).map(String)));
        logger.info(`[Ingestion] Price drop fanout complete for ${postId}`);
      }
      return;
    }

    case "sweep-active-users":
      return await sweepActiveUsersRecommendations();

    case "precompute-single-user": {
      const { precomputeUserRecommendations } = await import("./recommendation.helpers.js");
      return await precomputeUserRecommendations(data?.userId);
    }

    default:
      logger.warn(`Unknown ingestion job: ${name}`);
  }
}

export { flushEngagementToMongo };
