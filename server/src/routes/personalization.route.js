import express from "express";
import { logger } from "../utils/logger.js";
import PersonalizationService from "../services/PersonalizationService.js";
import { sendSuccessResponse, sendErrorResponse } from "../utils/responseHandler.js";
import { verifyUser, requireVerified } from "../middlewares/auth.middleware.js";
import { rebuildEmbeddings } from "../services/CollaborativeFilteringService.js";

const router = express.Router();

/**
 * GET /personalization/recommendations
 * Get personalized property recommendations for the current user
 */
router.get("/recommendations", verifyUser, requireVerified, async (req, res) => {
  try {
    if (!req.user || !req.user._id) {
      return sendErrorResponse(res, 401, "User not authenticated");
    }
    const userId = req.user._id;
    const limit = parseInt(req.query.limit) || 20;

    const recommendations = await PersonalizationService.getPersonalizedRecommendations(userId, limit);

    return sendSuccessResponse(res, 200, "Recommendations fetched successfully", {
      recommendations,
      count: recommendations.length
    });
  } catch (error) {
    logger.error("Error in recommendations endpoint:", error);
    return sendErrorResponse(res, 500, "Failed to get recommendations");
  }
});

/**
 * POST /personalization/events
 * Batch-record recommendation impressions + interactions (incl. "dismiss",
 * which also hides that post from future recommendations).
 * body: { events: [{ post, event, position?, strategy?, context?, reason?, scores? }] }
 */
router.post("/events", verifyUser, requireVerified, async (req, res) => {
  try {
    if (!req.user?._id) return sendErrorResponse(res, 401, "User not authenticated");
    const events = Array.isArray(req.body?.events)
      ? req.body.events
      : req.body?.event
        ? [req.body]
        : [];
    const result = await PersonalizationService.recordRecoEvents(req.user._id, events);
    return sendSuccessResponse(res, 200, "Events recorded", result);
  } catch (error) {
    logger.error("Error in reco events endpoint:", error);
    return sendErrorResponse(res, 500, "Failed to record events");
  }
});

/**
 * GET /personalization/similar-connections
 * Get suggested connections for the current user
 */
router.get("/suggested-connections", verifyUser, requireVerified, async (req, res) => {
  try {
    if (!req.user || !req.user._id) {
      return sendErrorResponse(res, 401, "User not authenticated");
    }
    const userId = req.user._id;
    const limit = parseInt(req.query.limit) || 10;

    const suggestedConnections = await PersonalizationService.getSuggestedConnections(userId, limit);

    return sendSuccessResponse(res, {
      connections: suggestedConnections,
      count: suggestedConnections.length
    });
  } catch (error) {
    return sendErrorResponse(res, 500, "Failed to get suggested connections");
  }
});

/**
 * GET /personalization/similar-properties/:propertyId
 * Get similar properties based on a reference property
 */
router.get("/similar-properties/:propertyId", verifyUser, requireVerified, async (req, res) => {
  try {
    if (!req.user || !req.user._id) {
      return sendErrorResponse(res, 401, "User not authenticated");
    }
    const { propertyId } = req.params;
    const userId = req.user._id;
    const limit = parseInt(req.query.limit) || 6;

    const similarProperties = await PersonalizationService.getSimilarProperties(propertyId, userId, limit);

    return sendSuccessResponse(res, {
      similarProperties,
      count: similarProperties.length
    });
  } catch (error) {
    return sendErrorResponse(res, 500, "Failed to get similar properties");
  }
});

/**
 * GET /personalization/trending-locations
 * Get trending locations based on user location and activity
 */
router.get("/trending-locations", verifyUser, requireVerified, async (req, res) => {
  try {
    if (!req.user || !req.user._id) {
      return sendErrorResponse(res, 401, "User not authenticated");
    }
    const userId = req.user._id;
    const limit = parseInt(req.query.limit) || 5;

    const trendingLocations = await PersonalizationService.getTrendingLocations(userId, limit);

    return sendSuccessResponse(res, 200, "Trending locations fetched successfully", {
      trendingLocations,
      count: trendingLocations.length
    });
  } catch (error) {
    logger.error("Error in trending locations endpoint:", error);
    return sendErrorResponse(res, 500, "Failed to get trending locations");
  }
});

