import mongoose from "mongoose";

export const MEAL_TYPES = ["breakfast", "lunch", "dinner", "snacks"];

const mealRatingSchema = new mongoose.Schema(
  {
    pg: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "PropertyPost",
      required: true,
      index: true,
    },
    rater: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    date: {
      type: Date,
      required: true,
    },
    mealType: {
      type: String,
      enum: MEAL_TYPES,
      required: true,
    },
    rating: {
      type: Number,
      min: 1,
      max: 5,
      required: true,
    },
    comment: {
      type: String,
      trim: true,
      maxlength: 200,
      default: "",
    },
    photo: {
      type: String,
      default: "",
    },
  },
  { timestamps: true }
);

mealRatingSchema.index({ pg: 1, date: -1 });
mealRatingSchema.index({ pg: 1, rater: 1, date: 1, mealType: 1 }, { unique: true });

export default mongoose.model("MealRating", mealRatingSchema);
