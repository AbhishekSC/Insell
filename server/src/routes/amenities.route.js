import express from "express";
import axios from "axios";
import { logger } from "../utils/logger.js";

const router = express.Router();

const GEOAPIFY_PLACES_URL = "https://api.geoapify.com/v2/places";

// The same property gets reopened repeatedly, so cache successful lookups
// briefly to stay comfortably inside Geoapify's free-tier daily quota.
const CACHE_TTL_MS = 15 * 60 * 1000;
const amenitiesCache = new Map();

function getCacheKey(lat, lng, radius, types) {
  // Round to ~11m precision — repeat clicks on the same marker land on the same key.
  return `${lat.toFixed(4)}:${lng.toFixed(4)}:${radius}:${[...types].sort().join(",")}`;
}

function pruneExpiredCacheEntries() {
  if (amenitiesCache.size < 500) return;
  const now = Date.now();
  for (const [key, entry] of amenitiesCache) {
    if (now - entry.cachedAt >= CACHE_TTL_MS) {
      amenitiesCache.delete(key);
    }
  }
}

// Amenity types mapped to Geoapify Places categories
// https://apidocs.geoapify.com/docs/places/#categories
const AMENITY_TYPES = {
  schools: {
    categories: ["education.school", "education.college", "education.university"],
    label: "Schools",
  },
  hospitals: {
    categories: ["healthcare.hospital", "healthcare.clinic_or_praxis", "healthcare.pharmacy"],
    label: "Hospitals",
  },
  metro: {
    categories: ["public_transport.subway", "public_transport.train", "public_transport.tram"],
    label: "Metro Stations",
  },
  malls: {
    categories: ["commercial.shopping_mall"],
    label: "Malls",
  },
};

// A network/API failure vs. a genuine zero-results search need different handling
// upstream (only the latter should trigger widening the radius), so failures throw.
class AmenitiesFetchError extends Error {}

async function fetchAmenitiesForRadius(latitude, longitude, radius, amenityTypesToSearch, apiKey) {
  const cacheKey = getCacheKey(latitude, longitude, radius, amenityTypesToSearch);
  const cached = amenitiesCache.get(cacheKey);
  if (cached && Date.now() - cached.cachedAt < CACHE_TTL_MS) {
    return { amenities: cached.data, cached: true };
  }

  // Geoapify rejects more than one category per request on this plan (a
  // request with two comma-separated categories 400s even when each one
  // works fine alone), so each category gets its own request; run them in
  // parallel and merge the results.
  const categoryToType = new Map();
  amenityTypesToSearch.forEach((type) => {
    AMENITY_TYPES[type].categories.forEach((category) => {
      categoryToType.set(category, type);
    });
  });

  let results;
  try {
    results = await Promise.all(
      Array.from(categoryToType.entries()).map(async ([category, amenityType]) => {
        const response = await axios.get(GEOAPIFY_PLACES_URL, {
          params: {
            categories: category,
            filter: `circle:${longitude},${latitude},${radius}`,
            bias: `proximity:${longitude},${latitude}`,
            limit: 20,
            apiKey,
          },
          timeout: 10000,
        });
        return { amenityType, features: response.data?.features || [] };
      })
    );
  } catch (apiError) {
    logger.error("Geoapify Places request failed", {
      message: apiError.message,
      status: apiError.response?.status,
      data: apiError.response?.data,
    });
    throw new AmenitiesFetchError(apiError.message);
  }

  const amenities = [];
  const seenIds = new Set();

  results.forEach(({ amenityType, features }) => {
    features.forEach((feature) => {
      const props = feature.properties || {};
      const [lon, featureLat] = feature.geometry?.coordinates || [];
      if (featureLat == null || lon == null) return;

      const id = props.place_id || `${amenityType}-${featureLat}-${lon}`;
      if (seenIds.has(id)) return;
      seenIds.add(id);

      const distance =
        typeof props.distance === "number" ? props.distance : calculateDistance(latitude, longitude, featureLat, lon);

      amenities.push({
        id,
        name: props.name || props.address_line1 || `${AMENITY_TYPES[amenityType].label} nearby`,
        type: amenityType,
        lat: featureLat,
        lng: lon,
        distance: Math.round(distance),
        tags: props,
      });
    });
  });

  amenities.sort((a, b) => a.distance - b.distance);
  const limitedAmenities = amenities.slice(0, 50);

  amenitiesCache.set(cacheKey, { data: limitedAmenities, cachedAt: Date.now() });
  pruneExpiredCacheEntries();

  return { amenities: limitedAmenities, cached: false };
}

/**
 * GET /api/amenities/nearby
 * Fetch real nearby amenities from Geoapify Places (OSM-backed).
 * If nothing real is found within the requested radius, widens the search up
 * to 5km before giving up — useful for rural/sparse properties.
 * Query params: lat, lng, radius (in meters), types (comma-separated)
 */
router.get("/nearby", async (req, res) => {
  try {
    const { lat, lng, radius = 2000, types } = req.query;

    if (!lat || !lng) {
      return res.status(400).json({
        success: false,
        message: "Latitude and longitude are required",
      });
    }

    const apiKey = process.env.GEOAPIFY_API_KEY;
    if (!apiKey) {
      logger.error("GEOAPIFY_API_KEY is not configured");
      return res.status(503).json({
        success: false,
        message: "Amenities service is not configured",
      });
    }

    const latitude = parseFloat(lat);
    const longitude = parseFloat(lng);
    const requestedRadius = parseInt(radius);
    const MAX_RADIUS = 5000;

    const amenityTypesToSearch = types
      ? types.split(",").filter((t) => AMENITY_TYPES[t])
      : Object.keys(AMENITY_TYPES);

    if (amenityTypesToSearch.length === 0) {
      return res.json({ success: true, data: [], count: 0, radius: requestedRadius });
    }

    let searchedRadius = requestedRadius;
    let amenities;
    let source;

    try {
      const first = await fetchAmenitiesForRadius(latitude, longitude, requestedRadius, amenityTypesToSearch, apiKey);
      amenities = first.amenities;
      source = first.cached ? "geoapify-cache" : "geoapify";

      if (amenities.length === 0 && requestedRadius < MAX_RADIUS) {
        logger.info(`No amenities within ${requestedRadius}m, widening to ${MAX_RADIUS}m`, { lat, lng });
        searchedRadius = MAX_RADIUS;
        const widened = await fetchAmenitiesForRadius(latitude, longitude, MAX_RADIUS, amenityTypesToSearch, apiKey);
        amenities = widened.amenities;
        source = widened.cached ? "geoapify-cache" : "geoapify";
      }
    } catch (error) {
      if (error instanceof AmenitiesFetchError) {
        return res.status(503).json({
          success: false,
          message: "Unable to fetch nearby amenities right now. Please try again shortly.",
        });
      }
      throw error;
    }

    logger.info(`Returning ${amenities.length} amenities within ${searchedRadius}m`, { lat, lng });

    return res.json({
      success: true,
      data: amenities,
      count: amenities.length,
      radius: searchedRadius,
      source,
    });
  } catch (error) {
    logger.error("Error fetching nearby amenities", { message: error.message, stack: error.stack });

    return res.status(500).json({
      success: false,
      message: "Failed to fetch nearby amenities",
    });
  }
});

/**
 * Calculate distance between two coordinates using Haversine formula
 */
function calculateDistance(lat1, lon1, lat2, lon2) {
  const R = 6371; // Earth's radius in km
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c * 1000; // Distance in meters
}

export default router;
