import mongoose from "mongoose";
import { cdnMediaPlugin } from "../plugins/cdnMedia.plugin.js";

export const AD_CATEGORIES = [
  "Real Estate",
  "Home Loans & Finance",
  "Interiors & Services",
  "Lifestyle & Entertainment",
];

const advertisementSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: true,
      trim: true,
      maxlength: 120,
    },
    description: {
      type: String,
      required: true,
      trim: true,
      maxlength: 300,
    },
    mediaUrl: {
      type: String,
      required: true,
      trim: true,
    },
    mediaType: {
      type: String,
      enum: ["image", "video"],
      default: "image",
    },
    ctaText: {
      type: String,
      required: true,
      trim: true,
      default: "Learn More",
      maxlength: 40,
    },
    targetUrl: {
      type: String,
      required: true,
      trim: true,
    },
    badgeText: {
      type: String,
      trim: true,
      default: "Ad",
      maxlength: 30,
    },
    companyName: {
      type: String,
      trim: true,
      default: "",
      maxlength: 80,
    },
    companyLogo: {
      type: String,
      trim: true,
      default: "",
    },
    targetCity: {
      type: String,
      trim: true,
      default: "", // empty means All Cities
    },
    targetIntent: {
      type: String,
      enum: ["All", "Buy", "Rent", "Sell"],
      default: "All",
    },
    adCategory: {
      type: String,
      enum: AD_CATEGORIES,
      default: "Real Estate",
      index: true,
    },
    status: {
      type: String,
      enum: ["active", "paused", "expired", "draft"],
      default: "active",
      index: true,
    },
    startDate: {
      type: Date,
      default: Date.now,
    },
    endDate: {
      type: Date,
      default: null,
    },
    impressionsCount: {
      type: Number,
      default: 0,
      min: 0,
    },
    frequencyCap: {
      type: Number,
      default: 3, // Max times a single user can see this ad per day
      min: 1,
      max: 50,
    },
    clicksCount: {
      type: Number,
      default: 0,
      min: 0,
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    coinsSpent: {
      type: Number,
      default: 0,
      min: 0,
    },
    associatedPostId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "PropertyPost",
      default: null,
    },
  },
  { timestamps: true }
);

advertisementSchema.index({ status: 1, startDate: 1, endDate: 1 });
advertisementSchema.index({ targetCity: 1, targetIntent: 1 });

advertisementSchema.plugin(cdnMediaPlugin, { fields: ["mediaUrl", "companyLogo"] });

const Advertisement = mongoose.model("Advertisement", advertisementSchema);

export default Advertisement;
