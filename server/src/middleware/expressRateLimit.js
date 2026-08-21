import rateLimit from "express-rate-limit";

// General, IP-based ceiling across the whole API. The app already polls
// aggressively in the background — AppShell.jsx alone runs four
// refetchInterval: 15000 queries at once, plus StoriesBar.jsx at 8000ms —
// so a single idle tab with zero clicks already generates ~350+ requests
// per 15 minutes on its own, before counting the marketplace's own polling,
// multiple tabs, or several people sharing one office/NAT IP. This is set
// with real headroom above that baseline; it's meant to catch a genuinely
// runaway client or bot, not normal usage.
export const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 2000,
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
