import express from "express";
import {
  getSearchSuggestions,
  saveSearchHistory,
  getSearchHistory,
  clearSearchHistory
} from "../controllers/search.controller.js";
import { verifyUser } from "../middlewares/auth.middleware.js";

const router = express.Router();

/**
 * GET /search/suggestions
 * Get autocomplete suggestions for search
 */
router.get("/suggestions", getSearchSuggestions);

/**
 * POST /search/history
 * Save search query to user's history
 */
router.post("/history", verifyUser, saveSearchHistory);

/**
 * GET /search/history
 * Get user's search history
 */
router.get("/history", verifyUser, getSearchHistory);

/**
 * DELETE /search/history
 * Clear user's search history
 */
router.delete("/history", verifyUser, clearSearchHistory);

export default router;
