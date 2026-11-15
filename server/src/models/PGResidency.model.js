import mongoose from "mongoose";

export const RESIDENCY_STATUSES = ["pending", "approved", "active", "notice_period", "moved_out", "evicted", "rejected"];

const pgResidencySchema = new mongoose.Schema(
  {
    tenant: {
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
    roomType: {
      type: String,
      trim: true,
      default: "",
    },
    preferredMoveInDate: Date,
    moveInDate: Date,
    moveOutDate: Date,
    status: {
      type: String,
      enum: RESIDENCY_STATUSES,
      default: "pending",
      index: true,
    },
    tenantMessage: {
      type: String,
      trim: true,
      maxlength: 500,
      default: "",
    },
    ownerNote: {
      type: String,
      trim: true,
      maxlength: 500,
      default: "",
    },
    assignedRoom: {
      type: String,
      trim: true,
      maxlength: 50,
      default: "",
    },
    assignedBed: {
      type: String,
      trim: true,
      maxlength: 50,
      default: "",
    },
    approvedAt: Date,
    rejectedAt: Date,
    monthlyRent: {
      type: Number,
      required: true,
      min: 0,
    },
    depositAmount: {
      type: Number,
      required: true,
      min: 0,
    },
    depositPaid: {
      type: Boolean,
      default: false,
    },
    depositRefunded: {
      type: Boolean,
      default: false,
    },
    depositRefundAmount: {
      type: Number,
      min: 0,
      default: 0,
    },
    depositRefundDate: Date,
    depositRefundNotes: {
      type: String,
      trim: true,
      maxlength: 500,
      default: "",
    },
    depositDueDate: Date,
    moveInConditionReport: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "ConditionReport",
    },
    moveOutConditionReport: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "ConditionReport",
    },
    formalNoticeGenerated: {
      type: Boolean,
      default: false,
    },
    formalNoticeDate: Date,
  },
  { timestamps: true }
);

pgResidencySchema.index({ tenant: 1, pg: 1, status: 1 });
pgResidencySchema.index({ pg: 1, status: 1 });

export default mongoose.model("PGResidency", pgResidencySchema);
