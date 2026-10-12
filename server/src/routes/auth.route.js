import express from "express";
import {
  login,
  logout,
  onboarding,
  signup,
  verifySignup,
  resendSignupCode,
  googleAuth,
  googleAuthCallback,
  requestPasswordReset,
  verifyResetOTP,
  resetPassword,
  requestLoginOTP,
  verifyLoginOTP,
} from "../controllers/auth.controller.js";
import {
  loginValidation,
  signupValidation,
} from "../middlewares/authValidation.middleware.js";
import { verifyUser } from "../middlewares/auth.middleware.js";
import {
  signupCodeRateLimiter,
  passwordResetRateLimiter,
  loginRateLimiter,
  otpVerifyRateLimiter,
  loginOtpRequestRateLimiter,
} from "../middleware/rateLimiter.js";
import { sendSuccessResponse } from "../utils/responseHandler.js";

const router = express.Router();

router.post("/signup", signupValidation, signup);
router.post("/verify-signup", otpVerifyRateLimiter, verifySignup);
router.post("/resend-signup-code", signupCodeRateLimiter, resendSignupCode);
router.post("/login", loginRateLimiter, loginValidation, login);
router.post("/logout", logout);

// Passwordless OTP Login routes
router.post("/otp-login/request", loginOtpRequestRateLimiter, requestLoginOTP);
router.post("/otp-login/verify", otpVerifyRateLimiter, verifyLoginOTP);

router.post("/onboarding", verifyUser, onboarding);
router.post("/profile-setup", verifyUser, onboarding);

router.get("/verify", verifyUser, (req, res) => {
  sendSuccessResponse(res, 200, "User verified successfully", {
    user: req.user,
  });
});

// Google OAuth routes
router.get("/google", googleAuth);
router.get("/google/callback", googleAuthCallback);

// Password Reset routes
router.post("/password-reset/request", passwordResetRateLimiter, requestPasswordReset);
router.post("/password-reset/verify-otp", otpVerifyRateLimiter, verifyResetOTP);
router.post("/password-reset/reset", resetPassword);

// Forget-password
// Send reset-password email

export default router;
