import mongoose from "mongoose";

// The "Verified Owner" trust badge — a user submits an ID / ownership
// document, an admin approves or rejects it. Separate from email
// verification (User.isVerified) entirely; see User.isOwnerVerified.
export const DOC_TYPES = ["AADHAAR", "PAN", "PROPERTY_TAX_RECEIPT", "SALE_DEED", "OTHER"];
export const REQUEST_STATUSES = ["PENDING", "APPROVED", "REJECTED"];

const ownerVerificationRequestSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    docType: {
      type: String,
      enum: DOC_TYPES,
      required: true,
    },
    docUrl: {
      type: String,
      required: true,
    },
    note: {
      type: String,
      trim: true,
      default: "",
      maxlength: 500,
    },
    status: {
      type: String,
      enum: REQUEST_STATUSES,
      default: "PENDING",
      index: true,
    },
    reviewNote: {
      type: String,
      trim: true,
      default: "",
      maxlength: 500,
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

const OwnerVerificationRequest = mongoose.model("OwnerVerificationRequest", ownerVerificationRequestSchema);

export default OwnerVerificationRequest;
