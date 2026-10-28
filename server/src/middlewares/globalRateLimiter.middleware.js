import { logger } from "../utils/logger.js";
import redisClient from "../config/redisClient.config.js";

const WINDOW_MS = 60 * 1000; // 1 minute
const MAX_REQUESTS = 300; // 300 req/min per IP — generous for SPA polling

const inMemoryStore = new Map();

setInterval(() => {
  const now = Date.now();
  for (const [key, data] of inMemoryStore.entries()) {
    if (now - data.windowStart > WINDOW_MS) {
      inMemoryStore.delete(key);
    }
  }
}, 5 * 60 * 1000);

export async function globalRateLimiter(req, res, next) {
  const ip = req.ip || req.headers["x-forwarded-for"]?.split(",")[0]?.trim() || "unknown";
  const key = `grl:${ip}`;
  const maxRequests = MAX_REQUESTS;

  try {
    if (redisClient?.isOpen) {
      const count = await redisClient.incr(key);
      if (count === 1) {
        await redisClient.expire(key, Math.ceil(WINDOW_MS / 1000));
      }
      if (count > maxRequests) {
        const ttl = await redisClient.ttl(key);
        res.setHeader("Retry-After", Math.max(1, ttl));
        return res.status(429).json({
          success: false,
          message: "Too many requests. Wait a moment.",
          retryAfter: Math.max(1, ttl),
        });
      }
      return next();
    }
  } catch (_) {}

  const now = Date.now();
  const record = inMemoryStore.get(key);

  if (!record || now - record.windowStart > WINDOW_MS) {
    inMemoryStore.set(key, { count: 1, windowStart: now });
    return next();
  }

  record.count++;
  if (record.count > maxRequests) {
    const retryAfter = Math.ceil((record.windowStart + WINDOW_MS - now) / 1000);
    res.setHeader("Retry-After", Math.max(1, retryAfter));
    return res.status(429).json({
      success: false,
      message: "Too many requests. Wait a moment.",
      retryAfter: Math.max(1, retryAfter),
    });
  }

  next();
}
