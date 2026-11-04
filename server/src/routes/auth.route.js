import express from "express";
import {
  login,
  logout,
  logoutAll,
  refresh,
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
import { validateRequest } from "../middlewares/validation.js";
import {
  verifySignupRules,
  requestPasswordResetRules,
  verifyResetOTPRules,
  resetPasswordRules,
  requestLoginOTPRules,
  verifyLoginOTPRules,
} from "../validators/auth.validator.js";
import { verifyUser } from "../middlewares/auth.middleware.js";
import {
  signupCodeRateLimiter,
  passwordResetRateLimiter,
  loginRateLimiter,
  otpVerifyRateLimiter,
  loginOtpRequestRateLimiter,
} from "../middlewares/rateLimiter.js";
import { sendSuccessResponse } from "../utils/responseHandler.js";

const router = express.Router();

/**
 * @swagger
 * /api/v1/auth/signup:
 *   post:
 *     tags: [Auth]
 *     summary: Register a new user
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [fullName, email, password]
 *             properties:
 *               fullName: { type: string, minLength: 5, maxLength: 30 }
 *               email: { type: string, format: email }
 *               password: { type: string, minLength: 6 }
 *     responses:
 *       201: { description: Signup successful — verification code sent }
 *       400: { description: Validation error, $ref: '#/components/schemas/Error' }
 */
router.post("/signup", signupValidation, signup);
router.post("/verify-signup", otpVerifyRateLimiter, verifySignupRules, validateRequest, verifySignup);
router.post("/resend-signup-code", signupCodeRateLimiter, resendSignupCode);
/**
 * @swagger
 * /api/v1/auth/login:
 *   post:
 *     tags: [Auth]
 *     summary: Log in with email and password
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [email, password]
 *             properties:
 *               email: { type: string, format: email }
 *               password: { type: string }
 *     responses:
 *       200: { description: Login successful — tokens set as cookies }
 *       401: { description: Invalid credentials }
 *       429: { description: Too many login attempts }
 */
router.post("/login", loginRateLimiter, loginValidation, login);
router.post("/refresh", refresh);
router.post("/logout", logout);
router.post("/logout-all", verifyUser, logoutAll);

// Passwordless OTP Login routes
router.post("/otp-login/request", loginOtpRequestRateLimiter, requestLoginOTPRules, validateRequest, requestLoginOTP);
router.post("/otp-login/verify", otpVerifyRateLimiter, verifyLoginOTPRules, validateRequest, verifyLoginOTP);

router.post("/onboarding", verifyUser, onboarding);
router.post("/profile-setup", verifyUser, onboarding);

router.get("/verify", verifyUser, (req, res) => {
  res.set({
    "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate",
    "Pragma": "no-cache",
    "Expires": "0",
    "Surrogate-Control": "no-store",
  });
  sendSuccessResponse(res, 200, "User verified successfully", {
    user: req.user,
  });
});

// Google OAuth routes
router.get("/google", googleAuth);
router.get("/google/callback", googleAuthCallback);

// Password Reset routes
router.post("/password-reset/request", passwordResetRateLimiter, requestPasswordResetRules, validateRequest, requestPasswordReset);
router.post("/password-reset/verify-otp", otpVerifyRateLimiter, verifyResetOTPRules, validateRequest, verifyResetOTP);
router.post("/password-reset/reset", resetPasswordRules, validateRequest, resetPassword);

// Forget-password
// Send reset-password email

export default router;
