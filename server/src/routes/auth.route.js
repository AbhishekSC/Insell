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
import { signupCodeRateLimiter, passwordResetRateLimiter } from "../middleware/rateLimiter.js";
import { sendSuccessResponse } from "../utils/responseHandler.js";

const router = express.Router();

router.post("/signup", signupValidation, signup);
router.post("/verify-signup", verifySignup);
router.post("/resend-signup-code", signupCodeRateLimiter, resendSignupCode);
router.post("/login", loginValidation, login);
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
router.post("/password-reset/request", passwordResetRateLimiter, requestPasswordReset);
router.post("/password-reset/verify-otp", verifyResetOTP);
router.post("/password-reset/reset", resetPassword);

// Forget-password
// Send reset-password email

export default router;
