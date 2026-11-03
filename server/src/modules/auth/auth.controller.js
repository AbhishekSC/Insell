import { validationResult } from "express-validator";
import UserRepository from "../../repositories/UserRepository.js";
import { logger } from "../../utils/logger.js";
import generateAccessToken from "../../services/generateToken.service.js";
import { addTokenBlacklist } from "../../services/tokenBlacklist.service.js";
import { UpdateStreamUser } from "../../services/stream.service.js";
import AuthService from "../../services/AuthService.js";
import {
  sendErrorResponse,
  sendSuccessResponse,
} from "../../utils/responseHandler.js";
import { enqueueWelcomeEmail } from "../../jobs/producers/email.producer.js";
import MobileDetail from "../../models/MobileDetail.model.js";
import passport from "../../config/googleAuth.config.js";
import {
  createRefreshToken,
  rotateRefreshToken,
  revokeRefreshToken,
  revokeAllUserRefreshTokens,
} from "../../services/refreshToken.service.js";
import {
  initiatePasswordReset,
  verifyPasswordResetOTP,
  resetUserPassword,
  initiateLoginOTP,
  verifyLoginOTPCode,
} from "./auth.service.js";

// ---------------------------------------------------------------------------
// AuthService instance (HTTP-layer wiring — stays in the controller)
// ---------------------------------------------------------------------------
const authService = new AuthService({
  userRepository: new UserRepository(),
  tokenIssuer: generateAccessToken,
  streamUpdater: UpdateStreamUser,
  queuePublisher: ({ email, name }) => enqueueWelcomeEmail(email, name),
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

  const deviceId = req.body?.deviceId || req.headers["x-device-id"] || null;
  const userAgent = req.headers["user-agent"] || "";
  const ipAddress = req.ip || req.connection?.remoteAddress || "";

  try {
    const user = await authService.verifySignup({
      email,
      code,
      res,
      deviceId,
      userAgent,
      ipAddress,
    });
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
  const deviceId = req.body?.deviceId || req.headers["x-device-id"] || null;
  const userAgent = req.headers["user-agent"] || "";
  const ipAddress = req.ip || req.connection?.remoteAddress || "";

  try {
    const user = await authService.login({
      email,
      password,
      res,
      deviceId,
      userAgent,
      ipAddress,
    });
    logger.info(`User logged in successfully: ${email}`);
    return sendSuccessResponse(res, 200, "Login successful", user);
  } catch (error) {
    logger.error("Error during login:", error);
    return sendErrorResponse(res, error?.statusCode || 500, error?.message || "Internal server error.", error?.details || {});
  }
}

// **Refresh Token - Silent rotation**
export async function refresh(req, res) {
  try {
    const rawRefreshToken =
      req.body?.refreshToken ||
      req.cookies?.syncspace_refresh_token ||
      req.headers["x-refresh-token"];

    const deviceId = req.body?.deviceId || req.headers["x-device-id"] || null;
    const userAgent = req.headers["user-agent"] || "";
    const ipAddress = req.ip || req.connection?.remoteAddress || "";

    const result = await rotateRefreshToken({
      rawRefreshToken,
      deviceId,
      userAgent,
      ipAddress,
      res,
    });

    return sendSuccessResponse(res, 200, "Token refreshed successfully", result);
  } catch (error) {
    logger.warn("Token refresh rejected:", { message: error.message });
    return sendErrorResponse(
      res,
      error?.statusCode || 401,
      error?.message || "Invalid or expired refresh token",
      error?.details || {}
    );
  }
}

// **Logout**
export async function logout(req, res) {
  logger.info(`Received logout request for user`);

  try {
    const token =
      req.cookies.syncspace_token || req.headers.authorization?.split(" ")[1];
    const refreshToken =
      req.body?.refreshToken ||
      req.cookies?.syncspace_refresh_token ||
      req.headers["x-refresh-token"];

    await authService.logout({ token, refreshToken, res });

    logger.info(`User logged out successfully`);
    return sendSuccessResponse(res, 200, "Logout successful");
  } catch (error) {
    logger.error("Error during logout:", error);
    return sendErrorResponse(res, error?.statusCode || 500, error?.message || "Internal server error.", error?.details || {});
  }
}

// **Logout from all devices**
export async function logoutAll(req, res) {
  try {
    const userId = req.user?._id;
    if (!userId) {
      return sendErrorResponse(res, 401, "Unauthorized");
    }

    logger.info(`Received logout-all request for user ${userId}`);

    // 1. Revoke all refresh tokens for this user in MongoDB
    await revokeAllUserRefreshTokens(userId);

    // 2. Deactivate active mobile device records
    await MobileDetail.updateMany(
      { user: userId, isActive: true },
      { $set: { isActive: false, pushToken: null } }
    ).catch((err) => {
      logger.warn("Failed to deactivate mobile details on logoutAll:", { message: err.message });
    });

    // 3. Blacklist the current access token in Redis and clear cookies
    const token =
      req.cookies.syncspace_token || req.headers.authorization?.split(" ")[1];
    if (token) {
      await authService.logout({ token, res });
    } else {
      await revokeRefreshToken({ rawRefreshToken: null, res });
    }

    logger.info(`User ${userId} logged out from all devices successfully`);
    return sendSuccessResponse(res, 200, "Logged out from all devices successfully");
  } catch (error) {
    logger.error("Error during logoutAll:", error);
    return sendErrorResponse(
      res,
      error?.statusCode || 500,
      error?.message || "Failed to log out from all devices"
    );
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
      let refreshToken = null;
      try {
        refreshToken = await createRefreshToken({ userId: user._id, res });
      } catch (err) {
        logger.error("Error creating refresh token for Google user:", err);
      }
      logger.info(`Generated token for Google user: ${user.email}`);
      logger.info(`Cookie set for Google user: ${user.email}`);

      logger.info(`Google authentication successful for user: ${user.email}`);

      const rfParam = refreshToken ? `&refreshToken=${encodeURIComponent(refreshToken)}` : '';

      if (customRedirect) {
        const sep = customRedirect.includes('?') ? '&' : '?';
        return res.redirect(`${customRedirect}${sep}success=true&token=${encodeURIComponent(token)}${rfParam}`);
      }

      // Redirect to frontend with success — the token rides along in the
      // URL too (not just the cookie) since Safari blocks third-party
      // cookies from the backend's onrender.com domain by default.
      const clientUrl = process.env.CLIENT_URL || 'http://localhost:5173';
      res.redirect(`${clientUrl}/${authPage}?success=true&token=${encodeURIComponent(token)}${rfParam}`);
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

    const result = await initiatePasswordReset(email);

    if (result.noUser) {
      // Don't reveal if user exists or not for security
      return sendSuccessResponse(res, 200, "If an account exists with this email, you will receive an OTP", {
        cooldownSeconds: req.rateLimitInfo?.cooldownSeconds,
        remainingAttempts: req.rateLimitInfo?.remainingAttempts,
      });
    }

    if (result.oauthOnly) {
      return sendErrorResponse(res, 400, "Google OAuth users cannot reset password. Please use Google login.");
    }

    if (result.emailFailed) {
      return sendErrorResponse(res, 500, "Failed to send OTP email");
    }

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

    const result = await verifyPasswordResetOTP(email, otp);

    if (result.notFound) {
      return sendErrorResponse(res, 404, "User not found");
    }

    if (result.tooManyAttempts) {
      return sendErrorResponse(res, 429, "Too many failed attempts. Code has been invalidated. Please request a new one.");
    }

    if (result.invalid) {
      return sendErrorResponse(res, 400, `Invalid or expired OTP. (${result.remaining} attempts remaining)`);
    }

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

    const result = await resetUserPassword(email, newPassword);

    if (result.weakPassword) {
      return sendErrorResponse(res, 400, result.message);
    }

    if (result.notFound) {
      return sendErrorResponse(res, 404, "User not found");
    }

    if (result.notVerified) {
      return sendErrorResponse(res, 400, "Please verify your OTP before resetting your password");
    }

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

    const result = await initiateLoginOTP(email);

    if (result.notFound) {
      return sendErrorResponse(res, 404, "No account found with this email. Please sign up first.");
    }

    if (result.blocked) {
      return sendErrorResponse(res, 403, "Your account has been blocked. Contact support for help.", {
        code: "ACCOUNT_BLOCKED",
      });
    }

    if (result.emailFailed) {
      return sendErrorResponse(res, 500, "Failed to send login code email");
    }

    return sendSuccessResponse(res, 200, "Login code sent to your email", {
      cooldownSeconds: req.rateLimitInfo?.cooldownSeconds,
      remainingAttempts: req.rateLimitInfo?.remainingAttempts,
      devOtp: result.devOtp,
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

    const result = await verifyLoginOTPCode(email, otp);

    if (result.notFound) {
      return sendErrorResponse(res, 404, "No account found with this email. Please sign up first.");
    }

    if (result.blocked) {
      return sendErrorResponse(res, 403, "Your account has been blocked. Contact support for help.", {
        code: "ACCOUNT_BLOCKED",
      });
    }

    if (result.tooManyAttempts) {
      return sendErrorResponse(res, 429, "Too many failed attempts. Code has been invalidated. Please request a new one.");
    }

    if (result.invalid) {
      return sendErrorResponse(res, 400, `Invalid or expired login code. (${result.remaining} attempts remaining)`);
    }

    const loginResult = await authService.loginUser(result.user, res);
    logger.info(`User logged in successfully via OTP: ${email}`);
    return sendSuccessResponse(res, 200, "Login successful", loginResult);
  } catch (error) {
    logger.error("Error in verifyLoginOTP:", error);
    return sendErrorResponse(res, error?.statusCode || 500, error?.message || "Failed to verify login code");
  }
}
