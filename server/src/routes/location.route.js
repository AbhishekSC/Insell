import express from "express";
import axios from "axios";
import { logger } from "../utils/logger.js";

const router = express.Router();

// Nominatim API for geocoding (OpenStreetMap)
const NOMINATIM_API_URL = "https://nominatim.openstreetmap.org/search";

// Cache for location results to reduce API calls
const locationCache = new Map();
const CACHE_TTL = 1000 * 60 * 60; // 1 hour cache

/**
 * GET /api/location/search
 * Search for locations (cities, states, localities) in India
 * Query params: q (search query), type (state, city, locality)
 */
router.get("/search", async (req, res) => {
  try {
    const { q, type = "all" } = req.query;

    if (!q || q.length < 2) {
      return res.json({
        success: true,
        data: []
      });
    }

    // Check cache first
    const cacheKey = `${q}_${type}`;
    const cached = locationCache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
      logger.debug("Returning cached location results", { query: q });
      return res.json({
        success: true,
        data: cached.data
      });
    }

    // Build query for Indian locations
    let query = `${q}, India`;
    
    // Add type-specific filters for Nominatim
    let featureType = "";
    if (type === "state") {
      featureType = "&featuretype=state";
    } else if (type === "city") {
      featureType = "&featuretype=city";
    } else if (type === "locality") {
      featureType = "&featuretype=suburb";
    }

    const params = {
      q: query,
      format: "json",
      addressdetails: 1,
      countrycodes: "in",
      limit: 10,
      featureType: featureType
    };

    logger.debug("Searching locations with Nominatim", { query, type });

    let results;
    try {
      const response = await axios.get(NOMINATIM_API_URL, {
        params,
        headers: {
          'User-Agent': 'SyncSpace-RealEstate-App'
        },
        timeout: 15000
      });
      results = response.data || [];
    } catch (apiError) {
      logger.warn("Nominatim API error", { error: apiError.message, status: apiError.response?.status });
      
      // Handle rate limiting specifically
      if (apiError.response?.status === 429) {
        return res.status(429).json({
          success: false,
          message: "Too many requests. Please wait a moment and try again.",
          error: "Rate limited by location service"
        });
      }
      
      // For other errors, return empty results
      return res.json({
        success: true,
        data: []
      });
    }

    // Process and format results
    const locations = results.map(result => {
      const address = result.address || {};
      
      // Determine the type of location
      let locationType = "locality";
      if (address.state && result.display_name.includes(address.state)) {
        locationType = "state";
      } else if (address.city || address.town || address.village) {
        locationType = "city";
      }

      return {
        name: address.city || address.town || address.village || address.suburb || address.state_district || result.display_name.split(',')[0],
        state: address.state || "",
        city: address.city || address.town || address.village || address.suburb || "",
        locality: address.suburb || address.neighbourhood || "",
        displayName: result.display_name,
        lat: parseFloat(result.lat),
        lng: parseFloat(result.lon),
        type: locationType
      };
    });

    // Cache the results
    locationCache.set(cacheKey, {
      data: locations,
      timestamp: Date.now()
    });

    logger.info(`Found ${locations.length} locations for query: ${q}`);

    return res.json({
      success: true,
      data: locations
    });

  } catch (error) {
    logger.error("Error searching locations", { error: error.message });
    
    // Handle rate limiting
    if (error.response?.status === 429) {
      return res.status(429).json({
        success: false,
        message: "Too many requests. Please wait a moment and try again.",
        error: "Rate limited by location service"
      });
    }
    
    return res.status(500).json({
      success: false,
      message: "Failed to search locations",
      error: error.message
    });
  }
});

/**
 * GET /api/location/states
 * Get all Indian states
 */
router.get("/states", async (req, res) => {
  try {
    // Return static list of Indian states
    const indianStates = [
      "Andhra Pradesh", "Arunachal Pradesh", "Assam", "Bihar", "Chhattisgarh",
      "Goa", "Gujarat", "Haryana", "Himachal Pradesh", "Jharkhand",
      "Karnataka", "Kerala", "Madhya Pradesh", "Maharashtra", "Manipur",
      "Meghalaya", "Mizoram", "Nagaland", "Odisha", "Punjab",
      "Rajasthan", "Sikkim", "Tamil Nadu", "Telangana", "Tripura",
      "Uttar Pradesh", "Uttarakhand", "West Bengal",
      "Andaman and Nicobar Islands", "Chandigarh", "Dadra and Nagar Haveli and Daman and Diu",
      "Delhi", "Jammu and Kashmir", "Ladakh", "Lakshadweep", "Puducherry"
    ];

    return res.json({
      success: true,
      data: indianStates.sort()
    });

  } catch (error) {
    logger.error("Error fetching states", { error: error.message });
    
    return res.status(500).json({
      success: false,
      message: "Failed to fetch states",
      error: error.message
    });
  }
});

export default router;
