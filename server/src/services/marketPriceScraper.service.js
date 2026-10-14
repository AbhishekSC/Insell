import axios from "axios";
import MarketBenchmark from "../models/MarketBenchmark.model.js";
import { logger } from "../utils/logger.js";

const CACHE_TTL_DAYS = 30;

// Sanity bounds for extracted prices per sq.ft
const RATE_BOUNDS = {
  rent: { min: 4, max: 250 },
  buy: { min: 400, max: 120000 },
};

/**
 * Extracts price-per-square-foot numbers from Google Serper organic snippets.
 */
export function extractRatesFromSnippets(organicResults = [], intent = "rent") {
  const rates = [];
  const sources = new Set();
  const snippets = [];
  const bounds = RATE_BOUNDS[intent] || RATE_BOUNDS.buy;

  for (const item of organicResults) {
    const rawText = `${item.title || ""} ${item.snippet || ""}`;
    const cleanText = rawText.replace(/,/g, "");
    const link = item.link || "";

    if (/99acres/i.test(link)) sources.add("99acres");
    if (/housing\.com/i.test(link)) sources.add("Housing.com");
    if (/magicbricks/i.test(link)) sources.add("Magicbricks");
    if (/olx/i.test(link)) sources.add("OLX");
    if (/nobroker/i.test(link)) sources.add("NoBroker");
    if (/squareyards/i.test(link)) sources.add("SquareYards");

    if (intent === "rent") {
      // 1. Direct psf: e.g. "₹25 / sqft" or "Rs. 15 per sqft" or "₹14/sq.ft"
      const directMatches = cleanText.matchAll(/(?:₹|rs\.?)\s*(\d+(?:\.\d+)?)\s*(?:\/|\s*per\s*)sq\.?\s*ft/gi);
      for (const m of directMatches) {
        const val = parseFloat(m[1]);
        if (val >= bounds.min && val <= bounds.max) {
          rates.push(val);
          snippets.push(rawText.slice(0, 140));
        }
      }

      // 2. Flexible rent with nearby area:
      // a) Rent before area: e.g. "₹7,000 ... 450 sqft" or "₹12000 / month ... 750 sqft"
      const rentBeforeAreaMatches = cleanText.matchAll(/(?:₹|rs\.?)\s*(\d{3,6})\b.{0,120}?(\d{2,5})\s*sqft/gi);
      for (const m of rentBeforeAreaMatches) {
        const rent = parseFloat(m[1]);
        const area = parseFloat(m[2]);
        if (rent > 0 && area >= 80) {
          const val = Math.round((rent / area) * 10) / 10;
          if (val >= bounds.min && val <= bounds.max) {
            rates.push(val);
            snippets.push(rawText.slice(0, 140));
          }
        }
      }

      // b) Area before rent: e.g. "1800 sq ft ... Rs. 27000/month"
      const areaBeforeRentMatches = cleanText.matchAll(/(\d{2,5})\s*sq\.?\s*ft\b.{0,120}?(?:₹|rs\.?)\s*(\d{3,6})\b/gi);
      for (const m of areaBeforeRentMatches) {
        const area = parseFloat(m[1]);
        const rent = parseFloat(m[2]);
        if (rent > 0 && area >= 80) {
          const val = Math.round((rent / area) * 10) / 10;
          if (val >= bounds.min && val <= bounds.max) {
            rates.push(val);
            snippets.push(rawText.slice(0, 140));
          }
        }
      }
    } else {
      // Buy / Sale intent
      // 1. Direct psf: e.g. "₹7500 /sqft" or "₹4611 /sqft" or "Rs. 5614 per sqft"
      const directMatches = cleanText.matchAll(/(?:₹|rs\.?)\s*(\d{3,6}(?:\.\d+)?)\s*(?:\/|\s*per\s*)sq\.?\s*ft/gi);
      for (const m of directMatches) {
        const val = parseFloat(m[1]);
        if (val >= bounds.min && val <= bounds.max) {
          rates.push(val);
          snippets.push(rawText.slice(0, 140));
        }
      }

      // 2. Lac/Lakh with area: e.g. "₹45 Lac ... 690 sqft" or "₹30 Lakh ... 600 sqft"
      const lacMatches = cleanText.matchAll(/(?:₹|rs\.?)\s*(\d+(?:\.\d+)?)\s*(?:lac|lakh)\b[^\d]*?(\d{2,5})\s*sqft/gi);
      for (const m of lacMatches) {
        const lacVal = parseFloat(m[1]) * 100000;
        const area = parseFloat(m[2]);
        if (lacVal > 0 && area >= 100) {
          const val = Math.round(lacVal / area);
          if (val >= bounds.min && val <= bounds.max) {
            rates.push(val);
            snippets.push(rawText.slice(0, 140));
          }
        }
      }
    }
  }

  return {
    rates,
    sources: Array.from(sources),
    snippets: snippets.slice(0, 3),
  };
}

