// Single source of truth for how the Create Post wizard and the marketplace
// card adapt to `postType`.
//
// The goal is UX: each post type should show only the handful of fields that
// actually matter for it, with everything else tucked behind an "Add more
// details" expander — instead of one giant form where a land listing still
// asks for bathrooms.
//
// IMPORTANT: this only decides WHICH fields render and how they look. It does
// NOT change the request payload shape — every field here maps to an existing
// key on the flat `draft` state in MarketplacePage, so the existing
// createPost payload builder (which nests requirement.* / project.* /
// investment.* into postMeta) keeps working untouched.
//
// Keep the post-type keys in sync with POST_TYPE_DEFINITIONS in
// MarketplacePage.jsx and POST_TYPES in server/src/utils/postPolicy.js.

export const FIELD_KIND = {
  TEXT: "text",
  NUMBER: "number",
  SELECT: "select",
  BOOLEAN: "boolean",
  DATE: "date",
};

const FURNISHING_OPTIONS = ["Furnished", "Semi-Furnished", "Unfurnished"];
const OCCUPANCY_OPTIONS = ["Single", "Double", "Shared", "Any"];
const GENDER_OPTIONS = ["Any", "Male", "Female"];
const TENANT_OPTIONS = ["Family", "Bachelors", "Students", "Any"];
const OCCUPATION_OPTIONS = ["Student", "Working Professional", "Business Owner", "Other"];
const REQUIREMENT_PROPERTY_OPTIONS = ["PG", "Room", "Flat", "Shared Flat", "Independent House", "Villa"];
const AREA_UNIT_OPTIONS = ["Acre", "Hectare", "Bigha", "Sq. Yard", "Sq. Ft"];
const SOIL_OPTIONS = ["Black Soil", "Red Soil", "Alluvial", "Sandy", "Laterite", "Other"];
const WATER_OPTIONS = ["Borewell", "Canal", "River", "Rain-fed", "None"];
const COMMERCIAL_TYPE_OPTIONS = ["Office", "Shop", "Showroom", "Warehouse", "Restaurant", "Co-working", "Other"];

