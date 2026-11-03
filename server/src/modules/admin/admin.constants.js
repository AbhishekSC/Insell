// Roles treated as "verified" — same rule the marketplace's Verified filter
// already uses (there's no dedicated verified-broker flag yet, just role).
export const VERIFIED_ROLES = ["Broker", "Seller", "Landlord"];

export const ADMIN_POST_FIELDS =
  "title price city listingType propertyType mediaUrls author status isDeleted isBlocked blockedAt blockedBy blockReasonCode blockNote createdAt";

export const ADMIN_USER_FIELDS =
  "fullName email mobileNumber city location primaryRole activeRole isVerified isOwnerVerified isAdmin isBlocked blockedAt createdAt profilePic ratingAvg ratingCount friends";

export const LIVE_USERS_WINDOW_MINUTES = 5;

export const ANNOUNCEMENT_MAX_LENGTH = 240;

export const COIN_AMOUNT_MAX = 10000;
