import mongoose from "mongoose";

const billLineItemSchema = new mongoose.Schema(
  {
    label: { type: String, required: true, trim: true, maxlength: 60 },
    amount: { type: Number, required: true, min: 0 },
    notes: { type: String, trim: true, maxlength: 200, default: "" },
  },
  { _id: false }
);

const pgBillSchema = new mongoose.Schema(
  {
    pg: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "PropertyPost",
      required: true,
      index: true,
    },
    tenant: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
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
    items: {
      type: [billLineItemSchema],
      validate: [arr => arr.length <= 20, "Maximum 20 line items"],
    },
    totalAmount: {
      type: Number,
      min: 0,
      default: 0,
    },
    electricityUnits: {
      type: Number,
      min: 0,
      default: 0,
    },
    electricityPerUnit: {
      type: Number,
      min: 0,
      default: 0,
    },
    splitMethod: {
      type: String,
      enum: ["equal", "per_meter", "usage_based", "fixed"],
      default: "equal",
    },
    paid: {
      type: Boolean,
      default: false,
    },
    paidAt: Date,
    notes: {
      type: String,
      trim: true,
      maxlength: 500,
      default: "",
    },
  },
  { timestamps: true }
);

pgBillSchema.index({ pg: 1, tenant: 1, year: -1, month: -1 });
pgBillSchema.index({ pg: 1, year: 1, month: 1 });

pgBillSchema.pre("save", function (next) {
  if (this.items && this.items.length) {
    this.totalAmount = this.items.reduce((sum, item) => sum + (item.amount || 0), 0);
  }
  next();
});

export default mongoose.model("PGBill", pgBillSchema);
