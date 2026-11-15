import * as service from "./pgDashboard.service.js";
import { sendSuccessResponse, sendErrorResponse } from "../../utils/responseHandler.js";
import { logger } from "../../utils/logger.js";

export async function getOwnerDashboard(req, res) {
  try {
    const pgId = req.query.pgId || undefined;
    const month = req.query.month ? Number(req.query.month) : undefined;
    const year = req.query.year ? Number(req.query.year) : undefined;
    const result = await service.getOwnerDashboard(req.user._id, { pgId, month, year });
    if (result.error) return sendErrorResponse(res, result.error.status, result.error.message);
    return sendSuccessResponse(res, 200, "Owner dashboard", result);
  } catch (error) {
    logger.error("Error fetching owner dashboard:", error);
    return sendErrorResponse(res, 500, "Failed to load dashboard");
  }
}

export async function getPgOverview(req, res) {
  try {
    const result = await service.getPgOverview(req.user._id);
    if (result.error) return sendErrorResponse(res, result.error.status, result.error.message);
    return sendSuccessResponse(res, 200, "PG overview", result);
  } catch (error) {
    logger.error("Error fetching PG overview:", error);
    return sendErrorResponse(res, 500, "Failed to load PG overview");
  }
}
