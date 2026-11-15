import { body, param, query } from "express-validator";

export const createBillRules = [
  body("pgId").isMongoId().withMessage("Invalid PG ID"),
  body("tenantId").isMongoId().withMessage("Invalid tenant ID"),
  body("month").isInt({ min: 1, max: 12 }).withMessage("Month must be between 1 and 12"),
  body("year").isInt({ min: 2020, max: 2100 }).withMessage("Invalid year"),
  body("items").isArray({ min: 1, max: 20 }).withMessage("At least 1 line item required"),
  body("items.*.label").isString().isLength({ min: 1, max: 60 }).withMessage("Item label required"),
  body("items.*.amount").isFloat({ min: 0 }).withMessage("Item amount must be >= 0"),
  body("items.*.notes").optional().isString().isLength({ max: 200 }),
  body("electricityUnits").optional().isFloat({ min: 0 }),
  body("electricityPerUnit").optional().isFloat({ min: 0 }),
  body("splitMethod").optional().isIn(["equal", "per_meter", "usage_based", "fixed"]),
  body("notes").optional().isString().isLength({ max: 500 }),
];

export const billIdRules = [
  param("billId").isMongoId().withMessage("Invalid bill ID"),
];

export const pgIdRules = [
  param("pgId").isMongoId().withMessage("Invalid PG ID"),
  query("month").optional().isInt({ min: 1, max: 12 }),
  query("year").optional().isInt({ min: 2020, max: 2100 }),
];
