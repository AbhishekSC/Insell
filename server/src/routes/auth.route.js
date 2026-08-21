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
} from "../controllers/auth.controller.js";
import {
  loginValidation,
  signupValidation,
} from "../middlewares/authValidation.middleware.js";
import { verifyUser } from "../middlewares/auth.middleware.js";
import { signupCodeRateLimiter } from "../middleware/rateLimiter.js";
import { authLimiter } from "../middleware/expressRateLimit.js";
import { sendSuccessResponse } from "../utils/responseHandler.js";

const router = express.Router();

router.post("/signup", authLimiter, signupValidation, signup);
router.post("/verify-signup", authLimiter, verifySignup);
router.post("/resend-signup-code", authLimiter, signupCodeRateLimiter, resendSignupCode);
router.post("/login", authLimiter, loginValidation, login);
router.post("/logout", logout);

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
router.post("/password-reset/request", authLimiter, requestPasswordReset);
router.post("/password-reset/verify-otp", authLimiter, verifyResetOTP);
router.post("/password-reset/reset", authLimiter, resetPassword);

// Forget-password
// Send reset-password email

export default router;
