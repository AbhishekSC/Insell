import express from "express";
import morgan from "morgan";
import cookieParser from "cookie-parser";
import cors from "cors";
import path from "path";
import session from "express-session";

import routes from "./routes/index.js";
import { logger } from "./utils/logger.js";
import { errorHandler, notFoundHandler } from "./middlewares/errorHandler.js";
import { requestIdMiddleware } from "./middlewares/requestId.middleware.js";
import passport from "./config/googleAuth.config.js";
import Sentry, { isSentryEnabled } from "./config/sentry.config.js";
import { apiLimiter } from "./middleware/expressRateLimit.js";

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

app.use("/api", apiLimiter, routes);
app.use(notFoundHandler);
if (isSentryEnabled()) {
  Sentry.setupExpressErrorHandler(app);
}
app.use(errorHandler);

export default app;
