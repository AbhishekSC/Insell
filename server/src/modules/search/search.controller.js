import { logger } from "../../utils/logger.js";
import * as searchService from "./search.service.js";

/**
 * Search autocomplete endpoint
 * Returns suggestions for cities, localities, and property types
 */
export async function getSearchSuggestions(req, res) {
  try {
    const { query } = req.query;

    const data = await searchService.getSearchSuggestions(query);

    res.status(200).json({ success: true, data });
  } catch (error) {
    logger.error("Error getting search suggestions:", error);
    res.status(500).json({
      success: false,
      message: "Failed to get search suggestions",
    });
  }
}

/**
 * Save search query to user's search history
 */
export async function saveSearchHistory(req, res) {
  try {
    const userId = req.user?._id;
    const { query, resultCount = 0 } = req.body;

    if (!userId || !query) {
      return res.status(400).json({
        success: false,
        message: "User ID and query are required",
      });
    }

    const result = await searchService.saveSearchHistory({ userId, query, resultCount });

    if (result?.error) {
      return res.status(result.error.status).json({
        success: false,
        message: result.error.message,
      });
    }

    res.status(200).json({
      success: true,
      message: "Search history saved",
    });
  } catch (error) {
    logger.error("Error saving search history:", error);
    res.status(500).json({
      success: false,
      message: "Failed to save search history",
    });
  }
}

/**
 * Get user's search history
 */
export async function getSearchHistory(req, res) {
  try {
    const userId = req.user?._id;

    if (!userId) {
      return res.status(400).json({
        success: false,
        message: "User ID is required",
      });
    }

    const result = await searchService.getSearchHistory(userId);

    if (result.error) {
      return res.status(result.error.status).json({
        success: false,
        message: result.error.message,
      });
    }

    res.status(200).json({
      success: true,
      data: {
        searchHistory: result.searchHistory,
      },
    });
  } catch (error) {
    logger.error("Error getting search history:", error);
    res.status(500).json({
      success: false,
      message: "Failed to get search history",
    });
  }
}

/**
 * Clear user's search history
 */
export async function clearSearchHistory(req, res) {
  try {
    const userId = req.user?._id;

    if (!userId) {
      return res.status(400).json({
        success: false,
        message: "User ID is required",
      });
    }

    await searchService.clearSearchHistory(userId);

    res.status(200).json({
      success: true,
      message: "Search history cleared",
    });
  } catch (error) {
    logger.error("Error clearing search history:", error);
    res.status(500).json({
      success: false,
      message: "Failed to clear search history",
    });
  }
}

/**
 * GET /search/natural?q=2BHK+near+metro+under+50+lakhs+in+Pune
 * Natural language property search endpoint
 */
export async function naturalLanguageSearch(req, res) {
  try {
    const query = String(req.query.q || req.query.query || "").trim();
    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const limit = Math.min(50, Math.max(1, parseInt(req.query.limit, 10) || 12));
    const currentUserId = req.user?._id ? String(req.user._id) : null;

    const result = await searchService.naturalLanguageSearch({ query, currentUserId, page, limit });

    return res.status(200).json({
      success: true,
      message: "Natural language search executed successfully",
      data: result,
    });
  } catch (error) {
    logger.error("Error in naturalLanguageSearch:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to execute natural language search",
      error: error.message,
    });
  }
}

/**
 * GET /search/parse?q=...
 * Parse-only endpoint (allows frontend to display chips for detected filters)
 */
export async function parseQueryOnly(req, res) {
  try {
    const query = String(req.query.q || req.query.query || "").trim();
    const parsed = searchService.parseQueryOnly(query);
    return res.status(200).json({
      success: true,
      data: parsed,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Failed to parse query",
    });
  }
}
