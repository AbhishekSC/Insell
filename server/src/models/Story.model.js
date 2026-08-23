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
    // Optional (not required) so a story saved into a Highlight can have
    // this field unset entirely — MongoDB's TTL monitor skips documents
    // that don't have the indexed field at all, so an unset expiresAt
    // means "never auto-delete" instead of needing a sentinel far-future
    // date. See highlight.controller.js.
    //
    // This field ONLY controls deletion — it is deliberately not what the
    // feed queries below filter on, so unsetting it (to save the story into
    // a Highlight) doesn't also yank the story out of the main feed early.
    // feedExpiresAt below is what keeps a highlighted story visible in the
    // normal 24h feed for its natural lifetime, same as any other story.
    expiresAt: {
      type: Date,
      index: true,
    },
    // Set once at creation to the same 24h mark as the initial expiresAt,
    // and never modified afterward (highlighting a story does not touch
    // this). This is what feed/profile queries filter on to decide whether
    // a story is still "live" — so a highlighted story keeps behaving like
    // a normal story in the feed until this passes, then just quietly stops
    // showing up there while staying permanently visible in its Highlight.
    feedExpiresAt: {
      type: Date,
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
    likedBy: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
      },
    ],
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
storySchema.index({ author: 1, isActive: 1, feedExpiresAt: 1 });

// Index for category-based queries
storySchema.index({ category: 1, isActive: 1, feedExpiresAt: 1 });

const Story = mongoose.model("Story", storySchema);

export default Story;
