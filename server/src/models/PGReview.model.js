import mongoose from "mongoose";

const REVIEW_CATEGORIES = ["food", "cleanliness", "wifi", "water", "safety", "landlord", "value_for_money", "location"];

const pgReviewSchema = new mongoose.Schema(
  {
    reviewer: {
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
    categoryRatings: {
      food: { type: Number, min: 1, max: 5, required: true },
      cleanliness: { type: Number, min: 1, max: 5, required: true },
      wifi: { type: Number, min: 1, max: 5, required: true },
      water: { type: Number, min: 1, max: 5, required: true },
      safety: { type: Number, min: 1, max: 5, required: true },
      landlord: { type: Number, min: 1, max: 5, required: true },
      value_for_money: { type: Number, min: 1, max: 5, required: true },
      location: { type: Number, min: 1, max: 5, required: true },
    },
    overallRating: {
      type: Number,
      min: 1,
      max: 5,
    },
    comment: {
      type: String,
      trim: true,
      maxlength: 1000,
      default: "",
    },
    photos: {
      type: [String],
      default: undefined,
    },
    stayDurationMonths: {
      type: Number,
      min: 1,
    },
    verifiedResident: {
      type: Boolean,
      default: false,
    },
    helpful: {
      type: [mongoose.Schema.Types.ObjectId],
      ref: "User",
      default: undefined,
    },
  },
  { timestamps: true }
);

pgReviewSchema.index({ pg: 1, reviewer: 1 }, { unique: true });
pgReviewSchema.index({ pg: 1, createdAt: -1 });

pgReviewSchema.pre("save", function (next) {
  if (this.categoryRatings) {
    const cats = this.categoryRatings;
    const values = REVIEW_CATEGORIES.map((c) => cats[c]).filter((v) => v != null);
    this.overallRating = values.length
      ? Math.round((values.reduce((s, v) => s + v, 0) / values.length) * 10) / 10
      : null;
  }
  next();
});

export { REVIEW_CATEGORIES };
export default mongoose.model("PGReview", pgReviewSchema);
