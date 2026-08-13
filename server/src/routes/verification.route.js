import express from "express";
import { sendVerificationCode, verifyCode, checkVerificationStatus } from "../services/VerificationService.js";
import { sendSuccessResponse, sendErrorResponse } from "../utils/responseHandler.js";
import { verifyUser } from "../middlewares/auth.middleware.js";
import { verificationRateLimiter } from "../middleware/rateLimiter.js";

const router = express.Router();

/**
 * POST /verification/send-code
 * Send verification code to user's email
 */
router.post("/send-code", verifyUser, verificationRateLimiter, async (req, res) => {
  try {
    if (!req.user || !req.user._id) {
      return sendErrorResponse(res, 401, "User not authenticated");
    }

    const result = await sendVerificationCode(req.user._id);

    return sendSuccessResponse(res, 200, "Verification code sent successfully", {
      expiresAt: result.expiresAt,
    });
  } catch (error) {
    console.error("Error sending verification code:", error);
    return sendErrorResponse(res, 500, "Failed to send verification code");
  }
});

/**
 * POST /verification/verify
 * Verify the code entered by user
 */
router.post("/verify", verifyUser, async (req, res) => {
  try {
    if (!req.user || !req.user._id) {
      return sendErrorResponse(res, 401, "User not authenticated");
    }

    const { code } = req.body;

    if (!code) {
      return sendErrorResponse(res, 400, "Verification code is required");
    }

    const result = await verifyCode(req.user._id, code);

    return sendSuccessResponse(res, 200, result.message, {
      isVerified: result.isVerified,
    });
  } catch (error) {
    console.error("Error verifying code:", error);
    const message = error.message || "Failed to verify code";
    return sendErrorResponse(res, 400, message);
  }
});

/**
 * GET /verification/status
 * Check if user is verified
 */
router.get("/status", verifyUser, async (req, res) => {
  try {
    if (!req.user || !req.user._id) {
      return sendErrorResponse(res, 401, "User not authenticated");
    }

    const result = await checkVerificationStatus(req.user._id);

    return sendSuccessResponse(res, 200, "Verification status fetched", result);
  } catch (error) {
    console.error("Error checking verification status:", error);
    return sendErrorResponse(res, 500, "Failed to check verification status");
  }
});

export default router;
