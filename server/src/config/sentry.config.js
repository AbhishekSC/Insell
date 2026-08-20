import * as Sentry from "@sentry/node";

let initialized = false;

// No-ops safely when SENTRY_DSN isn't set (e.g. local dev without a Sentry
// project) so error tracking is opt-in per environment.
export function initSentry() {
  if (initialized || !process.env.SENTRY_DSN) return;

  Sentry.init({
    dsn: process.env.SENTRY_DSN,
    environment: process.env.NODE_ENV || "development",
    // Free-tier friendly: light trace sampling, no profiling.
    tracesSampleRate: 0.1,
  });
  initialized = true;
}

export function isSentryEnabled() {
  return initialized;
}

export default Sentry;
