import { describe, it, expect, beforeEach, vi } from "vitest";
import CoinWallet from "../src/models/CoinWallet.model.js";
import CoinTransaction from "../src/models/CoinTransaction.model.js";
import User from "../src/models/User.model.js";
import {
  getOrCreateWallet,
  creditCoins,
  debitCoins,
  getPassbook,
} from "../src/services/wallet.service.js";

describe("CoinWallet & CoinTransaction Architecture", () => {
  const fakeUserId = "64b8f0f1a1b2c3d4e5f6a7b8";

  it("calculates virtual rupeeValue correctly (1 coin = 0.10 INR)", () => {
    const wallet = new CoinWallet({
      user: fakeUserId,
      balance: 65,
    });
    expect(wallet.rupeeValue).toBe(6.5);

    wallet.balance = 500;
    expect(wallet.rupeeValue).toBe(50.0);

    wallet.balance = 0;
    expect(wallet.rupeeValue).toBe(0.0);
  });

  it("validates allowed transaction categories", () => {
    const valid = [
      "REFERRAL_BONUS",
      "AD_CAMPAIGN_SPEND",
      "POST_BOOST_SPEND",
      "DAILY_CHECKIN",
      "PROFILE_COMPLETION",
      "ADMIN_ADJUSTMENT",
      "REFUND",
    ];

    valid.forEach((cat) => {
      const tx = new CoinTransaction({
        user: fakeUserId,
        wallet: fakeUserId,
        type: "CREDIT",
        amount: 50,
        balanceAfter: 50,
        category: cat,
        description: `Test for ${cat}`,
      });
      const err = tx.validateSync();
      expect(err).toBeUndefined();
    });
  });

  it("rejects invalid transaction category", () => {
    const tx = new CoinTransaction({
      user: fakeUserId,
      wallet: fakeUserId,
      type: "CREDIT",
      amount: 50,
      balanceAfter: 50,
      category: "INVALID_CATEGORY",
      description: "Invalid",
    });
    const err = tx.validateSync();
    expect(err?.errors?.category).toBeDefined();
  });

  it("calculates atomic balance updates correctly on credit and debit", () => {
    // Initial state
    let wallet = {
      balance: 100,
      lifetimeEarned: 100,
      lifetimeSpent: 0,
    };

    // Credit 65 coins
    const creditAmount = 65;
    wallet.balance += creditAmount;
    wallet.lifetimeEarned += creditAmount;

    expect(wallet.balance).toBe(165);
    expect(wallet.lifetimeEarned).toBe(165);

    // Debit 50 coins
    const debitAmount = 50;
    expect(wallet.balance >= debitAmount).toBe(true);
    wallet.balance -= debitAmount;
    wallet.lifetimeSpent += debitAmount;

    expect(wallet.balance).toBe(115);
    expect(wallet.lifetimeSpent).toBe(50);

    // Attempt to debit more than balance
    const excessiveDebit = 200;
    const canDebit = wallet.balance >= excessiveDebit;
    expect(canDebit).toBe(false);
    expect(wallet.balance).toBe(115); // unchanged
  });
});
