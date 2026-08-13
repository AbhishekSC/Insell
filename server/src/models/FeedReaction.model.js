import mongoose from "mongoose";

const feedReactionSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    targetType: {
      type: String,
      enum: ["checkin", "recap"],
      required: true,
      index: true,
    },
    targetId: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
      index: true,
    },
    emoji: {
      type: String,
      required: true,
      trim: true,
      maxlength: 8,
    },
  },
  { timestamps: true }
);

feedReactionSchema.index({ user: 1, targetType: 1, targetId: 1, emoji: 1 }, { unique: true });
feedReactionSchema.index({ targetType: 1, targetId: 1, createdAt: -1 });

const FeedReaction = mongoose.model("FeedReaction", feedReactionSchema);

export default FeedReaction;
