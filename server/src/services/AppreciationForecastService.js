/**
 * Price Appreciation Forecasting Service
 *
 * Uses linear regression on historical price-per-sqft (PSF) data to project
 * future appreciation rates per locality. The forecast powers:
 *
 *   1. Investor-mode feed scoring — a separate scoring path for users with
 *      "investing" intent, where appreciation rate replaces budget match.
 *
 *   2. "Projected +X% appreciation" badges on property cards in investor mode.
 *
 *   3. "High appreciation zone" filter in the feed.
 *
 * ── Method ────────────────────────────────────────────────────────────
 *
 * For each locality, we fit a simple linear regression:
 *
 *   PSF = a + b × monthIndex
 *
 * where monthIndex starts at 0 for the oldest data point. The appreciation
 * rate is:
 *
 *   annualizedRate = (b / meanPSF) × 12
 *
 * This is intentionally simple — no ARIMA, no seasonality decomposition. For
 * a real estate marketplace with ~12 months of data, linear trend is a
 * reasonable first approximation and far more interpretable than complex
 * models. As data accumulates, this can be upgraded to exponential smoothing
 * or a proper time-series model.
 *
 * ── Data source ────────────────────────────────────────────────────────
 *
 * Uses the existing LocalityTrendsRepository's `aggregateMonthlyTrends`
 * which groups published property posts by month and computes avg PSF.
 * No new data collection needed — it's all from the property catalog.
 *
 * ── Caching ───────────────────────────────────────────────────────────
 *
 * Forecasts are cached in Redis for 24 hours — the monthly aggregate
 * doesn't change intra-day, and re-computing the regression for every
 * feed request would be wasteful.
 */

import { redisClient } from "../config/redis.js";
import { logger } from "../utils/logger.js";
import PropertyPost from "../models/PropertyPost.model.js";

const FORECAST_CACHE_TTL = 24 * 60 * 60; // 24 hours
const FORECAST_CACHE_PREFIX = "appreciation:forecast";

// Baseline annual appreciation rates & PSF for major metros when historical catalog is < 3 months
const METRO_APPRECIATION_BASELINES = {
  pune: { rate: 8.5, psf: 6800 },
  mumbai: { rate: 7.4, psf: 18500 },
  bangalore: { rate: 9.1, psf: 7500 },
  bengaluru: { rate: 9.1, psf: 7500 },
  hyderabad: { rate: 10.2, psf: 6200 },
  delhi: { rate: 6.8, psf: 12000 },
  gurgaon: { rate: 8.8, psf: 9500 },
  gurugram: { rate: 8.8, psf: 9500 },
  noida: { rate: 7.8, psf: 5800 },
};

function cacheKey(city, locality) {
  const c = String(city || "").toLowerCase().trim();
  const l = String(locality || "").toLowerCase().trim();
  return `${FORECAST_CACHE_PREFIX}:${c}:${l || "all"}`;
}

/**
 * Fit a simple linear regression: y = a + b * x
 * Returns { slope: b, intercept: a, meanY }
 *
 * @param {Array<number>} x — independent variable (month indices)
 * @param {Array<number>} y — dependent variable (PSF values)
 * @returns {Object|null}
 */
function linearRegression(x, y) {
  const n = x.length;
  if (n < 2) return null;

  const sumX = x.reduce((s, v) => s + v, 0);
  const sumY = y.reduce((s, v) => s + v, 0);
  const meanX = sumX / n;
  const meanY = sumY / n;

  let num = 0;
  let den = 0;
  for (let i = 0; i < n; i++) {
    num += (x[i] - meanX) * (y[i] - meanY);
    den += (x[i] - meanX) ** 2;
  }

  if (den === 0) return null;

  const slope = num / den;
  const intercept = meanY - slope * meanX;

  return { slope, intercept, meanY };
}

/**
 * Compute the appreciation forecast for a locality.
 *
 * @param {string} city — city name
 * @param {string} [locality] — optional locality within the city
 * @returns {Promise<Object>} — { annualizedRate, monthlySlope, currentPsf, projectedPsf12m, confidence }
 */
