import { validationResult } from "express-validator";
import UserRepository from "../repositories/UserRepository.js";
import { logger } from "../utils/logger.js";
import generateAccessToken from "../services/generateToken.service.js";
import { addTokenBlacklist } from "../services/tokenBlacklist.service.js";
import { UpdateStreamUser } from "../services/stream.service.js";
import AuthService from "../services/AuthService.js";
import {
  sendErrorResponse,
  sendSuccessResponse,
} from "../utils/responseHandler.js";
import { publishToQueue } from "../config/queue.config.js";
import User from "../models/User.model.js";
import passport from "../config/googleAuth.config.js";
import { generateResetOTP, verifyOTP } from "../services/otp.service.js";
import { sendResetOTPEmail } from "../utils/emailClient.js";

const authService = new AuthService({
  userRepository: new UserRepository(),
  tokenIssuer: generateAccessToken,
  streamUpdater: UpdateStreamUser,
  queuePublisher: publishToQueue,
  tokenBlacklistService: addTokenBlacklist,
});

// **Signup**
export async function signup(req, res) {
  logger.info(`Received signup request: ${req.body.email}`);

  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    logger.warn(
      "Validation errors during signup: ",
      JSON.stringify(errors.array())
    );
    return sendErrorResponse(res, 400, "Validation failed", errors.array());
  }

  const { fullName, email, password } = req.body;

  try {
    const result = await authService.signup({ fullName, email, password });
    logger.info(`Signup pending verification: ${email}`);
    return sendSuccessResponse(res, 200, "Verification code sent to your email", result);
  } catch (error) {
    logger.error("Error during signup:", error);
    return sendErrorResponse(res, error?.statusCode || 500, error?.message || "Internal server error. Please try again later.", error?.details || {});
  }
}

// **Verify signup code — creates the account and logs the user in**
export async function verifySignup(req, res) {
  const { email, code } = req.body;

  if (!email || !code) {
    return sendErrorResponse(res, 400, "Email and verification code are required");
  }

  try {
    const user = await authService.verifySignup({ email, code, res });
    logger.info(`Account created after verification: ${email}`);
    return sendSuccessResponse(res, 201, "Account created successfully", user);
  } catch (error) {
    logger.error("Error during signup verification:", error);
    return sendErrorResponse(res, error?.statusCode || 500, error?.message || "Internal server error.", error?.details || {});
  }
}

// **Resend the signup OTP for a still-pending signup**
export async function resendSignupCode(req, res) {
  const { email } = req.body;

  if (!email) {
    return sendErrorResponse(res, 400, "Email is required");
  }

  try {
    const result = await authService.resendSignupCode({ email });
    return sendSuccessResponse(res, 200, "Verification code sent to your email", result);
  } catch (error) {
    logger.error("Error resending signup code:", error);
    return sendErrorResponse(res, error?.statusCode || 500, error?.message || "Internal server error.", error?.details || {});
  }
}

// **Login**
export async function login(req, res) {
  logger.info(`Received login request: ${req.body.email}`);

  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    logger.warn(
      "Validation errors during login: ",
      JSON.stringify(errors.array())
    );
    return sendErrorResponse(res, 400, "Validation failed", errors.array());
  }

  const { email, password } = req.body;

  try {
    const user = await authService.login({ email, password, res });
    logger.info(`User logged in successfully: ${email}`);
    return sendSuccessResponse(res, 200, "Login successful", user);
  } catch (error) {
    logger.error("Error during login:", error);
    return sendErrorResponse(res, error?.statusCode || 500, error?.message || "Internal server error.", error?.details || {});
  }
}

// **Logout**
export async function logout(req, res) {
  logger.info(`Received logout request for user`);

  try {
    const token =
      req.cookies.syncspace_token || req.headers.authorization?.split(" ")[1];

    await authService.logout({ token, res });

    logger.info(`User logged out successfully`);
    return sendSuccessResponse(res, 200, "Logout successful");
  } catch (error) {
    logger.error("Error during logout:", error);
    return sendErrorResponse(res, error?.statusCode || 500, error?.message || "Internal server error.", error?.details || {});
  }
}

// **Onboarding**
export async function onboarding(req, res) {
  try {
    const userId = req.user._id;
    logger.info(`Onboarding request for user ID: ${userId}`);

    const sanitizedUser = await authService.onboarding({
      currentUserId: userId,
      payload: req.body || {},
    });

    return sendSuccessResponse(res, 200, "Onboarding successful", {
      user: sanitizedUser,
    });
  } catch (error) {
    logger.error("Error during onboarding:", error);
    return sendErrorResponse(res, error?.statusCode || 500, error?.message || "Internal server error.", error?.details || {});
  }
}

// **Google OAuth Login/Signup**
export async function googleAuth(req, res, next) {
  // Check if Google OAuth is configured
  if (!process.env.GOOGLE_CLIENT_ID || !process.env.GOOGLE_CLIENT_SECRET) {
    logger.warn('Google OAuth attempt but credentials not configured');
    const clientUrl = process.env.CLIENT_URL || 'http://localhost:5173';
    return res.redirect(`${clientUrl}/login?error=google_not_configured`);
  }
  
  passport.authenticate('google', { scope: ['profile', 'email'] })(req, res, next);
}

