import mongoose from "mongoose";

export const FEEDBACK_STATUSES = ["OPEN", "RESOLVED"];

const feedbackSchema = new mongoose.Schema(
  {
    reporter: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    message: {
      type: String,
      required: true,
      trim: true,
      maxlength: 2000,
    },
    page: {
      type: String,
      trim: true,
      default: "",
    },
    screenshotUrl: {
      type: String,
      default: null,
    },
    status: {
      type: String,
      enum: FEEDBACK_STATUSES,
      default: "OPEN",
      index: true,
    },
    resolvedAt: {
      type: Date,
      default: null,
    },
    resolvedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
  },
  { timestamps: true }
);

const Feedback = mongoose.model("Feedback", feedbackSchema);

export default Feedback;
