import mongoose from "mongoose";

const checkInSchema = new mongoose.Schema(
  {
    author: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    prompt: {
      type: String,
      trim: true,
      required: true,
      maxlength: 180,
    },
    content: {
      type: String,
      trim: true,
      required: true,
      maxlength: 500,
    },
    type: {
      type: String,
      enum: ["voice", "text"],
      default: "voice",
    },
    expiresAt: {
      type: Date,
      required: true,
      index: true,
    },
  },
  { timestamps: true }
);

checkInSchema.index({ author: 1, createdAt: -1 });

const CheckIn = mongoose.model("CheckIn", checkInSchema);

export default CheckIn;
