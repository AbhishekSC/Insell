import mongoose from "mongoose";

const storySchema = new mongoose.Schema(
  {
    author: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    authorRole: {
      type: String,
      trim: true,
      default: "",
    },
    mediaUrl: {
      type: String,
      required: true,
      trim: true,
    },
    mediaType: {
      type: String,
      enum: ["image", "video"],
      default: "image",
    },
    caption: {
      type: String,
      trim: true,
      maxlength: 500,
      default: "",
    },
    visibility: {
      type: String,
      enum: ["public", "private"],
      default: "public",
      index: true,
    },
    propertyId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "PropertyPost",
      default: null,
    },
    linkUrl: {
      type: String,
      trim: true,
      default: "",
    },
    expiresAt: {
      type: Date,
      required: true,
      index: true,
    },
    viewedBy: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
      },
    ],
    viewCount: {
      type: Number,
      default: 0,
      min: 0,
    },
    isActive: {
      type: Boolean,
      default: true,
      index: true,
    },
  },
  { timestamps: true }
);

// TTL index to automatically delete expired stories (24 hours)
storySchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

// Index for querying active stories
storySchema.index({ author: 1, isActive: 1, expiresAt: 1 });

// Index for category-based queries
storySchema.index({ category: 1, isActive: 1, expiresAt: 1 });

const Story = mongoose.model("Story", storySchema);

export default Story;
