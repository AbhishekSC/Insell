import * as Sentry from "@sentry/react";

const SENTRY_DSN = import.meta.env.VITE_SENTRY_DSN;

let initialized = false;

// No-ops safely when VITE_SENTRY_DSN isn't set (e.g. local dev without a
// Sentry project) so error tracking is opt-in per environment.
export function initSentry() {
  if (initialized || !SENTRY_DSN) return;

  Sentry.init({
    dsn: SENTRY_DSN,
    environment: import.meta.env.MODE,
    // Free-tier friendly: no session replay, light trace sampling.
    tracesSampleRate: 0.1,
  });
  initialized = true;
}

export function isSentryEnabled() {
  return initialized;
}

export default Sentry;
