import * as repo from "./pgResidency.repository.js";
import PropertyPost from "../../models/PropertyPost.model.js";
import { logger } from "../../utils/logger.js";

// ── Booking Request Flow ──────────────────────────────────────────────

export async function requestBooking(tenantId, data) {
  const pg = await repo.findPgPost(data.pgId);
  if (!pg) return { error: { status: 404, message: "PG/Hostel not found" } };
  if (pg.postType !== "PG_HOSTEL") {
    return { error: { status: 400, message: "Booking requests are only for PG/Hostel listings" } };
  }
  if (String(pg.author) === String(tenantId)) {
    return { error: { status: 400, message: "You cannot book your own PG" } };
  }

  const existingActive = await repo.findActiveByTenantAndPg(tenantId, data.pgId);
  if (existingActive) {
    return { error: { status: 409, message: "You already have an active residency at this PG" } };
  }

  const existingPending = await repo.findPendingByTenantAndPg(tenantId, data.pgId);
  if (existingPending) {
    return { error: { status: 409, message: "You already have a pending booking request for this PG" } };
  }

  const residency = await repo.create({
    tenant: tenantId,
    pg: data.pgId,
    roomType: data.roomType,
    preferredMoveInDate: data.preferredMoveInDate,
    monthlyRent: data.monthlyRent,
    depositAmount: data.depositAmount,
    tenantMessage: data.message || "",
    status: "pending",
  });

  logger.info(`[PG BOOKING] User ${tenantId} requested booking at PG ${data.pgId}`);
  return { residency };
}

export async function approveBooking(ownerId, residencyId, data) {
  const residency = await repo.findById(residencyId);
  if (!residency) return { error: { status: 404, message: "Booking request not found" } };

  const pg = await repo.findPgPost(residency.pg._id || residency.pg);
  if (!pg || String(pg.author) !== String(ownerId)) {
    return { error: { status: 403, message: "Only the PG owner can approve bookings" } };
  }

  if (residency.status !== "pending") {
    return { error: { status: 400, message: `Cannot approve a request that is already ${residency.status}` } };
  }

  const moveInDate = data.moveInDate || residency.preferredMoveInDate || new Date();

  const updated = await repo.updateById(residencyId, {
    status: "active",
    moveInDate,
    approvedAt: new Date(),
    ownerNote: data.note || "",
    assignedRoom: data.assignedRoom || "",
    assignedBed: data.assignedBed || "",
    depositPaid: true,
  });

  try {
    const pgId = residency.pg._id || residency.pg;
    const count = await repo.getActiveResidentCount(pgId);
    const pgDoc = await PropertyPost.findById(pgId);
    const totalBeds = pgDoc?.postMeta?.pgHostel?.totalBeds || 0;
    const newAvailable = Math.max(0, totalBeds - count);
    await PropertyPost.findByIdAndUpdate(pgId, {
      "postMeta.pgHostel.residentCount": count,
      "postMeta.pgHostel.availableBeds": newAvailable,
    });
  } catch (err) {
    logger.warn(`[PG BOOKING] Failed to update resident/bed count: ${err.message}`);
  }

  logger.info(`[PG BOOKING] Owner ${ownerId} approved booking ${residencyId}`);
  return { residency: updated };
}

export async function rejectBooking(ownerId, residencyId, data) {
  const residency = await repo.findById(residencyId);
  if (!residency) return { error: { status: 404, message: "Booking request not found" } };

  const pg = await repo.findPgPost(residency.pg._id || residency.pg);
  if (!pg || String(pg.author) !== String(ownerId)) {
    return { error: { status: 403, message: "Only the PG owner can reject bookings" } };
  }

  if (residency.status !== "pending") {
    return { error: { status: 400, message: `Cannot reject a request that is already ${residency.status}` } };
  }

  const updated = await repo.updateById(residencyId, {
    status: "rejected",
    rejectedAt: new Date(),
    ownerNote: data.note || "",
  });

  logger.info(`[PG BOOKING] Owner ${ownerId} rejected booking ${residencyId}`);
  return { residency: updated };
}

export async function getBookingRequests(ownerId, pgId) {
  if (pgId) {
    const pg = await repo.findPgPost(pgId);
    if (!pg) return { error: { status: 404, message: "PG not found" } };
    if (String(pg.author) !== String(ownerId)) {
      return { error: { status: 403, message: "Only the PG owner can view booking requests" } };
    }
    const requests = await repo.findPendingByPg(pgId);
    return { requests };
  }
  const requests = await repo.findPendingByOwner(ownerId);
  return { requests };
}

