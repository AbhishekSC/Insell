import mongoose from "mongoose";

// A named, permanent collection of a user's own stories — Instagram-style
// "Highlights". Stories referenced here have had their TTL (expiresAt)
// unset (see highlight.controller.js), so they survive past the normal
// 24h auto-delete that every other Story is subject to.
const highlightSchema = new mongoose.Schema(
  {
    owner: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    title: {
      type: String,
      required: true,
      trim: true,
      maxlength: 30,
    },
    coverImage: {
      type: String,
      trim: true,
      default: "",
    },
    stories: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Story",
      },
    ],
  },
  { timestamps: true }
);

highlightSchema.index({ owner: 1, createdAt: -1 });

const Highlight = mongoose.model("Highlight", highlightSchema);

export default Highlight;
