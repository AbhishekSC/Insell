import { sendErrorResponse, sendSuccessResponse } from "../../utils/responseHandler.js";
import { logger } from "../../utils/logger.js";
import { sendWeeklyDigest } from "./weeklyDigest.service.js";

// POST /digest/cron/weekly   (header: x-cron-secret)
// Same shared-secret pattern as deals' nudge-stalled cron.
export async function runWeeklyDigest(req, res) {
  try {
    const secret = process.env.CRON_SECRET;
    if (!secret || req.get("x-cron-secret") !== secret) {
      return sendErrorResponse(res, 401, "Unauthorized");
    }
    const result = await sendWeeklyDigest({});
    return sendSuccessResponse(res, 200, "Weekly digest sent", result);
  } catch (error) {
    logger.error("Error in runWeeklyDigest:", error);
    return sendErrorResponse(res, 500, "Failed to send weekly digest");
  }
}
