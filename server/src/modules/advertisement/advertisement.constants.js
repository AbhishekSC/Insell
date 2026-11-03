// ── Category weights for ad scoring ──────────────────────────────────
export const CATEGORY_WEIGHTS = {
  "Real Estate": 1.5,
  "Home Loans & Finance": 1.3,
  "Interiors & Services": 1.2,
  "Lifestyle & Entertainment": 0.9,
};

// ── City-match bonus added to relevance when user city matches ad target ─
export const CITY_MATCH_BONUS = 0.4;

// ── CTR quality multiplier bounds ────────────────────────────────────
export const CTR_QUALITY_MIN = 0.5;
export const CTR_QUALITY_MAX = 2.5;
export const CTR_BASELINE = 1.5;

// ── Anti-fatigue penalty per impression today ────────────────────────
export const FATIGUE_PENALTY_PER_VIEW = 0.4;

// ── Frequency cap Redis key TTL (seconds) ────────────────────────────
export const FREQ_CAP_TTL_SECONDS = 86400;

// ── Feed limits ──────────────────────────────────────────────────────
export const FEED_DB_LIMIT = 50;
export const FEED_MAX_LIMIT = 20;
export const FEED_DEFAULT_LIMIT = 10;

// ── Admin pagination ─────────────────────────────────────────────────
export const ADMIN_PAGE_MAX_LIMIT = 50;
export const ADMIN_PAGE_DEFAULT_LIMIT = 12;

// ── Frequency cap bounds ─────────────────────────────────────────────
export const FREQ_CAP_MIN = 1;
export const FREQ_CAP_MAX = 50;
export const FREQ_CAP_DEFAULT = 3;

// ── Valid enums ──────────────────────────────────────────────────────
export const VALID_INTENTS = ["All", "Buy", "Rent", "Sell"];
export const VALID_STATUSES = ["active", "paused", "draft", "expired"];

// ── Allowed update fields (admin) ────────────────────────────────────
export const ADMIN_ALLOWED_UPDATE_FIELDS = [
  "title",
  "description",
  "mediaUrl",
  "mediaType",
  "ctaText",
  "targetUrl",
  "badgeText",
  "companyName",
  "companyLogo",
  "targetCity",
  "targetIntent",
  "adCategory",
  "status",
  "frequencyCap",
  "startDate",
  "endDate",
];

// ── Coin-based ad plans ──────────────────────────────────────────────
export const AD_COIN_PLANS = [
  { durationDays: 1, coins: 200, label: "1 Day", rupeeValue: 20 },
  { durationDays: 3, coins: 500, label: "3 Days", rupeeValue: 50, popular: true },
  { durationDays: 7, coins: 1000, label: "7 Days", rupeeValue: 100 },
  { durationDays: 14, coins: 1800, label: "14 Days", rupeeValue: 180 },
  { durationDays: 30, coins: 3500, label: "30 Days", rupeeValue: 350 },
];

// ── Coin cost fallback multiplier per day ────────────────────────────
export const COIN_COST_PER_DAY_FALLBACK = 160;
export const COIN_COST_MIN = 200;

// ── Rupee conversion rate per coin ───────────────────────────────────
export const RUPEE_PER_COIN = 0.1;
