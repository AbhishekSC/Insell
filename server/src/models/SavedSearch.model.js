import mongoose from "mongoose";

// A buyer's standing search. When a newly published listing matches the
// filters, the owner of the search gets notified. Distinct from PriceAlert
// (which watches one specific listing) — this watches for *new* inventory.
const filtersSchema = new mongoose.Schema(
  {
    postType: { type: [String], default: [] }, // e.g. ["PROPERTY_SALE","PROPERTY_RENT"]
    city: { type: String, default: "" },
    locality: { type: String, default: "" },
    minPrice: { type: Number, default: null },
    maxPrice: { type: Number, default: null },
    minBedrooms: { type: Number, default: null },
    propertyType: { type: String, default: "" },
  },
  { _id: false }
);

const savedSearchSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    label: { type: String, default: "", trim: true, maxlength: 120 },
    filters: { type: filtersSchema, default: () => ({}) },
    // Normalised JSON of `filters` — one saved search per user per filter set.
    filterKey: { type: String, required: true },
    active: { type: Boolean, default: true },
    lastNotifiedAt: { type: Date, default: null },
    lastMatchAt: { type: Date, default: null },
    matchCount: { type: Number, default: 0 },
  },
  { timestamps: true }
);

savedSearchSchema.index({ user: 1, filterKey: 1 }, { unique: true });
savedSearchSchema.index({ active: 1, "filters.city": 1 });

const SavedSearch = mongoose.model("SavedSearch", savedSearchSchema);

export default SavedSearch;