// Every field the wizard can render, keyed by the `draft` state key it binds
// to. `label`/`kind`/`options` drive the input; nothing else.
export const FIELD_DEFS = {
  // --- residential / generic listing ---
  price: { label: "Price (₹)", kind: FIELD_KIND.NUMBER },
  areaSqft: { label: "Area (sq ft)", kind: FIELD_KIND.NUMBER },
  bedrooms: { label: "Bedrooms", kind: FIELD_KIND.NUMBER },
  bathrooms: { label: "Bathrooms", kind: FIELD_KIND.NUMBER },
  depositAmount: { label: "Deposit (₹)", kind: FIELD_KIND.NUMBER },
  availableFromDate: { label: "Available from", kind: FIELD_KIND.DATE },
  tenantType: { label: "Tenant preference", kind: FIELD_KIND.SELECT, options: TENANT_OPTIONS },
  furnishedPreference: { label: "Furnishing", kind: FIELD_KIND.SELECT, options: FURNISHING_OPTIONS },
  parkingRequired: { label: "Parking available", kind: FIELD_KIND.BOOLEAN },
  amenitiesText: { label: "Amenities", kind: FIELD_KIND.TEXT, placeholder: "Gym, security, power backup" },
  possessionDate: { label: "Possession date", kind: FIELD_KIND.DATE },
  loanRequired: { label: "Loan assistance available", kind: FIELD_KIND.BOOLEAN },

  // --- requirement posts ---
  budgetMin: { label: "Budget min (₹)", kind: FIELD_KIND.NUMBER },
  budgetMax: { label: "Budget max (₹)", kind: FIELD_KIND.NUMBER },
  moveInDate: { label: "Preferred move-in date", kind: FIELD_KIND.DATE },
  requirementPropertyType: { label: "Property preference", kind: FIELD_KIND.SELECT, options: REQUIREMENT_PROPERTY_OPTIONS },
  occupancyPreference: { label: "Occupancy", kind: FIELD_KIND.SELECT, options: OCCUPANCY_OPTIONS },
  genderPreference: { label: "Gender preference", kind: FIELD_KIND.SELECT, options: GENDER_OPTIONS },
  occupation: { label: "Occupation", kind: FIELD_KIND.SELECT, options: OCCUPATION_OPTIONS },

  // --- builder project ---
  projectName: { label: "Project name", kind: FIELD_KIND.TEXT },
  launchDate: { label: "Launch date", kind: FIELD_KIND.DATE },
  reraNumber: { label: "RERA number", kind: FIELD_KIND.TEXT },
  brochureUrl: { label: "Brochure URL", kind: FIELD_KIND.TEXT },

  // --- investment ---
  investmentThesis: { label: "Investment thesis", kind: FIELD_KIND.TEXT, placeholder: "Why is this a strong opportunity?" },

  // --- agricultural land (stored in postMeta via draft passthrough) ---
  landArea: { label: "Land area", kind: FIELD_KIND.NUMBER },
  landAreaUnit: { label: "Area unit", kind: FIELD_KIND.SELECT, options: AREA_UNIT_OPTIONS },
  soilType: { label: "Soil type", kind: FIELD_KIND.SELECT, options: SOIL_OPTIONS },
  waterAvailability: { label: "Water availability", kind: FIELD_KIND.SELECT, options: WATER_OPTIONS },
  roadAccess: { label: "Road access", kind: FIELD_KIND.BOOLEAN },
  electricityAvailable: { label: "Electricity available", kind: FIELD_KIND.BOOLEAN },

  // --- commercial ---
  commercialType: { label: "Commercial type", kind: FIELD_KIND.SELECT, options: COMMERCIAL_TYPE_OPTIONS },
  carpetArea: { label: "Carpet area (sq ft)", kind: FIELD_KIND.NUMBER },
  floorNumber: { label: "Floor", kind: FIELD_KIND.NUMBER },
  washrooms: { label: "Washrooms", kind: FIELD_KIND.NUMBER },
};

// Fields whose draft keys the server does NOT read at the top level — the
// createPost payload builder passes the whole `draft` through, and the
// server only picks known columns, so these land in postMeta today only if
// the payload builder is extended. For now they are captured in draft state
// and surface in the preview; wiring them into postMeta is Phase 2.
export const META_ONLY_FIELDS = new Set([
  "landArea", "landAreaUnit", "soilType", "waterAvailability", "roadAccess",
  "electricityAvailable", "commercialType", "carpetArea", "floorNumber", "washrooms",
]);

const RESIDENTIAL_LISTING_INTENTS = ["Sell", "Rent"];

