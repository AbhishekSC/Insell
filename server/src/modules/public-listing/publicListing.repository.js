import PropertyPost from "../../models/PropertyPost.model.js";

// Only fields that are safe to expose to a logged-out visitor / link crawler.
// No coordinates, no owner contact details, no viewer/like/save lists.
const PUBLIC_FIELDS = [
  "title",
  "caption",
  "postType",
  "listingType",
  "customBadge",
  "propertyType",
  "city",
  "locality",
  "price",
  "bedrooms",
  "bathrooms",
  "areaSqft",
  "mediaUrls",
  "publishedAt",
  "createdAt",
  "viewCount",
].join(" ");

const SHAREABLE_FILTER = {
  status: "PUBLISHED",
  visibility: "PUBLIC",
  isDeleted: { $ne: true },
  isBlocked: { $ne: true },
};

export async function findShareableById(id) {
  return PropertyPost.findOne({ _id: id, ...SHAREABLE_FILTER })
    .select(PUBLIC_FIELDS)
    .populate("author", "fullName profilePic")
    .lean();
}

export async function incrementShareCount(id) {
  return PropertyPost.updateOne(
    { _id: id, ...SHAREABLE_FILTER },
    { $inc: { shareCount: 1 } },
    { timestamps: false }
  );
}
