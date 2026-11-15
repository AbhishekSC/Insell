import * as service from "./pgResidency.service.js";
import { sendSuccessResponse, sendErrorResponse } from "../../utils/responseHandler.js";
import { logger } from "../../utils/logger.js";

// ── Booking Request Flow ──────────────────────────────────────────────

export async function requestBooking(req, res) {
  try {
    const result = await service.requestBooking(req.user._id, req.body);
    if (result.error) return sendErrorResponse(res, result.error.status, result.error.message);
    return sendSuccessResponse(res, 201, "Booking request sent", { residency: result.residency });
  } catch (error) {
    logger.error("Error creating booking request:", error);
    return sendErrorResponse(res, 500, "Failed to send booking request");
  }
}

export async function approveBooking(req, res) {
  try {
    const result = await service.approveBooking(req.user._id, req.params.residencyId, req.body);
    if (result.error) return sendErrorResponse(res, result.error.status, result.error.message);
    return sendSuccessResponse(res, 200, "Booking approved", { residency: result.residency });
  } catch (error) {
    logger.error("Error approving booking:", error);
    return sendErrorResponse(res, 500, "Failed to approve booking");
  }
}

export async function rejectBooking(req, res) {
  try {
    const result = await service.rejectBooking(req.user._id, req.params.residencyId, req.body);
    if (result.error) return sendErrorResponse(res, result.error.status, result.error.message);
    return sendSuccessResponse(res, 200, "Booking rejected", { residency: result.residency });
  } catch (error) {
    logger.error("Error rejecting booking:", error);
    return sendErrorResponse(res, 500, "Failed to reject booking");
  }
}

export async function getBookingRequests(req, res) {
  try {
    const pgId = req.query.pgId || undefined;
    const result = await service.getBookingRequests(req.user._id, pgId);
    if (result.error) return sendErrorResponse(res, result.error.status, result.error.message);
    return sendSuccessResponse(res, 200, "Booking requests", { requests: result.requests });
  } catch (error) {
    logger.error("Error fetching booking requests:", error);
    return sendErrorResponse(res, 500, "Failed to fetch booking requests");
  }
}

export async function getBookingStatus(req, res) {
  try {
    const result = await service.getBookingStatus(req.user._id, req.params.pgId);
    return sendSuccessResponse(res, 200, "Booking status", { booking: result.booking });
  } catch (error) {
    logger.error("Error fetching booking status:", error);
    return sendErrorResponse(res, 500, "Failed to fetch booking status");
  }
}

export async function cancelBooking(req, res) {
  try {
    const result = await service.cancelBooking(req.user._id, req.params.residencyId);
    if (result.error) return sendErrorResponse(res, result.error.status, result.error.message);
    return sendSuccessResponse(res, 200, "Booking cancelled", { residency: result.residency });
  } catch (error) {
    logger.error("Error cancelling booking:", error);
    return sendErrorResponse(res, 500, "Failed to cancel booking");
  }
}

export async function getAllBookingRequests(req, res) {
  try {
    const pgId = req.query.pgId || undefined;
    const result = await service.getAllBookingRequests(req.user._id, pgId);
    if (result.error) return sendErrorResponse(res, result.error.status, result.error.message);
    return sendSuccessResponse(res, 200, "All booking requests", { requests: result.requests });
  } catch (error) {
    logger.error("Error fetching all booking requests:", error);
    return sendErrorResponse(res, 500, "Failed to fetch booking requests");
  }
}

export async function getMyBookings(req, res) {
  try {
    const result = await service.getMyBookings(req.user._id);
    return sendSuccessResponse(res, 200, "Your bookings", { bookings: result.bookings });
  } catch (error) {
    logger.error("Error fetching my bookings:", error);
    return sendErrorResponse(res, 500, "Failed to fetch bookings");
  }
}

// ── Existing Handlers ─────────────────────────────────────────────────

