import { body, param, query } from "express-validator";

export const createPropertyPostRules = [
  body("title")
    .trim()
    .notEmpty().withMessage("Title is required")
    .isLength({ max: 200 }).withMessage("Title must be under 200 characters"),
  body("postType")
    .isIn(["rent", "sale", "pg", "flatmate"]).withMessage("Post type must be rent, sale, pg, or flatmate"),
  body("price")
    .isNumeric().withMessage("Price must be a number")
    .custom((v) => v >= 0).withMessage("Price cannot be negative"),
  body("location")
    .optional()
    .isObject().withMessage("Location must be an object"),
  body("location.coordinates")
    .optional()
    .isArray({ min: 2, max: 2 }).withMessage("Coordinates must be [lng, lat]"),
];

export const updatePropertyPostRules = [
  param("id").isMongoId().withMessage("Invalid post ID"),
  body("title")
    .optional()
    .trim()
    .isLength({ max: 200 }).withMessage("Title must be under 200 characters"),
  body("price")
    .optional()
    .isNumeric().withMessage("Price must be a number")
    .custom((v) => v >= 0).withMessage("Price cannot be negative"),
];

export const reportPostRules = [
  param("id").isMongoId().withMessage("Invalid post ID"),
  body("reason")
    .trim()
    .notEmpty().withMessage("Report reason is required")
    .isLength({ max: 500 }).withMessage("Reason must be under 500 characters"),
];

export const boostPropertyPostRules = [
  param("id").isMongoId().withMessage("Invalid post ID"),
  body("durationDays")
    .optional()
    .isInt({ min: 1, max: 30 }).withMessage("Boost duration must be 1-30 days"),
];

export const mongoIdParam = [
  param("id").isMongoId().withMessage("Invalid ID"),
];
