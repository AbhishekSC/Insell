import mongoose from "mongoose";

const marketBenchmarkSchema = new mongoose.Schema(
  {
    city: {
      type: String,
      required: true,
      trim: true,
      lowercase: true,
      index: true,
    },
    locality: {
      type: String,
      trim: true,
      lowercase: true,
      default: "",
      index: true,
    },
    intent: {
      type: String,
      enum: ["rent", "buy"],
      required: true,
      index: true,
    },
    propertyType: {
      type: String,
      trim: true,
      lowercase: true,
      default: "all",
    },
    minPsf: {
      type: Number,
      required: true,
    },
    maxPsf: {
      type: Number,
      required: true,
    },
    avgPsf: {
      type: Number,
      required: true,
    },
    sampleCount: {
      type: Number,
      default: 1,
    },
    source: {
      type: String,
      default: "google_serper_aggregate",
    },
    topSources: {
      type: [String],
      default: [],
    },
    snippets: {
      type: [String],
      default: [],
    },
    lastFetchedAt: {
      type: Date,
      default: Date.now,
      index: true,
    },
  },
  {
    timestamps: true,
  }
);

marketBenchmarkSchema.index(
  { city: 1, locality: 1, intent: 1, propertyType: 1 },
  { unique: true }
);

const MarketBenchmark = mongoose.model("MarketBenchmark", marketBenchmarkSchema);

export default MarketBenchmark;
