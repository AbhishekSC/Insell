import PropertyPost from "../models/PropertyPost.model.js";
import redisClient from "../config/redisClient.config.js";
import { logger } from "../utils/logger.js";

const MAP_PINS_CACHE_KEY = "property:map-pins";
const MAP_PINS_CACHE_TTL = 120;
const MAP_PINS_PROJECTION =
  "_id title price latitude longitude city locality area listingType propertyType postType bedrooms bathrooms mediaUrls postMeta.flatmate.genderPreference postMeta.flatmate.rentPerPerson";

const FEED_LIMITS = [8, 12];

export async function warmFeedAndMapCaches() {
  try {
    const baseFilter = { isDeleted: { $ne: true }, isBlocked: { $ne: true } };

    const [feedPosts, mapPins] = await Promise.all([
      PropertyPost.find(baseFilter)
        .sort({ createdAt: -1 })
        .limit(12)
        .lean(),
      PropertyPost.find({
        ...baseFilter,
        latitude: { $exists: true, $ne: null },
        longitude: { $exists: true, $ne: null },
      })
        .select(MAP_PINS_PROJECTION)
        .sort({ createdAt: -1 })
        .limit(500)
        .lean(),
    ]);

    const total = await PropertyPost.countDocuments(baseFilter);

    const cacheOps = [];

    for (const limit of FEED_LIMITS) {
      const key = `property:feed:shared:1:${limit}:::::`;
      const posts = feedPosts.slice(0, limit);
      cacheOps.push(
        redisClient.setEx(key, 180, JSON.stringify({ posts, total }))
      );
    }

    const trimmedPins = mapPins.map((p) => ({
      ...p,
      mediaUrls: p.mediaUrls?.length ? [p.mediaUrls[0]] : [],
    }));
    cacheOps.push(
      redisClient.setEx(
        MAP_PINS_CACHE_KEY,
        MAP_PINS_CACHE_TTL,
        JSON.stringify(trimmedPins)
      )
    );

    await Promise.all(cacheOps);
    logger.info(
      `Cache warm-up complete: feed (${feedPosts.length} posts), map-pins (${trimmedPins.length} pins)`
    );
  } catch (err) {
    logger.warn("Cache warm-up failed (non-fatal):", err?.message);
  }
}