/**
 * Calls Serper.dev Google search to fetch market price trends for a locality/city.
 */
export async function querySerperForMarketRates({ city, locality = "", intent = "rent" }) {
  const apiKey = process.env.SERPER_API_KEY;
  if (!apiKey) {
    logger.warn("SERPER_API_KEY not configured. Market rate scraping skipped.");
    return null;
  }

  const queryLoc = locality && locality.toLowerCase() !== city.toLowerCase()
    ? `${locality} ${city}`
    : city;

  const searchQuery = intent === "rent"
    ? `${queryLoc} flat house rent 99acres magicbricks housing`
    : `${queryLoc} flat house price per sqft 99acres magicbricks housing`;

  try {
    const response = await axios.post(
      "https://google.serper.dev/search",
      { q: searchQuery, gl: "in" },
      {
        headers: {
          "X-API-KEY": apiKey,
          "Content-Type": "application/json",
        },
        timeout: 6000,
      }
    );

    const organic = response.data?.organic || [];
    return extractRatesFromSnippets(organic, intent);
  } catch (err) {
    logger.warn("Failed to fetch market rates from Serper (non-fatal):", err?.message || err);
    return null;
  }
}

/**
 * Retrieves a cached benchmark from MongoDB or fetches fresh data from Serper.
 */
export async function getOrFetchMarketBenchmark({
  city,
  locality = "",
  intent = "rent",
  propertyType = "all",
}) {
  const normCity = String(city || "").toLowerCase().trim();
  const normLocality = String(locality || "").toLowerCase().trim();
  const normType = String(propertyType || "all").toLowerCase().trim();

  if (!normCity) return null;

  try {
    // 1. Check existing cached benchmark
    const cached = await MarketBenchmark.findOne({
      city: normCity,
      locality: normLocality,
      intent,
      propertyType: normType,
    });

    const isStale =
      !cached ||
      Date.now() - new Date(cached.lastFetchedAt).getTime() >
        CACHE_TTL_DAYS * 24 * 60 * 60 * 1000;

    if (cached && !isStale) {
      return cached;
    }

    // 2. Fetch fresh data from Serper
    let scraped = await querySerperForMarketRates({
      city: normCity,
      locality: normLocality,
      intent,
    });

    // If locality search gave 0 rates and locality was specified, fallback to city search
    if ((!scraped || scraped.rates.length === 0) && normLocality) {
      scraped = await querySerperForMarketRates({
        city: normCity,
        locality: "",
        intent,
      });
    }

    if (!scraped || scraped.rates.length === 0) {
      return cached || null;
    }

    const { rates, sources, snippets } = scraped;
    rates.sort((a, b) => a - b);

    // Compute min, max, avg
    const minPsf = rates[0];
    const maxPsf = rates[rates.length - 1];
    const avgPsf = Math.round(
      (rates.reduce((sum, r) => sum + r, 0) / rates.length) * 10
    ) / 10;

    const benchmark = await MarketBenchmark.findOneAndUpdate(
      {
        city: normCity,
        locality: normLocality,
        intent,
        propertyType: normType,
      },
      {
        $set: {
          minPsf,
          maxPsf,
          avgPsf,
          sampleCount: rates.length,
          source: "google_serper_aggregate",
          topSources: sources.length > 0 ? sources : ["Market Aggregator"],
          snippets,
          lastFetchedAt: new Date(),
        },
      },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );

    logger.info(
      `Market benchmark updated for ${normLocality || normCity} (${intent}): ₹${minPsf} - ₹${maxPsf}/sq.ft (avg: ₹${avgPsf}) [${sources.join(", ")}]`
    );

    return benchmark;
  } catch (err) {
    logger.warn("getOrFetchMarketBenchmark failed (non-fatal):", err?.message || err);
    return null;
  }
}
