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
    logger.warn("Unauthorized access attempt: No token provided", { requestId: req.id });
    return sendErrorResponse(res, 401, "Unauthorized: No token provided");
  }

  try {
    const jwtSecret = process.env.JWT_SECRET || process.env.JWT_SECRET_KEY;

    if (!jwtSecret) {
      logger.error("Auth middleware: JWT secret is not configured", { requestId: req.id });
      return sendErrorResponse(res, 500, "Server auth configuration error");
    }

    const decoded = jwt.verify(token, jwtSecret);
    logger.debug("Token decoded successfully", { requestId: req.id, userId: decoded.id });

    if (!decoded || !decoded.id) {
      logger.warn("Unauthorized access attempt: Invalid token structure", { requestId: req.id });
      return sendErrorResponse(res, 401, "Unauthorized: Invalid token");
    }

    const user = await User.findById(decoded.id);
    logger.debug("User lookup completed", { requestId: req.id, userId: decoded.id, userFound: !!user });

    if (!user) {
      logger.warn(
        `Unauthorized access attempt: User not found for ID ${decoded.id}`,
        { requestId: req.id, userId: decoded.id }
      );
      return sendErrorResponse(res, 404, "Unauthorized: User not found");
    }

    if (user.isBlocked) {
      logger.warn("Blocked request from suspended user", { requestId: req.id, userId: user._id });
      return sendErrorResponse(res, 403, "Your account has been blocked. Contact support for help.");
    }

    const sanitizedUser = sanitizeUserData(user);

    req.user = sanitizedUser;
    next();
  } catch (error) {
    logger.error("Auth middleware: Token verification failed", { requestId: req.id, error: error.message });
    return sendErrorResponse(res, 401, "Unauthorized: Invalid token");
  }
};

// Must run after verifyUser (needs req.user). Blocks unverified accounts from
// every route except auth (login/signup/onboarding/verify) and
// /verification itself, which must stay reachable to actually get verified.
export const requireVerified = (req, res, next) => {
  if (!req.user?.isVerified) {
    logger.warn("Blocked request from unverified user", { requestId: req.id, userId: req.user?._id });
    return sendErrorResponse(res, 403, "Please verify your email to continue.");
  }
  next();
};

// Must run after verifyUser (needs req.user).
export const requireAdmin = (req, res, next) => {
  if (!req.user?.isAdmin) {
    logger.warn("Blocked non-admin request", { requestId: req.id, userId: req.user?._id });
    return sendErrorResponse(res, 403, "Admin access required.");
  }
  next();
};
