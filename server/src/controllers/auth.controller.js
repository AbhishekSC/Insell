import { validationResult } from "express-validator";
import UserRepository from "../repositories/UserRepository.js";
import { logger } from "../utils/logger.js";
import generateAccessToken from "../services/generateToken.service.js";
import { addTokenBlacklist } from "../services/tokenBlacklist.service.js";
import { UpdateStreamUser } from "../services/stream.service.js";
import AuthService, { PASSWORD_STRENGTH_REGEX, PASSWORD_STRENGTH_MESSAGE } from "../services/AuthService.js";
import {
  sendErrorResponse,
  sendSuccessResponse,
} from "../utils/responseHandler.js";
import { publishToQueue } from "../config/queue.config.js";
import User from "../models/User.model.js";
import passport from "../config/googleAuth.config.js";
import { generateResetOTP, verifyOTP } from "../services/otp.service.js";
import { sendResetOTPEmail, sendLoginOTPEmail } from "../utils/emailClient.js";

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

  const { fullName, email, password, referralCode } = req.body;

  try {
    const result = await authService.signup({ fullName, email, password, referralCode });
    logger.info(`Signup pending verification: ${email}`);
    return sendSuccessResponse(res, 200, "Verification code sent to your email", result);
  } catch (error) {
    logger.error("Error during signup:", error);
    return sendErrorResponse(res, error?.statusCode || 500, error?.message || "Internal server error. Please try again later.", error?.details || {});
  }
}

