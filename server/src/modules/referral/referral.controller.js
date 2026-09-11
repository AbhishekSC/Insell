import { asyncHandler } from "../../core/asyncHandler.js";
import { sendSuccessResponse } from "../../utils/responseHandler.js";
import { getMyReferralInfo } from "./referral.service.js";

// GET /referral/me
export const getMine = asyncHandler(async (req, res) => {
  const info = await getMyReferralInfo(req.user._id);
  return sendSuccessResponse(res, 200, "Referral info", info);
});
