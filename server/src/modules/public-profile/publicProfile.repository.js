import mongoose from "mongoose";
import User from "../../models/User.model.js";
import PropertyPost from "../../models/PropertyPost.model.js";

const PUBLIC_USER_FIELDS = "fullName profilePic bio city isVerified isOwnerVerified activeRole primaryRole ratingAvg ratingCount friends createdAt";

const SHAREABLE_POST_FILTER = {
  status: "PUBLISHED",
  visibility: "PUBLIC",
  isDeleted: { $ne: true },
  isBlocked: { $ne: true },
};

const POST_CARD_FIELDS = "title price postType listingType city locality bedrooms bathrooms areaSqft mediaUrls createdAt";

export async function findPublicUser(id) {
  if (!mongoose.isValidObjectId(id)) return null;
  const user = await User.findOne({ _id: id, isBlocked: { $ne: true } }).select(PUBLIC_USER_FIELDS).lean();
  return user;
}

export async function listPublicPosts(authorId, limit) {
  return PropertyPost.find({ author: authorId, ...SHAREABLE_POST_FILTER })
    .sort({ publishedAt: -1, createdAt: -1 })
    .limit(limit)
    .select(POST_CARD_FIELDS)
    .lean();
}

export async function countPublicPosts(authorId) {
  return PropertyPost.countDocuments({ author: authorId, ...SHAREABLE_POST_FILTER });
}

// A few other verified members to surface at the bottom — same city first,
// then anyone verified. Never the profile owner.
export async function relatedProfiles(user, limit) {
  const base = {
    _id: { $ne: user._id },
    isVerified: true,
    isBlocked: { $ne: true },
  };
  const bySameCity = user.city
    ? await User.find({ ...base, city: user.city })
        .select("fullName profilePic city isVerified")
        .limit(limit)
        .lean()
    : [];

  if (bySameCity.length >= limit) return bySameCity;

  const fill = await User.find({
    ...base,
    _id: { $nin: [user._id, ...bySameCity.map((u) => u._id)] },
  })
    .select("fullName profilePic city isVerified")
    .limit(limit - bySameCity.length)
    .lean();

  return [...bySameCity, ...fill];
}
