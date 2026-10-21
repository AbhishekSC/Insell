import express from "express";
import {
  getSearchSuggestions,
  saveSearchHistory,
  getSearchHistory,
  clearSearchHistory,
  naturalLanguageSearch,
  parseQueryOnly,
} from "../controllers/search.controller.js";
import {
  verifyUser,
  requireVerified,
  attachOptionalUser,
} from "../middlewares/auth.middleware.js";

const router = express.Router();

/**
 * GET /search/natural
 * Natural language property search
 */
router.get("/natural", attachOptionalUser, naturalLanguageSearch);

/**
 * GET /search/parse
 * Parse-only helper for natural queries
 */
router.get("/parse", parseQueryOnly);

/**
 * GET /search/suggestions
 * Get autocomplete suggestions for search
 */
router.get("/suggestions", getSearchSuggestions);

/**
 * POST /search/history
 * Save search query to user's history
 */
router.post("/history", verifyUser, requireVerified, saveSearchHistory);

/**
 * GET /search/history
 * Get user's search history
 */
router.get("/history", verifyUser, requireVerified, getSearchHistory);

/**
 * DELETE /search/history
 * Clear user's search history
 */
router.delete("/history", verifyUser, requireVerified, clearSearchHistory);

export default router;