// Per-type config. `essential` renders inline on the details step; `advanced`
// renders inside a collapsed "Add more details" section. `card` is the ordered
// list of fields shown as chips on the marketplace card.
export const POST_TYPE_CONFIG = {
  PROPERTY_SALE: {
    essential: ["price", "areaSqft", "bedrooms", "bathrooms"],
    advanced: ["furnishedPreference", "parkingRequired", "possessionDate", "loanRequired", "amenitiesText"],
    card: ["bedrooms", "bathrooms", "areaSqft"],
    allowedListingTypes: RESIDENTIAL_LISTING_INTENTS,
    requiresMedia: true,
  },
  PROPERTY_RENT: {
    essential: ["price", "depositAmount", "bedrooms", "bathrooms", "availableFromDate"],
    advanced: ["furnishedPreference", "tenantType", "parkingRequired", "amenitiesText"],
    card: ["bedrooms", "bathrooms", "areaSqft"],
    allowedListingTypes: ["Rent"],
    requiresMedia: true,
    priceLabel: "Monthly rent (₹)",
  },
  REQUIREMENT_BUY: {
    essential: ["budgetMin", "budgetMax", "requirementPropertyType"],
    advanced: ["possessionDate", "loanRequired", "amenitiesText"],
    card: ["requirementPropertyType"],
    allowedListingTypes: ["Buy"],
    requiresMedia: false,
  },
  REQUIREMENT_RENT: {
    essential: ["budgetMin", "budgetMax", "requirementPropertyType", "moveInDate"],
    advanced: ["furnishedPreference", "occupancyPreference", "genderPreference", "occupation", "amenitiesText"],
    card: ["requirementPropertyType", "budgetMax"],
    allowedListingTypes: ["Rent"],
    requiresMedia: false,
  },
  COMMERCIAL_LISTING: {
    essential: ["price", "commercialType", "carpetArea"],
    advanced: ["areaSqft", "floorNumber", "washrooms", "parkingRequired"],
    card: ["commercialType", "carpetArea"],
    allowedListingTypes: RESIDENTIAL_LISTING_INTENTS,
    requiresMedia: true,
  },
  AGRICULTURAL_LISTING: {
    essential: ["price", "landArea", "landAreaUnit"],
    advanced: ["soilType", "waterAvailability", "roadAccess", "electricityAvailable"],
    card: ["landArea", "landAreaUnit", "soilType"],
    allowedListingTypes: ["Sell"],
    requiresMedia: true,
  },
  BUILDER_PROJECT: {
    essential: ["projectName", "price", "launchDate"],
    advanced: ["reraNumber", "brochureUrl", "areaSqft", "bedrooms", "bathrooms"],
    card: ["projectName"],
    allowedListingTypes: ["Project"],
    requiresMedia: true,
    priceLabel: "Starting price (₹)",
  },
  INVESTMENT_OPPORTUNITY: {
    essential: ["price", "investmentThesis"],
    advanced: ["areaSqft", "possessionDate"],
    card: [],
    allowedListingTypes: ["Sell"],
    requiresMedia: true,
  },
  OPEN_HOUSE_EVENT: {
    essential: ["price", "possessionDate"],
    advanced: ["bedrooms", "bathrooms", "areaSqft"],
    card: ["bedrooms", "bathrooms"],
    allowedListingTypes: ["Event"],
    requiresMedia: true,
  },
};

const FALLBACK_CONFIG = POST_TYPE_CONFIG.PROPERTY_SALE;

export function getPostTypeConfig(postType) {
  return POST_TYPE_CONFIG[postType] || FALLBACK_CONFIG;
}

// Ordered, de-duplicated list of field descriptors for a group.
export function getFields(postType, group) {
  const config = getPostTypeConfig(postType);
  const names = config[group] || [];
  return names
    .filter((name, i) => names.indexOf(name) === i && FIELD_DEFS[name])
    .map((name) => ({ name, ...FIELD_DEFS[name] }));
}

// Chips for the marketplace card, resolved against a post's real data.
// Only returns a chip when the underlying value is actually present.
export function getCardChips(post) {
  const config = getPostTypeConfig(post?.postType);
  const chips = [];
  for (const name of config.card || []) {
    const def = FIELD_DEFS[name];
    if (!def) continue;
    const value = META_ONLY_FIELDS.has(name) ? post?.postMeta?.[name] : post?.[name];
    if (value === undefined || value === null || value === "" || value === 0 || value === false) continue;
    if (name === "bedrooms") chips.push(`${value} BHK`);
    else if (name === "bathrooms") chips.push(`${value} Baths`);
    else if (name === "areaSqft" || name === "carpetArea") chips.push(`${Number(value)} sq ft`);
    else if (name === "budgetMax") chips.push(`Up to ₹${Number(value).toLocaleString("en-IN")}`);
    else if (name === "landArea") chips.push(`${value} ${post?.postMeta?.landAreaUnit || ""}`.trim());
    else if (name === "landAreaUnit") continue; // folded into landArea
    else chips.push(String(value));
  }
  return chips;
}
