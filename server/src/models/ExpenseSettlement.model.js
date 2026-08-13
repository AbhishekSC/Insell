import mongoose from "mongoose";

const expenseSettlementSchema = new mongoose.Schema(
  {
    workspace: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "ExpenseWorkspace",
      required: true,
      index: true,
    },
    fromUser: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    toUser: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    amount: {
      type: Number,
      required: true,
      min: 1,
    },
    status: {
      type: String,
      enum: ["requested", "confirmed", "rejected"],
      default: "requested",
      index: true,
    },
    note: {
      type: String,
      trim: true,
      default: "",
      maxlength: 180,
    },
    paymentMethod: {
      type: String,
      enum: ["upi", "bank", "card", "cash", "other"],
      default: "upi",
    },
    payeeUpiId: {
      type: String,
      trim: true,
      default: "",
      maxlength: 120,
    },
    paymentReference: {
      type: String,
      trim: true,
      default: "",
      maxlength: 120,
    },
    requestedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    confirmedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
    confirmedAt: {
      type: Date,
      default: null,
    },
    rejectionReason: {
      type: String,
      trim: true,
      default: "",
      maxlength: 180,
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
  },
  { timestamps: true }
);

expenseSettlementSchema.index({ workspace: 1, createdAt: -1 });

const ExpenseSettlement = mongoose.model("ExpenseSettlement", expenseSettlementSchema);

export default ExpenseSettlement;
