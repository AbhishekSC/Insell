import mongoose from "mongoose";

const expenseWorkspaceSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      trim: true,
      required: true,
      maxlength: 120,
    },
    admin: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    members: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
      },
    ],
    pendingInvites: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
      },
    ],
    archivedAt: {
      type: Date,
      default: null,
      index: true,
    },
    archivedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
    budgetLimit: {
      type: Number,
      min: 0,
      default: 0,
    },
    budgetAlertThresholds: {
      type: [Number],
      default: [50, 80, 100],
    },
    reminderEnabled: {
      type: Boolean,
      default: true,
    },
  },
  { timestamps: true }
);

expenseWorkspaceSchema.index({ admin: 1, createdAt: -1 });
expenseWorkspaceSchema.index({ members: 1, createdAt: -1 });

const ExpenseWorkspace = mongoose.model("ExpenseWorkspace", expenseWorkspaceSchema);

export default ExpenseWorkspace;
