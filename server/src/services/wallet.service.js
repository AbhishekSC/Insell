import CoinWallet from "../models/CoinWallet.model.js";
import CoinTransaction from "../models/CoinTransaction.model.js";
import User from "../models/User.model.js";
import { logger } from "../utils/logger.js";

/**
 * Get or initialize user's CoinWallet.
 * Automatically backfills existing referralCredits from User document if present.
 */
export async function getOrCreateWallet(userId) {
  let wallet = await CoinWallet.findOne({ user: userId });
  if (wallet) {
    return wallet;
  }

  // Check if user has existing referralCredits on User model
  const user = await User.findById(userId).select("referralCredits").lean();
  const initialBalance = Math.max(0, user?.referralCredits || 0);

  try {
    wallet = await CoinWallet.create({
      user: userId,
      balance: initialBalance,
      lifetimeEarned: initialBalance,
      lifetimeSpent: 0,
      status: "ACTIVE",
    });

    if (initialBalance > 0) {
      await CoinTransaction.create({
        user: userId,
        wallet: wallet._id,
        type: "CREDIT",
        amount: initialBalance,
        balanceAfter: initialBalance,
        category: "ADMIN_ADJUSTMENT",
        description: "Initial balance synchronized from user account",
      });
    }
  } catch (err) {
    // If unique key collision on race condition, fetch existing
    if (err?.code === 11000) {
      wallet = await CoinWallet.findOne({ user: userId });
    } else {
      throw err;
    }
  }

  return wallet;
}

/**
 * Credit coins to user wallet and record transaction in ledger.
 */
export async function creditCoins({
  userId,
  amount,
  category,
  description,
  referenceId = null,
  referenceModel = null,
  metadata = {},
}) {
  const creditAmount = Math.max(0, Math.floor(Number(amount) || 0));
  if (creditAmount <= 0) {
    throw new Error("Credit amount must be greater than 0");
  }

  // Ensure wallet exists first
  await getOrCreateWallet(userId);

  // Atomically increment balance & lifetimeEarned
  const wallet = await CoinWallet.findOneAndUpdate(
    { user: userId },
    { $inc: { balance: creditAmount, lifetimeEarned: creditAmount } },
    { new: true }
  );

  const transaction = await CoinTransaction.create({
    user: userId,
    wallet: wallet._id,
    type: "CREDIT",
    amount: creditAmount,
    balanceAfter: wallet.balance,
    category,
    description: description || `Credited ${creditAmount} coins`,
    referenceId,
    referenceModel,
    metadata,
  });

  // Mirror balance on User document for legacy backwards compatibility
  await User.updateOne({ _id: userId }, { referralCredits: wallet.balance }).catch((err) => {
    logger.warn(`Failed to mirror referralCredits for user ${userId}:`, err?.message);
  });

  return { success: true, wallet, transaction };
}

/**
 * Atomically debit coins from user wallet.
 * Returns { success: false, reason: "INSUFFICIENT_COINS" } if user doesn't have enough coins.
 */
export async function debitCoins({
  userId,
  amount,
  category,
  description,
  referenceId = null,
  referenceModel = null,
  metadata = {},
}) {
  const debitAmount = Math.max(0, Math.floor(Number(amount) || 0));
  if (debitAmount <= 0) {
    throw new Error("Debit amount must be greater than 0");
  }

  // Ensure wallet exists
  await getOrCreateWallet(userId);

  // Atomically decrement only if sufficient spendable balance
  const wallet = await CoinWallet.findOneAndUpdate(
    { user: userId, balance: { $gte: debitAmount }, status: "ACTIVE" },
    { $inc: { balance: -debitAmount, lifetimeSpent: debitAmount } },
    { new: true }
  );

  if (!wallet) {
    const currentWallet = await CoinWallet.findOne({ user: userId }).lean();
    return {
      success: false,
      reason: "INSUFFICIENT_COINS",
      currentBalance: currentWallet?.balance || 0,
      required: debitAmount,
    };
  }

  const transaction = await CoinTransaction.create({
    user: userId,
    wallet: wallet._id,
    type: "DEBIT",
    amount: debitAmount,
    balanceAfter: wallet.balance,
    category,
    description: description || `Debited ${debitAmount} coins`,
    referenceId,
    referenceModel,
    metadata,
  });

  // Mirror balance on User document for legacy backwards compatibility
  await User.updateOne({ _id: userId }, { referralCredits: wallet.balance }).catch((err) => {
    logger.warn(`Failed to mirror referralCredits for user ${userId}:`, err?.message);
  });

  return { success: true, wallet, transaction };
}

/**
 * Update transaction reference after an entity (e.g. Ad campaign) has been saved.
 */
export async function updateTransactionReference(transactionId, referenceId, referenceModel) {
  if (!transactionId || !referenceId) return;
  await CoinTransaction.findByIdAndUpdate(transactionId, {
    referenceId,
    referenceModel,
  });
}

/**
 * Fetch paginated passbook statement for user.
 */
export async function getPassbook({ userId, page = 1, limit = 20 }) {
  const pageNum = Math.max(1, Number.parseInt(page, 10) || 1);
  const limitNum = Math.min(50, Math.max(1, Number.parseInt(limit, 10) || 20));
  const skip = (pageNum - 1) * limitNum;

  const wallet = await getOrCreateWallet(userId);

  const [transactions, total] = await Promise.all([
    CoinTransaction.find({ user: userId })
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limitNum)
      .lean(),
    CoinTransaction.countDocuments({ user: userId }),
  ]);

  return {
    wallet: {
      balance: wallet.balance,
      rupeeValue: Number(((wallet.balance || 0) * 0.1).toFixed(2)),
      lifetimeEarned: wallet.lifetimeEarned || 0,
      lifetimeSpent: wallet.lifetimeSpent || 0,
      status: wallet.status,
    },
    transactions,
    pagination: {
      page: pageNum,
      limit: limitNum,
      total,
      totalPages: Math.ceil(total / limitNum),
    },
  };
}
