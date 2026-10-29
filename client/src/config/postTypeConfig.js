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
  CHECKBOX_GRID: "checkbox_grid",
  TEXTAREA: "textarea",
  FILE: "file",
  HOUSE_RULES: "house_rules",
};

export const FURNISHING_OPTIONS = ["Fully Furnished", "Semi Furnished", "Unfurnished"];
export const OCCUPANCY_OPTIONS = ["Single", "Double", "Shared", "Any"];
export const GENDER_OPTIONS = ["Any", "Male", "Female"];
export const TENANT_OPTIONS = ["Family", "Bachelors", "Students", "Any"];
export const OCCUPATION_OPTIONS = ["Student", "Working Professional", "Business Owner", "Intern", "Other"];
export const REQUIREMENT_PROPERTY_OPTIONS = ["PG", "Room", "Flat", "Shared Flat", "Independent House", "Villa"];
export const AREA_UNIT_OPTIONS = ["Acre", "Hectare", "Bigha", "Sq. Yard", "Sq. Ft"];
export const SOIL_OPTIONS = ["Black Soil", "Red Soil", "Alluvial", "Sandy", "Laterite", "Other"];
export const WATER_OPTIONS = ["Borewell", "Canal", "River", "Rain-fed", "None"];
export const COMMERCIAL_TYPE_OPTIONS = ["Office", "Shop", "Showroom", "Warehouse", "Restaurant", "Co-working", "Other"];

export const ROOM_TYPE_OPTIONS = ["Private Room", "Shared Room", "PG Bed"];
export const TARGET_AUDIENCE_OPTIONS = ["Students", "Working Professionals", "Interns", "Any"];
export const LIFESTYLE_TAG_OPTIONS = [
  "Veg Only", "Non-Veg OK", "Non-Smoker", "Social Drinker",
  "Night Owl", "Early Riser", "Pet Friendly", "No Pets",
];
export const FLATMATE_AMENITY_OPTIONS = [
  "WiFi", "Cook Available", "Washing Machine", "AC",
  "Power Backup", "Geyser", "Gym", "Security/CCTV",
  "Covered Parking", "24x7 Water Supply",
];

export const HOUSE_RULE_SUGGESTIONS = [
  "No Smoking",
  "No Alcohol",
  "No Late Entry (after 10 PM)",
  "No Pets",
  "No Loud Music",
  "No Parties",
  "Vegetarian Only",
  "No Cooking",
  "No Overnight Guests",
];

export const AMENITY_OPTIONS = [
  "Attached Washroom",
  "Unattached Washroom",
  "Covered Parking",
  "Open Parking",
  "Gym",
  "Security/CCTV",
  "Laundry",
  "Lift",
  "Bed",
  "Mattress",
  "Wardrobe",
  "Sofa",
  "Geyser",
  "Fan & Lights",
  "Modular Kitchen",
  "Gas Stove/Chimney",
  "Water Purifier",
  "24x7 Water Supply",
  "Balcony",
  "Terrace",
  "AC",
  "WiFi",
  "Power Backup",
  "Swimming Pool",
];

export const PREFERRED_TENANT_OPTIONS = [
  "Bachelor Female",
  "Bachelor Male",
  "Students",
  "Working Professionals",
  "Govt. Employees",
  "Family",
];

export const FACING_OPTIONS = [
  "North",
  "South",
  "East",
  "West",
  "North-East",
  "North-West",
  "South-East",
  "South-West",
];

export const SPACE_TYPE_OPTIONS = [
  "Entire Flat",
  "Private Room",
  "Shared Room",
  "PG",
  "Co-living",
];

