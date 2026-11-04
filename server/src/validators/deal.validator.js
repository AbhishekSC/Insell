import { body, param } from "express-validator";

export const updateDealRules = [
  param("id").isMongoId().withMessage("Invalid deal ID"),
  body("status")
    .optional()
    .isIn(["pending", "in_progress", "inspection", "documentation", "completed", "cancelled"])
    .withMessage("Invalid deal status"),
  body("notes")
    .optional()
    .isString()
    .isLength({ max: 2000 }).withMessage("Notes must be under 2000 characters"),
];

export const addDealAttachmentRules = [
  param("id").isMongoId().withMessage("Invalid deal ID"),
];

export const verifyDealAttachmentRules = [
  param("id").isMongoId().withMessage("Invalid deal ID"),
  param("attId").isMongoId().withMessage("Invalid attachment ID"),
];
