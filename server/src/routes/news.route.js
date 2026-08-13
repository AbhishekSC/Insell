import express from "express";
import axios from "axios";
import { logger } from "../utils/logger.js";

const router = express.Router();

const NEWS_API_URL = "https://newsapi.org/v2";

// Fallback news data if API fails
const FALLBACK_NEWS = [
  {
    id: 1,
    title: "Real Estate Market Shows Strong Recovery in Q2",
    description: "Property markets across major cities show signs of recovery with increased transaction volumes.",
    image: "https://placehold.co/300x180?text=Real+Estate+News",
    source: { name: "Economic Times" },
    url: "https://economictimes.indiatimes.com/news/economy/infrastructure/real-estate-market-shows-strong-recovery-in-q2",
    publishedAt: new Date().toISOString()
  },
  {
    id: 2,
    title: "Property Prices Surge in Metro Cities",
    description: "Housing prices in metropolitan cities see significant increase due to high demand.",
    image: "https://placehold.co/300x180?text=Property+Prices",
    source: { name: "Moneycontrol" },
    url: "https://www.moneycontrol.com/news/business/real-estate/property-prices-surge-in-metro-cities",
    publishedAt: new Date().toISOString()
  },
  {
    id: 3,
    title: "Government Announces New Housing Policy",
    description: "New housing policy aims to boost affordable housing segment across the country.",
    image: "https://placehold.co/300x180?text=Housing+Policy",
    source: { name: "Business Standard" },
    url: "https://www.business-standard.com/news/economy/government-announces-new-housing-policy",
    publishedAt: new Date().toISOString()
  }
];

// Map our categories to specific search queries
const CATEGORY_SEARCH_QUERIES = {
  "all": "real estate",
  "real-estate": "real estate",
  "housing": "housing",
  "construction": "construction",
  "infrastructure": "infrastructure",
  "investment": "investment"
};

// GET /api/news/trending - Fetch trending real estate news
router.get("/trending", async (req, res) => {
  try {
    const category = req.query.category || "all";

    // If NewsAPI key is available, fetch from API
    if (process.env.NEWS_API_KEY) {
      const params = {
        apiKey: process.env.NEWS_API_KEY,
        pageSize: 12,
        sortBy: "publishedAt",
        q: CATEGORY_SEARCH_QUERIES[category] || CATEGORY_SEARCH_QUERIES["all"],
        language: "en"
      };

      logger.debug("Fetching news with params", { requestId: req.id, category, query: params.q });

      // Use /everything endpoint which supports search queries
      const response = await axios.get(`${NEWS_API_URL}/everything`, { params });

      logger.debug("NewsAPI response received", { requestId: req.id, status: response.status, totalResults: response.data.totalResults });

      const articles = response.data.articles || [];

      const filteredArticles = articles
        .filter(article => article.title && article.url && !article.title.includes("[Removed]"))
        .slice(0, 12)
        .map((article, index) => ({
          id: index + 1,
          title: article.title,
          description: article.description || "",
          image: article.urlToImage || "https://placehold.co/300x180?text=News",
          source: { name: article.source?.name || "Unknown" },
          url: article.url,
          publishedAt: article.publishedAt
        }));

      logger.debug("Filtered articles count", { requestId: req.id, count: filteredArticles.length });

      // If no articles from API, return fallback
      if (filteredArticles.length === 0) {
        logger.warn("No articles found, returning fallback data", { requestId: req.id });
        return res.json({
          success: true,
          data: FALLBACK_NEWS,
          message: "No articles found - using fallback data"
        });
      }

      return res.json({
        success: true,
        data: filteredArticles
      });
    }

    // Fallback to static data if no API key
    return res.json({
      success: true,
      data: FALLBACK_NEWS,
      message: "Using fallback data - add NEWS_API_KEY to enable live news"
    });

  } catch (error) {
    logger.error("Error fetching news", { requestId: req.id, error: error.message });
    
    // Return fallback data on error
    return res.json({
      success: true,
      data: FALLBACK_NEWS,
      message: "API error - using fallback data"
    });
  }
});

export default router;
