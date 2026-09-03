export const POST_TYPES = {
  PROPERTY_SALE: "PROPERTY_SALE",
  PROPERTY_RENT: "PROPERTY_RENT",
  REQUIREMENT_BUY: "REQUIREMENT_BUY",
  REQUIREMENT_RENT: "REQUIREMENT_RENT",
  COMMERCIAL_LISTING: "COMMERCIAL_LISTING",
  AGRICULTURAL_LISTING: "AGRICULTURAL_LISTING",
  BUILDER_PROJECT: "BUILDER_PROJECT",
  INVESTMENT_OPPORTUNITY: "INVESTMENT_OPPORTUNITY",
  OPEN_HOUSE_EVENT: "OPEN_HOUSE_EVENT",
  SERVICE_LISTING: "SERVICE_LISTING",
};

export const ROLE_POST_POLICY = {
  BUYER: [POST_TYPES.REQUIREMENT_BUY],
  TENANT: [POST_TYPES.REQUIREMENT_RENT],
  SELLER: [POST_TYPES.PROPERTY_SALE],
  LANDLORD: [POST_TYPES.PROPERTY_RENT],
  BROKER: [
    POST_TYPES.PROPERTY_SALE,
    POST_TYPES.PROPERTY_RENT,
    POST_TYPES.REQUIREMENT_BUY,
    POST_TYPES.REQUIREMENT_RENT,
    POST_TYPES.COMMERCIAL_LISTING,
    POST_TYPES.AGRICULTURAL_LISTING,
    POST_TYPES.INVESTMENT_OPPORTUNITY,
    POST_TYPES.OPEN_HOUSE_EVENT,
  ],
  BUILDER: [POST_TYPES.BUILDER_PROJECT],
  ARCHITECT: [POST_TYPES.SERVICE_LISTING],
  INTERIOR_DESIGNER: [POST_TYPES.SERVICE_LISTING],
  CONTRACTOR: [POST_TYPES.SERVICE_LISTING],
  LEGAL_CONSULTANT: [POST_TYPES.SERVICE_LISTING],
  LOAN_ADVISOR: [POST_TYPES.SERVICE_LISTING],
  MATERIAL_SUPPLIER: [POST_TYPES.SERVICE_LISTING],
};

const POST_TYPE_DEFAULTS = {
  [POST_TYPES.PROPERTY_SALE]: { listingType: "Sell", propertyType: "Apartment" },
  [POST_TYPES.PROPERTY_RENT]: { listingType: "Rent", propertyType: "Apartment" },
  [POST_TYPES.REQUIREMENT_BUY]: { listingType: "Buy", propertyType: "Apartment" },
  [POST_TYPES.REQUIREMENT_RENT]: { listingType: "Rent", propertyType: "Apartment" },
  [POST_TYPES.COMMERCIAL_LISTING]: { listingType: "Sell", propertyType: "Commercial" },
  [POST_TYPES.AGRICULTURAL_LISTING]: { listingType: "Sell", propertyType: "Agricultural Land" },
  [POST_TYPES.BUILDER_PROJECT]: { listingType: "Project", propertyType: "Apartment" },
  [POST_TYPES.INVESTMENT_OPPORTUNITY]: { listingType: "Sell", propertyType: "Commercial" },
  [POST_TYPES.OPEN_HOUSE_EVENT]: { listingType: "Event", propertyType: "Apartment" },
  [POST_TYPES.SERVICE_LISTING]: { listingType: "Service", propertyType: "Commercial" },
};

function safeUpper(value) {
  return String(value || "").trim().replace(/\s+/g, "_").toUpperCase();
}

export function normalizeRole(role) {
  return safeUpper(role);
}

export function normalizePostType(postType) {
  const value = safeUpper(postType);
  return Object.values(POST_TYPES).includes(value) ? value : "";
}

export function resolveActiveRole(user) {
  if (!user) return "";
  const firstRole = Array.isArray(user.userRoles) && user.userRoles.length ? user.userRoles[0] : "";
  return normalizeRole(user.activeRole || user.primaryRole || firstRole);
}

export function getAllowedPostTypesForRole(role) {
  const normalized = normalizeRole(role);
  return ROLE_POST_POLICY[normalized] || [POST_TYPES.PROPERTY_SALE];
}

// Post creation is not gated by role — this app only distinguishes admin vs
// user, and someone selling land, an office or their flat is all just "a
// user creating a listing". Any recognised post type is allowed for anyone;
// the role still only decides which type is pre-selected/recommended.
export function canRoleCreatePostType(role, postType) {
  return Boolean(normalizePostType(postType));
}

export function getPostTypeDefaults(postType) {
  const normalizedPostType = normalizePostType(postType);
  return POST_TYPE_DEFAULTS[normalizedPostType] || POST_TYPE_DEFAULTS[POST_TYPES.PROPERTY_SALE];
}

export function sanitizePostMeta(input) {
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    return {};
  }
  return input;
}
