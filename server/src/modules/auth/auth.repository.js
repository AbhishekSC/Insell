import User from "../../models/User.model.js";

/**
 * Find a user by email with the password-reset OTP fields selected.
 */
export function findUserForPasswordReset(email) {
  return User.findOne({ email }).select("+password");
}

/**
 * Find a user by email with the reset-OTP verification fields selected.
 */
export function findUserForResetOTPVerification(email) {
  return User.findOne({ email }).select(
    "+resetOTP +resetOTPExpires +resetOTPAttempts"
  );
}

/**
 * Find a user by email with password and resetVerifiedExpires for the
 * final password-reset step.
 */
export function findUserForResetPassword(email) {
  return User.findOne({ email }).select("+password +resetVerifiedExpires");
}

/**
 * Find a user by email (default projection) for login-OTP request.
 */
export function findUserForLoginOTPRequest(email) {
  return User.findOne({ email });
}

/**
 * Find a user by email with login-OTP fields selected for verification.
 */
export function findUserForLoginOTPVerification(email) {
  return User.findOne({ email }).select(
    "+loginOTP +loginOTPExpires +loginOTPAttempts +password"
  );
}