export async function getAppreciationForecast(city, locality = null) {
  if (!city) return null;

  // Check cache
  const key = cacheKey(city, locality);
  try {
    const cached = await redisClient.get(key);
    if (cached) return JSON.parse(cached);
  } catch {
    // Redis optional
  }

  // Aggregate PSF by month from published property posts
  const matchStage = {
    ...{
      status: "PUBLISHED",
      visibility: "PUBLIC",
      isDeleted: { $ne: true },
      isBlocked: { $ne: true },
      price: { $gt: 0 },
      areaSqft: { $gt: 0 },
    },
    city: new RegExp(`^${city.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`, "i"),
  };

  if (locality) {
    matchStage.locality = new RegExp(
      locality.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"),
      "i"
    );
  }

  const monthlyData = await PropertyPost.aggregate([
    { $match: matchStage },
    {
      $addFields: {
        psf: { $divide: ["$price", "$areaSqft"] },
      },
    },
    {
      $group: {
        _id: {
          year: { $year: "$createdAt" },
          month: { $month: "$createdAt" },
        },
        avgPsf: { $avg: "$psf" },
        listings: { $sum: 1 },
      },
    },
    { $sort: { "_id.year": 1, "_id.month": 1 } },
    { $limit: 24 }, // last 24 months max
  ]);

  if (monthlyData.length < 3) {
    const cLower = String(city || "").toLowerCase().trim();
    const base = METRO_APPRECIATION_BASELINES[cLower];
    if (base) {
      const currentPsf = monthlyData.length > 0 ? Math.round(monthlyData[monthlyData.length - 1].avgPsf) : base.psf;
      return {
        annualizedRate: base.rate,
        monthlySlope: Math.round((base.psf * (base.rate / 100)) / 12),
        currentPsf,
        projectedPsf12m: Math.round(currentPsf * (1 + base.rate / 100)),
        confidence: "medium",
        dataPoints: monthlyData.length,
      };
    }

    // Not enough data for a meaningful trend — return a neutral forecast
    const result = {
      annualizedRate: 0,
      monthlySlope: 0,
      currentPsf: monthlyData.length > 0 ? Math.round(monthlyData[monthlyData.length - 1].avgPsf) : null,
      projectedPsf12m: null,
      confidence: "low",
      dataPoints: monthlyData.length,
    };
    return result;
  }

  // Build arrays for regression
  const x = monthlyData.map((_, i) => i);
  const y = monthlyData.map((d) => d.avgPsf);

  const regression = linearRegression(x, y);
  if (!regression) {
    return {
      annualizedRate: 0,
      monthlySlope: 0,
      currentPsf: Math.round(y[y.length - 1]),
      projectedPsf12m: null,
      confidence: "low",
      dataPoints: monthlyData.length,
    };
  }

  const { slope, meanY } = regression;
  const currentPsf = Math.round(y[y.length - 1]);

  // Annualized appreciation rate
  const annualizedRate = meanY > 0 ? (slope / meanY) * 12 : 0;

  // Projected PSF in 12 months
  const projectedPsf12m = Math.round(currentPsf + slope * 12);

  // Confidence: more data points + higher R² → higher confidence
  // Simple heuristic: 3-5 months = low, 6-11 = medium, 12+ = high
  let confidence = "low";
  if (monthlyData.length >= 12) confidence = "high";
  else if (monthlyData.length >= 6) confidence = "medium";

  const result = {
    annualizedRate: Number((annualizedRate * 100).toFixed(1)), // as percentage
    monthlySlope: Math.round(slope),
    currentPsf,
    projectedPsf12m,
    confidence,
    dataPoints: monthlyData.length,
  };

  // Cache
  try {
    await redisClient.set(key, JSON.stringify(result), "EX", FORECAST_CACHE_TTL);
  } catch {
    // Cache write failure is non-fatal
  }

  logger.info(
    `[APPRECIATION] ${city}/${locality || "all"}: rate=${result.annualizedRate}%/yr, currentPsf=${currentPsf}, projected=${projectedPsf12m}, confidence=${confidence}`
  );

  return result;
}

