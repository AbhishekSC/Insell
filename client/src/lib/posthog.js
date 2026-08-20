import posthog from "posthog-js";

const POSTHOG_KEY = import.meta.env.VITE_POSTHOG_KEY;
const POSTHOG_HOST = import.meta.env.VITE_POSTHOG_HOST || "https://us.i.posthog.com";

let initialized = false;

// No-ops safely when VITE_POSTHOG_KEY isn't set (e.g. local dev without a
// PostHog project) so analytics is opt-in per environment.
export function initPostHog() {
  if (initialized || !POSTHOG_KEY) return;

  posthog.init(POSTHOG_KEY, {
    api_host: POSTHOG_HOST,
    person_profiles: "identified_only",
    capture_pageview: false,
  });
  initialized = true;
}

export function isPostHogEnabled() {
  return initialized;
}

export default posthog;
