import { logger } from "../utils/logger.js";
import { sendErrorResponse } from "../utils/responseHandler.js";

export function notFoundHandler(_req, res) {
  return sendErrorResponse(res, 404, "Route not found");
}

export function errorHandler(error, _req, res, _next) {
  const statusCode = Number(error?.statusCode || 500);
  const details = error?.details || {};

  if (statusCode >= 500) {
    logger.error(`Unhandled server error: ${error?.message || error}`, {
      stack: error?.stack,
      details,
    });
    return sendErrorResponse(res, statusCode, "Internal Server Error");
  }

  const message = error?.message || "Internal Server Error";
  logger.warn("Handled request error", {
    statusCode,
    message,
    details,
  });

  return sendErrorResponse(res, statusCode, message, details);
}
