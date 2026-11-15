import * as repo from "./rentalTools.repository.js";
import { generateRentReceiptPdf } from "./pdf/receiptPdf.js";
import { generateAgreementPdf } from "./pdf/agreementPdf.js";
import { generateConditionReportPdf } from "./pdf/conditionReportPdf.js";
import { logger } from "../../utils/logger.js";

// ── Rent Payments ──────────────────────────────────────────────────────

export async function logRentPayment(tenantId, data) {
  const payment = await repo.createRentPayment({
    tenant: tenantId,
    landlordName: data.landlordName,
    landlordPAN: data.landlordPAN || "",
    propertyAddress: data.propertyAddress,
    amount: data.amount,
    month: data.month,
    year: data.year,
    paymentDate: data.paymentDate || new Date(),
    paymentMode: data.paymentMode || "upi",
    notes: data.notes || "",
  });

  logger.info(`[RENTAL TOOLS] Rent payment logged: ₹${data.amount} for ${data.month}/${data.year} by user ${tenantId}`);
  return { payment };
}

export async function getRentHistory(tenantId, opts) {
  return repo.findRentPayments(tenantId, opts);
}

export async function generateReceipt(tenantId, paymentId, tenantName) {
  const payment = await repo.findRentPaymentById(paymentId);
  if (!payment) return { error: { status: 404, message: "Payment not found" } };
  if (String(payment.tenant) !== String(tenantId)) {
    return { error: { status: 403, message: "You can only generate receipts for your own payments" } };
  }

  const pdfBuffer = await generateRentReceiptPdf({ ...payment, tenantName });
  await repo.updateRentPayment(paymentId, { receiptGenerated: true });

  return { pdfBuffer, filename: `rent-receipt-${payment.month}-${payment.year}.pdf` };
}

export async function generateBulkReceipts(tenantId, data) {
  const payments = await repo.findPaymentsForReceipt(tenantId, {
    year: data.year,
    months: data.months,
  });
  if (!payments.length) {
    return { error: { status: 404, message: "No payments found for the specified period" } };
  }

  const receipts = [];
  for (const payment of payments) {
    const pdfBuffer = await generateRentReceiptPdf({ ...payment, tenantName: data.tenantName });
    await repo.updateRentPayment(payment._id, { receiptGenerated: true });
    receipts.push({ month: payment.month, year: payment.year, pdfBuffer });
  }

  return { receipts };
}

// ── Standalone Receipt (no payment log needed) ─────────────────────────

export async function generateStandaloneReceipt(data) {
  const pdfBuffer = await generateRentReceiptPdf({
    _id: null,
    tenantName: data.tenantName,
    landlordName: data.landlordName,
    landlordPAN: data.landlordPAN || "",
    propertyAddress: data.propertyAddress,
    amount: data.amount,
    month: data.month,
    year: data.year,
    paymentDate: data.paymentDate || new Date(),
    paymentMode: data.paymentMode || "upi",
  });

  return { pdfBuffer, filename: `rent-receipt-${data.month}-${data.year}.pdf` };
}

// ── Rental Agreements ──────────────────────────────────────────────────

export async function createAgreement(userId, data) {
  const agreement = await repo.createAgreement({ ...data, createdBy: userId });

  const pdfBuffer = await generateAgreementPdf(agreement.toObject ? agreement.toObject() : agreement);

  logger.info(`[RENTAL TOOLS] Agreement created by user ${userId} for state ${data.state}`);
  return { agreement, pdfBuffer, filename: `rental-agreement-${data.state}.pdf` };
}

export async function getAgreements(userId, opts) {
  return repo.findAgreements(userId, opts);
}

export async function getAgreementById(userId, agreementId) {
  const agreement = await repo.findAgreementById(agreementId);
  if (!agreement) return { error: { status: 404, message: "Agreement not found" } };
  if (String(agreement.createdBy) !== String(userId)) {
    return { error: { status: 403, message: "You can only view your own agreements" } };
  }
  return { agreement };
}

export async function regenerateAgreementPdf(userId, agreementId) {
  const agreement = await repo.findAgreementById(agreementId);
  if (!agreement) return { error: { status: 404, message: "Agreement not found" } };
  if (String(agreement.createdBy) !== String(userId)) {
    return { error: { status: 403, message: "You can only access your own agreements" } };
  }

  const pdfBuffer = await generateAgreementPdf(agreement);
  return { pdfBuffer, filename: `rental-agreement-${agreement.state}.pdf` };
}

// ── Condition Reports ──────────────────────────────────────────────────

export async function createConditionReport(tenantId, data) {
  const report = await repo.createConditionReport({
    tenant: tenantId,
    landlordName: data.landlordName,
    landlordEmail: data.landlordEmail || "",
    landlordPhone: data.landlordPhone || "",
    propertyAddress: data.propertyAddress,
    moveInDate: data.moveInDate || new Date(),
    rooms: data.rooms || [],
    overallNotes: data.overallNotes || "",
  });

  const pdfBuffer = await generateConditionReportPdf({
    ...report.toObject ? report.toObject() : report,
    tenantName: data.tenantName,
  });

  logger.info(`[RENTAL TOOLS] Condition report created by user ${tenantId}`);
  return { report, pdfBuffer, filename: `condition-report-${Date.now()}.pdf` };
}

export async function getConditionReports(tenantId, opts) {
  return repo.findConditionReports(tenantId, opts);
}

export async function getConditionReportById(tenantId, reportId) {
  const report = await repo.findConditionReportById(reportId);
  if (!report) return { error: { status: 404, message: "Condition report not found" } };
  if (String(report.tenant) !== String(tenantId)) {
    return { error: { status: 403, message: "You can only view your own reports" } };
  }
  return { report };
}

export async function regenerateConditionReportPdf(tenantId, reportId, tenantName) {
  const report = await repo.findConditionReportById(reportId);
  if (!report) return { error: { status: 404, message: "Condition report not found" } };
  if (String(report.tenant) !== String(tenantId)) {
    return { error: { status: 403, message: "You can only access your own reports" } };
  }

  const pdfBuffer = await generateConditionReportPdf({ ...report, tenantName });
  return { pdfBuffer, filename: `condition-report-${reportId}.pdf` };
}
