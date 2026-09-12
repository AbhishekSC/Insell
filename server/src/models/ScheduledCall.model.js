import mongoose from "mongoose";

// A one-off scheduled community video call — "add scheduling + reminders"
// on top of the existing instant "Start a call now" feature. It never
// creates its own video room: joining a scheduled call reuses the same
// `community-{circleId}` Stream room the instant-call button already opens.
export const SCHEDULED_CALL_STATUSES = ["SCHEDULED", "REMINDED", "STARTED", "ENDED", "CANCELLED"];

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
    // Optional — how long the organizer expects the call to run. `null`
    // means no limit at all (today's original behavior: it only ever ends
    // when someone explicitly cancels it). When set, the auto-end sweep
    // only ever CHECKS a call once scheduledAt + durationMinutes has
    // passed — if people are still actually in the room at that point, it
    // is left alone entirely and re-checked later, never force-ended.
    durationMinutes: {
      type: Number,
      default: null,
      min: 5,
      max: 240,
    },
    status: {
      type: String,
      enum: SCHEDULED_CALL_STATUSES,
      default: "SCHEDULED",
      index: true,
    },
    // Set when the auto-end sweep finds the duration elapsed AND the room
    // genuinely empty (not on user-initiated cancellation — see cancelledAt).
    endedAt: {
      type: Date,
      default: null,
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
