import mongoose from "mongoose";

const roomEntrySchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true, maxlength: 60 },
    photos: { type: [String], default: undefined },
    notes: { type: String, trim: true, maxlength: 500, default: "" },
    condition: {
      type: String,
      enum: ["excellent", "good", "fair", "poor", "damaged"],
      default: "good",
    },
  },
  { _id: false }
);

const conditionReportSchema = new mongoose.Schema(
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
    landlordEmail: {
      type: String,
      trim: true,
      maxlength: 120,
      default: "",
    },
    landlordPhone: {
      type: String,
      trim: true,
      maxlength: 15,
      default: "",
    },
    propertyAddress: {
      type: String,
      trim: true,
      required: true,
      maxlength: 500,
    },
    moveInDate: {
      type: Date,
      default: Date.now,
    },
    rooms: {
      type: [roomEntrySchema],
      validate: [arr => arr.length <= 20, "Maximum 20 rooms allowed"],
    },
    overallNotes: {
      type: String,
      trim: true,
      maxlength: 2000,
      default: "",
    },
    pdfUrl: {
      type: String,
      default: "",
    },
    sharedWith: {
      type: [mongoose.Schema.Types.ObjectId],
      ref: "User",
      default: undefined,
    },
  },
  { timestamps: true }
);

conditionReportSchema.index({ tenant: 1, createdAt: -1 });

export default mongoose.model("ConditionReport", conditionReportSchema);
