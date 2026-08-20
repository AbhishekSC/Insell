// Must be preloaded via `node --import ./src/instrument.js` before anything
// else (see package.json scripts) — Sentry's Express auto-instrumentation
// only attaches if Sentry.init() runs before express is ever imported.
import "dotenv/config";
import { initSentry } from "./config/sentry.config.js";

initSentry();
