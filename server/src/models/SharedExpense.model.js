import mongoose from "mongoose";

const sharedExpenseSchema = new mongoose.Schema(
  {
    workspace: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "ExpenseWorkspace",
      required: true,
      index: true,
    },
    title: {
      type: String,
      trim: true,
      required: true,
      maxlength: 160,
    },
    amount: {
      type: Number,
      required: true,
      min: 1,
    },
    paidBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    category: {
      type: String,
      trim: true,
      default: "other",
      enum: ["food", "stay", "transport", "activities", "shopping", "other"],
      index: true,
    },
    splitType: {
      type: String,
      default: "equal",
      enum: ["equal", "custom", "percentage"],
    },
    participants: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
      },
    ],
    splits: [
      {
        user: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "User",
          required: true,
        },
        amount: {
          type: Number,
          min: 0,
          required: true,
        },
        percentage: {
          type: Number,
          min: 0,
          max: 100,
        },
      },
    ],
    splitBetween: {
      type: Number,
      required: true,
      min: 1,
      default: 2,
    },
    receiptUrl: {
      type: String,
      trim: true,
      default: "",
    },
    warningFlags: {
      type: [String],
      default: [],
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    updatedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
      index: true,
    },
    updatedAtCustom: {
      type: Date,
      default: null,
    },
    updateReason: {
      type: String,
      trim: true,
      default: "",
      maxlength: 240,
    },
    updateHistory: [
      {
        updatedBy: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "User",
          required: true,
        },
        updatedAt: {
          type: Date,
          required: true,
          default: Date.now,
        },
        reason: {
          type: String,
          trim: true,
          default: "",
          maxlength: 240,
        },
      },
    ],
  },
  { timestamps: true }
);

sharedExpenseSchema.index({ workspace: 1, createdAt: -1 });

const SharedExpense = mongoose.model("SharedExpense", sharedExpenseSchema);

export default SharedExpense;
