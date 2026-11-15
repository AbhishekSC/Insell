import { Router } from "express";
import { verifyUser, requireVerified } from "../../middlewares/auth.middleware.js";
import { validateRequest } from "../../middlewares/validation.js";
import { createBillRules, billIdRules, pgIdRules } from "../../validators/pgBill.validator.js";
import { createBill, getMyBills, getBillById, markBillPaid, getMonthlyComparison, getPgBillSummary } from "./pgBill.controller.js";

const router = Router();

router.post("/", verifyUser, requireVerified, createBillRules, validateRequest, createBill);
router.get("/mine", verifyUser, requireVerified, getMyBills);
router.get("/:billId", verifyUser, requireVerified, billIdRules, validateRequest, getBillById);
router.patch("/:billId/pay", verifyUser, requireVerified, billIdRules, validateRequest, markBillPaid);
router.get("/pg/:pgId/comparison", verifyUser, requireVerified, pgIdRules, validateRequest, getMonthlyComparison);
router.get("/pg/:pgId/summary", verifyUser, requireVerified, pgIdRules, validateRequest, getPgBillSummary);

export default router;
