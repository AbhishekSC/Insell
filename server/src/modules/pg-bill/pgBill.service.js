import * as repo from "./pgBill.repository.js";
import PropertyPost from "../../models/PropertyPost.model.js";
import { logger } from "../../utils/logger.js";

export async function createBill(ownerId, data) {
  const pg = await PropertyPost.findById(data.pgId).select("postType author").lean();
  if (!pg) return { error: { status: 404, message: "PG/Hostel not found" } };
  if (pg.postType !== "PG_HOSTEL") {
    return { error: { status: 400, message: "Bills can only be created for PG/Hostel listings" } };
  }
  if (String(pg.author) !== String(ownerId)) {
    return { error: { status: 403, message: "Only the PG owner can create bills" } };
  }

  const bill = await repo.create({
    pg: data.pgId,
    tenant: data.tenantId,
    month: data.month,
    year: data.year,
    items: data.items,
    electricityUnits: data.electricityUnits || 0,
    electricityPerUnit: data.electricityPerUnit || 0,
    splitMethod: data.splitMethod || "equal",
    notes: data.notes || "",
  });

  logger.info(`[PG BILL] Owner ${ownerId} created bill for tenant ${data.tenantId} at PG ${data.pgId}: ₹${bill.totalAmount}`);
  return { bill };
}

export async function getMyBills(tenantId, opts) {
  return repo.findByTenant(tenantId, opts);
}

export async function getBillById(userId, billId) {
  const bill = await repo.findById(billId);
  if (!bill) return { error: { status: 404, message: "Bill not found" } };

  const pg = await PropertyPost.findById(bill.pg).select("author").lean();
  const isOwner = pg && String(pg.author) === String(userId);
  const isTenant = String(bill.tenant._id || bill.tenant) === String(userId);
  if (!isOwner && !isTenant) {
    return { error: { status: 403, message: "Access denied" } };
  }

  return { bill };
}

export async function markBillPaid(userId, billId) {
  const bill = await repo.findById(billId);
  if (!bill) return { error: { status: 404, message: "Bill not found" } };

  const isTenant = String(bill.tenant._id || bill.tenant) === String(userId);
  const pg = await PropertyPost.findById(bill.pg).select("author").lean();
  const isOwner = pg && String(pg.author) === String(userId);
  if (!isTenant && !isOwner) {
    return { error: { status: 403, message: "Only the tenant or PG owner can mark a bill as paid" } };
  }

  const updated = await repo.markPaid(billId);
  return { bill: updated };
}

export async function getMonthlyComparison(tenantId, pgId, month, year) {
  const { current, previous } = await repo.getMonthlyComparison(tenantId, pgId, month, year);
  const diff = current && previous ? current.totalAmount - previous.totalAmount : null;
  return { current, previous, diff };
}

export async function getPgBillSummary(ownerId, pgId, month, year) {
  const pg = await PropertyPost.findById(pgId).select("postType author").lean();
  if (!pg) return { error: { status: 404, message: "PG not found" } };
  if (String(pg.author) !== String(ownerId)) {
    return { error: { status: 403, message: "Only the PG owner can view bill summaries" } };
  }

  const summary = await repo.getBillSummaryForPg(pgId, month, year);
  const bills = await repo.findByPg(pgId, month, year);
  return { summary, bills };
}
