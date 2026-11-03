/** Maximum failed OTP verification attempts before the code is invalidated. */
export const OTP_MAX_ATTEMPTS = 5;

/** Duration (ms) after successful OTP verification during which a password reset is allowed. */
export const RESET_VERIFIED_WINDOW_MS = 10 * 60 * 1000; // 10 minutes
