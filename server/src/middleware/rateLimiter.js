import { logger } from "../utils/logger.js";

// Simple in-memory rate limiter (in production, use Redis)
const verificationRateLimit = new Map();
const signupCodeRateLimit = new Map();
const passwordResetRateLimit = new Map();

const ONE_DAY = 24 * 60 * 60 * 1000;
const TWO_DAYS = 2 * ONE_DAY;
const COOLDOWN_MS = 60 * 1000; // 60 seconds cooldown

// Tracks every store's own window so cleanupRateLimiter can purge each one
// correctly instead of assuming they all share the same window.
const registeredStores = [];

// Generic count-per-window / cooldown-between-requests limiter, parameterized
// by how the caller is identified (logged-in user id vs. a public email) and
// by the window/count/cooldown, so different flows (signup OTP, password
// reset) can share this logic with different limits.
function createRateLimiter(store, resolveKey, unauthorizedMessage, { windowMs = ONE_DAY, maxRequests = 3, cooldownMs = COOLDOWN_MS } = {}) {
  registeredStores.push({ store, windowMs });

  return function rateLimiter(req, res, next) {
    const key = resolveKey(req);
    if (!key) {
      return res.status(401).json({ success: false, message: unauthorizedMessage });
    }

    const now = Date.now();
    const requests = store.get(key);

    const proceed = (count, firstRequest) => {
      store.set(key, { count, firstRequest, lastRequest: now });
      // Exposed so the controller can include it in a successful response —
      // lets the client show a real countdown instead of just a static message.
      req.rateLimitInfo = {
        remainingAttempts: maxRequests - count,
        cooldownSeconds: Math.ceil(cooldownMs / 1000),
        windowResetAt: new Date(firstRequest + windowMs).toISOString(),
      };
      next();
    };

    if (!requests || now - requests.firstRequest > windowMs) {
      return proceed(1, now);
    }

    const timeSinceLastRequest = now - requests.lastRequest;
    if (timeSinceLastRequest < cooldownMs) {
      const cooldownRemaining = Math.ceil((cooldownMs - timeSinceLastRequest) / 1000);
      return res.status(429).json({
        success: false,
        message: `Please wait ${cooldownRemaining} seconds before requesting another code.`,
        cooldownRemaining,
        remainingAttempts: maxRequests - requests.count,
      });
    }

    if (requests.count >= maxRequests) {
      const windowLabel = windowMs >= ONE_DAY ? `${Math.round(windowMs / ONE_DAY)} day(s)` : `${Math.ceil(windowMs / 1000 / 60 / 60)} hour(s)`;
      const remainingMs = requests.firstRequest + windowMs - now;
      return res.status(429).json({
        success: false,
        message: `Too many requests. Please try again in ${windowLabel}.`,
        cooldownRemaining: Math.ceil(remainingMs / 1000),
        remainingAttempts: 0,
      });
    }

    proceed(requests.count + 1, requests.firstRequest);
  };
}

/**
 * Rate limiter for verification code sending on an already-authenticated
 * account. Limits to 3 requests per day per user with 60s cooldown.
 */
export const verificationRateLimiter = createRateLimiter(
  verificationRateLimit,
  (req) => req.user?._id,
  "Unauthorized"
);

/**
 * Same limits, keyed by email instead of a logged-in user — used by the
 * pre-account signup/resend-code endpoints, which are necessarily public
 * (no session exists yet).
 */
export const signupCodeRateLimiter = createRateLimiter(
  signupCodeRateLimit,
  (req) => String(req.body?.email || "").trim().toLowerCase(),
  "Email is required"
);

/**
 * Password-reset OTP requests: 2 per 2 days per email, 60s cooldown between
 * requests — tighter than signup verification since a reset email going to
 * the wrong inbox repeatedly is a bigger deal than a signup code.
 */
export const passwordResetRateLimiter = createRateLimiter(
  passwordResetRateLimit,
  (req) => String(req.body?.email || "").trim().toLowerCase(),
  "Email is required",
  { windowMs: TWO_DAYS, maxRequests: 2, cooldownMs: COOLDOWN_MS }
);

/**
 * Clean up expired rate limit entries (run periodically)
 */
export function cleanupRateLimiter() {
  const now = Date.now();

  for (const { store, windowMs } of registeredStores) {
    for (const [key, data] of store.entries()) {
      if (now - data.firstRequest > windowMs) {
        store.delete(key);
      }
    }
  }
  logger.debug("🧹 Rate limiter cleanup pass complete");
}

// Run cleanup every hour
setInterval(cleanupRateLimiter, 60 * 60 * 1000);
