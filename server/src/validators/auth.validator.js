import { body, param } from "express-validator";

export const verifySignupRules = [
  body("email").trim().isEmail().withMessage("Valid email is required").normalizeEmail({ gmail_remove_dots: false }),
  body("code").trim().notEmpty().withMessage("Verification code is required").isLength({ min: 6, max: 6 }).withMessage("Code must be 6 digits"),
];

export const requestPasswordResetRules = [
  body("email").trim().isEmail().withMessage("Valid email is required").normalizeEmail({ gmail_remove_dots: false }),
];

export const verifyResetOTPRules = [
  body("email").trim().isEmail().withMessage("Valid email is required").normalizeEmail({ gmail_remove_dots: false }),
  body("otp").trim().notEmpty().withMessage("OTP is required").isLength({ min: 6, max: 6 }).withMessage("OTP must be 6 digits"),
];

export const resetPasswordRules = [
  body("email").trim().isEmail().withMessage("Valid email is required").normalizeEmail({ gmail_remove_dots: false }),
  body("resetToken").trim().notEmpty().withMessage("Reset token is required"),
  body("newPassword")
    .isLength({ min: 6 }).withMessage("Password must be at least 6 characters")
    .matches(/[A-Z]/).withMessage("Password must contain at least one uppercase letter")
    .matches(/[!@#$%^&*(),.?":{}|<>]/).withMessage("Password must contain at least one special character"),
];

export const requestLoginOTPRules = [
  body("email").trim().isEmail().withMessage("Valid email is required").normalizeEmail({ gmail_remove_dots: false }),
];

export const verifyLoginOTPRules = [
  body("email").trim().isEmail().withMessage("Valid email is required").normalizeEmail({ gmail_remove_dots: false }),
  body("otp").trim().notEmpty().withMessage("OTP is required").isLength({ min: 6, max: 6 }).withMessage("OTP must be 6 digits"),
];
