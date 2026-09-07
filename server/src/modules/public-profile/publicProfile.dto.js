import { POST_TYPES } from "../../utils/postPolicy.js";

const SITE_ORIGIN = (process.env.CLIENT_URL || "https://insell-fe.vercel.app").replace(/\/$/, "");
const RENT_TYPES = new Set([POST_TYPES.PROPERTY_RENT, POST_TYPES.REQUIREMENT_RENT]);

function formatInr(value) {
  const n = Number(value) || 0;
  if (n <= 0) return null;
  if (n >= 1_00_00_000) return `₹${(n / 1_00_00_000).toFixed(n % 1_00_00_000 ? 2 : 0)} Cr`;
  if (n >= 1_00_000) return `₹${(n / 1_00_000).toFixed(n % 1_00_000 ? 2 : 0)} L`;
  return `₹${n.toLocaleString("en-IN")}`;
}

const isVideo = (url) => /\/video\/upload\/|\.(mp4|mov|webm|m4v)(\?|$)/i.test(url);

export function toPublicPostCardDTO(post) {
  const media = Array.isArray(post.mediaUrls) ? post.mediaUrls.filter(Boolean) : [];
  const images = [...media.filter((u) => !isVideo(u)), ...media.filter(isVideo)];
  const price = formatInr(post.price);
  return {
    id: String(post._id),
    title: post.title,
    priceLabel: price
      ? RENT_TYPES.has(post.postType)
        ? `${price}/mo`
        : price
      : "Price on request",
    location: [post.locality, post.city].filter(Boolean).join(", "),
    coverImage: images[0] || null,
    imageCount: images.length,
  };
}

export function toRelatedProfileDTO(u) {
  return {
    id: String(u._id),
    name: u.fullName || "Member",
    avatar: u.profilePic || null,
    city: u.city || "",
    isVerified: Boolean(u.isVerified),
  };
}

export function toPublicProfileDTO(user, { postsCount, previewPosts, related }) {
  const id = String(user._id);
  return {
    id,
    name: user.fullName || "Member",
    avatar: user.profilePic || null,
    bio: user.bio || "",
    city: user.city || "",
    isVerified: Boolean(user.isVerified),
    rating: user.ratingCount > 0 ? { avg: Math.round(user.ratingAvg * 10) / 10, count: user.ratingCount } : null,
    connectionsCount: Array.isArray(user.friends) ? user.friends.length : 0,
    postsCount,
    memberSince: user.createdAt || null,
    previewPosts: previewPosts.map(toPublicPostCardDTO),
    hasMorePosts: postsCount > previewPosts.length,
    related: related.map(toRelatedProfileDTO),
    canonicalUrl: `${SITE_ORIGIN}/users/${id}`,
  };
}
