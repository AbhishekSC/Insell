import { v4 as uuidv4 } from "uuid";
import { logger } from "../utils/logger.js";

/**
 * Request ID & HTTP access log middleware
 * Adds a unique request ID to each incoming request and tracks request execution time.
 */
export const requestIdMiddleware = (req, res, next) => {
  const requestId = req.headers["x-request-id"] || uuidv4();

  // Attach request ID and start timestamp to request object
  req.id = requestId;
  req.startTime = Date.now();

  // Attach to response header for client-side tracing
  res.setHeader("X-Request-ID", requestId);

  // Opt-in request start logging for debugging hanging/slow requests
  if (process.env.LOG_REQUEST_START === "true") {
    logger.debug(`--> ${req.method} ${req.originalUrl || req.url}`, {
      requestId,
      ip: req.ip,
    });
  }

  // Log single clean HTTP access entry upon request completion
  res.on("finish", () => {
    const responseTime = Date.now() - req.startTime;
    const url = req.originalUrl || req.url;
    const method = req.method;
    const statusCode = res.statusCode;
    const userId = req.user?._id || req.user?.id;

    const meta = {
      requestId,
      method,
      url,
      statusCode,
      responseTime,
      ip: req.ip,
      ...(userId ? { userId: String(userId) } : {}),
    };

    const logMessage = `${method} ${url} ${statusCode} ${responseTime}ms`;

    if (statusCode >= 500) {
      logger.error(logMessage, meta);
    } else if (statusCode >= 400) {
      logger.warn(logMessage, meta);
    } else {
      logger.info(logMessage, meta);
    }
  });

  next();
};

