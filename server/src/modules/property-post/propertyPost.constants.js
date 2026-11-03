export const PROPERTY_MEDIA_FOLDER = "property-media";
export const PROPERTY_MEDIA_ALLOWED_FORMATS = "jpg,jpeg,png,webp,gif,mp4,webm,mov,pdf,heic,heif,jfif";

export const POST_STATUSES = ["DRAFT", "PUBLISHED", "ARCHIVED"];
export const POST_VISIBILITIES = ["PUBLIC", "PRIVATE"];

export const PRICE_DROP_MIN_PCT = 0.02;
export const PRICE_DROP_MIN_ABS = 50_000;
export const PRICE_DROP_COOLDOWN_MS = 12 * 60 * 60 * 1000;

export const PRICE_INSIGHT_MIN_SAMPLE = 4;
export const PSF_BOUNDS = {
  buy: { min: 300, max: 500000 },
  rent: { min: 3, max: 2000 },
};

export const NEAR_ME_MAX_METERS = 100_000;
export const NEAR_ME_BANDS_KM = [5, 15, 30, 50, 100];
export const SAVED_LOCATION_MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000;

export const MAP_PINS_PROJECTION = "_id title price latitude longitude city locality area listingType propertyType postType bedrooms bathrooms mediaUrls postMeta.flatmate.genderPreference postMeta.flatmate.rentPerPerson";
export const MAP_PINS_CACHE_KEY = "property:map-pins";
export const MAP_PINS_CACHE_TTL = 120;

export const COMPARISON_WEIGHT_CONFIGS = {
  balanced: { price: 0.25, area: 0.20, bedrooms: 0.15, bathrooms: 0.15, engagement: 0.15, recency: 0.10 },
  price: { price: 0.50, area: 0.10, bedrooms: 0.08, bathrooms: 0.08, engagement: 0.12, recency: 0.12 },
  area: { price: 0.15, area: 0.40, bedrooms: 0.15, bathrooms: 0.15, engagement: 0.10, recency: 0.05 },
  amenities: { price: 0.15, area: 0.15, bedrooms: 0.20, bathrooms: 0.20, engagement: 0.20, recency: 0.10 },
  location: { price: 0.20, area: 0.15, bedrooms: 0.10, bathrooms: 0.10, engagement: 0.25, recency: 0.20 },
  popularity: { price: 0.10, area: 0.10, bedrooms: 0.10, bathrooms: 0.10, engagement: 0.50, recency: 0.10 },
};

export const AUTHOR_POPULATE_FIELDS = "fullName profilePic activeRole primaryRole city isVerified isOwnerVerified ratingAvg ratingCount responseRate";
export const AUTHOR_DETAIL_POPULATE_FIELDS = "fullName profilePic activeRole primaryRole city isVerified isOwnerVerified mobileNumber friends lastActiveAt responseRate ratingAvg ratingCount";
