import { body, param, query } from "express-validator";

export const bookingRequestRules = [
  body("pgId").isMongoId().withMessage("Invalid PG ID"),
  body("roomType").isString().isLength({ min: 1, max: 50 }).withMessage("Room type is required"),
  body("preferredMoveInDate").isISO8601().withMessage("Preferred move-in date is required"),
  body("monthlyRent").isFloat({ min: 0 }).withMessage("Monthly rent must be >= 0"),
  body("depositAmount").isFloat({ min: 0 }).withMessage("Deposit amount must be >= 0"),
  body("message").optional().isString().isLength({ max: 500 }),
];

export const approveBookingRules = [
  param("residencyId").isMongoId().withMessage("Invalid residency ID"),
  body("moveInDate").optional().isISO8601().withMessage("Invalid move-in date"),
  body("note").optional().isString().isLength({ max: 500 }),
  body("assignedRoom").optional().isString().isLength({ max: 50 }),
  body("assignedBed").optional().isString().isLength({ max: 50 }),
];

export const rejectBookingRules = [
  param("residencyId").isMongoId().withMessage("Invalid residency ID"),
  body("note").optional().isString().isLength({ max: 500 }),
];

export const moveInRules = [
  body("pgId").isMongoId().withMessage("Invalid PG ID"),
  body("roomType").optional().isString().isLength({ max: 50 }),
  body("moveInDate").optional().isISO8601().withMessage("Invalid move-in date"),
  body("monthlyRent").isFloat({ min: 0 }).withMessage("Monthly rent must be >= 0"),
  body("depositAmount").isFloat({ min: 0 }).withMessage("Deposit amount must be >= 0"),
  body("conditionReportId").optional().isMongoId().withMessage("Invalid condition report ID"),
];

export const moveOutRules = [
  param("residencyId").isMongoId().withMessage("Invalid residency ID"),
  body("moveOutDate").optional().isISO8601().withMessage("Invalid move-out date"),
  body("conditionReportId").optional().isMongoId().withMessage("Invalid condition report ID"),
];

export const depositRefundRules = [
  param("residencyId").isMongoId().withMessage("Invalid residency ID"),
  body("refundAmount").isFloat({ min: 0 }).withMessage("Refund amount must be >= 0"),
  body("notes").optional().isString().isLength({ max: 500 }),
];

export const residencyIdRules = [
  param("residencyId").isMongoId().withMessage("Invalid residency ID"),
];

export const pgIdRules = [
  param("pgId").isMongoId().withMessage("Invalid PG ID"),
  query("status").optional().isIn(["pending", "approved", "active", "notice_period", "moved_out", "evicted", "rejected"]),
];
