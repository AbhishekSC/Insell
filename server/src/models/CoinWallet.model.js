import mongoose from "mongoose";

const coinWalletSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      unique: true,
      index: true,
    },
    balance: {
      type: Number,
      default: 0,
      min: 0,
      index: true,
    },
    lifetimeEarned: {
      type: Number,
      default: 0,
      min: 0,
    },
    lifetimeSpent: {
      type: Number,
      default: 0,
      min: 0,
    },
    status: {
      type: String,
      enum: ["ACTIVE", "FROZEN"],
      default: "ACTIVE",
      index: true,
    },
  },
  { timestamps: true }
);

// Virtual property for Rupee valuation (1 Coin = 0.10 INR / 10 Paise)
coinWalletSchema.virtual("rupeeValue").get(function () {
  return Number(((this.balance || 0) * 0.1).toFixed(2));
});

coinWalletSchema.set("toJSON", { virtuals: true });
coinWalletSchema.set("toObject", { virtuals: true });

const CoinWallet = mongoose.model("CoinWallet", coinWalletSchema);

export default CoinWallet;
