export const SERVICE_NAMES = {
  MONGO: "mongodb",
  REDIS: "redis",
  STREAM: "stream",
  FIREBASE: "firebase",
  CLOUDINARY: "cloudinary",
  BULLMQ: "bullmq",
};

export const STATUS = {
  HEALTHY: "healthy",
  DEGRADED: "degraded",
  UNHEALTHY: "unhealthy",
  UNCONFIGURED: "unconfigured",
};

export const PROBE_TIMEOUT_MS = 5000;
