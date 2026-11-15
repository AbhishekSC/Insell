import { body, param, query } from "express-validator";

const ratingField = (field) =>
  body(`categoryRatings.${field}`)
    .isInt({ min: 1, max: 5 })
    .withMessage(`${field} rating must be between 1 and 5`);

export const createReviewRules = [
  param("pgId").isMongoId().withMessage("Invalid PG ID"),
  ratingField("food"),
  ratingField("cleanliness"),
  ratingField("wifi"),
  ratingField("water"),
  ratingField("safety"),
  ratingField("landlord"),
  ratingField("value_for_money"),
  ratingField("location"),
  body("comment")
    .optional()
    .isString()
    .isLength({ max: 1000 })
    .withMessage("Comment must be under 1000 characters"),
  body("photos")
    .optional()
    .isArray({ max: 10 })
    .withMessage("Maximum 10 photos allowed"),
  body("stayDurationMonths")
    .optional()
    .isInt({ min: 1, max: 120 })
    .withMessage("Stay duration must be between 1 and 120 months"),
];

export const getReviewsRules = [
  param("pgId").isMongoId().withMessage("Invalid PG ID"),
  query("page").optional().isInt({ min: 1 }).withMessage("Page must be a positive integer"),
  query("limit").optional().isInt({ min: 1, max: 50 }).withMessage("Limit must be between 1 and 50"),
];

export const markHelpfulRules = [
  param("reviewId").isMongoId().withMessage("Invalid review ID"),
];

export const deleteReviewRules = [
  param("reviewId").isMongoId().withMessage("Invalid review ID"),
];