export async function googleAuthCallback(req, res, next) {
  // Check if Google OAuth is configured
  if (!process.env.GOOGLE_CLIENT_ID || !process.env.GOOGLE_CLIENT_SECRET) {
    logger.warn('Google OAuth callback but credentials not configured');
    const clientUrl = process.env.CLIENT_URL || 'http://localhost:5173';
    return res.redirect(`${clientUrl}/login?error=google_not_configured`);
  }

  passport.authenticate('google', { session: false }, async (err, user) => {
    if (err || !user) {
      logger.error('Google authentication failed:', err);
      const clientUrl = process.env.CLIENT_URL || 'http://localhost:5173';
      return res.redirect(`${clientUrl}/login?error=google_auth_failed`);
    }

    try {
      // Generate JWT token and set cookie
      const token = generateAccessToken(user, res);
      logger.info(`Generated token for Google user: ${user.email}`);
      logger.info(`Cookie set for Google user: ${user.email}`);

      logger.info(`Google authentication successful for user: ${user.email}`);

      // Redirect to frontend with success — the token rides along in the
      // URL too (not just the cookie) since Safari blocks third-party
      // cookies from the backend's onrender.com domain by default.
      const clientUrl = process.env.CLIENT_URL || 'http://localhost:5173';
      res.redirect(`${clientUrl}/login?success=true&token=${encodeURIComponent(token)}`);
    } catch (error) {
      logger.error('Error generating token after Google auth:', error);
      const clientUrl = process.env.CLIENT_URL || 'http://localhost:5173';
      res.redirect(`${clientUrl}/login?error=token_generation_failed`);
    }
  })(req, res, next);
}

// **Password Reset - Request OTP**
export async function requestPasswordReset(req, res) {
  try {
    const { email } = req.body;

    if (!email) {
      return sendErrorResponse(res, 400, "Email is required");
    }

    const user = await User.findOne({ email });
    if (!user) {
      // Don't reveal if user exists or not for security
      logger.info(`Password reset requested for non-existent email: ${email}`);
      return sendSuccessResponse(res, 200, "If an account exists with this email, you will receive an OTP");
    }

    // Check if user has a password (not OAuth user)
    if (user.provider === 'google' && !user.password) {
      return sendErrorResponse(res, 400, "Google OAuth users cannot reset password. Please use Google login.");
    }

    // Generate OTP
    const { otp, expiry } = generateResetOTP();

    // Store OTP in user document
    user.resetOTP = otp;
    user.resetOTPExpires = expiry;
    await user.save();

    // Send OTP email
    const emailResult = await sendResetOTPEmail({ email, otp });

    if (!emailResult.success) {
      logger.error('Failed to send reset OTP email:', emailResult.error);
      return sendErrorResponse(res, 500, "Failed to send OTP email");
    }

    logger.info(`Password reset OTP sent to: ${email}`);
    return sendSuccessResponse(res, 200, "OTP sent successfully to your email");
  } catch (error) {
    logger.error("Error in requestPasswordReset:", error);
    return sendErrorResponse(res, 500, "Failed to process password reset request");
  }
}

// **Password Reset - Verify OTP**
export async function verifyResetOTP(req, res) {
  try {
    const { email, otp } = req.body;

    if (!email || !otp) {
      return sendErrorResponse(res, 400, "Email and OTP are required");
    }

    const user = await User.findOne({ email }).select('+resetOTP +resetOTPExpires');
    if (!user) {
      return sendErrorResponse(res, 404, "User not found");
    }

    // Verify OTP
    const isValid = verifyOTP(user.resetOTP, otp, user.resetOTPExpires);
    if (!isValid) {
      return sendErrorResponse(res, 400, "Invalid or expired OTP");
    }

    // Clear OTP after successful verification
    user.resetOTP = undefined;
    user.resetOTPExpires = undefined;
    await user.save();

    logger.info(`OTP verified for: ${email}`);
    return sendSuccessResponse(res, 200, "OTP verified successfully");
  } catch (error) {
    logger.error("Error in verifyResetOTP:", error);
    return sendErrorResponse(res, 500, "Failed to verify OTP");
  }
}

// **Password Reset - Set New Password**
export async function resetPassword(req, res) {
  try {
    const { email, newPassword } = req.body;

    if (!email || !newPassword) {
      return sendErrorResponse(res, 400, "Email and new password are required");
    }

    if (newPassword.length < 6) {
      return sendErrorResponse(res, 400, "Password must be at least 6 characters long");
    }

    const user = await User.findOne({ email }).select('+password');
    if (!user) {
      return sendErrorResponse(res, 404, "User not found");
    }

    // Update password
    user.password = newPassword;
    await user.save();

    logger.info(`Password reset successful for: ${email}`);
    return sendSuccessResponse(res, 200, "Password reset successfully");
  } catch (error) {
    logger.error("Error in resetPassword:", error);
    return sendErrorResponse(res, 500, "Failed to reset password");
  }
}
