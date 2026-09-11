import { asyncHandler } from "../../core/asyncHandler.js";
import { sendSuccessResponse, sendErrorResponse } from "../../utils/responseHandler.js";
import { logger } from "../../utils/logger.js";
import { scheduleCall, listUpcoming, cancelCall, markCallStarted, sendDueReminders } from "./communityCall.service.js";

// POST /community-calls/:circleId
export const schedule = asyncHandler(async (req, res) => {
  const call = await scheduleCall(req.user._id, req.params.circleId, {
    title: req.body?.title,
    scheduledAt: req.body?.scheduledAt,
  });
  return sendSuccessResponse(res, 201, "Call scheduled", { call });
});

// GET /community-calls/:circleId
export const list = asyncHandler(async (req, res) => {
  const calls = await listUpcoming(req.user._id, req.params.circleId);
  return sendSuccessResponse(res, 200, "Upcoming calls", { calls });
});

// POST /community-calls/:circleId/:callId/cancel
export const cancel = asyncHandler(async (req, res) => {
  const call = await cancelCall(req.user._id, req.params.circleId, req.params.callId);
  return sendSuccessResponse(res, 200, "Call cancelled", { call });
});

// POST /community-calls/:circleId/:callId/started
// Best-effort — the join flow itself is the existing instant-call room;
// this just updates the scheduled-call record so it stops showing as
// "upcoming". Never blocks joining the call if it fails.
export const markStarted = asyncHandler(async (req, res) => {
  const call = await markCallStarted(req.user._id, req.params.circleId, req.params.callId);
  return sendSuccessResponse(res, 200, "Marked started", { call });
});

// POST /community-calls/cron/reminders   (header: x-cron-secret)
// Same shared-secret pattern as the digest/stalled-deals crons. Runs every
// ~5 minutes; sends the "starts in 10 minutes" reminder for anything due.
export async function runCallReminders(req, res) {
  try {
    const secret = process.env.CRON_SECRET;
    if (!secret || req.get("x-cron-secret") !== secret) {
      return sendErrorResponse(res, 401, "Unauthorized");
    }
    const result = await sendDueReminders();
    return sendSuccessResponse(res, 200, "Call reminders swept", result);
  } catch (error) {
    logger.error("Error in runCallReminders:", error);
    return sendErrorResponse(res, 500, "Failed to sweep call reminders");
  }
}
