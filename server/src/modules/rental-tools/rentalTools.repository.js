import RentPayment from "../../models/RentPayment.model.js";
import RentalAgreement from "../../models/RentalAgreement.model.js";
import ConditionReport from "../../models/ConditionReport.model.js";

// ── Rent Payments ──────────────────────────────────────────────────────

export async function createRentPayment(data) {
  return RentPayment.create(data);
}

export async function findRentPayments(tenantId, { page = 1, limit = 20, year } = {}) {
  const filter = { tenant: tenantId };
  if (year) filter.year = year;

  const skip = (page - 1) * limit;
  const [payments, total] = await Promise.all([
    RentPayment.find(filter).sort({ year: -1, month: -1 }).skip(skip).limit(limit).lean(),
    RentPayment.countDocuments(filter),
  ]);
  return { payments, total };
}

export async function findRentPaymentById(paymentId) {
  return RentPayment.findById(paymentId).lean();
}

export async function updateRentPayment(paymentId, updates) {
  return RentPayment.findByIdAndUpdate(paymentId, updates, { new: true }).lean();
}

export async function findPaymentsForReceipt(tenantId, { year, months }) {
  const filter = { tenant: tenantId, year };
  if (months && months.length) filter.month = { $in: months };
  return RentPayment.find(filter).sort({ month: 1 }).lean();
}

// ── Rental Agreements ──────────────────────────────────────────────────

export async function createAgreement(data) {
  return RentalAgreement.create(data);
}

export async function findAgreements(userId, { page = 1, limit = 10 } = {}) {
  const skip = (page - 1) * limit;
  const [agreements, total] = await Promise.all([
    RentalAgreement.find({ createdBy: userId }).sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
    RentalAgreement.countDocuments({ createdBy: userId }),
  ]);
  return { agreements, total };
}

export async function findAgreementById(agreementId) {
  return RentalAgreement.findById(agreementId).lean();
}

// ── Condition Reports ──────────────────────────────────────────────────

export async function createConditionReport(data) {
  return ConditionReport.create(data);
}

export async function findConditionReports(tenantId, { page = 1, limit = 10 } = {}) {
  const skip = (page - 1) * limit;
  const [reports, total] = await Promise.all([
    ConditionReport.find({ tenant: tenantId }).sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
    ConditionReport.countDocuments({ tenant: tenantId }),
  ]);
  return { reports, total };
}

export async function findConditionReportById(reportId) {
  return ConditionReport.findById(reportId).lean();
}
