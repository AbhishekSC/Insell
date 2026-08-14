import express from "express";
import PersonalizationService from "../services/PersonalizationService.js";
import { sendSuccessResponse, sendErrorResponse } from "../utils/responseHandler.js";
import { verifyUser, requireVerified } from "../middlewares/auth.middleware.js";

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
    console.error("Error in recommendations endpoint:", error);
    return sendErrorResponse(res, 500, "Failed to get recommendations");
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
    console.error("Error in trending locations endpoint:", error);
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
    console.error("Error in trending localities endpoint:", error);
    return sendErrorResponse(res, 500, "Failed to get trending localities");
  }
});

export default router;
