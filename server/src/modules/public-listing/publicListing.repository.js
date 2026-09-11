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

// A bit more for the full logged-out detail page — still nothing sensitive
// (no exact coords, no contact number, no viewer/like/save lists).
const DETAIL_FIELDS = `${PUBLIC_FIELDS} postMeta shareCount`;

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

export async function findPublicDetailById(id) {
  return PropertyPost.findOne({ _id: id, ...SHAREABLE_FILTER })
    .select(DETAIL_FIELDS)
    .populate("author", "fullName profilePic isVerified isOwnerVerified city")
    .lean();
}

// A few other live listings genuinely comparable to this one — same city,
// same kind, similar price. Never pads with unrelated listings; shows fewer
// (or none) rather than a ₹90L flat next to a ₹15k PG.
export async function findRelatedListings(post, limit) {
  if (!post.city || !(post.price > 0)) return [];
  const base = { _id: { $ne: post._id }, ...SHAREABLE_FILTER, city: post.city, postType: post.postType };

  const tight = await PropertyPost.find({
    ...base,
    price: { $gte: post.price * 0.6, $lte: post.price * 1.6 },
  })
    .sort({ publishedAt: -1 })
    .limit(limit)
    .select(PUBLIC_FIELDS)
    .lean();
  if (tight.length >= limit) return tight;

  const wide = await PropertyPost.find({
    ...base,
    _id: { $nin: [post._id, ...tight.map((p) => p._id)] },
    price: { $gte: post.price * 0.3, $lte: post.price * 3 },
  })
    .sort({ publishedAt: -1 })
    .limit(limit - tight.length)
    .select(PUBLIC_FIELDS)
    .lean();
  return [...tight, ...wide];
}

// A small random sample of live listings for the guest landing page.
export async function samplePublicFeed(limit) {
  const rows = await PropertyPost.aggregate([
    { $match: { ...SHAREABLE_FILTER, mediaUrls: { $exists: true, $ne: [] } } },
    { $sample: { size: limit } },
    {
      $project: {
        title: 1, caption: 1, postType: 1, listingType: 1, customBadge: 1,
        propertyType: 1, city: 1, locality: 1, price: 1, bedrooms: 1,
        bathrooms: 1, areaSqft: 1, mediaUrls: 1, publishedAt: 1, createdAt: 1,
      },
    },
  ]);
  return rows;
}

export async function incrementShareCount(id) {
  return PropertyPost.updateOne(
    { _id: id, ...SHAREABLE_FILTER },
    { $inc: { shareCount: 1 } },
    { timestamps: false }
  );
}
