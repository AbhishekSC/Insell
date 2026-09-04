import mongoose from "mongoose";

// One row per (user, IST calendar day) tracking how many visit requests they
// created that day. The daily rate limit is enforced with a conditional
// $inc against this — never a read-then-write count of VisitRequest docs,
// which would race on a double-submit.

const visitUsageSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    dateBucket: { type: String, required: true }, // "YYYY-MM-DD" in Asia/Kolkata
    count: { type: Number, default: 0, min: 0 },
  },
  { timestamps: true }
);

visitUsageSchema.index({ user: 1, dateBucket: 1 }, { unique: true });
// Old buckets are harmless but pointless to keep — expire a week out.
visitUsageSchema.index({ createdAt: 1 }, { expireAfterSeconds: 7 * 24 * 60 * 60 });

const VisitUsage = mongoose.model("VisitUsage", visitUsageSchema);
export default VisitUsage;
