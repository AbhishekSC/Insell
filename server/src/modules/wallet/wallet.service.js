import {
  getOrCreateWallet,
  getPassbook,
} from "../../services/wallet.service.js";

/**
 * Get the authenticated user's wallet summary with formatted fields.
 * @param {string} userId
 * @returns {Promise<Object>} Wallet summary data.
 */
export async function getMyWallet(userId) {
  const wallet = await getOrCreateWallet(userId);

  return {
    balance: wallet.balance,
    rupeeValue: Number(((wallet.balance || 0) * 0.1).toFixed(2)),
    lifetimeEarned: wallet.lifetimeEarned || 0,
    lifetimeSpent: wallet.lifetimeSpent || 0,
    status: wallet.status,
  };
}

/**
 * Get the authenticated user's passbook / transaction history.
 * @param {Object} params
 * @param {string} params.userId
 * @param {number|string} params.page
 * @param {number|string} params.limit
 * @returns {Promise<Object>} Passbook result.
 */
export async function getMyPassbook({ userId, page, limit }) {
  return getPassbook({ userId, page, limit });
}
