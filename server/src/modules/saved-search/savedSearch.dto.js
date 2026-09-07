import AppError from "../../exceptions/AppError.js";
import { POST_TYPES } from "../../utils/postPolicy.js";

const VALID_POST_TYPES = new Set(Object.values(POST_TYPES));
const MAX_PRICE = 10_00_00_00_000;

function clean(str) {
  return String(str || "").trim();
}

function num(v) {
  const n = Number(v);
  return Number.isFinite(n) && n >= 0 ? Math.round(n) : null;
}

export function normalizeFilters(raw = {}) {
  const postType = Array.isArray(raw.postType)
    ? [...new Set(raw.postType.map(clean).filter((t) => VALID_POST_TYPES.has(t)))]
    : [];
  const filters = {
    postType,
    city: clean(raw.city),
    locality: clean(raw.locality),
    minPrice: num(raw.minPrice),
    maxPrice: num(raw.maxPrice),
    minBedrooms: num(raw.minBedrooms),
    propertyType: clean(raw.propertyType),
  };

  if (filters.minPrice && filters.minPrice > MAX_PRICE) filters.minPrice = null;
  if (filters.maxPrice && filters.maxPrice > MAX_PRICE) filters.maxPrice = null;
  if (filters.minPrice && filters.maxPrice && filters.minPrice > filters.maxPrice) {
    throw new AppError("Minimum price can't exceed the maximum", 400);
  }

  const hasAny =
    filters.postType.length ||
    filters.city ||
    filters.locality ||
    filters.minPrice ||
    filters.maxPrice ||
    filters.minBedrooms ||
    filters.propertyType;
  if (!hasAny) {
    throw new AppError("Add at least one filter to save this search", 400);
  }

  return filters;
}

// Stable key so re-saving the same search updates instead of duplicating.
export function filterKeyOf(filters) {
  return JSON.stringify({
    p: [...filters.postType].sort(),
    c: filters.city.toLowerCase(),
    l: filters.locality.toLowerCase(),
    mn: filters.minPrice || 0,
    mx: filters.maxPrice || 0,
    b: filters.minBedrooms || 0,
    t: filters.propertyType.toLowerCase(),
  });
}

const POST_TYPE_LABEL = {
  [POST_TYPES.PROPERTY_SALE]: "for sale",
  [POST_TYPES.PROPERTY_RENT]: "for rent",
  [POST_TYPES.COMMERCIAL_LISTING]: "commercial",
  [POST_TYPES.AGRICULTURAL_LISTING]: "land",
};

function money(n) {
  if (!n) return null;
  if (n >= 1_00_00_000) return `₹${(n / 1_00_00_000).toFixed(n % 1_00_00_000 ? 1 : 0)}Cr`;
  if (n >= 1_00_000) return `₹${(n / 1_00_000).toFixed(n % 1_00_000 ? 1 : 0)}L`;
  return `₹${n.toLocaleString("en-IN")}`;
}

export function describeFilters(filters) {
  const parts = [];
  if (filters.minBedrooms) parts.push(`${filters.minBedrooms}+ BHK`);
  if (filters.propertyType) parts.push(filters.propertyType);
  const kinds = filters.postType.map((t) => POST_TYPE_LABEL[t]).filter(Boolean);
  if (kinds.length) parts.push(kinds.join(" / "));
  const where = [filters.locality, filters.city].filter(Boolean).join(", ");
  if (where) parts.push(`in ${where}`);
  const lo = money(filters.minPrice);
  const hi = money(filters.maxPrice);
  if (lo && hi) parts.push(`${lo}–${hi}`);
  else if (hi) parts.push(`under ${hi}`);
  else if (lo) parts.push(`above ${lo}`);
  return parts.join(" · ") || "All new listings";
}

export function toDTO(doc) {
  if (!doc) return null;
  return {
    id: String(doc._id),
    label: doc.label || describeFilters(doc.filters),
    filters: doc.filters,
    active: doc.active !== false,
    matchCount: doc.matchCount || 0,
    lastMatchAt: doc.lastMatchAt || null,
    createdAt: doc.createdAt || null,
  };
}
