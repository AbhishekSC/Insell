import mongoose from "mongoose";

// A one-off scheduled community video call — "add scheduling + reminders"
// on top of the existing instant "Start a call now" feature. It never
// creates its own video room: joining a scheduled call reuses the same
// `community-{circleId}` Stream room the instant-call button already opens.
export const SCHEDULED_CALL_STATUSES = ["SCHEDULED", "REMINDED", "STARTED", "CANCELLED"];

const scheduledCallSchema = new mongoose.Schema(
  {
    circle: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "StudyCircle",
      required: true,
      index: true,
    },
    scheduledBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    title: {
      type: String,
      trim: true,
      default: "",
      maxlength: 120,
    },
    scheduledAt: {
      type: Date,
      required: true,
    },
    status: {
      type: String,
      enum: SCHEDULED_CALL_STATUSES,
      default: "SCHEDULED",
      index: true,
    },
    // Set once the "starts in 10 minutes" reminder goes out, so the cron
    // sweep never sends it twice — the guard the whole feature hinges on.
    reminderSentAt: {
      type: Date,
      default: null,
    },
    cancelledBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
    cancelledAt: {
      type: Date,
      default: null,
    },
  },
  { timestamps: true }
);

// The cron sweep's exact query shape: due, not yet reminded, still pending.
scheduledCallSchema.index({ status: 1, scheduledAt: 1 });
// Listing a community's upcoming calls, soonest first.
scheduledCallSchema.index({ circle: 1, scheduledAt: 1 });

const ScheduledCall = mongoose.model("ScheduledCall", scheduledCallSchema);

export default ScheduledCall;
