import mongoose from "mongoose";

const sessionRecapSchema = new mongoose.Schema(
  {
    author: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    title: {
      type: String,
      trim: true,
      required: true,
      maxlength: 140,
    },
    duration: {
      type: Number,
      required: true,
      min: 1,
      max: 600,
    },
    confidence: {
      type: Number,
      required: true,
      min: 1,
      max: 5,
    },
    newWords: {
      type: Number,
      required: true,
      min: 0,
      max: 100,
      default: 0,
    },
    nextStep: {
      type: String,
      trim: true,
      required: true,
      maxlength: 220,
    },
  },
  { timestamps: true }
);

sessionRecapSchema.index({ author: 1, createdAt: -1 });

const SessionRecap = mongoose.model("SessionRecap", sessionRecapSchema);

export default SessionRecap;
