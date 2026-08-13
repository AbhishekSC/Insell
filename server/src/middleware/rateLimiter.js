import { logger } from "../utils/logger.js";

// Simple in-memory rate limiter (in production, use Redis)
const verificationRateLimit = new Map();

/**
 * Rate limiter middleware for verification code sending
 * Limits to 3 requests per day per user with 60 second cooldown between requests
 */
export function verificationRateLimiter(req, res, next) {
  const userId = req.user?._id;
  if (!userId) {
    return res.status(401).json({ success: false, message: "Unauthorized" });
  }

  const now = Date.now();
  const ONE_DAY = 24 * 60 * 60 * 1000;
  const COOLDOWN_MS = 60 * 1000; // 60 seconds cooldown
  const MAX_REQUESTS = 3;

  const userRequests = verificationRateLimit.get(userId);

  if (!userRequests) {
    // First request
    verificationRateLimit.set(userId, { count: 1, firstRequest: now, lastRequest: now });
    logger.info(`📊 Rate limit initialized for user ${userId}`);
    return next();
  }

  // Check if the day has passed since first request
  if (now - userRequests.firstRequest > ONE_DAY) {
    // Reset the counter
    verificationRateLimit.set(userId, { count: 1, firstRequest: now, lastRequest: now });
    logger.info(`📊 Rate limit reset for user ${userId}`);
    return next();
  }

  // Check cooldown period
  const timeSinceLastRequest = now - userRequests.lastRequest;
  if (timeSinceLastRequest < COOLDOWN_MS) {
    const cooldownRemaining = Math.ceil((COOLDOWN_MS - timeSinceLastRequest) / 1000);
    logger.warn(`⚠️ Cooldown active for user ${userId}. ${cooldownRemaining}s remaining.`);
    return res.status(429).json({
      success: false,
      message: `Please wait ${cooldownRemaining} seconds before requesting another code.`,
      cooldownRemaining,
      remainingAttempts: MAX_REQUESTS - userRequests.count,
    });
  }

  // Check if user has exceeded the limit
  if (userRequests.count >= MAX_REQUESTS) {
    const remainingTime = Math.ceil((userRequests.firstRequest + ONE_DAY - now) / 1000 / 60 / 60);
    logger.warn(`⚠️ Rate limit exceeded for user ${userId}. ${remainingTime} hours remaining.`);
    return res.status(429).json({
      success: false,
      message: `Too many verification code requests. Please try again in ${remainingTime} hours.`,
      cooldownRemaining: remainingTime * 3600,
      remainingAttempts: 0,
    });
  }

  // Increment the counter
  userRequests.count += 1;
  userRequests.lastRequest = now;
  verificationRateLimit.set(userId, userRequests);
  logger.info(`📊 Rate limit: ${userRequests.count}/${MAX_REQUESTS} for user ${userId}`);

  next();
}

/**
 * Clean up expired rate limit entries (run periodically)
 */
export function cleanupRateLimiter() {
  const now = Date.now();
  const ONE_DAY = 24 * 60 * 60 * 1000;

  for (const [userId, data] of verificationRateLimit.entries()) {
    if (now - data.firstRequest > ONE_DAY) {
      verificationRateLimit.delete(userId);
      logger.info(`🧹 Cleaned up rate limit entry for user ${userId}`);
    }
  }
}

// Run cleanup every hour
setInterval(cleanupRateLimiter, 60 * 60 * 1000);
