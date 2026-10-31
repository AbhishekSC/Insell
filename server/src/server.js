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

// A single coordinated shutdown path for SIGINT/SIGTERM (real termination) and
// SIGUSR2 (nodemon's restart signal). Previously Mongo and Redis each raced to
// call process.exit() from their own SIGINT listener — whichever finished first
// killed the process before the other's cleanup ran, which could leave the port
// or a connection in a bad state for the next process to bind/connect.
async function shutdown(signal) {
  if (shuttingDown) return;
  shuttingDown = true;

  logger.info(`Received ${signal}, shutting down gracefully...`);

  const closeHttpServer = () =>
    new Promise((resolve) => {
      if (!httpServer) return resolve();
      httpServer.close(() => resolve());
    });

  try {
    await closeHttpServer();
    await Promise.allSettled([
      closeMongoConnection(),
      closeRedisConnection(),
      shutdownAllWorkers(),
    ]);
  } catch (error) {
    logger.error(`Error during shutdown: ${error.message}`, { stack: error.stack });
  } finally {
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

    // These three have no dependency on each other — awaiting them in
    // sequence added their startup latencies together (part of why cold
    // starts took 30-40s). Running them in parallel cuts that to whichever
    // one is slowest, instead of the sum of all three.
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