// **Verify signup code — creates the account and logs the user in**
export async function verifySignup(req, res) {
  const email = String(req.body?.email || "").trim().toLowerCase();
  const code = String(req.body?.code || "").trim();

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
  const email = String(req.body?.email || "").trim().toLowerCase();

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

// Which page to land back on — carried through Google's own "state" param
// (echoed back unchanged on the callback) so a signup-initiated flow doesn't
// land on /login with a "logged in" message and vice versa.
function resolveAuthPage(intent) {
  return intent === 'signup' ? 'signup' : 'login';
}

// **Google OAuth Login/Signup**
export async function googleAuth(req, res, next) {
  const intent = req.query.intent === 'signup' ? 'signup' : 'login';
  const redirectUri = req.query.redirect_uri || null;
  const stateData = redirectUri ? JSON.stringify({ intent, redirect_uri: redirectUri }) : intent;

  // Check if Google OAuth is configured
  if (!process.env.GOOGLE_CLIENT_ID || !process.env.GOOGLE_CLIENT_SECRET) {
    logger.warn('Google OAuth attempt but credentials not configured');
    if (redirectUri) {
      const sep = redirectUri.includes('?') ? '&' : '?';
      return res.redirect(`${redirectUri}${sep}error=google_not_configured`);
    }
    const clientUrl = process.env.CLIENT_URL || 'http://localhost:5173';
    return res.redirect(`${clientUrl}/${intent}?error=google_not_configured`);
  }

  passport.authenticate('google', { scope: ['profile', 'email'], state: stateData })(req, res, next);
}

export async function googleAuthCallback(req, res, next) {
  let authPage = 'login';
  let customRedirect = null;
  if (req.query.state) {
    try {
      if (typeof req.query.state === 'string' && req.query.state.startsWith('{')) {
        const parsed = JSON.parse(req.query.state);
        authPage = resolveAuthPage(parsed.intent);
        customRedirect = parsed.redirect_uri || null;
      } else {
        authPage = resolveAuthPage(req.query.state);
      }
    } catch {
      authPage = resolveAuthPage(req.query.state);
    }
  }

  // Check if Google OAuth is configured
  if (!process.env.GOOGLE_CLIENT_ID || !process.env.GOOGLE_CLIENT_SECRET) {
    logger.warn('Google OAuth callback but credentials not configured');
    if (customRedirect) {
      const sep = customRedirect.includes('?') ? '&' : '?';
      return res.redirect(`${customRedirect}${sep}error=google_not_configured`);
    }
    const clientUrl = process.env.CLIENT_URL || 'http://localhost:5173';
    return res.redirect(`${clientUrl}/${authPage}?error=google_not_configured`);
  }

  passport.authenticate('google', { session: false }, async (err, user) => {
    if (err || !user) {
      logger.error('Google authentication failed:', err);
      if (customRedirect) {
        const sep = customRedirect.includes('?') ? '&' : '?';
        return res.redirect(`${customRedirect}${sep}error=google_auth_failed`);
      }
      const clientUrl = process.env.CLIENT_URL || 'http://localhost:5173';
      return res.redirect(`${clientUrl}/${authPage}?error=google_auth_failed`);
    }

    try {
      // Generate JWT token and set cookie
      const token = generateAccessToken(user, res);
      logger.info(`Generated token for Google user: ${user.email}`);
      logger.info(`Cookie set for Google user: ${user.email}`);

      logger.info(`Google authentication successful for user: ${user.email}`);

      if (customRedirect) {
        const sep = customRedirect.includes('?') ? '&' : '?';
        return res.redirect(`${customRedirect}${sep}success=true&token=${encodeURIComponent(token)}`);
      }

      // Redirect to frontend with success — the token rides along in the
      // URL too (not just the cookie) since Safari blocks third-party
      // cookies from the backend's onrender.com domain by default.
      const clientUrl = process.env.CLIENT_URL || 'http://localhost:5173';
      res.redirect(`${clientUrl}/${authPage}?success=true&token=${encodeURIComponent(token)}`);
    } catch (error) {
      logger.error('Error generating token after Google auth:', error);
      if (customRedirect) {
        const sep = customRedirect.includes('?') ? '&' : '?';
        return res.redirect(`${customRedirect}${sep}error=token_generation_failed`);
      }
      const clientUrl = process.env.CLIENT_URL || 'http://localhost:5173';
      res.redirect(`${clientUrl}/${authPage}?error=token_generation_failed`);
    }
  })(req, res, next);
}

// **Password Reset - Request OTP**
export async function requestPasswordReset(req, res) {
  try {
    const rawEmail = req.body?.email;
    if (!rawEmail) {
      return sendErrorResponse(res, 400, "Email is required");
    }
    const email = String(rawEmail).trim().toLowerCase();

    const user = await User.findOne({ email }).select("+password");
    if (!user) {
      // Don't reveal if user exists or not for security
      logger.info(`Password reset requested for non-existent email: ${email}`);
      return sendSuccessResponse(res, 200, "If an account exists with this email, you will receive an OTP", {
        cooldownSeconds: req.rateLimitInfo?.cooldownSeconds,
        remainingAttempts: req.rateLimitInfo?.remainingAttempts,
      });
    }

    // Check if user has a password (not OAuth user) — `password` is
    // select: false on the schema, so it must be explicitly selected above,
    // otherwise `user.password` is always undefined here and this check
    // would incorrectly block every Google-linked account, even ones that
    // also have a real password from signing up with email/password first.
    if (user.provider === 'google' && !user.password) {
      return sendErrorResponse(res, 400, "Google OAuth users cannot reset password. Please use Google login.");
    }

    // Generate OTP
    const { otp, expiry } = generateResetOTP();

    // Store OTP in user document
    user.resetOTP = otp;
    user.resetOTPExpires = expiry;
    user.resetOTPAttempts = 0;
    await user.save();

    // Send OTP email
    const emailResult = await sendResetOTPEmail({ email, otp });

    if (!emailResult.success) {
      logger.error('Failed to send reset OTP email:', emailResult.error);
      return sendErrorResponse(res, 500, "Failed to send OTP email");
    }

    logger.info(`Password reset OTP sent to: ${email}`);
    return sendSuccessResponse(res, 200, "OTP sent successfully to your email", {
      cooldownSeconds: req.rateLimitInfo?.cooldownSeconds,
      remainingAttempts: req.rateLimitInfo?.remainingAttempts,
    });
  } catch (error) {
    logger.error("Error in requestPasswordReset:", error);
    return sendErrorResponse(res, 500, "Failed to process password reset request");
  }
}

// **Password Reset - Verify OTP**
export async function verifyResetOTP(req, res) {
  try {
    const rawEmail = req.body?.email;
    const rawOtp = req.body?.otp;

    if (!rawEmail || !rawOtp) {
      return sendErrorResponse(res, 400, "Email and OTP are required");
    }

    const email = String(rawEmail).trim().toLowerCase();
    const otp = String(rawOtp).trim();

    const user = await User.findOne({ email }).select('+resetOTP +resetOTPExpires +resetOTPAttempts');
    if (!user) {
      return sendErrorResponse(res, 404, "User not found");
    }

    // Check if user exceeded maximum failed attempts
    if ((user.resetOTPAttempts || 0) >= 5) {
      user.resetOTP = undefined;
      user.resetOTPExpires = undefined;
      user.resetOTPAttempts = 0;
      await user.save();
      return sendErrorResponse(res, 429, "Too many failed attempts. Code has been invalidated. Please request a new one.");
    }

    // Verify OTP
    const isValid = verifyOTP(user.resetOTP, otp, user.resetOTPExpires);
    if (!isValid) {
      user.resetOTPAttempts = (user.resetOTPAttempts || 0) + 1;
      const remaining = Math.max(0, 5 - user.resetOTPAttempts);
      if (user.resetOTPAttempts >= 5) {
        user.resetOTP = undefined;
        user.resetOTPExpires = undefined;
        user.resetOTPAttempts = 0;
        await user.save();
        return sendErrorResponse(res, 429, "Too many failed attempts. Code has been invalidated. Please request a new one.");
      }
      await user.save();
      return sendErrorResponse(res, 400, `Invalid or expired OTP. (${remaining} attempts remaining)`);
    }

    // Clear OTP and reset attempts after successful verification
    user.resetOTP = undefined;
    user.resetOTPExpires = undefined;
    user.resetOTPAttempts = 0;
    user.resetVerifiedExpires = new Date(Date.now() + 10 * 60 * 1000);
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
    const rawEmail = req.body?.email;
    const { newPassword } = req.body;

    if (!rawEmail || !newPassword) {
      return sendErrorResponse(res, 400, "Email and new password are required");
    }

    const email = String(rawEmail).trim().toLowerCase();

    if (!PASSWORD_STRENGTH_REGEX.test(newPassword)) {
      return sendErrorResponse(res, 400, PASSWORD_STRENGTH_MESSAGE);
    }

    const user = await User.findOne({ email }).select('+password +resetVerifiedExpires');
    if (!user) {
      return sendErrorResponse(res, 404, "User not found");
    }

    if (!user.resetVerifiedExpires || user.resetVerifiedExpires < new Date()) {
      return sendErrorResponse(res, 400, "Please verify your OTP before resetting your password");
    }

    // Update password
    user.password = newPassword;
    user.resetVerifiedExpires = undefined;
    await user.save();

    logger.info(`Password reset successful for: ${email}`);
    return sendSuccessResponse(res, 200, "Password reset successfully");
  } catch (error) {
    logger.error("Error in resetPassword:", error);
    return sendErrorResponse(res, 500, "Failed to reset password");
  }
}

// **Login via OTP - Request Code**
export async function requestLoginOTP(req, res) {
  try {
    const rawEmail = req.body?.email;
    if (!rawEmail) {
      return sendErrorResponse(res, 400, "Email is required");
    }

    const email = String(rawEmail).trim().toLowerCase();
    const user = await User.findOne({ email });

    if (!user) {
      return sendErrorResponse(res, 404, "No account found with this email. Please sign up first.");
    }

    if (user.isBlocked) {
      return sendErrorResponse(res, 403, "Your account has been blocked. Contact support for help.", {
        code: "ACCOUNT_BLOCKED",
      });
    }

    // Generate 6-digit OTP and 10-minute expiry
    const { otp, expiry } = generateResetOTP();
    user.loginOTP = otp;
    user.loginOTPExpires = expiry;
    user.loginOTPAttempts = 0;
    await user.save();

    const isDev = (process.env.NODE_ENV || "development") !== "production";
    if (isDev) {
      logger.info(`[DEV MODE] Login OTP for ${email}: ${otp}`);
    }

    // Send OTP email
    const emailResult = await sendLoginOTPEmail({ email, otp });
    if (!emailResult.success && !isDev) {
      logger.error("Failed to send login OTP email:", emailResult.error);
      return sendErrorResponse(res, 500, "Failed to send login code email");
    }

    if (!emailResult.success && isDev) {
      logger.warn(`Failed to send login OTP email in dev mode, but proceeding since DEV OTP is: ${otp}`);
    }

    logger.info(`Login OTP sent to: ${email}`);
    return sendSuccessResponse(res, 200, "Login code sent to your email", {
      cooldownSeconds: req.rateLimitInfo?.cooldownSeconds,
      remainingAttempts: req.rateLimitInfo?.remainingAttempts,
      devOtp: isDev ? otp : undefined,
    });
  } catch (error) {
    logger.error("Error in requestLoginOTP:", error);
    return sendErrorResponse(res, 500, "Failed to process login code request");
  }
}

// **Login via OTP - Verify Code & Login**
export async function verifyLoginOTP(req, res) {
  try {
    const rawEmail = req.body?.email;
    const rawOtp = req.body?.otp;

    if (!rawEmail || !rawOtp) {
      return sendErrorResponse(res, 400, "Email and login code are required");
    }

    const email = String(rawEmail).trim().toLowerCase();
    const otp = String(rawOtp).trim();

    const user = await User.findOne({ email }).select('+loginOTP +loginOTPExpires +loginOTPAttempts +password');
    if (!user) {
      return sendErrorResponse(res, 404, "No account found with this email. Please sign up first.");
    }

    if (user.isBlocked) {
      return sendErrorResponse(res, 403, "Your account has been blocked. Contact support for help.", {
        code: "ACCOUNT_BLOCKED",
      });
    }

    if ((user.loginOTPAttempts || 0) >= 5) {
      user.loginOTP = undefined;
      user.loginOTPExpires = undefined;
      user.loginOTPAttempts = 0;
      await user.save();
      return sendErrorResponse(res, 429, "Too many failed attempts. Code has been invalidated. Please request a new one.");
    }

    const isValid = verifyOTP(user.loginOTP, otp, user.loginOTPExpires);
    if (!isValid) {
      user.loginOTPAttempts = (user.loginOTPAttempts || 0) + 1;
      const remaining = Math.max(0, 5 - user.loginOTPAttempts);
      if (user.loginOTPAttempts >= 5) {
        user.loginOTP = undefined;
        user.loginOTPExpires = undefined;
        user.loginOTPAttempts = 0;
        await user.save();
        return sendErrorResponse(res, 429, "Too many failed attempts. Code has been invalidated. Please request a new one.");
      }
      await user.save();
      return sendErrorResponse(res, 400, `Invalid or expired login code. (${remaining} attempts remaining)`);
    }

    // Invalidate OTP on successful verification
    user.loginOTP = undefined;
    user.loginOTPExpires = undefined;
    user.loginOTPAttempts = 0;
    await user.save();

    const loginResult = await authService.loginUser(user, res);
    logger.info(`User logged in successfully via OTP: ${email}`);
    return sendSuccessResponse(res, 200, "Login successful", loginResult);
  } catch (error) {
    logger.error("Error in verifyLoginOTP:", error);
    return sendErrorResponse(res, error?.statusCode || 500, error?.message || "Failed to verify login code");
  }
}
