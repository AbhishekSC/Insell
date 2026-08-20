import express from "express";
import axios from "axios";
import { logger } from "../utils/logger.js";

const router = express.Router();

const NEWS_API_URL = "https://newsapi.org/v2";

// In-memory cache with 10-minute TTL to respect NewsAPI rate limits
const newsCache = new Map();
const CACHE_TTL_MS = 10 * 60 * 1000;

// Dynamic fallback news generator with city support
const getFallbackNews = (city = "") => {
  const cityName = city && city.toLowerCase() !== "all" ? city : "Metro";
  return [
    {
      id: 1,
      title: `${cityName} Real Estate Market Shows Strong Recovery in Q2`,
      description: `Property markets across ${cityName} and major urban clusters show signs of high recovery with increased residential transaction volumes.`,
      image: "https://images.unsplash.com/photo-1560518883-ce09059eeffa?auto=format&fit=crop&w=600&q=80",
      source: { name: "Economic Times" },
      url: "https://economictimes.indiatimes.com/news/economy/infrastructure",
      publishedAt: new Date().toISOString(),
      city: cityName,
    },
    {
      id: 2,
      title: `Housing & Infrastructure Investments Surge in ${cityName}`,
      description: `Major infrastructure developments and housing projects announced to enhance connectivity and property values in ${cityName}.`,
      image: "https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?auto=format&fit=crop&w=600&q=80",
      source: { name: "Moneycontrol" },
      url: "https://www.moneycontrol.com/news/business/real-estate",
      publishedAt: new Date().toISOString(),
      city: cityName,
    },
    {
      id: 3,
      title: `Government Updates Housing Policy & Urban Planning Guidelines`,
      description: "New housing policy revisions aim to boost affordable and luxury housing segments across key economic regions.",
      image: "https://images.unsplash.com/photo-1545324418-cc1a3fa10c00?auto=format&fit=crop&w=600&q=80",
      source: { name: "Business Standard" },
      url: "https://www.business-standard.com/news/economy",
      publishedAt: new Date().toISOString(),
      city: cityName,
    },
    {
      id: 4,
      title: `Commercial & Residential Demand Peaks in ${cityName} Prime Localities`,
      description: `Commercial offices and gated communities in ${cityName} witness unprecedented buyer inquiries and rental yield growth.`,
      image: "https://images.unsplash.com/photo-1582407947304-fd86f028f716?auto=format&fit=crop&w=600&q=80",
      source: { name: "LiveMint" },
      url: "https://www.livemint.com/industry",
      publishedAt: new Date().toISOString(),
      city: cityName,
    },
  ];
};

// Map categories to targeted search keywords
const CATEGORY_SEARCH_QUERIES = {
  all: '"real estate" OR "property market" OR housing OR realty OR flats OR apartments',
  "real-estate": '"real estate" OR realty OR "property market" OR residential',
  housing: 'housing OR "affordable housing" OR residential OR flats OR apartments',
  construction: 'construction OR builder OR "real estate project" OR redevelopment',
  infrastructure: 'infrastructure OR metro OR expressway OR airport OR highway OR transit',
  investment: '"real estate investment" OR "property prices" OR "commercial property" OR "rental yield"',
};

// GET /api/news/trending - Fetch trending real estate news with city & category filters
router.get("/trending", async (req, res) => {
  try {
    const rawCategory = (req.query.category || "all").toString().trim().toLowerCase();
    const category = CATEGORY_SEARCH_QUERIES[rawCategory] ? rawCategory : "all";
    const rawCity = (req.query.city || "").toString().trim();
    const isSpecificCity = rawCity && rawCity.toLowerCase() !== "all";

    const cacheKey = `${category}:${rawCity.toLowerCase()}`;
    const cachedItem = newsCache.get(cacheKey);

    if (cachedItem && Date.now() - cachedItem.timestamp < CACHE_TTL_MS) {
      logger.debug("Returning cached news data", { requestId: req.id, cacheKey });
      return res.json({
        success: true,
        data: cachedItem.data,
        city: rawCity || "All Regions",
        category,
        cached: true,
      });
    }

    if (process.env.NEWS_API_KEY) {
      const categoryKeyword = CATEGORY_SEARCH_QUERIES[category];
      const query = isSpecificCity
        ? `(${rawCity}) AND (${categoryKeyword})`
        : `(India OR National) AND (${categoryKeyword})`;

      const params = {
        apiKey: process.env.NEWS_API_KEY,
        pageSize: 12,
        sortBy: "publishedAt",
        q: query,
        searchIn: "title,description",
        language: "en",
      };

      logger.debug("Fetching news with params", { requestId: req.id, city: rawCity, category, query });

      let response;
      try {
        response = await axios.get(`${NEWS_API_URL}/everything`, { params, timeout: 8000 });
      } catch (apiErr) {
        logger.warn("NewsAPI request failed or timed out", { requestId: req.id, error: apiErr.message });
      }

      let articles = response?.data?.articles || [];

      // If specific city returned 0 articles, fallback to broader national query
      let isFallback = false;
      if (articles.length === 0 && isSpecificCity) {
        logger.info(`No specific news for city "${rawCity}". Falling back to national real estate news.`, { requestId: req.id });
        try {
          const fallbackParams = {
            apiKey: process.env.NEWS_API_KEY,
            pageSize: 12,
            sortBy: "publishedAt",
            q: `(India) AND (${categoryKeyword})`,
            searchIn: "title,description",
            language: "en",
          };
          const fallbackResponse = await axios.get(`${NEWS_API_URL}/everything`, { params: fallbackParams, timeout: 8000 });
          articles = fallbackResponse?.data?.articles || [];
          isFallback = true;
        } catch {
          // ignore fallback api error
        }
      }

      const filteredArticles = articles
        .filter((article) => article.title && article.url && !article.title.includes("[Removed]"))
        .slice(0, 12)
        .map((article, index) => ({
          id: index + 1,
          title: article.title,
          description: article.description || "",
          image: article.urlToImage || "https://images.unsplash.com/photo-1560518883-ce09059eeffa?auto=format&fit=crop&w=600&q=80",
          source: { name: article.source?.name || "Unknown" },
          url: article.url,
          publishedAt: article.publishedAt,
          city: isSpecificCity && !isFallback ? rawCity : "National",
        }));

      if (filteredArticles.length > 0) {
        newsCache.set(cacheKey, { timestamp: Date.now(), data: filteredArticles });
        return res.json({
          success: true,
          data: filteredArticles,
          city: rawCity || "All Regions",
          category,
          isFallback,
        });
      }
    }

    // Fallback static data if NewsAPI is unavailable or returned empty
    const fallbackData = getFallbackNews(rawCity);
    return res.json({
      success: true,
      data: fallbackData,
      city: rawCity || "All Regions",
      category,
      isFallback: true,
      message: "Using curated real estate news updates",
    });
  } catch (error) {
    logger.error("Error fetching news", { requestId: req.id, error: error.message });
    return res.json({
      success: true,
      data: getFallbackNews(req.query.city),
      city: req.query.city || "All Regions",
      isFallback: true,
      message: "API error - using fallback data",
    });
  }
});

export default router;
