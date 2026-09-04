import { useEffect, useState } from "react";

const CACHE_KEY = "nearMeLocation";
const MAX_AGE_MS = 10 * 60 * 1000; // 10 minutes

function readCache() {
  try {
    const raw = sessionStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    const v = JSON.parse(raw);
    if (!v || Date.now() - v.t > MAX_AGE_MS) return null;
    return v;
  } catch {
    return null;
  }
}

// Resolves the browser's current position for the "Near Me" feed. Only asks
// once `enabled` is true (i.e. the user actually opened Near Me), caches the
// fix for 10 minutes in sessionStorage, and never blocks — if permission is
// denied or geolocation is unavailable it just returns null and the server
// falls back to the saved / city location.
//
// Returns { coords: {lat, lon, accuracy} | null, status }
export function useNearMeLocation(enabled) {
  const [state, setState] = useState(() => {
    const cached = readCache();
    return cached
      ? { coords: { lat: cached.lat, lon: cached.lon, accuracy: cached.accuracy }, status: "ready" }
      : { coords: null, status: "idle" };
  });

  useEffect(() => {
    if (!enabled || state.status === "ready" || state.status === "loading") return;
    if (!("geolocation" in navigator)) {
      setState({ coords: null, status: "unavailable" });
      return;
    }

    setState((s) => ({ ...s, status: "loading" }));
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const c = {
          lat: pos.coords.latitude,
          lon: pos.coords.longitude,
          accuracy: pos.coords.accuracy ? Math.round(pos.coords.accuracy) : undefined,
        };
        try {
          sessionStorage.setItem(CACHE_KEY, JSON.stringify({ ...c, t: Date.now() }));
        } catch {
          /* private mode — fine, just won't cache */
        }
        setState({ coords: c, status: "ready" });
      },
      (err) => {
        setState({ coords: null, status: err.code === err.PERMISSION_DENIED ? "denied" : "error" });
      },
      { enableHighAccuracy: false, timeout: 8000, maximumAge: MAX_AGE_MS }
    );
  }, [enabled, state.status]);

  return state;
}
