import User from "../models/User.model.js";
import { logger } from "../utils/logger.js";
import { sendErrorResponse } from "../utils/responseHandler.js";
import jwt from "jsonwebtoken";
import "dotenv/config.js";
import { sanitizeUserData } from "../utils/sanitizeUser.js";

export const verifyUser = async (req, res, next) => {
  const token =
    req.cookies.syncspace_token || req.headers.authorization?.split(" ")[1];

  if (!token) {
    logger.warn("Unauthorized access attempt: No token provided");
    return sendErrorResponse(res, 401, "Unauthorized: No token provided");
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    console.log("Decoded token:", decoded);

    if (!decoded || !decoded.id) {
      logger.warn("Unauthorized access attempt: Invalid token structure");
      return sendErrorResponse(res, 401, "Unauthorized: Invalid token");
    }

    const user = await User.findById(decoded.id);

    if (!user) {
      logger.warn(
        `Unauthorized access attempt: User not found for ID ${decoded.id}`
      );
      return sendErrorResponse(res, 404, "Unauthorized: User not found");
    }

    const sanitizedUser = sanitizeUserData(user);

    req.user = sanitizedUser;
    next();
  } catch (error) {
    logger.error("Auth middleware: Token verification failed:", error);
    return sendErrorResponse(res, 401, "Unauthorized: Invalid token");
  }
};
