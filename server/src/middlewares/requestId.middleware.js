import { v4 as uuidv4 } from "uuid";
import { logger } from "../utils/logger.js";

/**
 * Request ID middleware - adds a unique request ID to each incoming request
 * This enables traceability across all logs for a single request
 */
export const requestIdMiddleware = (req, res, next) => {
  // Generate or use existing request ID from header
  const requestId = req.headers["x-request-id"] || uuidv4();
  
  // Attach request ID to request object for use in downstream middleware/controllers
  req.id = requestId;
  
  // Also attach to response header for client-side tracking
  res.setHeader("X-Request-ID", requestId);
  
  // Log request start
  logger.info("request_start", {
    requestId,
    method: req.method,
    path: req.path,
    ip: req.ip,
    userAgent: req.get("user-agent")
  });
  
  // Log request completion
  res.on("finish", () => {
    logger.info("request_complete", {
      requestId,
      method: req.method,
      path: req.path,
      statusCode: res.statusCode,
      responseTime: Date.now() - req.startTime
    });
  });
  
  next();
};
