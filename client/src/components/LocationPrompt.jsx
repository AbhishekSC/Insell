import { useState } from "react";
import { MapPin, X } from "lucide-react";
import { useLiveLocation } from "../hooks/useLiveLocation";

// One-time nudge shown at the top of the feed for a signed-in user who
// hasn't shared a location yet — "turn on live location to personalize
// your feed." Dismissing it ("Not now" / ✕) remembers the choice on this
// device; the LocateFixed button in the top bar stays available to turn
// it on later. Once a real location exists the card never shows again.
const DISMISS_KEY = "nms:locationPromptDismissed";

function wasDismissed() {
  try {
    return localStorage.getItem(DISMISS_KEY) === "1";
  } catch {
    return false;
  }
}

export default function LocationPrompt() {
  const { location, freshness, status, refresh } = useLiveLocation();
  const [dismissed, setDismissed] = useState(wasDismissed);
  const [outcome, setOutcome] = useState(null); // "denied" | "unavailable" | "error" | null

  // Nothing to ask for: already have a usable fix, or the user waved it away.
  if (dismissed) return null;
  if (location?.lat && freshness !== "missing") return null;

  const remember = () => {
    try {
      localStorage.setItem(DISMISS_KEY, "1");
    } catch {
      /* private mode — fine, it'll ask again next session */
    }
  };

  const enable = async () => {
    const r = await refresh();
    if (r?.ok) {
      // Got a fix (precise GPS or coarse IP fallback) — nothing left to ask.
      remember();
      setDismissed(true);
    } else if (r?.denied) {
      setOutcome("denied");
    } else if (r?.reason === "unavailable") {
      setOutcome("unavailable");
    } else {
      setOutcome("error");
    }
  };

  const notNow = () => {
    remember();
    setDismissed(true);
  };

  return (
    <div className="mt-4 flex items-start gap-3 rounded-2xl border border-primary/20 bg-primary/5 p-4">
      <span className="grid size-9 shrink-0 place-items-center rounded-full bg-primary/12 text-primary">
        <MapPin className="size-4" />
      </span>

      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold text-base-content">See what's near you</p>
        <p className="mt-0.5 text-[13px] leading-snug text-base-content/60">
          {outcome === "denied"
            ? "Location is blocked in your browser. Allow it in site settings, then tap the location button up top."
            : outcome === "unavailable"
              ? "Turn on your phone's location (Settings → Location), then try again."
              : outcome === "error"
                ? "Couldn't get your location just now — try the location button up top."
                : "Turn on live location to personalize your feed, distances, and neighbourhood info."}
        </p>

        {outcome !== "denied" && (
          <div className="mt-2.5 flex items-center gap-3">
            <button
              type="button"
              onClick={enable}
              disabled={status === "locating"}
              className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-3 py-1.5 text-[12px] font-semibold text-primary-content transition hover:opacity-90 disabled:opacity-60"
            >
              <MapPin className="size-3.5" />
              {status === "locating" ? "Locating…" : "Enable location"}
            </button>
            <button
              type="button"
              onClick={notNow}
              className="text-[12px] font-semibold text-base-content/50 hover:text-base-content"
            >
              Not now
            </button>
          </div>
        )}
      </div>

      <button
        type="button"
        onClick={notNow}
        className="-m-1 shrink-0 rounded-lg p-1 text-base-content/35 transition hover:bg-base-200 hover:text-base-content"
        aria-label="Dismiss"
      >
        <X className="size-4" />
      </button>
    </div>
  );
}
