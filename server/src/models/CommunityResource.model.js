import mongoose from "mongoose";
import { cdnMediaPlugin } from "../plugins/cdnMedia.plugin.js";

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

communityResourceSchema.plugin(cdnMediaPlugin, { fields: ["url"] });

const CommunityResource = mongoose.model("CommunityResource", communityResourceSchema);

export default CommunityResource;
