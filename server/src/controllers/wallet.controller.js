import { getOrCreateWallet, getPassbook } from "../services/wallet.service.js";
import { sendSuccessResponse, sendErrorResponse } from "../utils/responseHandler.js";
import { logger } from "../utils/logger.js";

/**
 * Public/Auth: Get authenticated user's coin wallet summary.
 */
export async function getMyWallet(req, res) {
  try {
    const wallet = await getOrCreateWallet(req.user._id);
    return sendSuccessResponse(res, 200, "Wallet fetched successfully", {
      balance: wallet.balance,
      rupeeValue: Number(((wallet.balance || 0) * 0.1).toFixed(2)),
      lifetimeEarned: wallet.lifetimeEarned || 0,
      lifetimeSpent: wallet.lifetimeSpent || 0,
      status: wallet.status,
    });
  } catch (error) {
    logger.error("Error fetching user wallet:", error);
    return sendErrorResponse(res, 500, "Internal Server Error");
  }
}

/**
 * Public/Auth: Get authenticated user's coin passbook / transaction history.
 */
export async function getMyPassbook(req, res) {
  try {
    const { page, limit } = req.query;
    const result = await getPassbook({
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
