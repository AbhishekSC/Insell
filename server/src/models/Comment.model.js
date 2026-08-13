import mongoose from "mongoose";

const commentSchema = new mongoose.Schema(
  {
    post: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "PropertyPost",
      required: true,
      index: true,
    },
    author: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    content: {
      type: String,
      required: true,
      trim: true,
      maxlength: 1000,
    },
    parentComment: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Comment",
      default: null,
    },
    likesCount: {
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
    isDeleted: {
      type: Boolean,
      default: false,
    },
    // Analytics fields for personalization
    keywords: [{
      type: String,
      index: true,
    }],
    sentiment: {
      type: String,
      enum: ['positive', 'neutral', 'negative'],
      default: 'neutral',
      index: true,
    },
    sentimentScore: {
      type: Number,
      min: -1,
      max: 1,
      default: 0,
    },
    category: {
      type: String,
      enum: ['inquiry', 'feedback', 'compliment', 'complaint', 'question', 'other'],
      default: 'other',
      index: true,
    },
    propertyMentions: [{
      type: String,
    }],
    intent: {
      type: String,
      enum: ['buying', 'renting', 'investing', 'browsing', 'comparing'],
      default: 'browsing',
    },
  },
  {
    timestamps: true,
  }
);

// Index for efficient queries
commentSchema.index({ post: 1, createdAt: -1 });
commentSchema.index({ author: 1, createdAt: -1 });
commentSchema.index({ keywords: 1 });
commentSchema.index({ sentiment: 1 });
commentSchema.index({ category: 1 });
commentSchema.index({ intent: 1 });
commentSchema.index({ author: 1, intent: 1 });

const Comment = mongoose.model("Comment", commentSchema);

export default Comment;
