import mongoose from "mongoose";

const deadLetterSchema = new mongoose.Schema(
  {
    originalJobId: String,
    jobName: { type: String, index: true },
    sourceQueue: { type: String, index: true },
    payload: mongoose.Schema.Types.Mixed,
    failedReason: String,
    attemptsMade: Number,
    failedAt: Date,
    resolved: { type: Boolean, default: false },
  },
  { timestamps: true }
);

deadLetterSchema.index({ createdAt: 1 }, { expireAfterSeconds: 30 * 24 * 60 * 60 });

export default mongoose.model("DeadLetter", deadLetterSchema);
