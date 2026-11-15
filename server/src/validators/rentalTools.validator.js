import { body, param, query } from "express-validator";
import { SUPPORTED_STATES } from "../models/RentalAgreement.model.js";

// ── Rent Payment ───────────────────────────────────────────────────────

export const logPaymentRules = [
  body("landlordName").isString().isLength({ min: 2, max: 120 }).withMessage("Landlord name is required (2-120 chars)"),
  body("landlordPAN").optional().isString().isLength({ max: 10 }),
  body("propertyAddress").isString().isLength({ min: 5, max: 500 }).withMessage("Property address is required (5-500 chars)"),
  body("amount").isFloat({ min: 1 }).withMessage("Rent amount must be a positive number"),
  body("month").isInt({ min: 1, max: 12 }).withMessage("Month must be between 1 and 12"),
  body("year").isInt({ min: 2020, max: 2100 }).withMessage("Year must be between 2020 and 2100"),
  body("paymentDate").optional().isISO8601().withMessage("Invalid payment date"),
  body("paymentMode").optional().isIn(["cash", "upi", "bank_transfer", "cheque", "other"]),
  body("notes").optional().isString().isLength({ max: 300 }),
];

export const rentHistoryRules = [
  query("page").optional().isInt({ min: 1 }),
  query("limit").optional().isInt({ min: 1, max: 50 }),
  query("year").optional().isInt({ min: 2020, max: 2100 }),
];

export const generateReceiptRules = [
  param("paymentId").isMongoId().withMessage("Invalid payment ID"),
];

export const standaloneReceiptRules = [
  body("tenantName").isString().isLength({ min: 2, max: 120 }).withMessage("Tenant name is required"),
  body("landlordName").isString().isLength({ min: 2, max: 120 }).withMessage("Landlord name is required"),
  body("landlordPAN").optional().isString().isLength({ max: 10 }),
  body("propertyAddress").isString().isLength({ min: 5, max: 500 }).withMessage("Property address is required"),
  body("amount").isFloat({ min: 1 }).withMessage("Rent amount must be a positive number"),
  body("month").isInt({ min: 1, max: 12 }).withMessage("Month must be between 1 and 12"),
  body("year").isInt({ min: 2020, max: 2100 }).withMessage("Year must be between 2020 and 2100"),
  body("paymentDate").optional().isISO8601(),
  body("paymentMode").optional().isIn(["cash", "upi", "bank_transfer", "cheque", "other"]),
];

// ── Rental Agreement ───────────────────────────────────────────────────

export const createAgreementRules = [
  body("state").isIn(SUPPORTED_STATES).withMessage(`State must be one of: ${SUPPORTED_STATES.join(", ")}`),
  body("tenantName").isString().isLength({ min: 2, max: 120 }).withMessage("Tenant name is required"),
  body("tenantAddress").optional().isString().isLength({ max: 500 }),
  body("tenantPhone").optional().isString().isLength({ max: 15 }),
  body("tenantAadhar").optional().isString().isLength({ max: 12 }),
  body("landlordName").isString().isLength({ min: 2, max: 120 }).withMessage("Landlord name is required"),
  body("landlordAddress").optional().isString().isLength({ max: 500 }),
  body("landlordPhone").optional().isString().isLength({ max: 15 }),
  body("landlordAadhar").optional().isString().isLength({ max: 12 }),
  body("propertyAddress").isString().isLength({ min: 5, max: 500 }).withMessage("Property address is required"),
  body("propertyType").optional().isString().isLength({ max: 50 }),
  body("furnishing").optional().isString().isLength({ max: 50 }),
  body("monthlyRent").isFloat({ min: 1 }).withMessage("Monthly rent is required"),
  body("securityDeposit").optional().isFloat({ min: 0 }),
  body("maintenanceCharges").optional().isFloat({ min: 0 }),
  body("rentDueDate").optional().isInt({ min: 1, max: 31 }),
  body("leaseStartDate").isISO8601().withMessage("Lease start date is required"),
  body("leaseEndDate").isISO8601().withMessage("Lease end date is required"),
  body("lockInPeriodMonths").optional().isInt({ min: 0, max: 60 }),
  body("noticePeriodMonths").optional().isInt({ min: 0, max: 12 }),
  body("additionalTerms").optional().isArray({ max: 10 }),
  body("additionalTerms.*").optional().isString().isLength({ max: 500 }),
];

export const agreementIdRules = [
  param("agreementId").isMongoId().withMessage("Invalid agreement ID"),
];

// ── Condition Report ───────────────────────────────────────────────────

export const createConditionReportRules = [
  body("landlordName").isString().isLength({ min: 2, max: 120 }).withMessage("Landlord name is required"),
  body("landlordEmail").optional().isEmail().withMessage("Invalid email"),
  body("landlordPhone").optional().isString().isLength({ max: 15 }),
  body("propertyAddress").isString().isLength({ min: 5, max: 500 }).withMessage("Property address is required"),
  body("moveInDate").optional().isISO8601(),
  body("rooms").isArray({ min: 1, max: 20 }).withMessage("At least 1 room required, maximum 20"),
  body("rooms.*.name").isString().isLength({ min: 1, max: 60 }).withMessage("Room name is required"),
  body("rooms.*.notes").optional().isString().isLength({ max: 500 }),
  body("rooms.*.condition").optional().isIn(["excellent", "good", "fair", "poor", "damaged"]),
  body("rooms.*.photos").optional().isArray({ max: 10 }),
  body("overallNotes").optional().isString().isLength({ max: 2000 }),
];

export const conditionReportIdRules = [
  param("reportId").isMongoId().withMessage("Invalid report ID"),
];
