import mongoose from "mongoose";

const communityMessageSchema = new mongoose.Schema(
  {
    circle: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "StudyCircle",
      required: true,
      index: true,
    },
    author: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    text: {
      type: String,
      trim: true,
      required: true,
      maxlength: 500,
    },
  },
  { timestamps: true }
);

communityMessageSchema.index({ circle: 1, createdAt: -1 });

const CommunityMessage = mongoose.model("CommunityMessage", communityMessageSchema);

export default CommunityMessage;
