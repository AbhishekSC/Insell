import mongoose from "mongoose";
import { POST_TYPES } from "../utils/postPolicy.js";
import { PostMetaSchema } from "./postMeta.schema.js";

const postTypeValues = Object.values(POST_TYPES);
const statusValues = ["DRAFT", "PUBLISHED", "ARCHIVED"];
const visibilityValues = ["PUBLIC", "PRIVATE"];
export const BLOCK_REASON_CODES = [
  "SPAM",
  "FRAUD",
  "INAPPROPRIATE_CONTENT",
  "DUPLICATE",
  "INCORRECT_INFORMATION",
  "POLICY_VIOLATION",
  "OTHER",
];

const propertyPostSchema = new mongoose.Schema(
  {
    author: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    authorRole: {
      type: String,
      trim: true,
      default: "",
      index: true,
    },
    postType: {
      type: String,
      enum: postTypeValues,
      default: POST_TYPES.PROPERTY_SALE,
      index: true,
    },
    status: {
      type: String,
      enum: statusValues,
      default: "PUBLISHED",
      index: true,
    },
    visibility: {
      type: String,
      enum: visibilityValues,
      default: "PUBLIC",
      index: true,
    },
    publishedAt: {
      type: Date,
      default: Date.now,
      index: true,
    },
    listingType: {
      type: String,
      trim: true,
      default: "Buy",
    },
    // Overrides the auto-derived badge (e.g. "For Sale", "Looking for Rent")
    // shown on the property card — empty means fall back to that default.
    customBadge: {
      type: String,
      trim: true,
      default: "",
      maxlength: 40,
    },
    propertyType: {
      type: String,
      trim: true,
      default: "Apartment",
    },
    title: {
      type: String,
      trim: true,
      required: true,
      maxlength: 140,
    },
    caption: {
      type: String,
      trim: true,
      default: "",
      maxlength: 2000,
    },
    city: {
      type: String,
      trim: true,
      default: "",
      index: true,
    },
    locality: {
      type: String,
      trim: true,
      default: "",
    },
    latitude: {
      type: Number,
      default: null,
    },
    longitude: {
      type: Number,
      default: null,
    },
    // GeoJSON mirror of latitude/longitude, kept in sync by the pre-save hook
    // below. This is what the 2dsphere index and $geoNear query use.
    // `locationPrecision` records how the coordinates were obtained so the UI
    // can avoid showing fake precision ("~12 km" vs "12.4 km away").
    location: {
      type: { type: String, enum: ["Point"], default: undefined },
      coordinates: { type: [Number], default: undefined }, // [longitude, latitude]
    },
    locationPrecision: {
      type: String,
      enum: ["exact", "approx", null],
      default: null,
    },
    price: {
      type: Number,
      min: 0,
      default: 0,
      index: true,
    },
    // Every distinct price the post has ever had, oldest first — seeded
    // with the listing price at creation, appended to whenever price
    // actually changes on an edit. Powers the "Price History" chart on the
    // property page.
    priceHistory: [
      {
        price: { type: Number, required: true, min: 0 },
        changedAt: { type: Date, default: Date.now },
      },
    ],
    // The source of truth for "can a new offer be opened on this post" —
    // flipped to ACCEPTED inside the same transaction that accepts an
    // Offer, so a concurrent createOffer reading this field mid-transaction
    // sees either the pre- or post-accept state consistently, never a torn
    // read. Querying "does an accepted Offer document exist for this post"
    // instead would leave a race window between that query and the write.
    offerStatus: {
      type: String,
      enum: ["OPEN", "ACCEPTED"],
      default: "OPEN",
      index: true,
    },
    bedrooms: {
      type: Number,
      min: 0,
      default: 0,
    },
    bathrooms: {
      type: Number,
      min: 0,
      default: 0,
    },
    areaSqft: {
      type: Number,
      min: 0,
      default: 0,
    },
    mediaUrls: [
      {
        type: String,
        trim: true,
      },
    ],
    likedBy: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
      },
    ],
    likedByTimestamps: [
      {
        userId: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "User",
        },
        timestamp: {
          type: Date,
          default: Date.now,
        },
      },
    ],
    savedBy: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
      },
    ],
    savedByTimestamps: [
      {
        userId: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "User",
        },
        timestamp: {
          type: Date,
          default: Date.now,
        },
      },
    ],
    viewCount: {
      type: Number,
      default: 0,
      min: 0,
    },
    shareCount: {
      type: Number,
      default: 0,
      min: 0,
    },
    commentCount: {
      type: Number,
      default: 0,
      min: 0,
    },
    chatCount: {
      type: Number,
      default: 0,
      min: 0,
    },
    engagementScore: {
      type: Number,
      default: 0,
      min: 0,
    },
    postMeta: {
      type: PostMetaSchema,
      default: () => ({}),
    },
    isDeleted: {
      type: Boolean,
      default: false,
      index: true,
    },
    deletedAt: {
      type: Date,
      default: null,
    },
    deletedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
    isBlocked: {
      type: Boolean,
      default: false,
      index: true,
    },
    blockedAt: {
      type: Date,
      default: null,
    },
    blockedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
    blockReasonCode: {
      type: String,
      enum: BLOCK_REASON_CODES,
      default: null,
    },
    blockNote: {
      type: String,
      trim: true,
      default: "",
      maxlength: 1000,
    },
  },
  { timestamps: true }
);

// Keep the GeoJSON `location` in lockstep with latitude/longitude on every
// write. When both are present it's a real Point; when they're cleared the
// field is unset so it doesn't match geo queries as [0,0] off Africa.
propertyPostSchema.pre("save", function syncLocation(next) {
  if (this.isModified("latitude") || this.isModified("longitude")) {
    const lat = this.latitude;
    const lon = this.longitude;
    if (Number.isFinite(lat) && Number.isFinite(lon)) {
      this.location = { type: "Point", coordinates: [lon, lat] };
      if (!this.locationPrecision) this.locationPrecision = "exact";
    } else {
      this.location = undefined;
    }
  }
  next();
});

propertyPostSchema.index({ location: "2dsphere" });
propertyPostSchema.index({ createdAt: -1 });
// Matches the marketplace feed's base filter (getFeedPosts in
// propertyPost.controller.js: isDeleted/isBlocked excluded, sorted by
// newest) — without this, that filter+sort can't be served by a single
// index and falls back to a slower in-memory sort as the collection grows.
propertyPostSchema.index({ isDeleted: 1, isBlocked: 1, createdAt: -1 });
// Matches "my posts" / author-filtered feeds (profile pages, authorId
// query param) sorted by newest.
propertyPostSchema.index({ author: 1, isDeleted: 1, createdAt: -1 });

const PropertyPost = mongoose.model("PropertyPost", propertyPostSchema);

export default PropertyPost;
