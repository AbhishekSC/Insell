import { Router } from "express";
import { verifyUser, requireVerified } from "../../middlewares/auth.middleware.js";
import { validateRequest } from "../../middlewares/validation.js";
import {
  bookingRequestRules,
  approveBookingRules,
  rejectBookingRules,
  moveInRules,
  moveOutRules,
  depositRefundRules,
  residencyIdRules,
  pgIdRules,
} from "../../validators/pgResidency.validator.js";
import {
  requestBooking,
  approveBooking,
  rejectBooking,
  getBookingRequests,
  getBookingStatus,
  cancelBooking,
  getAllBookingRequests,
  getMyBookings,
  registerMoveIn,
  registerMoveOut,
  recordDepositRefund,
  generateFormalNotice,
  getMyResidencies,
  getResidencyById,
  getPgResidents,
  getPendingDeposits,
} from "./pgResidency.controller.js";

const router = Router();

// ── Booking Request Flow ──────────────────────────────────────────────
router.post("/booking-request", verifyUser, requireVerified, bookingRequestRules, validateRequest, requestBooking);
router.patch("/:residencyId/approve", verifyUser, requireVerified, approveBookingRules, validateRequest, approveBooking);
router.patch("/:residencyId/reject", verifyUser, requireVerified, rejectBookingRules, validateRequest, rejectBooking);
router.get("/booking-requests", verifyUser, requireVerified, getBookingRequests);
router.get("/booking-requests/all", verifyUser, requireVerified, getAllBookingRequests);
router.get("/booking-status/:pgId", verifyUser, requireVerified, pgIdRules, validateRequest, getBookingStatus);
router.patch("/:residencyId/cancel", verifyUser, requireVerified, residencyIdRules, validateRequest, cancelBooking);
router.get("/my-bookings", verifyUser, requireVerified, getMyBookings);

// ── Direct Move-in (owner-initiated) ─────────────────────────────────
router.post("/move-in", verifyUser, requireVerified, moveInRules, validateRequest, registerMoveIn);
router.patch("/:residencyId/move-out", verifyUser, requireVerified, moveOutRules, validateRequest, registerMoveOut);
router.patch("/:residencyId/deposit-refund", verifyUser, requireVerified, depositRefundRules, validateRequest, recordDepositRefund);
router.get("/:residencyId/formal-notice", verifyUser, requireVerified, residencyIdRules, validateRequest, generateFormalNotice);

// ── Queries ───────────────────────────────────────────────────────────
router.get("/mine", verifyUser, requireVerified, getMyResidencies);
router.get("/:residencyId", verifyUser, requireVerified, residencyIdRules, validateRequest, getResidencyById);
router.get("/pg/:pgId/residents", verifyUser, requireVerified, pgIdRules, validateRequest, getPgResidents);
router.get("/pg/:pgId/pending-deposits", verifyUser, requireVerified, pgIdRules, validateRequest, getPendingDeposits);

export default router;
