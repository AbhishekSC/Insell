import { asyncHandler } from "../../core/asyncHandler.js";
import { sendSuccessResponse } from "../../utils/responseHandler.js";
import {
  getMyAlert,
  setAlert,
  removeAlert,
  listMyAlerts,
} from "./priceAlert.app.service.js";

// GET /api/price-alerts/mine
export const getMine = asyncHandler(async (req, res) => {
  const alerts = await listMyAlerts(req.user._id);
  return sendSuccessResponse(res, 200, "Your price alerts", { alerts });
});

// GET /api/price-alerts/post/:postId
export const getForPost = asyncHandler(async (req, res) => {
  const result = await getMyAlert(req.user._id, req.params.postId);
  return sendSuccessResponse(res, 200, "Price alert", result);
});

// PUT /api/price-alerts/post/:postId   body: { targetPrice }
export const setForPost = asyncHandler(async (req, res) => {
  const result = await setAlert(req.user._id, req.params.postId, req.body?.targetPrice);
  return sendSuccessResponse(res, 200, "Price alert set", result);
});

// DELETE /api/price-alerts/post/:postId
export const removeForPost = asyncHandler(async (req, res) => {
  const result = await removeAlert(req.user._id, req.params.postId);
  return sendSuccessResponse(res, 200, "Price alert removed", result);
});
