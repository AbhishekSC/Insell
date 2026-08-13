import mongoose from "mongoose";

const presenceSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      unique: true,
      index: true,
    },
    status: {
      type: String,
      enum: ["ready", "busy", "offline"],
      default: "ready",
    },
    note: {
      type: String,
      trim: true,
      default: "",
      maxlength: 180,
    },
  },
  { timestamps: true }
);

const Presence = mongoose.model("Presence", presenceSchema);

export default Presence;