export const AGE_OPTIONS = [
  "New Construction",
  "1-3 Years",
  "3-5 Years",
  "5-10 Years",
  "10+ Years",
];

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
  furnishing: { label: "Furnishing", kind: FIELD_KIND.SELECT, options: FURNISHING_OPTIONS },
  facing: { label: "Facing", kind: FIELD_KIND.SELECT, options: FACING_OPTIONS },
  totalFloors: { label: "Total floors", kind: FIELD_KIND.NUMBER },
  ageOfProperty: { label: "Age of property", kind: FIELD_KIND.SELECT, options: AGE_OPTIONS },
  maintenanceCharges: { label: "Maintenance (₹/month)", kind: FIELD_KIND.NUMBER },
  houseRules: {
    label: "House rules",
    kind: FIELD_KIND.HOUSE_RULES,
    placeholder: "Type a rule (e.g. No smoking) and press Enter",
    suggestions: HOUSE_RULE_SUGGESTIONS,
  },
  spaceType: { label: "Space type", kind: FIELD_KIND.SELECT, options: SPACE_TYPE_OPTIONS },
  preferredTenants: { label: "Preferred tenants", kind: FIELD_KIND.CHECKBOX_GRID, options: PREFERRED_TENANT_OPTIONS },
  alternativeMobile: { label: "Alternative mobile (optional)", kind: FIELD_KIND.TEXT, placeholder: "9876543210" },
  electricityBillUrl: { label: "Electricity bill", kind: FIELD_KIND.FILE, description: "Upload bill to verify address (PDF or image)" },
  amenities: { label: "Amenities", kind: FIELD_KIND.CHECKBOX_GRID, options: AMENITY_OPTIONS },
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

  // --- flatmate ---
  roomType: { label: "Room type", kind: FIELD_KIND.SELECT, options: ROOM_TYPE_OPTIONS },
  occupancy: { label: "Sharing (persons per room)", kind: FIELD_KIND.NUMBER },
  rentPerPerson: { label: "Rent per person (₹/month)", kind: FIELD_KIND.NUMBER },
  flatmateDeposit: { label: "Deposit (₹)", kind: FIELD_KIND.NUMBER },
  availableFrom: { label: "Available from", kind: FIELD_KIND.DATE },
  flatmateFurnishing: { label: "Furnishing", kind: FIELD_KIND.SELECT, options: FURNISHING_OPTIONS },
  flatmateGender: { label: "Gender preference", kind: FIELD_KIND.SELECT, options: GENDER_OPTIONS },
  targetAudience: { label: "Who should apply?", kind: FIELD_KIND.CHECKBOX_GRID, options: TARGET_AUDIENCE_OPTIONS },
  lifestyleTags: { label: "Lifestyle & habits", kind: FIELD_KIND.CHECKBOX_GRID, options: LIFESTYLE_TAG_OPTIONS },
  amenityTags: { label: "Amenities included", kind: FIELD_KIND.CHECKBOX_GRID, options: FLATMATE_AMENITY_OPTIONS },
  collegeName: { label: "College / University", kind: FIELD_KIND.TEXT, placeholder: "e.g. PES University, Christ University" },
  workplaceName: { label: "Workplace / Company", kind: FIELD_KIND.TEXT, placeholder: "e.g. Novio, Infosys, TCS" },
  seekerBudgetMin: { label: "Budget min (₹/month)", kind: FIELD_KIND.NUMBER },
  seekerBudgetMax: { label: "Budget max (₹/month)", kind: FIELD_KIND.NUMBER },
  preferredLocalities: { label: "Preferred areas", kind: FIELD_KIND.TEXT, placeholder: "e.g. Indiranagar, Koramangala, HSR" },
  groupSize: { label: "Group size (if teaming up)", kind: FIELD_KIND.NUMBER },
  hideContact: { label: "Hide contact (message-only via connections)", kind: FIELD_KIND.BOOLEAN },

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
// the payload builder is extended.
export const META_ONLY_FIELDS = new Set([
  "landArea", "landAreaUnit", "soilType", "waterAvailability", "roadAccess",
  "electricityAvailable", "commercialType", "carpetArea", "floorNumber", "washrooms",
  "furnishing", "facing", "totalFloors", "ageOfProperty", "maintenanceCharges",
  "houseRules", "spaceType", "preferredTenants", "alternativeMobile",
  "electricityBillUrl", "amenities",
  "roomType", "occupancy", "rentPerPerson", "flatmateDeposit", "availableFrom",
  "flatmateFurnishing", "flatmateGender", "targetAudience", "lifestyleTags",
  "amenityTags", "collegeName", "workplaceName", "seekerBudgetMin", "seekerBudgetMax",
  "preferredLocalities", "groupSize",
]);

const RESIDENTIAL_LISTING_INTENTS = ["Sell", "Rent"];

