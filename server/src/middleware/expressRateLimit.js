import rateLimit from "express-rate-limit";

// General, IP-based ceiling across the whole API — not meant to bother a
// real user (300 requests/15min is generous), just to stop one runaway
// client or bot from monopolizing the server's limited free-tier capacity.
export const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 300,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: "Too many requests, please try again later." },
});

// Tighter, IP-based limit on auth endpoints specifically — brute-force
// protection. This is separate from rateLimiter.js's per-email/per-user
// limiters (signupCodeRateLimiter etc.), which don't stop someone hammering
// /login with a different email on every attempt from the same IP.
export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: "Too many attempts, please try again later." },
});
