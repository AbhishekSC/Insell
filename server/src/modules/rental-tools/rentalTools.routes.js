import { Router } from "express";
import { verifyUser, requireVerified } from "../../middlewares/auth.middleware.js";
import { validateRequest } from "../../middlewares/validation.js";
import {
  logPaymentRules,
  rentHistoryRules,
  generateReceiptRules,
  standaloneReceiptRules,
  createAgreementRules,
  agreementIdRules,
  createConditionReportRules,
  conditionReportIdRules,
} from "../../validators/rentalTools.validator.js";
import {
  logRentPayment,
  getRentHistory,
  generateReceipt,
  generateStandaloneReceipt,
  createAgreement,
  getAgreements,
  getAgreementById,
  downloadAgreementPdf,
  createConditionReport,
  getConditionReports,
  getConditionReportById,
  downloadConditionReportPdf,
} from "./rentalTools.controller.js";

const router = Router();

// ── Rent Receipts (standalone — no login required for basic receipt) ───
router.post("/receipt", verifyUser, requireVerified, standaloneReceiptRules, validateRequest, generateStandaloneReceipt);

// ── Rent Payments & Receipts ───────────────────────────────────────────
router.post("/rent-history", verifyUser, requireVerified, logPaymentRules, validateRequest, logRentPayment);
router.get("/rent-history", verifyUser, requireVerified, rentHistoryRules, validateRequest, getRentHistory);
router.get("/rent-history/:paymentId/receipt", verifyUser, requireVerified, generateReceiptRules, validateRequest, generateReceipt);

// ── Rental Agreements ──────────────────────────────────────────────────
router.post("/agreement", verifyUser, requireVerified, createAgreementRules, validateRequest, createAgreement);
router.get("/agreements", verifyUser, requireVerified, getAgreements);
router.get("/agreement/:agreementId", verifyUser, requireVerified, agreementIdRules, validateRequest, getAgreementById);
router.get("/agreement/:agreementId/pdf", verifyUser, requireVerified, agreementIdRules, validateRequest, downloadAgreementPdf);

// ── Condition Reports ──────────────────────────────────────────────────
router.post("/condition-report", verifyUser, requireVerified, createConditionReportRules, validateRequest, createConditionReport);
router.get("/condition-reports", verifyUser, requireVerified, getConditionReports);
router.get("/condition-report/:reportId", verifyUser, requireVerified, conditionReportIdRules, validateRequest, getConditionReportById);
router.get("/condition-report/:reportId/pdf", verifyUser, requireVerified, conditionReportIdRules, validateRequest, downloadConditionReportPdf);

export default router;
