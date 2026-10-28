import { logger } from "../utils/logger.js";
import redisClient from "../config/redisClient.config.js";

// In-memory fallback stores
const verificationRateLimit = new Map();
const signupCodeRateLimit = new Map();
const passwordResetRateLimit = new Map();
const loginRateLimit = new Map();
const otpVerifyRateLimit = new Map();
const loginOtpRequestRateLimit = new Map();

const ONE_DAY = 24 * 60 * 60 * 1000;
const TWO_DAYS = 2 * ONE_DAY;
const COOLDOWN_MS = 60 * 1000; // 60 seconds cooldown

// Tracks every store's own window so cleanupRateLimiter can purge each one
const registeredStores = [];

/**
 * Universal rate limiter with Redis-cluster backing and in-memory fallback.
 */
function createRateLimiter(
  store,
  resolveKey,
  unauthorizedMessage,
  { prefix = "rl", windowMs = ONE_DAY, maxRequests = 3, cooldownMs = COOLDOWN_MS } = {}
) {
  registeredStores.push({ store, windowMs });

  return async function rateLimiter(req, res, next) {
    const key = resolveKey(req);
    if (!key) {
      return res.status(401).json({ success: false, message: unauthorizedMessage });
    }

    // 1. Try Redis first (atomic, multi-instance safe)
    try {
      if (redisClient.isOpen) {
        const redisKey = `ratelimit:${prefix}:${key}`;
        const count = await redisClient.incr(redisKey);
        if (count === 1) {
          await redisClient.expire(redisKey, Math.ceil(windowMs / 1000));
        }

        if (count > maxRequests) {
          const ttl = await redisClient.ttl(redisKey);
          return res.status(429).json({
            success: false,
            message: `Too many requests. Please try again later.`,
            cooldownRemaining: Math.max(1, ttl),
            remainingAttempts: 0,
          });
        }

        req.rateLimitInfo = {
          remainingAttempts: Math.max(0, maxRequests - count),
          cooldownSeconds: Math.ceil(cooldownMs / 1000),
        };
        return next();
      }
    } catch {
      // Redis not initialized or threw — fall through gracefully to in-memory store
    }

    // 2. In-memory fallback
    const now = Date.now();
    const requests = store.get(key);

    const proceed = (count, firstRequest) => {
      store.set(key, { count, firstRequest, lastRequest: now });
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
    if (cooldownMs > 0 && timeSinceLastRequest < cooldownMs) {
      const cooldownRemaining = Math.ceil((cooldownMs - timeSinceLastRequest) / 1000);
      return res.status(429).json({
        success: false,
        message: `Please wait ${cooldownRemaining} seconds before trying again.`,
        cooldownRemaining,
        remainingAttempts: maxRequests - requests.count,
      });
    }

    if (requests.count >= maxRequests) {
      const windowLabel =
        windowMs >= ONE_DAY
          ? `${Math.round(windowMs / ONE_DAY)} day(s)`
          : `${Math.ceil(windowMs / 1000 / 60)} minute(s)`;
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
 * Rate limiter for verification code sending on an already-authenticated account.
 */
export const verificationRateLimiter = createRateLimiter(
  verificationRateLimit,
  (req) => req.user?._id,
  "Unauthorized",
  { prefix: "verify_send", windowMs: ONE_DAY, maxRequests: 5, cooldownMs: COOLDOWN_MS }
);

/**
 * Keyed by email — used by public signup code resend endpoints.
 */
export const signupCodeRateLimiter = createRateLimiter(
  signupCodeRateLimit,
  (req) => String(req.body?.email || "").trim().toLowerCase(),
  "Email is required",
  { prefix: "signup_code", windowMs: ONE_DAY, maxRequests: 5, cooldownMs: COOLDOWN_MS }
);

/**
 * Password-reset OTP requests: 3 per day per email, 60s cooldown.
 */
export const passwordResetRateLimiter = createRateLimiter(
  passwordResetRateLimit,
  (req) => String(req.body?.email || "").trim().toLowerCase(),
  "Email is required",
  { prefix: "pwd_reset_req", windowMs: ONE_DAY, maxRequests: 3, cooldownMs: COOLDOWN_MS }
);

/**
 * Login rate limiter: Max 10 attempts per 15 minutes per IP/email.
 */
export const loginRateLimiter = createRateLimiter(
  loginRateLimit,
  (req) => {
    const ip = req.ip || req.headers["x-forwarded-for"] || "ip";
    const email = String(req.body?.email || "").trim().toLowerCase();
    return `${ip}:${email || "anon"}`;
  },
  "Email and password required",
  { prefix: "login", windowMs: 15 * 60 * 1000, maxRequests: 10, cooldownMs: 0 }
);

/**
 * OTP Verification rate limiter: Max 10 verification attempts per 15 minutes.
 */
export const otpVerifyRateLimiter = createRateLimiter(
  otpVerifyRateLimit,
  (req) => {
    const ip = req.ip || req.headers["x-forwarded-for"] || "ip";
    const email = String(req.body?.email || "").trim().toLowerCase();
    return `${ip}:${email || "anon"}`;
  },
  "Email and OTP code required",
  { prefix: "otp_verify", windowMs: 15 * 60 * 1000, maxRequests: 10, cooldownMs: 0 }
);

/**
 * Login OTP request rate limiter: Max 5 requests per 15 minutes per email, 60s cooldown.
 */
export const loginOtpRequestRateLimiter = createRateLimiter(
  loginOtpRequestRateLimit,
  (req) => String(req.body?.email || "").trim().toLowerCase(),
  "Email is required",
  { prefix: "login_otp_req", windowMs: 15 * 60 * 1000, maxRequests: 5, cooldownMs: COOLDOWN_MS }
);

/**
 * Clean up expired rate limit entries in memory
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
