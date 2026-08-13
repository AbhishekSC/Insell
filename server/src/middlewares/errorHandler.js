import { logger } from "../utils/logger.js";
import { sendErrorResponse } from "../utils/responseHandler.js";

export function notFoundHandler(_req, res) {
  return sendErrorResponse(res, 404, "Route not found");
}

export function errorHandler(error, _req, res, _next) {
  const statusCode = Number(error?.statusCode || 500);
  const message = error?.message || "Internal Server Error";
  const details = error?.details || {};

  if (statusCode >= 500) {
    logger.error("Unhandled server error", {
      message,
      stack: error?.stack,
      details,
    });
  } else {
    logger.warn("Handled request error", {
      statusCode,
      message,
      details,
    });
  }

  return sendErrorResponse(res, statusCode, message, details);
}