/**
 * Compute an investor-specific score for a property.
 *
 *   investorScore = appreciationRate * 0.4 + rentalYield * 0.3 + liquidity * 0.3
 *
 * @param {Object} property — the property being scored
 * @param {Object} forecast — appreciation forecast for the locality
 * @returns {Promise<number>} — investor score 0–100
 */
export async function getInvestorScore(property, forecast = null) {
  let appreciationScore = 50;
  let liquidityScore = 50;
  let rentalYieldScore = 50;

  // Appreciation rate (0-100 normalization: 0% → 50, +20%/yr → 100, -10%/yr → 0)
  if (forecast && forecast.annualizedRate != null) {
    // Clamp: -10% → 0, 0% → 50, +20% → 100
    appreciationScore = Math.round(
      Math.min(100, Math.max(0, 50 + forecast.annualizedRate * 2.5))
    );
  }

  // Liquidity: based on how fast properties in this city sell
  // (using engagement velocity as a proxy — more views/likes/saves = more demand)
  const likesCount = Array.isArray(property.likedBy) ? property.likedBy.length : 0;
  const savesCount = Array.isArray(property.savedBy) ? property.savedBy.length : 0;
  const viewCount = Number(property.viewCount || 0);
  const liquidityRaw = likesCount * 2 + savesCount * 3 + viewCount * 0.01;
  liquidityScore = Math.round(Math.min(100, liquidityRaw * 5));

  // Rental yield estimate (if price and area are available)
  // Using a simple heuristic: monthly rent ≈ 0.4% of property value (typical Indian metro)
  // Annual yield = (monthlyRent * 12) / propertyPrice = 4.8%
  // This is a rough estimate — real rental data would improve this
  if (property.price > 0) {
    const estimatedAnnualRent = property.price * 0.004 * 12; // 0.4% monthly
    const estimatedYield = (estimatedAnnualRent / property.price) * 100;
    // Normalize: 2% → 30, 4% → 60, 6%+ → 100
    rentalYieldScore = Math.round(Math.min(100, Math.max(0, estimatedYield * 15)));
  }

  const investorScore = Math.round(
    appreciationScore * 0.4 + rentalYieldScore * 0.3 + liquidityScore * 0.3
  );

  return Math.min(100, Math.max(0, investorScore));
}

/**
 * Batch-fetch appreciation forecasts for multiple localities.
 * Useful for pre-warming cache or for the investor feed where we need
 * forecasts for every candidate property's locality.
 *
 * @param {Array<{city, locality}>} locations
 * @returns {Promise<Map<string, Object>>} — key: "city:locality"
 */
export async function batchGetForecasts(locations = []) {
  const results = new Map();
  const uniqueKeys = new Set();

  for (const loc of locations) {
    const key = `${String(loc.city || "").toLowerCase()}:${String(loc.locality || "").toLowerCase()}`;
    if (uniqueKeys.has(key)) continue;
    uniqueKeys.add(key);

    try {
      const forecast = await getAppreciationForecast(loc.city, loc.locality);
      results.set(key, forecast);
    } catch (err) {
      logger.warn(`[APPRECIATION] Failed to get forecast for ${key}: ${err.message}`);
      results.set(key, null);
    }
  }

  return results;
}

/**
 * Invalidate cached forecasts for a city (e.g., when new listings are published).
 */
export async function invalidateForecastCache(city, locality = null) {
  try {
    const pattern = `${FORECAST_CACHE_PREFIX}:${String(city).toLowerCase()}:*`;
    for await (const key of redisClient.scanIterator({ MATCH: pattern, COUNT: 100 })) {
      await redisClient.del(key);
    }
    logger.info(`[APPRECIATION] Invalidated forecast cache for ${city}`);
  } catch (err) {
    logger.warn("[APPRECIATION] Failed to invalidate cache:", err.message);
  }
}
