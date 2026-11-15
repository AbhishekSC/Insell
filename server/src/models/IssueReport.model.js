import mongoose from "mongoose";

export const ISSUE_CATEGORIES = [
  "wifi",
  "water",
  "electricity",
  "maintenance",
  "food",
  "cleanliness",
  "safety",
  "noise",
  "other",
];

export const ISSUE_STATUSES = ["open", "acknowledged", "in_progress", "resolved", "closed"];

const issueReportSchema = new mongoose.Schema(
  {
    reporter: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    pg: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "PropertyPost",
      required: true,
      index: true,
    },
    category: {
      type: String,
      enum: ISSUE_CATEGORIES,
      required: true,
    },
    title: {
      type: String,
      trim: true,
      required: true,
      maxlength: 120,
    },
    description: {
      type: String,
      trim: true,
      maxlength: 1000,
      default: "",
    },
    photos: {
      type: [String],
      default: undefined,
    },
    status: {
      type: String,
      enum: ISSUE_STATUSES,
      default: "open",
      index: true,
    },
    priority: {
      type: String,
      enum: ["low", "medium", "high", "urgent"],
      default: "medium",
    },
    ownerResponse: {
      type: String,
      trim: true,
      maxlength: 1000,
      default: "",
    },
    acknowledgedAt: Date,
    resolvedAt: Date,
    closedAt: Date,
  },
  { timestamps: true }
);

issueReportSchema.index({ pg: 1, status: 1, createdAt: -1 });
issueReportSchema.index({ reporter: 1, createdAt: -1 });

export default mongoose.model("IssueReport", issueReportSchema);
