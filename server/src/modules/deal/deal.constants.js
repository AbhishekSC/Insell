import { NotificationChannel } from "../../services/NotificationService.js";

export const CHANNELS = [NotificationChannel.IN_APP, NotificationChannel.REALTIME, NotificationChannel.FIREBASE];

export const STALLED_AFTER_DAYS = 7;
export const NUDGE_COOLDOWN_DAYS = 7;
export const RECENT_OFFER_CUTOFF_DAYS = 30;
export const DUPE_ATTACH_COOLDOWN_MS = 30_000;
export const DISPUTE_DEADLINE_HOURS = 48;
export const GEO_FENCE_RADIUS_METERS = 150;

export const VALID_ATTACHMENT_CATEGORIES = [
  "IDENTITY_PROOF",
  "PROPERTY_TITLE",
  "SALE_AGREEMENT",
  "PAYMENT_RECEIPT",
  "NOC_TAX_RECEIPT",
  "SITE_INSPECTION",
  "OTHER",
];

export const VALID_AMENDMENT_TYPES = ["PRICE_ADJUSTMENT", "TIMELINE_EXTENSION", "CONDITION_RESOLUTION"];

export const VALID_ADMIN_STATUSES = ["ACTIVE", "COMPLETED", "CANCELLED"];

export const DEAL_POPULATE_BUYER = "fullName profilePic";
export const DEAL_POPULATE_OWNER = "fullName profilePic";
export const DEAL_POPULATE_POST_LIST = "title mediaUrls city locality price listingType";
export const DEAL_POPULATE_POST_SUMMARY = "title description price address locality city state listingType postType mediaUrls";
export const DEAL_POPULATE_POST_VERIFY = "title address locality city propertyType listingType mediaUrls";

export const ADMIN_ATTENTION_LIMIT = 50;
export const ADMIN_LIST_MAX_LIMIT = 50;
export const ADMIN_LIST_MIN_LIMIT = 5;
export const ADMIN_LIST_DEFAULT_LIMIT = 20;
export const ADMIN_TOP_CANCEL_REASONS_LIMIT = 10;
