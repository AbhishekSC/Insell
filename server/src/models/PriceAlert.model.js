import mongoose from "mongoose";

// A buyer's standing request to be told when a specific listing's price
// drops to or below a target they choose. One alert per user per listing —
// re-setting it just updates the target.
const priceAlertSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    post: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "PropertyPost",
      required: true,
      index: true,
    },
    targetPrice: {
      type: Number,
      required: true,
      min: 1,
    },
    // Only "below" is supported today; kept explicit for future "above" alerts.
    direction: {
      type: String,
      enum: ["below"],
      default: "below",
    },
    active: {
      type: Boolean,
      default: true,
    },
    // Guards against re-pinging on repeated small drops — we only notify
    // again if the price falls further than it was when last notified.
    lastNotifiedAt: { type: Date, default: null },
    lastNotifiedPrice: { type: Number, default: null },
  },
  { timestamps: true }
);

priceAlertSchema.index({ user: 1, post: 1 }, { unique: true });
priceAlertSchema.index({ post: 1, active: 1 });

const PriceAlert = mongoose.model("PriceAlert", priceAlertSchema);

export default PriceAlert;
