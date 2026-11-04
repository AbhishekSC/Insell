import "dotenv/config";
import app from "./app.js";
import { logger } from "./utils/logger.js";
import { connectToMongoDB, closeMongoConnection } from "./config/db.config.js";
import { testCloudinaryConnection } from "./config/cloudinary.js";
import { connectToRedis, closeRedisConnection } from "./config/redisClient.config.js";
import { initAllWorkers, shutdownAllWorkers } from "./jobs/index.js";
import { initTelemetry } from "./services/telemetry.service.js";
import { warmFeedAndMapCaches } from "./services/feedWarmup.service.js";

let httpServer = null;
let shuttingDown = false;
let activeRequests = 0;

const SHUTDOWN_TIMEOUT_MS = 15_000;

app.use((_req, res, next) => {
  if (shuttingDown) {
    res.set("Connection", "close");
    return res.status(503).json({ status: "error", message: "Server is shutting down" });
  }
  activeRequests++;
  res.on("finish", () => { activeRequests--; });
  next();
});

async function shutdown(signal) {
  if (shuttingDown) return;
  shuttingDown = true;

  logger.info(`Received ${signal}, shutting down gracefully… (active requests: ${activeRequests})`);

  const forceExit = setTimeout(() => {
    logger.warn(`Shutdown timeout (${SHUTDOWN_TIMEOUT_MS}ms) exceeded — forcing exit`);
    process.exit(1);
  }, SHUTDOWN_TIMEOUT_MS);
  forceExit.unref();

  const closeHttpServer = () =>
    new Promise((resolve) => {
      if (!httpServer) return resolve();
      httpServer.close(() => resolve());
    });

  try {
    await closeHttpServer();

    const drainStart = Date.now();
    while (activeRequests > 0 && Date.now() - drainStart < 5000) {
      await new Promise((r) => setTimeout(r, 100));
    }
    if (activeRequests > 0) {
      logger.warn(`Draining timed out with ${activeRequests} active requests`);
    }

    await Promise.allSettled([
      closeMongoConnection(),
      closeRedisConnection(),
      shutdownAllWorkers(),
    ]);
  } catch (error) {
    logger.error(`Error during shutdown: ${error.message}`, { stack: error.stack });
  } finally {
    clearTimeout(forceExit);
    process.exit(0);
  }
}

process.on("SIGINT", () => shutdown("SIGINT"));
process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGUSR2", () => shutdown("SIGUSR2"));

process.on("unhandledRejection", (reason, promise) => {
  logger.error("Unhandled Promise Rejection:", {
    reason: reason?.stack || reason,
    promise,
  });
});

process.on("uncaughtException", (error) => {
  logger.error("Uncaught Exception thrown:", { error: error?.stack || error });
  shutdown("uncaughtException");
});

async function startServer() {
  try {
    const PORT = process.env.PORT || 5001;

    if (!process.env.CRON_SECRET) {
      logger.warn("CRON_SECRET is not set — the stalled-deals nudge endpoint (/api/deals/cron/nudge-stalled) will reject every call with 401.");
    }

    await Promise.all([connectToRedis(), connectToMongoDB(), testCloudinaryConnection()]);

    httpServer = app.listen(PORT, async () => {
      initTelemetry();
      await initAllWorkers();
      warmFeedAndMapCaches();
      logger.info(`Server is running on port ${PORT}`);
    }).on("error", (err) => {
      if (err.code === "EADDRINUSE") {
        logger.error(`Port ${PORT} is already in use. Kill the existing process and restart.`);
      } else {
        logger.error(`Server error: ${err.message}`);
      }
      process.exit(1);
    });
  } catch (error) {
    logger.error(`Failed to start server: ${error.message}`, { stack: error.stack });
    process.exit(1);
  }
}

startServer();
