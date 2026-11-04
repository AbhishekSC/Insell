import { body } from "express-validator";

export const createFeedbackRules = [
  body("category")
    .optional()
    .isIn(["bug", "feature", "improvement", "other"]).withMessage("Invalid feedback category"),
  body("message")
    .trim()
    .notEmpty().withMessage("Feedback message is required")
    .isLength({ max: 2000 }).withMessage("Message must be under 2000 characters"),
  body("rating")
    .optional()
    .isInt({ min: 1, max: 5 }).withMessage("Rating must be between 1 and 5"),
];