export async function registerMoveIn(req, res) {
  try {
    const result = await service.registerMoveIn(req.user._id, req.body);
    if (result.error) return sendErrorResponse(res, result.error.status, result.error.message);
    return sendSuccessResponse(res, 201, "Move-in registered", { residency: result.residency });
  } catch (error) {
    logger.error("Error registering move-in:", error);
    return sendErrorResponse(res, 500, "Failed to register move-in");
  }
}

export async function registerMoveOut(req, res) {
  try {
    const result = await service.registerMoveOut(req.user._id, req.params.residencyId, req.body);
    if (result.error) return sendErrorResponse(res, result.error.status, result.error.message);
    return sendSuccessResponse(res, 200, "Move-out registered", { residency: result.residency });
  } catch (error) {
    logger.error("Error registering move-out:", error);
    return sendErrorResponse(res, 500, "Failed to register move-out");
  }
}

export async function recordDepositRefund(req, res) {
  try {
    const result = await service.recordDepositRefund(req.user._id, req.params.residencyId, req.body);
    if (result.error) return sendErrorResponse(res, result.error.status, result.error.message);
    return sendSuccessResponse(res, 200, "Deposit refund recorded", { residency: result.residency });
  } catch (error) {
    logger.error("Error recording deposit refund:", error);
    return sendErrorResponse(res, 500, "Failed to record deposit refund");
  }
}

export async function generateFormalNotice(req, res) {
  try {
    const result = await service.generateFormalNotice(req.user._id, req.params.residencyId);
    if (result.error) return sendErrorResponse(res, result.error.status, result.error.message);
    return sendSuccessResponse(res, 200, "Formal notice generated", { notice: result.notice });
  } catch (error) {
    logger.error("Error generating formal notice:", error);
    return sendErrorResponse(res, 500, "Failed to generate formal notice");
  }
}

export async function getMyResidencies(req, res) {
  try {
    const page = Math.max(1, Number(req.query.page) || 1);
    const limit = Math.min(20, Math.max(1, Number(req.query.limit) || 10));
    const { residencies, total } = await service.getMyResidencies(req.user._id, { page, limit });
    return sendSuccessResponse(res, 200, "Your residencies", {
      residencies,
      pagination: { page, limit, total, totalPages: Math.max(1, Math.ceil(total / limit)) },
    });
  } catch (error) {
    logger.error("Error fetching residencies:", error);
    return sendErrorResponse(res, 500, "Failed to retrieve residencies");
  }
}

export async function getResidencyById(req, res) {
  try {
    const result = await service.getResidencyById(req.user._id, req.params.residencyId);
    if (result.error) return sendErrorResponse(res, result.error.status, result.error.message);
    return sendSuccessResponse(res, 200, "Residency retrieved", { residency: result.residency });
  } catch (error) {
    logger.error("Error fetching residency:", error);
    return sendErrorResponse(res, 500, "Failed to retrieve residency");
  }
}

export async function getPgResidents(req, res) {
  try {
    const status = req.query.status || undefined;
    const result = await service.getPgResidents(req.user._id, req.params.pgId, { status });
    if (result.error) return sendErrorResponse(res, result.error.status, result.error.message);
    return sendSuccessResponse(res, 200, "PG residents", { residents: result.residents });
  } catch (error) {
    logger.error("Error fetching PG residents:", error);
    return sendErrorResponse(res, 500, "Failed to retrieve residents");
  }
}

export async function getPendingDeposits(req, res) {
  try {
    const result = await service.getPendingDeposits(req.user._id, req.params.pgId);
    if (result.error) return sendErrorResponse(res, result.error.status, result.error.message);
    return sendSuccessResponse(res, 200, "Pending deposits", { pending: result.pending });
  } catch (error) {
    logger.error("Error fetching pending deposits:", error);
    return sendErrorResponse(res, 500, "Failed to retrieve pending deposits");
  }
}
