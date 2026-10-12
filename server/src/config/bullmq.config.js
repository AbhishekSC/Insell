import Redis from "ioredis";
import { logger } from "../utils/logger.js";
import "dotenv/config";

let _redisConnection = null;

export function getBullRedisConnection() {
  if (!_redisConnection) {
    const redisUrl = process.env.REDIS_URI || "redis://localhost:6379";
    try {
      _redisConnection = new Redis(redisUrl, {
        maxRetriesPerRequest: null,
        enableReadyCheck: false,
        lazyConnect: true,
        retryStrategy(times) {
          if (times > 5) {
            logger.warn("BullMQ Redis retry limit reached; backoff 5s.");
            return 5000;
          }
          return Math.min(times * 500, 2000);
        },
      });

      _redisConnection.on("error", (err) => {
        logger.warn("BullMQ Redis connection warning:", err?.message || err);
      });
    } catch (err) {
      logger.error("Failed to initialize BullMQ Redis connection:", err);
      return null;
    }
  }
  return _redisConnection;
}

export async function closeBullConnection() {
  if (_redisConnection) {
    try {
      await _redisConnection.quit();
      logger.info("BullMQ Redis connection closed");
    } catch (err) {
      logger.warn("Error closing BullMQ Redis connection:", err?.message);
    } finally {
      _redisConnection = null;
    }
  }
}
