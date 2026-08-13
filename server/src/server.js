import "dotenv/config";
import app from "./app.js";
import { logger } from "./utils/logger.js";
import { connectToMongoDB, closeMongoConnection } from "./config/db.config.js";
import { connectQueue } from "./config/queue.config.js";
import { testCloudinaryConnection } from "./config/cloudinary.js";
import { connectToRedis, closeRedisConnection } from "./config/redisClient.config.js";

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
    await Promise.allSettled([closeMongoConnection(), closeRedisConnection()]);
  } catch (error) {
    logger.error(`Error during shutdown: ${error.message}`, { stack: error.stack });
  } finally {
    process.exit(0);
  }
}

process.on("SIGINT", () => shutdown("SIGINT"));
process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGUSR2", () => shutdown("SIGUSR2"));

async function startServer() {
  try {
    const PORT = process.env.PORT || 5001;

    await connectToRedis();
    await connectToMongoDB();
    await testCloudinaryConnection();

    httpServer = app.listen(PORT, async () => {
      await connectQueue();
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
