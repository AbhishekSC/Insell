import { logger } from "../utils/logger.js";
import { sendErrorResponse } from "../utils/responseHandler.js";
import AppError from "../exceptions/AppError.js";

export function notFoundHandler(_req, res) {
  return sendErrorResponse(res, 404, "Route not found");
}

export function errorHandler(error, _req, res, _next) {
  if (res.headersSent) return;

  if (error instanceof AppError) {
    if (error.statusCode >= 500) {
      logger.error(`${error.name}: ${error.message}`, { stack: error.stack, details: error.details });
    } else {
      logger.warn(`${error.name}: ${error.message}`, { details: error.details });
    }
    return sendErrorResponse(res, error.statusCode, error.message, error.details);
  }

  // Mongoose validation errors
  if (error.name === "ValidationError" && error.errors) {
    const details = Object.values(error.errors).map((e) => ({
      field: e.path,
      message: e.message,
    }));
    return sendErrorResponse(res, 400, "Validation failed", details);
  }

  // Mongoose cast errors (invalid ObjectId etc.)
  if (error.name === "CastError") {
    return sendErrorResponse(res, 400, `Invalid ${error.path}: ${error.value}`);
  }

  // Mongo duplicate key
  if (error.code === 11000) {
    const field = Object.keys(error.keyPattern || {})[0] || "field";
    return sendErrorResponse(res, 409, `Duplicate value for ${field}`);
  }

  // Errors with a statusCode set (e.g. from libraries or middleware)
  const statusCode = Number(error?.statusCode || 500);
  if (statusCode >= 400 && statusCode < 500) {
    logger.warn(`${error?.name || "Error"}: ${error?.message}`, { statusCode });
    return sendErrorResponse(res, statusCode, error?.message || "Request error");
  }

  logger.error(`Unhandled error: ${error?.message || error}`, { stack: error?.stack });
  return sendErrorResponse(res, 500, "Internal Server Error");
}
