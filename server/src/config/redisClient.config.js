import { createClient } from "redis";
import { logger } from "../utils/logger.js";

let _client = null;

// Proxy forwards all calls to the real client once connectToRedis() is called
const redisClient = new Proxy({}, {
  get(_, prop) {
    if (!_client) throw new Error(`Redis not initialized. Ensure connectToRedis() is called first.`);
    if (prop === "del") {
      return (...args) => {
        const flat = args.flat(Infinity).filter((k) => typeof k === "string" && k.trim().length > 0);
        if (flat.length === 0) return Promise.resolve(0);
        return _client.del(flat.length === 1 ? flat[0] : flat);
      };
    }
    const val = _client[prop];
    return typeof val === "function" ? val.bind(_client) : val;
  }
});

export async function connectToRedis() {
  const redisUrl = process.env.REDIS_URI;
  if (!redisUrl) {
    logger.error("❌ REDIS_URI is not defined in environment variables.");
    throw new Error("REDIS_URI is not defined in environment variables.");
  }

  _client = createClient({ url: redisUrl });

  // Patch sendCommand directly to intercept any DEL command with 0 key arguments
  const rawSendCommand = _client.sendCommand.bind(_client);
  _client.sendCommand = (args, options) => {
    if (Array.isArray(args) && args.length > 0 && String(args[0]).toUpperCase() === "DEL") {
      if (args.length === 1) {
        return Promise.resolve(0);
      }
    }
    return rawSendCommand(args, options);
  };

  const rawDel = _client.del.bind(_client);
  _client.del = (...args) => {
    const flat = args.flat(Infinity).filter((k) => typeof k === "string" && k.trim().length > 0);
    if (flat.length === 0) return Promise.resolve(0);
    return rawDel(flat.length === 1 ? flat[0] : flat);
  };

  _client.on("connect", () => logger.info("Redis client connecting..."));
  _client.on("ready", () => logger.info("Redis client connected and ready!"));
  _client.on("error", (err) => logger.error("Redis Client Error:", err));
  _client.on("end", () => logger.warn("Redis client disconnected."));

  await _client.connect();
  return _client;
}

// Call during a coordinated shutdown (see server.js) — do not attach signal
// handlers here, since multiple independent SIGINT listeners racing to call
// process.exit() can cut off other resources' cleanup mid-flight.
export async function closeRedisConnection() {
  if (!_client) return;
  await _client.quit();
  logger.info("Redis client closed");
}

export default redisClient;
