import crypto from "crypto";
import User from "../models/User.model.js";
import { logger } from "../utils/logger.js";
import { sendSuccessResponse, sendErrorResponse } from "../utils/responseHandler.js";
import { sendVerificationEmail, sendWelcomeEmail } from "./EmailService.js";

const VERIFICATION_CODE_LENGTH = 6;
const VERIFICATION_CODE_EXPIRY_MINUTES = 10;

/**
 * Generate a random verification code
 */
function generateVerificationCode() {
  const code = crypto.randomInt(0, 10 ** VERIFICATION_CODE_LENGTH);
  return code.toString().padStart(VERIFICATION_CODE_LENGTH, '0');
}

/**
 * Send verification code to user's email
 */
export async function sendVerificationCode(userId) {
  try {
    const user = await User.findById(userId).select("+verificationCode +verificationCodeExpires isVerified email fullName");
    if (!user) {
      throw new Error("User not found");
    }

    const verificationCode = generateVerificationCode();
    const expiresAt = new Date(Date.now() + VERIFICATION_CODE_EXPIRY_MINUTES * 60 * 1000);

    user.verificationCode = verificationCode;
    user.verificationCodeExpires = expiresAt;
    // Initialize isVerified if it doesn't exist
    if (user.isVerified === undefined) {
      user.isVerified = false;
    }
    await user.save();

    // Send real email using Resend
    try {
      await sendVerificationEmail(user.email, verificationCode, user.fullName);
      logger.info(`✅ Verification email sent to ${user.email}`);
    } catch (emailError) {
      logger.error(`❌ Failed to send verification email, falling back to console log:`, emailError);
      // Fallback to console logging if email fails
      logger.info(`📧 Verification code for ${user.email}: ${verificationCode} (expires at ${expiresAt})`);
      console.log(`📧 VERIFICATION CODE for ${user.email}: ${verificationCode}`);
    }

    return {
      success: true,
      message: "Verification code sent successfully",
      expiresAt,
    };
  } catch (error) {
    logger.error("Error sending verification code:", error);
    throw error;
  }
}

/**
 * Verify the code entered by user
 */
export async function verifyCode(userId, code) {
  try {
    const user = await User.findById(userId).select("+verificationCode +verificationCodeExpires email fullName isVerified");
    if (!user) {
      throw new Error("User not found");
    }

    // Check if code is expired
    if (user.verificationCodeExpires && new Date() > user.verificationCodeExpires) {
      throw new Error("Verification code has expired");
    }

    // Check if code matches
    if (user.verificationCode !== code) {
      throw new Error("Invalid verification code");
    }

    // Mark user as verified
    user.isVerified = true;
    user.verificationCode = undefined;
    user.verificationCodeExpires = undefined;
    await user.save();

    logger.info(`✅ User ${user.email} verified successfully`);

    // Send welcome email
    try {
      await sendWelcomeEmail(user.email, user.fullName);
      logger.info(`✅ Welcome email sent to ${user.email}`);
    } catch (emailError) {
      logger.error(`❌ Failed to send welcome email:`, emailError);
      // Don't throw error - verification is still successful
    }

    return {
      success: true,
      message: "Email verified successfully",
      isVerified: true,
    };
  } catch (error) {
    logger.error("Error verifying code:", error);
    throw error;
  }
}

/**
 * Check if user is verified
 */
export async function checkVerificationStatus(userId) {
  try {
    const user = await User.findById(userId).select("isVerified");
    if (!user) {
      throw new Error("User not found");
    }

    return {
      isVerified: user.isVerified || false,
    };
  } catch (error) {
    logger.error("Error checking verification status:", error);
    throw error;
  }
}
