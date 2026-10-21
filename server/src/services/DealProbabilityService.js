import { logger } from "../utils/logger.js";
import LocalityTrendsService from "./LocalityTrendsService.js";

/**
 * Deal Probability Service
 *
 * Predicts the likelihood of a successful transaction / deal closing based on:
 * - Author response rate & responsiveness (25%)
 * - Author rating & credibility (15%)
 * - Price competitiveness vs. locality benchmark (25%)
 * - Listing age & seller motivation (10%)
 * - Engagement velocity & demand spike (15%)
 * - Verified identity and property address status (10%)
 */

export function calculateDealProbability(property, author = null, benchmark = null) {
  if (!property) return null;

  const auth = author || property.author || {};

  // 1. Author Response Rate (25%)
  // Response rate stored as 0-100 or decimal 0-1
  let rawResponseRate = auth.responseRate;
  if (rawResponseRate === undefined || rawResponseRate === null) {
    rawResponseRate = 70; // neutral default
  } else if (rawResponseRate <= 1) {
    rawResponseRate = rawResponseRate * 100;
  }
  const responseScore = Math.min(100, Math.max(0, rawResponseRate));

  // 2. Author Rating (15%)
  // 0-5 stars normalized to 0-100
  const ratingAvg = Number(auth.ratingAvg || auth.rating || 4.0);
  const ratingScore = Math.min(100, Math.max(0, (ratingAvg / 5) * 100));

  // 3. Price Competitiveness vs Locality (25%)
  let priceScore = 60; // neutral
  let priceDiffPercent = null;

  const pricePerSqft =
    property.areaSqft && property.areaSqft > 0 && property.price && property.price > 0
      ? property.price / property.areaSqft
      : null;

  const medianPsf = benchmark?.medianPricePerSqft || benchmark?.averagePricePerSqft;

  if (pricePerSqft && medianPsf && medianPsf > 0) {
    priceDiffPercent = Math.round(((pricePerSqft - medianPsf) / medianPsf) * 100);
    // If priced below median -> attractive deal
    if (priceDiffPercent <= -15) {
      priceScore = 95;
    } else if (priceDiffPercent <= -5) {
      priceScore = 85;
    } else if (priceDiffPercent <= 5) {
      priceScore = 75;
    } else if (priceDiffPercent <= 15) {
      priceScore = 55;
    } else {
      priceScore = 35;
    }
  }

  // 4. Listing Age & Seller Motivation (10%)
  const createdAt = property.createdAt ? new Date(property.createdAt).getTime() : Date.now();
  const ageDays = (Date.now() - createdAt) / (1000 * 60 * 60 * 24);

  let ageScore = 60;
  if (ageDays >= 15 && ageDays <= 45) {
    ageScore = 85; // Peak deal momentum
  } else if (ageDays > 45 && ageDays <= 90) {
    ageScore = 90; // High seller motivation
  } else if (ageDays > 90) {
    ageScore = 70; // Stale or firm price
  } else {
    ageScore = 65; // Fresh listing
  }

  // 5. Engagement Velocity (15%)
  const likes = Array.isArray(property.likedBy) ? property.likedBy.length : Number(property.likesCount || 0);
  const saves = Array.isArray(property.savedBy) ? property.savedBy.length : Number(property.savesCount || 0);
  const views = Number(property.viewsCount || 0);
  const rawVelocity = saves * 4 + likes * 2 + views * 0.1;
  const velocityScore = Math.min(100, Math.round(rawVelocity * 3));

  // 6. Verified Status (10%)
  const isAddressVerified = Boolean(
    property.isAddressVerified ||
    property.electricityBillStatus === "VERIFIED" ||
    property.postMeta?.residential?.electricityBillStatus === "VERIFIED"
  );
  const isOwnerVerified = Boolean(auth.isOwnerVerified || auth.isVerified);

  let verificationScore = 30;
  if (isAddressVerified && isOwnerVerified) {
    verificationScore = 100;
  } else if (isAddressVerified || isOwnerVerified) {
    verificationScore = 75;
  }

  // Composite weighted score (0–100)
  const finalProbability = Math.round(
    responseScore * 0.25 +
    ratingScore * 0.15 +
    priceScore * 0.25 +
    ageScore * 0.10 +
    velocityScore * 0.15 +
    verificationScore * 0.10
  );

  let level = "MODERATE";
  let label = "Standard Deal Probability";

  if (finalProbability >= 75) {
    level = "HIGH";
    if (priceDiffPercent !== null && priceDiffPercent <= -5) {
      label = `Price ${Math.abs(priceDiffPercent)}% below locality median — High deal likelihood`;
    } else if (responseScore >= 80) {
      label = "High response seller — fast deal closure expected";
    } else {
      label = "High deal closing probability";
    }
  } else if (finalProbability >= 55) {
    level = "GOOD";
    label = "Solid interest & verified property";
  }

  return {
    score: finalProbability,
    level,
    label,
    priceDiffPercent,
    factors: {
      responseScore,
      ratingScore,
      priceScore,
      ageScore,
      velocityScore,
      verificationScore,
    },
  };
}

/**
 * Batch attach deal probabilities to an array of property posts
 */
export async function attachDealProbability(posts) {
  if (!Array.isArray(posts) || posts.length === 0) return posts;

  try {
    return posts.map((post) => {
      const dealProbability = calculateDealProbability(post, post.author);
      return {
        ...post,
        dealProbability,
      };
    });
  } catch (err) {
    logger.warn("attachDealProbability warning:", err?.message);
    return posts;
  }
}

export default {
  calculateDealProbability,
  attachDealProbability,
};