// Per-type config. `essential` renders inline on the details step; `advanced`
// renders inside a collapsed "Add more details" section. `card` is the ordered
// list of fields shown as chips on the marketplace card.
export const POST_TYPE_CONFIG = {
  PROPERTY_SALE: {
    essential: ["price", "areaSqft", "bedrooms", "bathrooms"],
    advanced: [
      "spaceType",
      "furnishing",
      "facing",
      "floorNumber",
      "totalFloors",
      "ageOfProperty",
      "maintenanceCharges",
      "parkingRequired",
      "possessionDate",
      "loanRequired",
      "amenities",
      "electricityBillUrl",
      "alternativeMobile",
    ],
    card: ["bedrooms", "bathrooms", "areaSqft"],
    allowedListingTypes: RESIDENTIAL_LISTING_INTENTS,
    requiresMedia: true,
  },
  PROPERTY_RENT: {
    essential: ["price", "depositAmount", "bedrooms", "bathrooms", "availableFromDate"],
    advanced: [
      "spaceType",
      "furnishing",
      "spaceType",
      "facing",
      "floorNumber",
      "totalFloors",
      "maintenanceCharges",
      "parkingRequired",
      "amenities",
      "houseRules",
      "preferredTenants",
      "electricityBillUrl",
      "alternativeMobile",
    ],
    card: ["bedrooms", "bathrooms", "areaSqft"],
    allowedListingTypes: ["Rent"],
    requiresMedia: true,
    priceLabel: "Monthly rent (₹)",
  },
  REQUIREMENT_BUY: {
    essential: ["budgetMin", "budgetMax", "requirementPropertyType"],
    advanced: ["possessionDate", "loanRequired", "amenities"],
    card: ["requirementPropertyType"],
    allowedListingTypes: ["Buy"],
    requiresMedia: false,
  },
  REQUIREMENT_RENT: {
    essential: ["budgetMin", "budgetMax", "requirementPropertyType", "moveInDate"],
    advanced: ["furnishedPreference", "occupancyPreference", "genderPreference", "occupation", "amenities"],
    card: ["requirementPropertyType", "budgetMax"],
    allowedListingTypes: ["Rent"],
    requiresMedia: false,
  },
  COMMERCIAL_LISTING: {
    essential: ["price", "commercialType", "carpetArea"],
    advanced: [
      "areaSqft",
      "furnishing",
      "facing",
      "floorNumber",
      "washrooms",
      "maintenanceCharges",
      "parkingRequired",
      "amenities",
      "electricityBillUrl",
      "alternativeMobile",
    ],
    card: ["commercialType", "carpetArea"],
    allowedListingTypes: RESIDENTIAL_LISTING_INTENTS,
    requiresMedia: true,
  },
  AGRICULTURAL_LISTING: {
    essential: ["price", "landArea", "landAreaUnit"],
    advanced: [
      "soilType",
      "waterAvailability",
      "roadAccess",
      "electricityAvailable",
      "electricityBillUrl",
      "alternativeMobile",
    ],
    card: ["landArea", "landAreaUnit", "soilType"],
    allowedListingTypes: ["Sell"],
    requiresMedia: true,
  },
  BUILDER_PROJECT: {
    essential: ["projectName", "price", "launchDate"],
    advanced: [
      "reraNumber",
      "brochureUrl",
      "areaSqft",
      "bedrooms",
      "bathrooms",
      "facing",
      "amenities",
    ],
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
    advanced: ["bedrooms", "bathrooms", "areaSqft", "furnishing", "amenities"],
    card: ["bedrooms", "bathrooms"],
    allowedListingTypes: ["Event"],
    requiresMedia: true,
  },
  FLATMATE_OFFER: {
    essential: ["roomType", "rentPerPerson", "flatmateDeposit", "availableFrom", "flatmateGender"],
    advanced: [
      "occupancy",
      "flatmateFurnishing",
      "targetAudience",
      "lifestyleTags",
      "amenityTags",
      "collegeName",
      "workplaceName",
      "hideContact",
    ],
    card: ["roomType", "rentPerPerson"],
    allowedListingTypes: ["Rent"],
    requiresMedia: true,
    priceLabel: "Rent per person (₹/month)",
  },
  FLATMATE_SEEKING: {
    essential: ["seekerBudgetMin", "seekerBudgetMax", "moveInDate", "flatmateGender"],
    advanced: [
      "occupation",
      "lifestyleTags",
      "collegeName",
      "workplaceName",
      "groupSize",
      "hideContact",
    ],
    card: ["seekerBudgetMax"],
    allowedListingTypes: ["Rent"],
    requiresMedia: false,
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
    else if (name === "rentPerPerson") chips.push(`₹${Number(value).toLocaleString("en-IN")}/mo`);
    else if (name === "seekerBudgetMax") chips.push(`Up to ₹${Number(value).toLocaleString("en-IN")}/mo`);
    else chips.push(String(value));
  }
  return chips;
}
