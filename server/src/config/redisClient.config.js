import { createClient } from "redis";
import "dotenv/config"
import { logger } from "../utils/logger.js";

const redisUrl = process.env.REDIS_URI;

if (!redisUrl) {
  logger.error("❌ REDIS_URI is not defined in environment variables.");
  throw new Error("REDIS_URI is not defined in environment variables.");
}

const redisClient = createClient({ url: redisUrl });

redisClient.on("connect", () => {
  logger.info("Redis client connecting...");
});

redisClient.on("ready", () => {
  logger.info("Redis client connected and ready!");
});

redisClient.on("error", (err) => {
  logger.error("Redis Client Error:", err);
});

redisClient.on("end", () => {
  logger.warn("Redis client disconnected.");
});

// Connect to Redis
redisClient.connect().catch((err) => {
  logger.error("Redis connection failed:", err);
  process.exit(1);
});

// Graceful shutdown
process.on("SIGINT", async () => {
  await redisClient.quit();
  logger.info("Redis client closed. Exiting process.");
  process.exit(0);
});

export default redisClient;
