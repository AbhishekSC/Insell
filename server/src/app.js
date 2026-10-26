import express from "express";
import cookieParser from "cookie-parser";
import cors from "cors";
import helmet from "helmet";
import compression from "compression";
import path from "path";
import session from "express-session";
import mongoose from "mongoose";
import redisClient from "./config/redisClient.config.js";

import routes from "./routes/index.js";
import { renderListingSharePage } from "./modules/public-listing/publicListing.controller.js";
import { renderProfileSharePage } from "./modules/public-profile/publicProfile.controller.js";
import { generateSitemapXml } from "./controllers/sitemap.controller.js";
import { logger } from "./utils/logger.js";
import { errorHandler, notFoundHandler } from "./middlewares/errorHandler.js";
import { requestIdMiddleware } from "./middlewares/requestId.middleware.js";
import { telemetryMiddleware } from "./services/telemetry.service.js";
import passport from "./config/googleAuth.config.js";
import Sentry, { isSentryEnabled } from "./config/sentry.config.js";

const app = express();

// CLIENT_URL is also used as-is for the Google OAuth redirect (auth.controller.js),
// so it must stay a single origin — just add it to the CORS allow-list alongside
// the local dev origins, so `npm run dev` keeps working unchanged after this is set.
const explicitAllowedOrigins = [
  "http://localhost:5173",
  "http://localhost:5174",
  "http://localhost:5175",
  "http://localhost:3000",
  "http://localhost:8081",
  "http://127.0.0.1:5173",
  "http://127.0.0.1:5174",
  "http://127.0.0.1:5175",
  "http://127.0.0.1:8081",
  process.env.CLIENT_URL,
  ...(process.env.ALLOWED_ORIGINS ? process.env.ALLOWED_ORIGINS.split(",") : []),
]
  .filter(Boolean)
  .map((o) => o.trim().replace(/\/$/, ""));

const allowedOriginsSet = new Set(explicitAllowedOrigins);

const isDevLocalOrigin = (origin) => {
  if (process.env.NODE_ENV === "production") return false;
  try {
    const url = new URL(origin);
    const host = url.hostname;
    return (
      host === "localhost" ||
      host === "127.0.0.1" ||
      host === "10.0.2.2" ||
      host.startsWith("192.168.") ||
      host.startsWith("10.") ||
      host.endsWith(".local")
    );
  } catch {
    return false;
  }
};

const corsOptions = {
  origin: (origin, callback) => {
    if (!origin) {
      return callback(null, true);
    }
    const cleanOrigin = origin.replace(/\/$/, "");
    if (allowedOriginsSet.has(cleanOrigin) || isDevLocalOrigin(cleanOrigin)) {
      return callback(null, true);
    }
    logger.warn(`[CORS] Blocked request from origin: ${origin}`);
    return callback(null, false);
  },
  credentials: true,
  methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization", "X-Requested-With", "Accept", "Origin"],
  exposedHeaders: ["Authorization"],
};

// Baseline security headers with safe Content Security Policy allowing Cloudinary, Stream, and Map tiles
app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'", "'unsafe-inline'", "'unsafe-eval'"],
        styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
        fontSrc: ["'self'", "https://fonts.gstatic.com", "data:"],
        imgSrc: ["'self'", "data:", "blob:", "https://res.cloudinary.com", "https://*.stream-io-cdn.com", "https://*.tile.openstreetmap.org", "https://placehold.co", "https://*.googleusercontent.com"],
        mediaSrc: ["'self'", "blob:", "https://res.cloudinary.com", "https://*.stream-io-cdn.com"],
        connectSrc: ["'self'", "https://*.stream-io-api.com", "https://res.cloudinary.com", "https://*.tile.openstreetmap.org", "https://*.sentry.io", "https://*.posthog.com"],
        frameSrc: ["'self'"],
        objectSrc: ["'none'"],
      },
    },
    crossOriginEmbedderPolicy: false,
    crossOriginResourcePolicy: false,
  })
);
app.use(cors(corsOptions));
app.options("*", cors(corsOptions));
app.use(compression({ threshold: 1024 }));
app.use(requestIdMiddleware);
app.use(telemetryMiddleware);
// Guard against stalled connections (30s standard, 60s for file uploads)
app.use((req, res, next) => {
  const isUpload = req.originalUrl?.includes("/upload") || req.originalUrl?.includes("/media");
  const timeoutMs = isUpload ? 60000 : 30000;
  req.setTimeout(timeoutMs, () => {
    if (!res.headersSent) {
      res.status(504).json({ success: false, message: "Gateway timeout: request took too long" });
    }
  });
  next();
});
app.use(express.json());
app.use(cookieParser());

