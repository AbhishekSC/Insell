import { logger } from "../../utils/logger.js";
import { generateResetOTP, verifyOTP } from "../../services/otp.service.js";
import { sendResetOTPEmail, sendLoginOTPEmail } from "../../utils/emailClient.js";
import { revokeAllUserRefreshTokens } from "../../services/refreshToken.service.js";
import { PASSWORD_STRENGTH_REGEX, PASSWORD_STRENGTH_MESSAGE } from "../../services/AuthService.js";
import {
  OTP_MAX_ATTEMPTS,
  RESET_VERIFIED_WINDOW_MS,
} from "./auth.constants.js";
import {
  findUserForPasswordReset,
  findUserForResetOTPVerification,
  findUserForResetPassword,
  findUserForLoginOTPRequest,
  findUserForLoginOTPVerification,
} from "./auth.repository.js";

// ---------------------------------------------------------------------------
// Password-reset OTP flow
// ---------------------------------------------------------------------------

/**
 * Generate and send a password-reset OTP for the given email.
 * Returns `{ sent: true }` on success or `{ noUser: true }` when no account
 * exists (caller should still respond 200 to avoid user-enumeration).
 */
export async function initiatePasswordReset(email) {
  const user = await findUserForPasswordReset(email);
  if (!user) {
    logger.info(`Password reset requested for non-existent email: ${email}`);
    return { noUser: true };
  }

  // Google-only accounts cannot reset password
  if (user.provider === "google" && !user.password) {
    return { oauthOnly: true };
  }

  const { otp, expiry } = generateResetOTP();
  user.resetOTP = otp;
  user.resetOTPExpires = expiry;
  user.resetOTPAttempts = 0;
  await user.save();

  const emailResult = await sendResetOTPEmail({ email, otp });
  if (!emailResult.success) {
    logger.error("Failed to send reset OTP email:", emailResult.error);
    return { emailFailed: true };
  }

  logger.info(`Password reset OTP sent to: ${email}`);
  return { sent: true };
}

/**
 * Verify a password-reset OTP.
 * Returns `{ verified: true }` on success.
 * Throws an object with `{ status, message }` on failure.
 */
export async function verifyPasswordResetOTP(email, otp) {
  const user = await findUserForResetOTPVerification(email);
  if (!user) {
    return { notFound: true };
  }

  // Exceeded max attempts?
  if ((user.resetOTPAttempts || 0) >= OTP_MAX_ATTEMPTS) {
    user.resetOTP = undefined;
    user.resetOTPExpires = undefined;
    user.resetOTPAttempts = 0;
    await user.save();
    return { tooManyAttempts: true };
  }

  const isValid = verifyOTP(user.resetOTP, otp, user.resetOTPExpires);
  if (!isValid) {
    user.resetOTPAttempts = (user.resetOTPAttempts || 0) + 1;
    const remaining = Math.max(0, OTP_MAX_ATTEMPTS - user.resetOTPAttempts);
    if (user.resetOTPAttempts >= OTP_MAX_ATTEMPTS) {
      user.resetOTP = undefined;
      user.resetOTPExpires = undefined;
      user.resetOTPAttempts = 0;
      await user.save();
      return { tooManyAttempts: true };
    }
    await user.save();
    return { invalid: true, remaining };
  }

  // Success — clear OTP and open a reset window
  user.resetOTP = undefined;
  user.resetOTPExpires = undefined;
  user.resetOTPAttempts = 0;
  user.resetVerifiedExpires = new Date(Date.now() + RESET_VERIFIED_WINDOW_MS);
  await user.save();

  logger.info(`OTP verified for: ${email}`);
  return { verified: true };
}

/**
 * Set a new password after the OTP has been verified.
 * Returns `{ reset: true }` on success.
 */
export async function resetUserPassword(email, newPassword) {
  if (!PASSWORD_STRENGTH_REGEX.test(newPassword)) {
    return { weakPassword: true, message: PASSWORD_STRENGTH_MESSAGE };
  }

  const user = await findUserForResetPassword(email);
  if (!user) {
    return { notFound: true };
  }

  if (!user.resetVerifiedExpires || user.resetVerifiedExpires < new Date()) {
    return { notVerified: true };
  }

  user.password = newPassword;
  user.resetVerifiedExpires = undefined;
  await user.save();

  // Invalidate all refresh sessions on password change
  await revokeAllUserRefreshTokens(user._id);

  logger.info(`Password reset successful for: ${email}`);
  return { reset: true };
}

// ---------------------------------------------------------------------------
// Login OTP flow
// ---------------------------------------------------------------------------

/**
 * Generate and send a login OTP for the given email.
 */
export async function initiateLoginOTP(email) {
  const user = await findUserForLoginOTPRequest(email);
  if (!user) {
    return { notFound: true };
  }

  if (user.isBlocked) {
    return { blocked: true };
  }

  const { otp, expiry } = generateResetOTP();
  user.loginOTP = otp;
  user.loginOTPExpires = expiry;
  user.loginOTPAttempts = 0;
  await user.save();

  const isDev = (process.env.NODE_ENV || "development") !== "production";
  if (isDev) {
    logger.info(`[DEV MODE] Login OTP for ${email}: ${otp}`);
  }

  const emailResult = await sendLoginOTPEmail({ email, otp });
  if (!emailResult.success && !isDev) {
    logger.error("Failed to send login OTP email:", emailResult.error);
    return { emailFailed: true };
  }

  if (!emailResult.success && isDev) {
    logger.warn(
      `Failed to send login OTP email in dev mode, but proceeding since DEV OTP is: ${otp}`
    );
  }

  logger.info(`Login OTP sent to: ${email}`);
  return { sent: true, devOtp: isDev ? otp : undefined };
}

/**
 * Verify a login OTP and return the user object (caller issues tokens).
 */
export async function verifyLoginOTPCode(email, otp) {
  const user = await findUserForLoginOTPVerification(email);
  if (!user) {
    return { notFound: true };
  }

  if (user.isBlocked) {
    return { blocked: true };
  }

  if ((user.loginOTPAttempts || 0) >= OTP_MAX_ATTEMPTS) {
    user.loginOTP = undefined;
    user.loginOTPExpires = undefined;
    user.loginOTPAttempts = 0;
    await user.save();
    return { tooManyAttempts: true };
  }

  const isValid = verifyOTP(user.loginOTP, otp, user.loginOTPExpires);
  if (!isValid) {
    user.loginOTPAttempts = (user.loginOTPAttempts || 0) + 1;
    const remaining = Math.max(0, OTP_MAX_ATTEMPTS - user.loginOTPAttempts);
    if (user.loginOTPAttempts >= OTP_MAX_ATTEMPTS) {
      user.loginOTP = undefined;
      user.loginOTPExpires = undefined;
      user.loginOTPAttempts = 0;
      await user.save();
      return { tooManyAttempts: true };
    }
    await user.save();
    return { invalid: true, remaining };
  }

  // Invalidate OTP on success
  user.loginOTP = undefined;
  user.loginOTPExpires = undefined;
  user.loginOTPAttempts = 0;
  await user.save();

  return { verified: true, user };
}
