import * as service from "./pgBill.service.js";
import { sendSuccessResponse, sendErrorResponse } from "../../utils/responseHandler.js";
import { logger } from "../../utils/logger.js";

export async function createBill(req, res) {
  try {
    const result = await service.createBill(req.user._id, req.body);
    if (result.error) return sendErrorResponse(res, result.error.status, result.error.message);
    return sendSuccessResponse(res, 201, "Bill created", { bill: result.bill });
  } catch (error) {
    logger.error("Error creating PG bill:", error);
    return sendErrorResponse(res, 500, "Failed to create bill");
  }
}

export async function getMyBills(req, res) {
  try {
    const page = Math.max(1, Number(req.query.page) || 1);
    const limit = Math.min(50, Math.max(1, Number(req.query.limit) || 12));
    const year = req.query.year ? Number(req.query.year) : undefined;
    const { bills, total } = await service.getMyBills(req.user._id, { page, limit, year });
    return sendSuccessResponse(res, 200, "Your bills", {
      bills,
      pagination: { page, limit, total, totalPages: Math.max(1, Math.ceil(total / limit)) },
    });
  } catch (error) {
    logger.error("Error fetching bills:", error);
    return sendErrorResponse(res, 500, "Failed to retrieve bills");
  }
}

export async function getBillById(req, res) {
  try {
    const result = await service.getBillById(req.user._id, req.params.billId);
    if (result.error) return sendErrorResponse(res, result.error.status, result.error.message);
    return sendSuccessResponse(res, 200, "Bill retrieved", { bill: result.bill });
  } catch (error) {
    logger.error("Error fetching bill:", error);
    return sendErrorResponse(res, 500, "Failed to retrieve bill");
  }
}

export async function markBillPaid(req, res) {
  try {
    const result = await service.markBillPaid(req.user._id, req.params.billId);
    if (result.error) return sendErrorResponse(res, result.error.status, result.error.message);
    return sendSuccessResponse(res, 200, "Bill marked as paid", { bill: result.bill });
  } catch (error) {
    logger.error("Error marking bill paid:", error);
    return sendErrorResponse(res, 500, "Failed to mark bill as paid");
  }
}

export async function getMonthlyComparison(req, res) {
  try {
    const month = Number(req.query.month) || new Date().getMonth() + 1;
    const year = Number(req.query.year) || new Date().getFullYear();
    const result = await service.getMonthlyComparison(req.user._id, req.params.pgId, month, year);
    return sendSuccessResponse(res, 200, "Monthly comparison", result);
  } catch (error) {
    logger.error("Error fetching monthly comparison:", error);
    return sendErrorResponse(res, 500, "Failed to retrieve comparison");
  }
}

export async function getPgBillSummary(req, res) {
  try {
    const month = Number(req.query.month) || new Date().getMonth() + 1;
    const year = Number(req.query.year) || new Date().getFullYear();
    const result = await service.getPgBillSummary(req.user._id, req.params.pgId, month, year);
    if (result.error) return sendErrorResponse(res, result.error.status, result.error.message);
    return sendSuccessResponse(res, 200, "PG bill summary", result);
  } catch (error) {
    logger.error("Error fetching PG bill summary:", error);
    return sendErrorResponse(res, 500, "Failed to retrieve bill summary");
  }
}
