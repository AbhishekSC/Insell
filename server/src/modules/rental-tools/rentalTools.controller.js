import * as service from "./rentalTools.service.js";
import { sendSuccessResponse, sendErrorResponse } from "../../utils/responseHandler.js";
import { logger } from "../../utils/logger.js";

// ── Rent Payments ──────────────────────────────────────────────────────

export async function logRentPayment(req, res) {
  try {
    const result = await service.logRentPayment(req.user._id, req.body);
    if (result.error) return sendErrorResponse(res, result.error.status, result.error.message);
    return sendSuccessResponse(res, 201, "Rent payment logged", { payment: result.payment });
  } catch (error) {
    if (error.code === 11000) {
      return sendErrorResponse(res, 409, "A payment for this month and landlord already exists");
    }
    logger.error("Error logging rent payment:", error);
    return sendErrorResponse(res, 500, "Failed to log rent payment");
  }
}

export async function getRentHistory(req, res) {
  try {
    const page = Math.max(1, Number(req.query.page) || 1);
    const limit = Math.min(50, Math.max(1, Number(req.query.limit) || 20));
    const year = req.query.year ? Number(req.query.year) : undefined;
    const { payments, total } = await service.getRentHistory(req.user._id, { page, limit, year });
    return sendSuccessResponse(res, 200, "Rent history retrieved", {
      payments,
      pagination: { page, limit, total, totalPages: Math.max(1, Math.ceil(total / limit)) },
    });
  } catch (error) {
    logger.error("Error fetching rent history:", error);
    return sendErrorResponse(res, 500, "Failed to retrieve rent history");
  }
}

export async function generateReceipt(req, res) {
  try {
    const tenantName = req.user.fullName || "Tenant";
    const result = await service.generateReceipt(req.user._id, req.params.paymentId, tenantName);
    if (result.error) return sendErrorResponse(res, result.error.status, result.error.message);

    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `attachment; filename="${result.filename}"`);
    return res.send(result.pdfBuffer);
  } catch (error) {
    logger.error("Error generating rent receipt:", error);
    return sendErrorResponse(res, 500, "Failed to generate receipt");
  }
}

export async function generateStandaloneReceipt(req, res) {
  try {
    const result = await service.generateStandaloneReceipt(req.body);
    if (result.error) return sendErrorResponse(res, result.error.status, result.error.message);

    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `attachment; filename="${result.filename}"`);
    return res.send(result.pdfBuffer);
  } catch (error) {
    logger.error("Error generating standalone receipt:", error);
    return sendErrorResponse(res, 500, "Failed to generate receipt");
  }
}

// ── Rental Agreements ──────────────────────────────────────────────────

export async function createAgreement(req, res) {
  try {
    const result = await service.createAgreement(req.user._id, req.body);
    if (result.error) return sendErrorResponse(res, result.error.status, result.error.message);

    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `attachment; filename="${result.filename}"`);
    return res.send(result.pdfBuffer);
  } catch (error) {
    logger.error("Error creating rental agreement:", error);
    return sendErrorResponse(res, 500, "Failed to create agreement");
  }
}

export async function getAgreements(req, res) {
  try {
    const page = Math.max(1, Number(req.query.page) || 1);
    const limit = Math.min(20, Math.max(1, Number(req.query.limit) || 10));
    const { agreements, total } = await service.getAgreements(req.user._id, { page, limit });
    return sendSuccessResponse(res, 200, "Agreements retrieved", {
      agreements,
      pagination: { page, limit, total, totalPages: Math.max(1, Math.ceil(total / limit)) },
    });
  } catch (error) {
    logger.error("Error fetching agreements:", error);
    return sendErrorResponse(res, 500, "Failed to retrieve agreements");
  }
}

export async function getAgreementById(req, res) {
  try {
    const result = await service.getAgreementById(req.user._id, req.params.agreementId);
    if (result.error) return sendErrorResponse(res, result.error.status, result.error.message);
    return sendSuccessResponse(res, 200, "Agreement retrieved", { agreement: result.agreement });
  } catch (error) {
    logger.error("Error fetching agreement:", error);
    return sendErrorResponse(res, 500, "Failed to retrieve agreement");
  }
}

export async function downloadAgreementPdf(req, res) {
  try {
    const result = await service.regenerateAgreementPdf(req.user._id, req.params.agreementId);
    if (result.error) return sendErrorResponse(res, result.error.status, result.error.message);

    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `attachment; filename="${result.filename}"`);
    return res.send(result.pdfBuffer);
  } catch (error) {
    logger.error("Error downloading agreement PDF:", error);
    return sendErrorResponse(res, 500, "Failed to download agreement");
  }
}

// ── Condition Reports ──────────────────────────────────────────────────

export async function createConditionReport(req, res) {
  try {
    const tenantName = req.user.fullName || "Tenant";
    const result = await service.createConditionReport(req.user._id, { ...req.body, tenantName });
    if (result.error) return sendErrorResponse(res, result.error.status, result.error.message);

    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `attachment; filename="${result.filename}"`);
    return res.send(result.pdfBuffer);
  } catch (error) {
    logger.error("Error creating condition report:", error);
    return sendErrorResponse(res, 500, "Failed to create condition report");
  }
}

export async function getConditionReports(req, res) {
  try {
    const page = Math.max(1, Number(req.query.page) || 1);
    const limit = Math.min(20, Math.max(1, Number(req.query.limit) || 10));
    const { reports, total } = await service.getConditionReports(req.user._id, { page, limit });
    return sendSuccessResponse(res, 200, "Condition reports retrieved", {
      reports,
      pagination: { page, limit, total, totalPages: Math.max(1, Math.ceil(total / limit)) },
    });
  } catch (error) {
    logger.error("Error fetching condition reports:", error);
    return sendErrorResponse(res, 500, "Failed to retrieve condition reports");
  }
}

export async function getConditionReportById(req, res) {
  try {
    const result = await service.getConditionReportById(req.user._id, req.params.reportId);
    if (result.error) return sendErrorResponse(res, result.error.status, result.error.message);
    return sendSuccessResponse(res, 200, "Condition report retrieved", { report: result.report });
  } catch (error) {
    logger.error("Error fetching condition report:", error);
    return sendErrorResponse(res, 500, "Failed to retrieve condition report");
  }
}

export async function downloadConditionReportPdf(req, res) {
  try {
    const tenantName = req.user.fullName || "Tenant";
    const result = await service.regenerateConditionReportPdf(req.user._id, req.params.reportId, tenantName);
    if (result.error) return sendErrorResponse(res, result.error.status, result.error.message);

    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `attachment; filename="${result.filename}"`);
    return res.send(result.pdfBuffer);
  } catch (error) {
    logger.error("Error downloading condition report:", error);
    return sendErrorResponse(res, 500, "Failed to download condition report");
  }
}