// Session configuration for Passport.
// If neither SESSION_SECRET nor JWT_SECRET is configured, generate a process-local fallback secret
// and log a clear warning rather than crashing the deployment process.
let sessionSecret = process.env.SESSION_SECRET || process.env.JWT_SECRET || process.env.JWT_SECRET_KEY;
if (!sessionSecret) {
  if (process.env.NODE_ENV === "production") {
    logger.warn("SECURITY WARNING: Neither SESSION_SECRET nor JWT_SECRET is set in environment. Using fallback process secret.");
  }
  sessionSecret = "syncspace-session-secret-fallback-" + (process.env.NODE_ENV || "dev");
}

app.use(session({
  secret: sessionSecret,
  resave: false,
  saveUninitialized: false,
  cookie: {
    secure: process.env.NODE_ENV === "production",
    httpOnly: true,
    sameSite: "lax",
  }
}));

// Initialize Passport
app.use(passport.initialize());
app.use(passport.session());

app.use("/uploads", express.static(path.resolve(process.cwd(), "uploads")));

// Lightweight liveness probe — no DB, no auth. Used by the external
// keep-alive ping (see .github/workflows/keep-alive.yml) and any uptime
// monitor.
const handleLiveness = (req, res) => {
  res.json({ status: "ok", uptime: process.uptime(), ts: Date.now() });
};
app.get("/api/v1/health", handleLiveness);
app.get("/api/health", handleLiveness);
app.get("/health", handleLiveness);
app.get("/healthz", handleLiveness);

// Deep readiness probe — actively verifies Mongo connection and Redis reachability.
const handleReadiness = async (req, res) => {
  const isMongoReady = mongoose.connection.readyState === 1;
  let isRedisReady = false;
  try {
    if (redisClient && typeof redisClient.ping === "function") {
      await redisClient.ping();
      isRedisReady = true;
    }
  } catch (_) {}

  if (!isMongoReady) {
    return res.status(503).json({
      status: "not_ready",
      database: "disconnected",
      redis: isRedisReady ? "connected" : "disconnected",
    });
  }

  return res.status(200).json({
    status: "ready",
    database: "connected",
    redis: isRedisReady ? "connected" : "disconnected",
    uptime: process.uptime(),
  });
};
app.get("/api/v1/readyz", handleReadiness);
app.get("/api/readyz", handleReadiness);
app.get("/readyz", handleReadiness);

// Public server-rendered listing share page (Open Graph unfurl). Sits
// outside /api so share links are short; Vercel proxies /p/:id here.
app.get("/p/:id", renderListingSharePage);
app.get("/u/:id", renderProfileSharePage);
app.get("/sitemap.xml", generateSitemapXml);

// /api/v1 is the versioned prefix new clients (mobile) use going forward;
// the unprefixed /api mount stays aliased to the same router so the web
// client keeps working unchanged during the transition.
app.use("/api/v1", routes);
app.use("/api", routes);
app.use(notFoundHandler);
if (isSentryEnabled()) {
  Sentry.setupExpressErrorHandler(app);
}
app.use(errorHandler);

export default app;
