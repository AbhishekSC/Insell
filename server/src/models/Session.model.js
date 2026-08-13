import mongoose from "mongoose";

const sessionSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      trim: true,
      required: true,
      maxlength: 120,
    },
    mode: {
      type: String,
      trim: true,
      required: true,
      default: "intro",
    },
    scheduledFor: {
      type: Date,
      required: true,
      index: true,
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    invitees: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
      },
    ],
    status: {
      type: String,
      enum: ["scheduled", "completed", "cancelled"],
      default: "scheduled",
      index: true,
    },
  },
  { timestamps: true }
);

sessionSchema.index({ createdBy: 1, scheduledFor: -1 });
sessionSchema.index({ invitees: 1, scheduledFor: -1 });

const Session = mongoose.model("Session", sessionSchema);

export default Session;
