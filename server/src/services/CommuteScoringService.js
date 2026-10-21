/**
 * Commute-Time-Aware Scoring Service
 *
 * Real estate is fundamentally about location, but "near" is better measured
 * in *travel time* than crow-flies distance. A property 8km away across a river
 * might be a 45-minute commute while one 15km away on a straight highway is
 * 20 minutes.
 *
 * ── How it works ──────────────────────────────────────────────────────
 *
 * 1. The user sets their work location (lat/lng) via onboarding or profile
 *    settings — stored as `user.workLocation`.
 *
 * 2. For each candidate property with coordinates, we compute the driving
 *    time via the OSRM (Open Source Routing Machine) public API. No API
 *    key required, though a self-hosted instance is recommended for
 *    production volume.
 *
 * 3. Results are cached in Redis with a 7-day TTL — commute times between
 *    two fixed points don't change daily, and re-computing for every feed
 *    request would be wasteful.
 *
 * 4. The commute score is blended into the location score:
 *
 *      locationScore = 0.6 * proximityScore + 0.4 * commuteScore
 *
 *    If no work location is set, proximity is the sole signal (unchanged).
 *
 * ── Scoring ───────────────────────────────────────────────────────────
 *
 *   ≤15 min → 100     (excellent commute)
 *   ≤30 min → 85
 *   ≤45 min → 60
 *   ≤60 min → 35
 *   >60 min → 15      (long but not zero — some buyers will accept it)
 *
 * ── Fallback ──────────────────────────────────────────────────────────
 *
 * If OSRM is unavailable, we fall back to a distance-based estimate:
 *   estimatedMinutes = distanceKm * 2.5  (average city speed ~24 km/h)
 * This is less accurate but still better than ignoring commute entirely.
 */

import { redisClient } from "../config/redis.js";
import { logger } from "../utils/logger.js";

const OSRM_URL = "https://router.project-osrm.org/route/v1/driving";
const COMMUTE_CACHE_TTL = 7 * 24 * 60 * 60; // 7 days in seconds

function commuteCacheKey(workLat, workLng, propLat, propLng) {
  // Round to 4 decimal places (~11m) — repeat lookups hit the same key
  return `commute:${workLat.toFixed(4)},${workLng.toFixed(4)}:${propLat.toFixed(4)},${propLng.toFixed(4)}`;
}

/**
 * Fetch driving time (in minutes) between two points via OSRM.
 * Returns null if the API is unavailable or the route can't be computed.
 *
 * @param {number} workLat
 * @param {number} workLng
 * @param {number} propLat
 * @param {number} propLng
 * @returns {Promise<number|null>} — driving time in minutes, or null
 */
async function fetchCommuteTime(workLat, workLng, propLat, propLng) {
  const key = commuteCacheKey(workLat, workLng, propLat, propLng);

  // Check cache first
  try {
    const cached = await redisClient.get(key);
    if (cached != null) return parseInt(cached, 10);
  } catch {
    // Redis optional — proceed to API
  }

  // Call OSRM — coordinates in [lng,lat] order (GeoJSON convention)
  const url = `${OSRM_URL}/${workLng},${workLat};${propLng},${propLat}?overview=false`;

  try {
    const response = await fetch(url, { signal: AbortSignal.timeout(5000) });
    if (!response.ok) {
      logger.warn(`[COMMUTE] OSRM returned ${response.status}`);
      return null;
    }
    const data = await response.json();
    if (!data.routes || !data.routes[0]) return null;

    const durationSeconds = data.routes[0].duration;
    if (typeof durationSeconds !== "number") return null;

    const minutes = Math.round(durationSeconds / 60);

    // Cache the result
    try {
      await redisClient.set(key, String(minutes), "EX", COMMUTE_CACHE_TTL);
    } catch {
      // Cache write failure is non-fatal
    }

    return minutes;
  } catch (err) {
    logger.warn(`[COMMUTE] OSRM request failed: ${err.message}`);
    return null;
  }
}

/**
 * Estimate commute time from straight-line distance.
 * Fallback when routing API is unavailable. Uses a conservative 24 km/h
 * average city speed (accounts for traffic, signals, etc.).
 *
 * @param {number} distanceKm
 * @returns {number} — estimated minutes
 */
function estimateCommuteFromDistance(distanceKm) {
  return Math.round((distanceKm / 24) * 60);
}

/**
 * Convert commute time (minutes) to a score 0–100.
 *
 * @param {number} minutes
 * @returns {number}
 */
export function commuteTimeToScore(minutes) {
  if (minutes <= 15) return 100;
  if (minutes <= 30) return 85;
  if (minutes <= 45) return 60;
  if (minutes <= 60) return 35;
  return 15;
}

/**
 * Get the commute score for a property given the user's work location.
 *
 * @param {Object} workLocation — { latitude, longitude } from user model
 * @param {Object} property — the property being scored (needs latitude, longitude)
 * @param {number} fallbackDistanceKm — straight-line distance for fallback estimate
 * @returns {Promise<number>} — commute score 0–100, or null if not applicable
 */
export async function getCommuteScore(workLocation, property, fallbackDistanceKm = null) {
  if (
    !workLocation ||
    !workLocation.latitude ||
    !workLocation.longitude ||
    !property.latitude ||
    !property.longitude
  ) {
    return null; // Can't compute — no coordinates
  }

  let minutes = await fetchCommuteTime(
    workLocation.latitude,
    workLocation.longitude,
    property.latitude,
    property.longitude
  );

  // Fallback: estimate from distance
  if (minutes == null && fallbackDistanceKm != null) {
    minutes = estimateCommuteFromDistance(fallbackDistanceKm);
    logger.debug(`[COMMUTE] Using distance-based estimate: ${minutes} min for ${fallbackDistanceKm.toFixed(1)} km`);
  }

  if (minutes == null) return null;

  return commuteTimeToScore(minutes);
}

/**
 * Get commute info for display on property cards.
 * Returns the raw minutes + a display label for the UI.
 *
 * @param {Object} workLocation
 * @param {Object} property
 * @param {number} fallbackDistanceKm
 * @returns {Promise<Object|null>} — { minutes, label } or null
 */
export async function getCommuteInfo(workLocation, property, fallbackDistanceKm = null) {
  if (
    !workLocation ||
    !workLocation.latitude ||
    !workLocation.longitude ||
    !property.latitude ||
    !property.longitude
  ) {
    return null;
  }

  let minutes = await fetchCommuteTime(
    workLocation.latitude,
    workLocation.longitude,
    property.latitude,
    property.longitude
  );

  if (minutes == null && fallbackDistanceKm != null) {
    minutes = estimateCommuteFromDistance(fallbackDistanceKm);
  }

  if (minutes == null) return null;

  let label;
  if (minutes <= 15) label = `${minutes} min`;
  else if (minutes <= 30) label = `${minutes} min`;
  else if (minutes <= 45) label = `${minutes} min`;
  else if (minutes <= 60) label = `${minutes} min`;
  else label = `${Math.floor(minutes / 60)}h ${minutes % 60} min`;

  return { minutes, label };
}
