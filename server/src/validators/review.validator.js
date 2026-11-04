import { body, param } from "express-validator";

export const createReviewRules = [
  param("offerId").isMongoId().withMessage("Invalid offer ID"),
  body("rating")
    .isInt({ min: 1, max: 5 }).withMessage("Rating must be between 1 and 5"),
  body("comment")
    .optional()
    .isString()
    .isLength({ max: 1000 }).withMessage("Comment must be under 1000 characters"),
];

export const getUserReviewsRules = [
  param("userId").isMongoId().withMessage("Invalid user ID"),
];
