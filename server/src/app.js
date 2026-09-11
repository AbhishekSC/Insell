import express from "express";
import morgan from "morgan";
import cookieParser from "cookie-parser";
import cors from "cors";
import helmet from "helmet";
import path from "path";
import session from "express-session";

import routes from "./routes/index.js";
import { renderListingSharePage } from "./modules/public-listing/publicListing.controller.js";
import { renderProfileSharePage } from "./modules/public-profile/publicProfile.controller.js";
import { logger } from "./utils/logger.js";
import { errorHandler, notFoundHandler } from "./middlewares/errorHandler.js";
import { requestIdMiddleware } from "./middlewares/requestId.middleware.js";
import passport from "./config/googleAuth.config.js";
import Sentry, { isSentryEnabled } from "./config/sentry.config.js";

const app = express();

// CLIENT_URL is also used as-is for the Google OAuth redirect (auth.controller.js),
// so it must stay a single origin — just add it to the CORS allow-list alongside
// the local dev origins, so `npm run dev` keeps working unchanged after this is set.
const allowedOrigins = [...new Set([
  "http://localhost:5173",
  "http://localhost:5174",
  process.env.CLIENT_URL,
].filter(Boolean))];

const corsOptions = {
  origin: (origin, callback) => {
    if (!origin || allowedOrigins.includes(origin)) {
      return callback(null, true);
    }
    return callback(new Error("Not allowed by CORS"));
  },
  credentials: true,
  methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization", "X-Requested-With", "Accept", "Origin"],
  exposedHeaders: ["Authorization"],
};

// Baseline security headers (HSTS, X-Content-Type-Options, X-Frame-Options,
// hides X-Powered-By, etc). CSP and Cross-Origin-*-Policy are switched off
// rather than left at helmet's defaults: this server also renders the
// crawler-facing OG share pages (/p/:id, /u/:id — raw HTML with inline
// styles/meta refresh) and the browser loads Cloudinary/Stream assets
// cross-origin, both of which a default-strict CSP/COEP/CORP would break.
// Add a real CSP later if these routes get audited for it specifically.
app.use(
  helmet({
    contentSecurityPolicy: false,
    crossOriginEmbedderPolicy: false,
    crossOriginResourcePolicy: false,
  })
);
app.use(cors(corsOptions));
app.options("*", cors(corsOptions));
app.use(requestIdMiddleware);
app.use(express.json());
app.use(cookieParser());

// Session configuration for Passport
app.use(session({
  secret: process.env.JWT_SECRET || 'your_session_secret',
  resave: false,
  saveUninitialized: false,
  cookie: {
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
  }
}));

// Initialize Passport
app.use(passport.initialize());
app.use(passport.session());

app.use("/uploads", express.static(path.resolve(process.cwd(), "uploads")));
app.use(
  morgan("combined", {
    stream: logger.stream,
  })
);

// Lightweight liveness probe — no DB, no auth. Used by the external
// keep-alive ping (see .github/workflows/keep-alive.yml) and any uptime
// monitor.
app.get("/api/health", (req, res) => {
  res.json({ status: "ok", uptime: process.uptime(), ts: Date.now() });
});

// Public server-rendered listing share page (Open Graph unfurl). Sits
// outside /api so share links are short; Vercel proxies /p/:id here.
app.get("/p/:id", renderListingSharePage);
app.get("/u/:id", renderProfileSharePage);

app.use("/api", routes);
app.use(notFoundHandler);
if (isSentryEnabled()) {
  Sentry.setupExpressErrorHandler(app);
}
app.use(errorHandler);

export default app;