/**
 * GET /personalization/trending-localities
 * Get trending localities (granular neighborhoods/areas) based on user preferences
 */
router.get("/trending-localities", verifyUser, requireVerified, async (req, res) => {
  try {
    if (!req.user || !req.user._id) {
      return sendErrorResponse(res, 401, "User not authenticated");
    }
    const userId = req.user._id;
    const limit = parseInt(req.query.limit) || 5;

    const trendingLocalities = await PersonalizationService.getTrendingLocalities(userId, limit);

    return sendSuccessResponse(res, 200, "Trending localities fetched successfully", {
      trendingLocalities,
      count: trendingLocalities.length
    });
  } catch (error) {
    logger.error("Error in trending localities endpoint:", error);
    return sendErrorResponse(res, 500, "Failed to get trending localities");
  }
});

/**
 * GET /personalization/trending-near-you
 * Real properties trending close to the user right now — proximity +
 * engagement velocity first, personalization + freshness as tie-breakers.
 * ?lat & ?lon (optional) — a fresh GPS fix from the browser for *this*
 * request takes priority over the user's saved location; both optional,
 * falls back to their saved location / city.
 */
router.get("/trending-near-you", verifyUser, requireVerified, async (req, res) => {
  try {
    if (!req.user || !req.user._id) {
      return sendErrorResponse(res, 401, "User not authenticated");
    }
    const userId = req.user._id;
    const limit = Math.min(20, Math.max(1, parseInt(req.query.limit) || 10));
    const lat = Number(req.query.lat);
    const lon = Number(req.query.lon);

    const result = await PersonalizationService.getTrendingNearYou(userId, {
      lat: Number.isFinite(lat) ? lat : undefined,
      lon: Number.isFinite(lon) ? lon : undefined,
      limit,
    });

    return sendSuccessResponse(res, 200, "Trending near you fetched successfully", {
      properties: result.properties,
      count: result.properties.length,
      source: result.source,
    });
  } catch (error) {
    logger.error("Error in trending-near-you endpoint:", error);
    return sendErrorResponse(res, 500, "Failed to get trending properties near you");
  }
});

/**
 * POST /personalization/cf/rebuild
 * Rebuild collaborative filtering embeddings from recent engagement data.
 * Admin-only — intended to be called by a daily cron job.
 */
router.post("/cf/rebuild", verifyUser, requireVerified, async (req, res) => {
  try {
    if (!req.user?._id) return sendErrorResponse(res, 401, "User not authenticated");
    // Only admin users can trigger a rebuild
    if (req.user.activeRole !== "ADMIN" && req.user.primaryRole !== "ADMIN") {
      return sendErrorResponse(res, 403, "Admin access required");
    }
    const result = await rebuildEmbeddings();
    return sendSuccessResponse(res, 200, "CF embeddings rebuilt", result);
  } catch (error) {
    logger.error("Error rebuilding CF embeddings:", error);
    return sendErrorResponse(res, 500, "Failed to rebuild CF embeddings");
  }
});

/**
 * GET /personalization/forecast?city=...&locality=...
 * Get price appreciation forecast for a locality
 */
router.get("/forecast", async (req, res) => {
  try {
    const city = String(req.query.city || "").trim();
    const locality = String(req.query.locality || "").trim() || null;
    if (!city) {
      return sendErrorResponse(res, 400, "City parameter is required");
    }
    const { getAppreciationForecast } = await import("../services/AppreciationForecastService.js");
    const forecast = await getAppreciationForecast(city, locality);
    return sendSuccessResponse(res, 200, "Appreciation forecast fetched successfully", { forecast });
  } catch (error) {
    logger.error("Error in appreciation forecast endpoint:", error);
    return sendErrorResponse(res, 500, "Failed to get appreciation forecast");
  }
});

export default router;
