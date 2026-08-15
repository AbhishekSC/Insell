import { logger } from "../utils/logger.js";

// Simple in-memory rate limiter (in production, use Redis)
const verificationRateLimit = new Map();
const signupCodeRateLimit = new Map();

const ONE_DAY = 24 * 60 * 60 * 1000;
const COOLDOWN_MS = 60 * 1000; // 60 seconds cooldown
const MAX_REQUESTS = 3;

// Shared 3-per-day / 60s-cooldown limiter, parameterized by how the caller
// is identified — a logged-in user's id for the authenticated verification
// flow, an email address for the public (pre-account) signup-code flow.
function createRateLimiter(store, resolveKey, unauthorizedMessage) {
  return function rateLimiter(req, res, next) {
    const key = resolveKey(req);
    if (!key) {
      return res.status(401).json({ success: false, message: unauthorizedMessage });
    }

    const now = Date.now();
    const requests = store.get(key);

    if (!requests) {
      store.set(key, { count: 1, firstRequest: now, lastRequest: now });
      return next();
    }

    if (now - requests.firstRequest > ONE_DAY) {
      store.set(key, { count: 1, firstRequest: now, lastRequest: now });
      return next();
    }

    const timeSinceLastRequest = now - requests.lastRequest;
    if (timeSinceLastRequest < COOLDOWN_MS) {
      const cooldownRemaining = Math.ceil((COOLDOWN_MS - timeSinceLastRequest) / 1000);
      return res.status(429).json({
        success: false,
        message: `Please wait ${cooldownRemaining} seconds before requesting another code.`,
        cooldownRemaining,
        remainingAttempts: MAX_REQUESTS - requests.count,
      });
    }

    if (requests.count >= MAX_REQUESTS) {
      const remainingHours = Math.ceil((requests.firstRequest + ONE_DAY - now) / 1000 / 60 / 60);
      return res.status(429).json({
        success: false,
        message: `Too many verification code requests. Please try again in ${remainingHours} hours.`,
        cooldownRemaining: remainingHours * 3600,
        remainingAttempts: 0,
      });
    }

    requests.count += 1;
    requests.lastRequest = now;
    store.set(key, requests);
    next();
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
 * Clean up expired rate limit entries (run periodically)
 */
export function cleanupRateLimiter() {
  const now = Date.now();

  for (const store of [verificationRateLimit, signupCodeRateLimit]) {
    for (const [key, data] of store.entries()) {
      if (now - data.firstRequest > ONE_DAY) {
        store.delete(key);
      }
    }
  }
  logger.debug("🧹 Rate limiter cleanup pass complete");
}

// Run cleanup every hour
setInterval(cleanupRateLimiter, 60 * 60 * 1000);
