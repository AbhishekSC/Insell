import mongoose from "mongoose";

const rentPaymentSchema = new mongoose.Schema(
  {
    tenant: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    landlordName: {
      type: String,
      trim: true,
      required: true,
      maxlength: 120,
    },
    landlordPAN: {
      type: String,
      trim: true,
      maxlength: 10,
      default: "",
    },
    propertyAddress: {
      type: String,
      trim: true,
      required: true,
      maxlength: 500,
    },
    amount: {
      type: Number,
      required: true,
      min: 1,
    },
    month: {
      type: Number,
      required: true,
      min: 1,
      max: 12,
    },
    year: {
      type: Number,
      required: true,
      min: 2020,
    },
    paymentDate: {
      type: Date,
      default: Date.now,
    },
    paymentMode: {
      type: String,
      enum: ["cash", "upi", "bank_transfer", "cheque", "other"],
      default: "upi",
    },
    receiptGenerated: {
      type: Boolean,
      default: false,
    },
    receiptUrl: {
      type: String,
      default: "",
    },
    notes: {
      type: String,
      trim: true,
      maxlength: 300,
      default: "",
    },
  },
  { timestamps: true }
);

rentPaymentSchema.index({ tenant: 1, year: -1, month: -1 });
rentPaymentSchema.index({ tenant: 1, landlordName: 1, year: 1, month: 1 }, { unique: true });

export default mongoose.model("RentPayment", rentPaymentSchema);
