import { body, param, query } from "express-validator";
import { ISSUE_CATEGORIES, ISSUE_STATUSES } from "../models/IssueReport.model.js";

export const createIssueRules = [
  body("pgId").isMongoId().withMessage("Invalid PG ID"),
  body("category")
    .isIn(ISSUE_CATEGORIES)
    .withMessage(`Category must be one of: ${ISSUE_CATEGORIES.join(", ")}`),
  body("title")
    .isString()
    .isLength({ min: 3, max: 120 })
    .withMessage("Title must be between 3 and 120 characters"),
  body("description")
    .optional()
    .isString()
    .isLength({ max: 1000 })
    .withMessage("Description must be under 1000 characters"),
  body("photos")
    .optional()
    .isArray({ max: 5 })
    .withMessage("Maximum 5 photos allowed"),
  body("priority")
    .optional()
    .isIn(["low", "medium", "high", "urgent"])
    .withMessage("Priority must be low, medium, high, or urgent"),
];

export const getIssuesByPgRules = [
  param("pgId").isMongoId().withMessage("Invalid PG ID"),
  query("status").optional().isIn(ISSUE_STATUSES).withMessage("Invalid status filter"),
  query("page").optional().isInt({ min: 1 }),
  query("limit").optional().isInt({ min: 1, max: 50 }),
];

export const updateIssueRules = [
  param("issueId").isMongoId().withMessage("Invalid issue ID"),
  body("status")
    .optional()
    .isIn(ISSUE_STATUSES)
    .withMessage(`Status must be one of: ${ISSUE_STATUSES.join(", ")}`),
  body("ownerResponse")
    .optional()
    .isString()
    .isLength({ max: 1000 })
    .withMessage("Response must be under 1000 characters"),
];

export const issueIdRules = [
  param("issueId").isMongoId().withMessage("Invalid issue ID"),
];

export const pgIdRules = [
  param("pgId").isMongoId().withMessage("Invalid PG ID"),
];