export async function getBookingStatus(tenantId, pgId) {
  const booking = await repo.getBookingStatusForTenant(tenantId, pgId);
  return { booking };
}

export async function cancelBooking(tenantId, residencyId) {
  const residency = await repo.findById(residencyId);
  if (!residency) return { error: { status: 404, message: "Booking not found" } };
  if (String(residency.tenant._id || residency.tenant) !== String(tenantId)) {
    return { error: { status: 403, message: "Only the tenant can cancel their booking" } };
  }
  if (residency.status !== "pending") {
    return { error: { status: 400, message: `Cannot cancel a booking that is ${residency.status}` } };
  }

  const updated = await repo.updateById(residencyId, {
    status: "rejected",
    rejectedAt: new Date(),
    ownerNote: "Cancelled by tenant",
  });

  logger.info(`[PG BOOKING] Tenant ${tenantId} cancelled booking ${residencyId}`);
  return { residency: updated };
}

export async function getAllBookingRequests(ownerId, pgId) {
  if (pgId) {
    const pg = await repo.findPgPost(pgId);
    if (!pg) return { error: { status: 404, message: "PG not found" } };
    if (String(pg.author) !== String(ownerId)) {
      return { error: { status: 403, message: "Only the PG owner can view booking requests" } };
    }
    const requests = await repo.findAllRequestsByPg(pgId);
    return { requests };
  }
  const requests = await repo.findAllRequestsByOwner(ownerId);
  return { requests };
}

export async function getMyBookings(tenantId) {
  const bookings = await repo.findTenantBookings(tenantId);
  return { bookings };
}

// ── Existing Move-in / Move-out Flow ──────────────────────────────────

export async function registerMoveIn(tenantId, data) {
  const pg = await repo.findPgPost(data.pgId);
  if (!pg) return { error: { status: 404, message: "PG/Hostel not found" } };
  if (pg.postType !== "PG_HOSTEL") {
    return { error: { status: 400, message: "Residency can only be registered for PG/Hostel listings" } };
  }

  const existing = await repo.findActiveByTenantAndPg(tenantId, data.pgId);
  if (existing) {
    return { error: { status: 409, message: "You already have an active residency at this PG" } };
  }

  const residency = await repo.create({
    tenant: tenantId,
    pg: data.pgId,
    roomType: data.roomType || "",
    moveInDate: data.moveInDate || new Date(),
    monthlyRent: data.monthlyRent,
    depositAmount: data.depositAmount,
    status: "active",
    depositPaid: true,
    moveInConditionReport: data.conditionReportId || undefined,
  });

  try {
    const count = await repo.getActiveResidentCount(data.pgId);
    await PropertyPost.findByIdAndUpdate(data.pgId, { "postMeta.pgHostel.residentCount": count });
  } catch (err) {
    logger.warn(`[PG RESIDENCY] Failed to update resident count: ${err.message}`);
  }

  logger.info(`[PG RESIDENCY] User ${tenantId} registered move-in at PG ${data.pgId}`);
  return { residency };
}

export async function registerMoveOut(tenantId, residencyId, data) {
  const residency = await repo.findById(residencyId);
  if (!residency) return { error: { status: 404, message: "Residency not found" } };
  if (String(residency.tenant._id || residency.tenant) !== String(tenantId)) {
    return { error: { status: 403, message: "Only the tenant can register move-out" } };
  }
  if (residency.status === "moved_out") {
    return { error: { status: 400, message: "Already moved out" } };
  }

  const depositDueDate = new Date();
  depositDueDate.setDate(depositDueDate.getDate() + 30);

  const updated = await repo.updateById(residencyId, {
    status: "moved_out",
    moveOutDate: data.moveOutDate || new Date(),
    moveOutConditionReport: data.conditionReportId || undefined,
    depositDueDate,
  });

  try {
    const pgId = residency.pg._id || residency.pg;
    const count = await repo.getActiveResidentCount(pgId);
    const pgDoc = await PropertyPost.findById(pgId);
    const totalBeds = pgDoc?.postMeta?.pgHostel?.totalBeds || 0;
    const newAvailable = Math.max(0, totalBeds - count);
    await PropertyPost.findByIdAndUpdate(pgId, {
      "postMeta.pgHostel.residentCount": count,
      "postMeta.pgHostel.availableBeds": newAvailable,
    });
  } catch (err) {
    logger.warn(`[PG RESIDENCY] Failed to update resident/bed count: ${err.message}`);
  }

  return { residency: updated };
}

