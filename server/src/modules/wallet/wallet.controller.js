import {
  getMyWallet as getMyWalletService,
  getMyPassbook as getMyPassbookService,
} from "./wallet.service.js";
import { sendSuccessResponse, sendErrorResponse } from "../../utils/responseHandler.js";
import { logger } from "../../utils/logger.js";

/**
 * GET handler — authenticated user's coin wallet summary.
 */
export async function getMyWallet(req, res) {
  try {
    const data = await getMyWalletService(req.user._id);
    return sendSuccessResponse(res, 200, "Wallet fetched successfully", data);
  } catch (error) {
    logger.error("Error fetching user wallet:", error);
    return sendErrorResponse(res, 500, "Internal Server Error");
  }
}

/**
 * GET handler — authenticated user's coin passbook / transaction history.
 */
export async function getMyPassbook(req, res) {
  try {
    const { page, limit } = req.query;
    const result = await getMyPassbookService({
      userId: req.user._id,
      page,
      limit,
    });
    return sendSuccessResponse(res, 200, "Passbook fetched successfully", result);
  } catch (error) {
    logger.error("Error fetching user passbook:", error);
    return sendErrorResponse(res, 500, "Internal Server Error");
  }
}
