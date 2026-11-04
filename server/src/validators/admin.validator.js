import { body, param } from "express-validator";

export const toggleUserBlockRules = [
  param("id").isMongoId().withMessage("Invalid user ID"),
];

export const adminCreditCoinsRules = [
  param("id").isMongoId().withMessage("Invalid user ID"),
  body("amount")
    .isInt({ min: 1 }).withMessage("Amount must be a positive integer"),
  body("reason")
    .trim()
    .notEmpty().withMessage("Reason is required")
    .isLength({ max: 500 }).withMessage("Reason must be under 500 characters"),
];

export const createAnnouncementRules = [
  body("title")
    .trim()
    .notEmpty().withMessage("Title is required")
    .isLength({ max: 200 }).withMessage("Title must be under 200 characters"),
  body("body")
    .trim()
    .notEmpty().withMessage("Body is required")
    .isLength({ max: 5000 }).withMessage("Body must be under 5000 characters"),
  body("type")
    .optional()
    .isIn(["info", "warning", "update", "maintenance"]).withMessage("Invalid announcement type"),
];

export const reviewVerificationRules = [
  param("id").isMongoId().withMessage("Invalid verification ID"),
  body("status")
    .isIn(["approved", "rejected"]).withMessage("Status must be approved or rejected"),
  body("rejectionReason")
    .if(body("status").equals("rejected"))
    .trim()
    .notEmpty().withMessage("Rejection reason is required when rejecting"),
];