export async function recordDepositRefund(userId, residencyId, data) {
  const residency = await repo.findById(residencyId);
  if (!residency) return { error: { status: 404, message: "Residency not found" } };

  const pg = await repo.findPgPost(residency.pg._id || residency.pg);
  const isOwner = pg && String(pg.author) === String(userId);
  const isTenant = String(residency.tenant._id || residency.tenant) === String(userId);
  if (!isOwner && !isTenant) {
    return { error: { status: 403, message: "Access denied" } };
  }

  const updated = await repo.updateById(residencyId, {
    depositRefunded: true,
    depositRefundAmount: data.refundAmount,
    depositRefundDate: new Date(),
    depositRefundNotes: data.notes || "",
  });

  return { residency: updated };
}

export async function generateFormalNotice(tenantId, residencyId) {
  const residency = await repo.findById(residencyId);
  if (!residency) return { error: { status: 404, message: "Residency not found" } };
  if (String(residency.tenant._id || residency.tenant) !== String(tenantId)) {
    return { error: { status: 403, message: "Only the tenant can generate a formal notice" } };
  }
  if (residency.depositRefunded) {
    return { error: { status: 400, message: "Deposit has already been refunded" } };
  }

  await repo.updateById(residencyId, { formalNoticeGenerated: true, formalNoticeDate: new Date() });

  const notice = {
    to: residency.pg?.title || "PG Owner",
    from: residency.tenant?.fullName || "Tenant",
    date: new Date().toLocaleDateString("en-IN"),
    pgName: residency.pg?.title || "",
    pgAddress: `${residency.pg?.locality || ""}, ${residency.pg?.city || ""}`,
    depositAmount: residency.depositAmount,
    moveInDate: residency.moveInDate ? new Date(residency.moveInDate).toLocaleDateString("en-IN") : "",
    moveOutDate: residency.moveOutDate ? new Date(residency.moveOutDate).toLocaleDateString("en-IN") : "",
    depositDueDate: residency.depositDueDate ? new Date(residency.depositDueDate).toLocaleDateString("en-IN") : "",
    message: `This is a formal notice regarding the non-refund of security deposit of ₹${residency.depositAmount?.toLocaleString("en-IN")}. As per the terms of my tenancy, the deposit was to be refunded within 30 days of vacating the premises. I vacated on ${residency.moveOutDate ? new Date(residency.moveOutDate).toLocaleDateString("en-IN") : "N/A"} and the refund is now overdue. I request immediate refund of the deposit amount. If not resolved within 15 days of this notice, I reserve the right to pursue legal remedies under the applicable Rent Control Act and Consumer Protection Act.`,
  };

  return { notice, residency };
}

export async function getMyResidencies(tenantId, opts) {
  return repo.findByTenant(tenantId, opts);
}

export async function getResidencyById(userId, residencyId) {
  const residency = await repo.findById(residencyId);
  if (!residency) return { error: { status: 404, message: "Residency not found" } };

  const isTenant = String(residency.tenant._id || residency.tenant) === String(userId);
  const pg = await repo.findPgPost(residency.pg._id || residency.pg);
  const isOwner = pg && String(pg.author) === String(userId);
  if (!isTenant && !isOwner) {
    return { error: { status: 403, message: "Access denied" } };
  }

  return { residency };
}

export async function getPgResidents(ownerId, pgId, { status } = {}) {
  const pg = await repo.findPgPost(pgId);
  if (!pg) return { error: { status: 404, message: "PG not found" } };
  if (String(pg.author) !== String(ownerId)) {
    return { error: { status: 403, message: "Only the PG owner can view residents" } };
  }

  const residents = await repo.findByPg(pgId, { status });
  return { residents };
}

export async function getPendingDeposits(ownerId, pgId) {
  const pg = await repo.findPgPost(pgId);
  if (!pg) return { error: { status: 404, message: "PG not found" } };
  if (String(pg.author) !== String(ownerId)) {
    return { error: { status: 403, message: "Only the PG owner can view pending deposits" } };
  }

  const pending = await repo.getPendingDeposits(pgId);
  return { pending };
}
