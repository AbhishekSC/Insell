import mongoose from "mongoose";

export const REPORT_REASON_CODES = [
  "SPAM",
  "FALSE_INFORMATION",
  "INAPPROPRIATE_CONTENT",
  "RESTRICTED_ITEM",
  "HARASSMENT",
  "INTELLECTUAL_PROPERTY",
  "DUPLICATE_LISTING",
  "OTHER",
];

export const REPORT_STATUSES = ["PENDING", "DISMISSED", "ACTION_TAKEN"];

const postReportSchema = new mongoose.Schema(
  {
    post: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "PropertyPost",
      required: true,
      index: true,
    },
    reporter: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    reasonCode: {
      type: String,
      enum: REPORT_REASON_CODES,
      required: true,
    },
    description: {
      type: String,
      trim: true,
      default: "",
      maxlength: 1000,
    },
    status: {
      type: String,
      enum: REPORT_STATUSES,
      default: "PENDING",
      index: true,
    },
    reviewedAt: {
      type: Date,
      default: null,
    },
    reviewedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
  },
  { timestamps: true }
);

postReportSchema.index({ post: 1, reporter: 1 }, { unique: true });

const PostReport = mongoose.model("PostReport", postReportSchema);

export default PostReport;
