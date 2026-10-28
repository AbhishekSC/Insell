import { body, param } from "express-validator";

export const updateProfileRules = [
  body("fullName")
    .optional()
    .trim()
    .isLength({ min: 2, max: 50 }).withMessage("Name must be between 2 and 50 characters"),
  body("phone")
    .optional()
    .trim()
    .matches(/^[+]?[\d\s-]{7,15}$/).withMessage("Invalid phone number format"),
  body("bio")
    .optional()
    .trim()
    .isLength({ max: 500 }).withMessage("Bio must be under 500 characters"),
];

export const updateLocationRules = [
  body("latitude").isFloat({ min: -90, max: 90 }).withMessage("Invalid latitude"),
  body("longitude").isFloat({ min: -180, max: 180 }).withMessage("Invalid longitude"),
];

export const userIdParamRules = [
  param("id").isMongoId().withMessage("Invalid user ID"),
];
