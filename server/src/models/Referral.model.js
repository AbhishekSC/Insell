import mongoose from "mongoose";

// One row per successfully-referred signup — exists mainly so a reward can
// never fire twice for the same referred user (unique index below), and so
// a referrer can see a real count of who they've brought in. The running
// balance itself lives on User.referralCredits.
const referralSchema = new mongoose.Schema(
  {
    referrer: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    referred: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      unique: true,
    },
    status: {
      type: String,
      enum: ["PENDING", "REWARDED"],
      default: "PENDING",
      index: true,
    },
    rewardedAt: {
      type: Date,
      default: null,
    },
  },
  { timestamps: true }
);

const Referral = mongoose.model("Referral", referralSchema);

export default Referral;
