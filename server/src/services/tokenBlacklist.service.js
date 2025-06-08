import redisClient from "../config/redisClient.config.js";
import { sendErrorResponse } from "../utils/responseHandler.js";
import { logger } from "../utils/logger.js";
import jwt from "jsonwebtoken";

export const addTokenBlacklist = async (res, token) => {
  try {
    // Set the token in Redis with an expiration time (e.g., 1 hour)
    if (token) {
      // Decode token to get expiry
      const decoded = jwt.decode(token);
      const exp = decoded?.exp;
      const now = Math.floor(Date.now() / 1000);
      const expiresIn = exp ? exp - now : 60 * 60; // fallback 1 hour

      // Blacklist the token in Redis
      await redisClient.set(token, "blacklisted", { EX: expiresIn });
      logger.info(`Token blacklisted successfully: ${token}`);
    }
  } catch (error) {
    logger.error("Error adding token to blacklist:", error);
    return sendErrorResponse(res, 500, "Failed to blacklist token");
  }
};

export const isTokenBlacklisted = async (res, token) => {
  try {
    const isBlacklisted = await redisClient.get(token);
    if (isBlacklisted) {
      return sendErrorResponse(
        res,
        401,
        "Token is blacklisted. Please log in again."
      );
    }
  } catch (error) {
    logger.error("Error checking token blacklist:", error);
    return sendErrorResponse(
      res,
      500,
      "Failed to check token blacklist"
    );
  }
};
