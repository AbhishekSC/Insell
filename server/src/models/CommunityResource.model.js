import mongoose from "mongoose";

const communityResourceSchema = new mongoose.Schema(
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
    },
    title: {
      type: String,
      trim: true,
      required: true,
      maxlength: 140,
    },
    type: {
      type: String,
      enum: ["link", "note", "file"],
      default: "link",
    },
    url: {
      type: String,
      trim: true,
      default: "",
      maxlength: 400,
    },
    description: {
      type: String,
      trim: true,
      default: "",
      maxlength: 500,
    },
  },
  { timestamps: true }
);

communityResourceSchema.index({ circle: 1, createdAt: -1 });

const CommunityResource = mongoose.model("CommunityResource", communityResourceSchema);

export default CommunityResource;
