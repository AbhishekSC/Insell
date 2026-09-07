import { POST_TYPES } from "../../utils/postPolicy.js";

// Public site origin — where /p/:id share links live. Falls back to the
// configured client URL, then the production domain.
const SITE_ORIGIN = (process.env.CLIENT_URL || "https://insell-fe.vercel.app").replace(/\/$/, "");

const RENT_TYPES = new Set([POST_TYPES.PROPERTY_RENT, POST_TYPES.REQUIREMENT_RENT]);

function formatInr(value) {
  const n = Number(value) || 0;
  if (n <= 0) return null;
  if (n >= 1_00_00_000) return `₹${(n / 1_00_00_000).toFixed(n % 1_00_00_000 === 0 ? 0 : 2)} Cr`;
  if (n >= 1_00_000) return `₹${(n / 1_00_000).toFixed(n % 1_00_000 === 0 ? 0 : 2)} L`;
  return `₹${n.toLocaleString("en-IN")}`;
}

function priceLabel(post) {
  const formatted = formatInr(post.price);
  if (!formatted) return "Price on request";
  return RENT_TYPES.has(post.postType) ? `${formatted}/mo` : formatted;
}

function locationLabel(post) {
  return [post.locality, post.city].filter(Boolean).join(", ");
}

// "2 BHK · 1,150 sqft · Apartment" — whichever parts we have.
function specsLabel(post) {
  const parts = [];
  if (post.bedrooms > 0) parts.push(`${post.bedrooms} BHK`);
  if (post.bathrooms > 0) parts.push(`${post.bathrooms} bath`);
  if (post.areaSqft > 0) parts.push(`${Number(post.areaSqft).toLocaleString("en-IN")} sqft`);
  if (post.propertyType) parts.push(post.propertyType);
  return parts.join(" · ");
}

export function toSharePreviewDTO(post) {
  const id = String(post._id);
  const price = priceLabel(post);
  const where = locationLabel(post);
  const specs = specsLabel(post);

  const title = where ? `${post.title} — ${where}` : post.title;
  const description = [price, specs, post.caption].filter(Boolean).join(" · ").slice(0, 200);
  const images = Array.isArray(post.mediaUrls) ? post.mediaUrls.filter(Boolean) : [];

  return {
    id,
    title: post.title,
    ogTitle: `${price} · ${title}`,
    description,
    priceLabel: price,
    locationLabel: where,
    specsLabel: specs,
    badge: post.customBadge || post.listingType || "",
    coverImage: images[0] || null,
    images: images.slice(0, 6),
    author: post.author
      ? { name: post.author.fullName || "Owner", avatar: post.author.profilePic || null }
      : null,
    publishedAt: post.publishedAt || post.createdAt || null,
    canonicalUrl: `${SITE_ORIGIN}/p/${id}`,
    appUrl: `${SITE_ORIGIN}/property/${id}`,
  };
}
