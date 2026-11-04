import mongoose from "mongoose";
import redisClient from "../../config/redisClient.config.js";
import { getQueuesHealth } from "../../jobs/bullboard.js";
import { logger } from "../../utils/logger.js";
import { SERVICE_NAMES, STATUS, PROBE_TIMEOUT_MS } from "./systemHealth.constants.js";

function withTimeout(promise, ms) {
  return Promise.race([
    promise,
    new Promise((_, reject) => setTimeout(() => reject(new Error("Probe timed out")), ms)),
  ]);
}

async function probeMongo() {
  const start = Date.now();
  try {
    const state = mongoose.connection.readyState;
    if (state !== 1) {
      return { name: SERVICE_NAMES.MONGO, status: STATUS.UNHEALTHY, latencyMs: Date.now() - start, message: `readyState=${state}` };
    }
    await withTimeout(mongoose.connection.db.admin().ping(), PROBE_TIMEOUT_MS);
    return { name: SERVICE_NAMES.MONGO, status: STATUS.HEALTHY, latencyMs: Date.now() - start };
  } catch (err) {
    return { name: SERVICE_NAMES.MONGO, status: STATUS.UNHEALTHY, latencyMs: Date.now() - start, message: err.message };
  }
}

async function probeRedis() {
  const start = Date.now();
  try {
    if (!redisClient || typeof redisClient.ping !== "function") {
      return { name: SERVICE_NAMES.REDIS, status: STATUS.UNCONFIGURED, latencyMs: 0 };
    }
    await withTimeout(redisClient.ping(), PROBE_TIMEOUT_MS);
    return { name: SERVICE_NAMES.REDIS, status: STATUS.HEALTHY, latencyMs: Date.now() - start };
  } catch (err) {
    return { name: SERVICE_NAMES.REDIS, status: STATUS.UNHEALTHY, latencyMs: Date.now() - start, message: err.message };
  }
}

async function probeStream() {
  const start = Date.now();
  try {
    const apiKey = process.env.STREAM_API_KEY;
    const apiSecret = process.env.STREAM_API_SECRET;
    if (!apiKey || !apiSecret) {
      return { name: SERVICE_NAMES.STREAM, status: STATUS.UNCONFIGURED, latencyMs: 0 };
    }
    const { StreamChat } = await import("stream-chat");
    const client = StreamChat.getInstance(apiKey, apiSecret);
    await withTimeout(client.getAppSettings(), PROBE_TIMEOUT_MS);
    return { name: SERVICE_NAMES.STREAM, status: STATUS.HEALTHY, latencyMs: Date.now() - start };
  } catch (err) {
    return { name: SERVICE_NAMES.STREAM, status: STATUS.UNHEALTHY, latencyMs: Date.now() - start, message: err.message };
  }
}

async function probeFirebase() {
  const start = Date.now();
  try {
    const raw = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
    if (!raw) {
      return { name: SERVICE_NAMES.FIREBASE, status: STATUS.UNCONFIGURED, latencyMs: 0 };
    }
    JSON.parse(raw);
    return { name: SERVICE_NAMES.FIREBASE, status: STATUS.HEALTHY, latencyMs: Date.now() - start, message: "configured" };
  } catch (err) {
    return { name: SERVICE_NAMES.FIREBASE, status: STATUS.UNHEALTHY, latencyMs: Date.now() - start, message: err.message };
  }
}

async function probeCloudinary() {
  const start = Date.now();
  try {
    const { cloudinaryInstance, configureCloudinary } = await import("../../config/cloudinary.js");
    configureCloudinary();
    const result = await withTimeout(cloudinaryInstance.api.ping(), PROBE_TIMEOUT_MS);
    if (result?.status === "ok") {
      return { name: SERVICE_NAMES.CLOUDINARY, status: STATUS.HEALTHY, latencyMs: Date.now() - start };
    }
    return { name: SERVICE_NAMES.CLOUDINARY, status: STATUS.DEGRADED, latencyMs: Date.now() - start, message: "Unexpected ping response" };
  } catch (err) {
    return { name: SERVICE_NAMES.CLOUDINARY, status: STATUS.UNHEALTHY, latencyMs: Date.now() - start, message: err.message };
  }
}

async function probeBullMQ() {
  const start = Date.now();
  try {
    const health = await withTimeout(getQueuesHealth(), PROBE_TIMEOUT_MS);
    const hasFailures = Object.values(health).some((q) => (q.failed || 0) > 0);
    const hasErrors = Object.values(health).some((q) => q.status === "error" || q.status === "unavailable");
    let status = STATUS.HEALTHY;
    if (hasErrors) status = STATUS.UNHEALTHY;
    else if (hasFailures) status = STATUS.DEGRADED;
    return { name: SERVICE_NAMES.BULLMQ, status, latencyMs: Date.now() - start, queues: health };
  } catch (err) {
    return { name: SERVICE_NAMES.BULLMQ, status: STATUS.UNHEALTHY, latencyMs: Date.now() - start, message: err.message };
  }
}

export async function getSystemHealth() {
  const probes = await Promise.allSettled([
    probeMongo(),
    probeRedis(),
    probeStream(),
    probeFirebase(),
    probeCloudinary(),
    probeBullMQ(),
  ]);

  const services = probes.map((p) =>
    p.status === "fulfilled"
      ? p.value
      : { name: "unknown", status: STATUS.UNHEALTHY, message: p.reason?.message }
  );

  const hasUnhealthy = services.some((s) => s.status === STATUS.UNHEALTHY);
  const hasDegraded = services.some((s) => s.status === STATUS.DEGRADED);
  const overall = hasUnhealthy ? STATUS.UNHEALTHY : hasDegraded ? STATUS.DEGRADED : STATUS.HEALTHY;

  return {
    status: overall,
    uptime: process.uptime(),
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || "development",
    nodeVersion: process.version,
    pid: process.pid,
    memory: {
      rss: Math.round(process.memoryUsage().rss / 1024 / 1024),
      heapUsed: Math.round(process.memoryUsage().heapUsed / 1024 / 1024),
      heapTotal: Math.round(process.memoryUsage().heapTotal / 1024 / 1024),
    },
    services,
  };
}
