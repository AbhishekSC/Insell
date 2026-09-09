import { useCallback, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import axiosInstance from "../lib/axios";
import { reverseGeocode, ipLocate } from "../utils/geolocation";

const FRESH_MS = 60 * 60 * 1000; // 1 hour
const STALE_MS = 30 * 24 * 60 * 60 * 1000; // 30 days

// Single interface to the user's location across the app.
//
//   - `location` is the LAST KNOWN, user-approved location, read straight
//     from user.locationDetails (the server is the source of truth).
//   - `freshness` is "fresh" | "stale" | "missing", derived from capturedAt.
//   - `refresh()` captures a fresh GPS fix, reverse-geocodes it, persists it
//     via the one write endpoint (PATCH /users/location), then updates the
//     authUser cache from the server's response and invalidates every
//     location-dependent query.
//
// No feature should call navigator.geolocation or PATCH /users/location
// directly — they all go through this.
export function useLiveLocation() {
  const queryClient = useQueryClient();
  const [status, setStatus] = useState("idle"); // idle | locating | denied | error
  const [permission, setPermission] = useState(null); // "granted" | "prompt" | "denied" | null

  const { data: authData } = useQuery({
    queryKey: ["authUser"],
    queryFn: async () => {
      const res = await axiosInstance.get("/auth/verify", { skipErrorToast: true });
      return res.data;
    },
    staleTime: 1000 * 60 * 5,
    retry: false,
  });
  const authUser = authData?.data?.user || authData?.data || null;
  const ld = authUser?.locationDetails || null;

  const location = useMemo(() => {
    if (!ld || !Number.isFinite(ld.latitude) || !Number.isFinite(ld.longitude)) {
      return ld?.city ? { city: ld.city, state: ld.state, lat: null, lon: null } : null;
    }
    return {
      lat: ld.latitude,
      lon: ld.longitude,
      city: ld.city || "",
      state: ld.state || "",
      accuracyMeters: ld.accuracyMeters,
      source: ld.source || null,
      capturedAt: ld.capturedAt || null,
    };
  }, [ld]);

  const freshness = useMemo(() => {
    if (!location?.lat) return "missing";
    const t = location.capturedAt ? new Date(location.capturedAt).getTime() : 0;
    if (!t) return "stale";
    const age = Date.now() - t;
    if (age <= FRESH_MS) return "fresh";
    if (age <= STALE_MS) return "stale";
    return "missing";
  }, [location]);

  // Best-effort read of the permission state (not supported everywhere).
  const checkPermission = useCallback(async () => {
    try {
      if (!navigator.permissions?.query) return null;
      const p = await navigator.permissions.query({ name: "geolocation" });
      setPermission(p.state);
      return p.state;
    } catch {
      return null;
    }
  }, []);

  const getPosition = () =>
    new Promise((resolve, reject) => {
      if (!("geolocation" in navigator)) {
        reject(Object.assign(new Error("unsupported"), { code: 0 }));
        return;
      }
      navigator.geolocation.getCurrentPosition(
        (pos) => resolve(pos),
        (err) => reject(err),
        { enableHighAccuracy: false, timeout: 10000, maximumAge: FRESH_MS }
      );
    });

  // Persist a resolved location and refresh everything that depends on it.
  const persist = useCallback(
    async ({ lat, lon, accuracyMeters, source, geo = {} }) => {
      const res = await axiosInstance.patch("/users/location", {
        latitude: lat,
        longitude: lon,
        accuracyMeters,
        source,
        city: geo.city || undefined,
        state: geo.state || undefined,
        country: geo.country || undefined,
        countryCode: geo.countryCode || undefined,
        address: geo.address || undefined,
        formattedAddress: geo.formattedAddress || undefined,
      });
      const savedUser = res.data?.data?.user;
      if (savedUser) {
        queryClient.setQueryData(["authUser"], (prev) => {
          const prevUser = prev?.data?.user || prev?.data || {};
          return { status: "success", data: { user: { ...prevUser, ...savedUser } } };
        });
      }
      queryClient.invalidateQueries({ queryKey: ["propertyFeed"] });
      queryClient.invalidateQueries({ queryKey: ["propertyFeedLatest"] });
      queryClient.invalidateQueries({ queryKey: ["cityWeather"] });
      queryClient.invalidateQueries({ queryKey: ["propertyNews"] });
    },
    [queryClient]
  );

  const refresh = useCallback(async () => {
    setStatus("locating");
    let pos;
    try {
      pos = await getPosition();
    } catch (err) {
      // code 1 = PERMISSION_DENIED, 2 = POSITION_UNAVAILABLE (OS location
      // off / no signal), 3 = TIMEOUT, 0 = API not available.
      const code = err?.code;
      const denied = code === 1;
      const reason = denied ? "denied" : code === 2 ? "unavailable" : code === 3 ? "timeout" : "unsupported";

      if (denied) {
        setStatus("denied");
        setPermission("denied");
        return { ok: false, denied: true, reason };
      }

      // Not a denial — fall back to coarse IP-based location so the feed
      // still gets *something* (in-app browsers, OS location off, timeouts).
      const ip = await ipLocate();
      if (ip) {
        try {
          await persist({ lat: ip.lat, lon: ip.lon, accuracyMeters: 25000, source: "ip", geo: ip });
          setStatus("idle");
          return { ok: true, approximate: true, city: ip.city, lat: ip.lat, lon: ip.lon };
        } catch {
          /* fall through to the error return */
        }
      }
      setStatus("error");
      return { ok: false, denied: false, reason };
    }

    const lat = pos.coords.latitude;
    const lon = pos.coords.longitude;
    const accuracyMeters = pos.coords.accuracy ? Math.round(pos.coords.accuracy) : undefined;

    let geo = {};
    try {
      geo = await reverseGeocode(lat, lon);
    } catch {
      /* coords still useful without a city name */
    }

    try {
      await persist({ lat, lon, accuracyMeters, source: "gps", geo });
      setStatus("idle");
      setPermission("granted");
      return { ok: true, city: geo.city, lat, lon, accuracyMeters };
    } catch {
      setStatus("error");
      return { ok: false, denied: false, reason: "save-failed" };
    }
  }, [persist]);

  return { location, freshness, status, permission, refresh, checkPermission };
}
