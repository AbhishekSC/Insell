import redisClient from "../config/redisClient.config.js";
import { logger } from "../utils/logger.js";

const DEFAULT_TTL = 60;
const CACHE_PREFIX = "rc:";

function defaultKeyFn(req) {
  return req.originalUrl;
}

export function cacheResponse(ttlSeconds = DEFAULT_TTL, keyFn = defaultKeyFn) {
  return async (req, res, next) => {
    if (req.method !== "GET") return next();

    const cacheKey = `${CACHE_PREFIX}${keyFn(req)}`;

    try {
      if (redisClient && typeof redisClient.get === "function") {
        const cached = await redisClient.get(cacheKey);
        if (cached) {
          const parsed = JSON.parse(cached);
          res.setHeader("X-Cache", "HIT");
          return res.status(parsed._status || 200).json(parsed._body);
        }
      }
    } catch (err) {
      logger.warn("Cache read error, proceeding without cache", { key: cacheKey, error: err.message });
    }

    res.setHeader("X-Cache", "MISS");

    const originalJson = res.json.bind(res);
    res.json = function (body) {
      if (res.statusCode >= 200 && res.statusCode < 300) {
        const payload = JSON.stringify({ _status: res.statusCode, _body: body });
        try {
          if (redisClient && typeof redisClient.setex === "function") {
            redisClient.setex(cacheKey, ttlSeconds, payload).catch((err) => {
              logger.warn("Cache write error", { key: cacheKey, error: err.message });
            });
          }
        } catch (_) {}
      }
      return originalJson(body);
    };

    next();
  };
}

export async function invalidateCache(pattern) {
  try {
    if (!redisClient || typeof redisClient.keys !== "function") return;
    const keys = await redisClient.keys(`${CACHE_PREFIX}${pattern}`);
    if (keys.length > 0) {
      await redisClient.del(...keys);
    }
  } catch (err) {
    logger.warn("Cache invalidation error", { pattern, error: err.message });
  }
}

export function invalidateCacheKey(key) {
  try {
    if (redisClient && typeof redisClient.del === "function") {
      return redisClient.del(`${CACHE_PREFIX}${key}`).catch(() => {});
    }
  } catch (_) {}
}
