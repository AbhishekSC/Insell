import mongoose from "mongoose";

export const COIN_TRANSACTION_CATEGORIES = [
  "REFERRAL_BONUS",
  "AD_CAMPAIGN_SPEND",
  "POST_BOOST_SPEND",
  "DAILY_CHECKIN",
  "PROFILE_COMPLETION",
  "ADMIN_ADJUSTMENT",
  "REFUND",
];

const coinTransactionSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    wallet: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "CoinWallet",
      required: true,
      index: true,
    },
    type: {
      type: String,
      enum: ["CREDIT", "DEBIT"],
      required: true,
      index: true,
    },
    amount: {
      type: Number,
      required: true,
      min: 1,
    },
    balanceAfter: {
      type: Number,
      required: true,
      min: 0,
    },
    category: {
      type: String,
      enum: COIN_TRANSACTION_CATEGORIES,
      required: true,
      index: true,
    },
    description: {
      type: String,
      required: true,
      trim: true,
      maxlength: 250,
    },
    referenceId: {
      type: mongoose.Schema.Types.ObjectId,
      default: null,
      index: true,
    },
    referenceModel: {
      type: String,
      enum: ["Advertisement", "PropertyPost", "Referral", "User", null],
      default: null,
    },
    metadata: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },
  },
  { timestamps: true }
);

coinTransactionSchema.index({ user: 1, createdAt: -1 });

const CoinTransaction = mongoose.model("CoinTransaction", coinTransactionSchema);

export default CoinTransaction;
