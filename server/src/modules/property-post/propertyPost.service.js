import mongoose from "mongoose";
import redisClient from "../../config/redisClient.config.js";
import { logger } from "../../utils/logger.js";
import {
  toggleEngagementRedis,
  getLikersFromCache,
  incrementViewCountRedis,
  invalidatePostDetailCache,
  getPostEngagement,
} from "../../services/likeCache.service.js";
import {
  canRoleCreatePostType,
  getAllowedPostTypesForRole,
  getPostTypeDefaults,
  normalizePostType,
  resolveActiveRole,
  sanitizePostMeta,
} from "../../utils/postPolicy.js";
import { invalidateDiscoverCache } from "../../services/DiscoverRecommendationService.js";
import { invalidateActivityCache } from "../../services/UserServiceHandlers.js";
import { getHotPostsByCity, invalidateHotCityCache } from "../../services/HotFeedCacheService.js";
import PersonalizationService from "../../services/PersonalizationService.js";
import * as NotificationService from "../../services/NotificationService.js";
import { NotificationChannel } from "../../services/NotificationService.js";
import { notifyTriggeredAlerts as notifyTriggeredPriceAlerts } from "../price-alert/priceAlert.app.service.js";
import { activeUserIdsForPost as activeAlertUserIdsForPost, deleteForPost as deletePriceAlertsForPost } from "../price-alert/priceAlert.repository.js";
import { debitCoins } from "../../services/wallet.service.js";
import { calculateLivePropertyValuation } from "../../utils/propertyValuationService.js";
import { notifyMatches as notifySavedSearchMatches } from "../saved-search/savedSearch.app.service.js";
import { closeActiveOffersForPost } from "../../controllers/offer.controller.js";
import { cloudinaryInstance } from "../../config/cloudinary.js";
import { calculateFlatmateCompatibility } from "../../services/FlatmateCompatibilityService.js";
import { centroidForCity } from "../../utils/cityCentroids.js";
import { batchGetForecasts, getCachedForecastOrRecompute } from "../../services/AppreciationForecastService.js";
import { calculateDealProbability } from "../../services/DealProbabilityService.js";
import CardCTRService from "../../services/CardCTRService.js";
import * as repo from "./propertyPost.repository.js";
import {
  PROPERTY_MEDIA_FOLDER,
  PROPERTY_MEDIA_ALLOWED_FORMATS,
  POST_STATUSES,
  POST_VISIBILITIES,
  PRICE_DROP_MIN_PCT,
  PRICE_DROP_MIN_ABS,
  PRICE_DROP_COOLDOWN_MS,
  PRICE_INSIGHT_MIN_SAMPLE,
  PSF_BOUNDS,
  NEAR_ME_BANDS_KM,
  SAVED_LOCATION_MAX_AGE_MS,
  COMPARISON_WEIGHT_CONFIGS,
} from "./propertyPost.constants.js";

// ── Pure utility functions ──────────────────────────────────────────────

export function haversineKm(lat1, lon1, lat2, lon2) {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export function normalizeMediaUrls(raw) {
  if (Array.isArray(raw)) {
    return raw.map((item) => String(item || "").trim()).filter(Boolean);
  }
  if (typeof raw === "string") {
    return raw.split(",").map((item) => String(item || "").trim()).filter(Boolean);
  }
  return [];
}

export function sanitizePriceHistory(history, currentPrice) {
  const current = Number(currentPrice) || 0;
  if (!Array.isArray(history) || history.length === 0) {
    return current > 0 ? [{ price: current, changedAt: new Date() }] : [];
  }
  const valid = history.filter((h) => Number(h?.price) > 0);
  if (valid.length === 0) {
    return current > 0 ? [{ price: current, changedAt: new Date() }] : [];
  }
  const deduped = [];
  for (const item of valid) {
    const itemPrice = Number(item.price);
    if (deduped.length === 0 || Number(deduped[deduped.length - 1].price) !== itemPrice) {
      deduped.push({ price: itemPrice, changedAt: item.changedAt || new Date() });
    }
  }
  return deduped;
}

function median(nums) {
  if (!nums.length) return 0;
  const s = [...nums].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
}

export function intentOf(post) {
  const lt = String(post?.listingType || "").toLowerCase();
  const pt = String(post?.postType || "").toUpperCase();
  return lt === "rent" || lt === "lease" || pt === "PROPERTY_RENT" ? "rent" : "buy";
}

function subjectPsfOf(post, intent = intentOf(post)) {
  const area = Number(post.areaSqft) || Number(post.postMeta?.commercial?.carpetArea) || 0;
  const psf = post.price > 0 && area > 0 ? post.price / area : 0;
  const b = PSF_BOUNDS[intent] || PSF_BOUNDS.buy;
  return psf >= b.min && psf <= b.max ? psf : 0;
}

// ── Feed ranking ────────────────────────────────────────────────────────

export function applyDistanceAndFreshnessRanking(posts, viewer) {
  if (!posts || posts.length <= 1) return posts;
  const viewerLat = viewer?.locationDetails?.latitude || viewer?.workLocation?.latitude;
  const viewerLon = viewer?.locationDetails?.longitude || viewer?.workLocation?.longitude;
  const nowMs = Date.now();
  const len = posts.length;

  return posts
    .map((p, index) => {
      const positionBase = (len - index) * 3;
      let rankBonus = 0;
      if (viewerLat && viewerLon && p.latitude && p.longitude) {
        const km = haversineKm(viewerLat, viewerLon, p.latitude, p.longitude);
        rankBonus += km <= 3 ? 30 : km <= 10 ? 20 : km <= 25 ? 10 : km <= 50 ? 5 : 0;
      }
      const ageDays = (nowMs - new Date(p.createdAt || 0).getTime()) / 86400000;
      rankBonus -= Math.min(20, Math.round(ageDays * (20 / 30)));
      if (p.flatmateMatchScore) rankBonus += p.flatmateMatchScore;
      return { ...p, _rankScore: positionBase + rankBonus * 0.4 };
    })
    .sort((a, b) => (b._rankScore || 0) - (a._rankScore || 0))
    .map(({ _rankScore, ...p }) => p);
}

export function scoreFlatmatePosts(posts, viewer, category) {
  const fp = viewer?.flatmateProfile;
  if (!fp?.updatedAt) return posts;
  return posts.map((p) => {
    if (p.postType === "FLATMATE_OFFER" || p.postType === "FLATMATE_SEEKING") {
      const score = calculateFlatmateCompatibility(fp, p);
      return score != null ? { ...p, flatmateMatchScore: score } : p;
    }
    return p;
  });
}

export function nearMeBand(distanceKm) {
  for (let i = 0; i < NEAR_ME_BANDS_KM.length; i += 1) {
    if (distanceKm <= NEAR_ME_BANDS_KM[i]) return i;
  }
  return NEAR_ME_BANDS_KM.length;
}

export function nearMeWithinBandScore(post) {
  const ageDays = Math.max(0, (Date.now() - new Date(post.createdAt).getTime()) / 86_400_000);
  const recency = 55 * Math.pow(0.5, ageDays / 14);
  let quality = 0;
  if (Array.isArray(post.mediaUrls) && post.mediaUrls.length > 0) quality += 15;
  const likes = Array.isArray(post.likedBy) ? post.likedBy.length : 0;
  const saves = Array.isArray(post.savedBy) ? post.savedBy.length : 0;
  quality += Math.min(20, likes * 2 + saves * 3);
  if (post.locationPrecision === "exact") quality += 10;
  return recency + quality;
}

// ── Comparison scoring ──────────────────────────────────────────────────

export function calculatePropertyScore(property, allProperties, preferenceCriteria = "balanced") {
  let score = 0;
  const breakdown = {};
  const weights = COMPARISON_WEIGHT_CONFIGS[preferenceCriteria] || COMPARISON_WEIGHT_CONFIGS.balanced;

  const prices = allProperties.map((p) => p.price || 0).filter((p) => p > 0);
  const minPrice = Math.min(...prices);
  const maxPrice = Math.max(...prices);
  const priceScore = maxPrice > minPrice ? ((maxPrice - (property.price || 0)) / (maxPrice - minPrice)) * 100 : 50;
  score += priceScore * weights.price;
  breakdown.price = Math.round(priceScore);

  const areas = allProperties.map((p) => p.areaSqft || 0).filter((a) => a > 0);
  const maxArea = Math.max(...areas);
  const areaScore = maxArea > 0 ? ((property.areaSqft || 0) / maxArea) * 100 : 50;
  score += areaScore * weights.area;
  breakdown.area = Math.round(areaScore);

  const bedrooms = allProperties.map((p) => p.bedrooms || 0);
  const maxBedrooms = Math.max(...bedrooms);
  const bedroomScore = maxBedrooms > 0 ? ((property.bedrooms || 0) / maxBedrooms) * 100 : 50;
  score += bedroomScore * weights.bedrooms;
  breakdown.bedrooms = Math.round(bedroomScore);

  const bathrooms = allProperties.map((p) => p.bathrooms || 0);
  const maxBathrooms = Math.max(...bathrooms);
  const bathroomScore = maxBathrooms > 0 ? ((property.bathrooms || 0) / maxBathrooms) * 100 : 50;
  score += bathroomScore * weights.bathrooms;
  breakdown.bathrooms = Math.round(bathroomScore);

  const engagementScore = Math.min(100, (
    (property.viewCount || 0) * 0.3 +
    (property.likedBy?.length || 0) * 5 +
    (property.savedBy?.length || 0) * 8 +
    (property.commentCount || 0) * 10
  ));
  score += engagementScore * weights.engagement;
  breakdown.engagement = Math.round(engagementScore);

  const daysSincePublish = property.publishedAt
    ? (new Date() - new Date(property.publishedAt)) / (1000 * 60 * 60 * 24)
    : 365;
  const recencyScore = Math.max(0, 100 - (daysSincePublish / 3));
  score += recencyScore * weights.recency;
  breakdown.recency = Math.round(recencyScore);

  return { total: Math.round(score), breakdown };
}

export function getBestPropertyReason(bestProperty, allProperties) {
  const reasons = [];
  const breakdown = bestProperty.scoreBreakdown;
  if (breakdown.price > 70) reasons.push("Best value for money");
  if (breakdown.area > 70) reasons.push("Largest area");
  if (breakdown.bedrooms > 70) reasons.push("Most bedrooms");
  if (breakdown.bathrooms > 70) reasons.push("Most bathrooms");
  if (breakdown.engagement > 70) reasons.push("Highly popular");
  if (breakdown.recency > 70) reasons.push("Recently listed");
  return reasons.length > 0 ? reasons.slice(0, 2).join(", ") : "Best overall match";
}

export function generateFeedReason(post, userCity, userPrefs) {
  const reasons = [];
  if (userCity && String(post.city || "").toLowerCase() === userCity.toLowerCase()) {
    reasons.push("In your city");
  }
  if (post.locality && userPrefs?.localities?.includes(post.locality)) {
    reasons.push(`Matches your area: ${post.locality}`);
  }
  const pt = String(post.postType || "").toUpperCase();
  if (userPrefs?.postTypes?.includes(pt)) {
    reasons.push("Matches your search history");
  }
  if (post.personalizationScore >= 75) reasons.push("Top pick for you");
  else if (post.personalizationScore >= 55) reasons.push("Good match");
  if (Number(post.likesCount || 0) >= 10) reasons.push("Popular listing");
  const daysSince = post.createdAt ? (Date.now() - new Date(post.createdAt).getTime()) / 86400000 : 999;
  if (daysSince <= 2) reasons.push("Just listed");
  if (post.author?.isOwnerVerified || post.author?.isVerified) reasons.push("Verified owner");
  return reasons.slice(0, 2);
}

export function getMatchReason(property, comparedProperties, userBehavior) {
  const reasons = [];
  const comparedCities = comparedProperties.map((p) => p.city);
  if (comparedCities.includes(property.city)) reasons.push("Same location as compared properties");
  const comparedTypes = comparedProperties.map((p) => p.propertyType);
  if (comparedTypes.includes(property.propertyType)) reasons.push("Similar property type");
  const avgPrice = comparedProperties.reduce((sum, p) => sum + (p.price || 0), 0) / comparedProperties.length;
  if (property.price >= avgPrice * 0.8 && property.price <= avgPrice * 1.2) reasons.push("Within your budget range");
  if (userBehavior.preferredPropertyTypes?.some((pt) => pt.type === property.propertyType)) reasons.push("Matches your preferences");
  return reasons.length > 0 ? reasons[0] : "Similar to properties you viewed";
}

// ── Post decoration ─────────────────────────────────────────────────────

export async function batchDecoratePosts(posts, currentUserId) {
  if (!Array.isArray(posts) || posts.length === 0) return [];
  const uid = currentUserId ? String(currentUserId) : null;

  try {
    const multi = redisClient.multi();
    for (const post of posts) {
      const pid = String(post._id);
      const likeKey = `post:${pid}:liked_by`;
      const saveKey = `post:${pid}:saved_by`;
      const viewsKey = `post:${pid}:views`;

      multi.zCard(likeKey);
      multi.zScore(likeKey, "__empty__");
      if (uid) multi.zScore(likeKey, uid);
      multi.zCard(saveKey);
      multi.zScore(saveKey, "__empty__");
      if (uid) multi.zScore(saveKey, uid);
      multi.get(viewsKey);
    }

    const results = await multi.exec();
    if (!results || results.length === 0) {
      return Promise.all(posts.map((p) => decorateForUser(p, uid)));
    }

    const stride = uid ? 7 : 5;
    return posts.map((post, idx) => {
      let offset = idx * stride;

      let rawLikeCount = Number(results[offset++]) || 0;
      const likeSentinel = results[offset++];
      if (likeSentinel !== null && likeSentinel !== undefined && Number(likeSentinel) === 0) {
        rawLikeCount = Math.max(0, rawLikeCount - 1);
      }
      let isLikedByMe = false;
      if (uid) {
        const likeScore = results[offset++];
        isLikedByMe = likeScore !== null && likeScore !== undefined;
      }

      let rawSaveCount = Number(results[offset++]) || 0;
      const saveSentinel = results[offset++];
      if (saveSentinel !== null && saveSentinel !== undefined && Number(saveSentinel) === 0) {
        rawSaveCount = Math.max(0, rawSaveCount - 1);
      }
      let isSavedByMe = false;
      if (uid) {
        const saveScore = results[offset++];
        isSavedByMe = saveScore !== null && saveScore !== undefined;
      }

      const cachedViews = results[offset++];
      let viewCount = Number(post.viewCount || 0);
      if (cachedViews !== null && cachedViews !== undefined) {
        viewCount = parseInt(cachedViews, 10) || 0;
      }

      const likedBy = Array.isArray(post.likedBy) ? post.likedBy.map(String) : [];
      const savedBy = Array.isArray(post.savedBy) ? post.savedBy.map(String) : [];
      const isBoostActive = Boolean(
        post.isBoosted && post.boostExpiresAt && new Date(post.boostExpiresAt).getTime() > Date.now(),
      );

      return {
        ...post,
        isBoosted: isBoostActive,
        boostExpiresAt: post.boostExpiresAt,
        boostCount: post.boostCount || 0,
        likesCount: rawLikeCount > 0 ? rawLikeCount : likedBy.length,
        savesCount: rawSaveCount > 0 ? rawSaveCount : savedBy.length,
        viewCount,
        isLikedByMe: uid ? isLikedByMe : false,
        isSavedByMe: uid ? isSavedByMe : false,
        priceHistory: sanitizePriceHistory(post.priceHistory, post.price),
      };
    });
  } catch (err) {
    logger.warn("Pipeline batch decorate error, falling back to individual calls:", err?.message);
    return Promise.all(posts.map((p) => decorateForUser(p, uid)));
  }
}

async function decorateForUser(post, currentUserId) {
  const likedBy = Array.isArray(post.likedBy) ? post.likedBy.map(String) : [];
  const savedBy = Array.isArray(post.savedBy) ? post.savedBy.map(String) : [];
  const isBoostActive = Boolean(
    post.isBoosted && post.boostExpiresAt && new Date(post.boostExpiresAt).getTime() > Date.now(),
  );

  let likesCount = likedBy.length;
  let isLikedByMe = currentUserId ? likedBy.includes(currentUserId) : false;
  let savesCount = savedBy.length;
  let isSavedByMe = currentUserId ? savedBy.includes(currentUserId) : false;
  let viewCount = Number(post.viewCount || 0);

  try {
    const [likeEng, saveEng, cachedViews] = await Promise.all([
      getPostEngagement(post._id, currentUserId, "like"),
      getPostEngagement(post._id, currentUserId, "save"),
      redisClient.get(`post:${post._id}:views`).catch(() => null),
    ]);
    if (likeEng !== null) { likesCount = likeEng.count; isLikedByMe = Boolean(likeEng.isEngaged); }
    if (saveEng !== null) { savesCount = saveEng.count; isSavedByMe = Boolean(saveEng.isEngaged); }
    if (cachedViews !== null && cachedViews !== undefined) viewCount = parseInt(cachedViews, 10) || 0;
  } catch {}

  return {
    ...post,
    isBoosted: isBoostActive,
    boostExpiresAt: post.boostExpiresAt,
    boostCount: post.boostCount || 0,
    likesCount, savesCount, viewCount, isLikedByMe, isSavedByMe,
    priceHistory: sanitizePriceHistory(post.priceHistory, post.price),
  };
}

// ── Social proof ────────────────────────────────────────────────────────

export async function attachSocialProof(posts, currentUserId) {
  if (!Array.isArray(posts) || posts.length === 0) return posts;

  const locations = posts.filter((p) => p.city).map((p) => ({ city: p.city, locality: p.locality }));
  const [graphResult, forecastMap] = await Promise.all([
    currentUserId ? repo.getUserSocialGraph(currentUserId) : null,
    batchGetForecasts(locations),
  ]);

  const friends = graphResult?.friends ?? new Set();
  const communityIds = graphResult?.communityIds ?? new Set();
  const viewer = graphResult?.viewer ?? null;

  const picks = new Map();
  const wanted = new Set();
  for (const p of posts) {
    const friendLiker = (p.likedBy || []).map(String).find((id) => id !== currentUserId && friends.has(id));
    if (!friendLiker) continue;
    picks.set(String(p._id), friendLiker);
    wanted.add(friendLiker);
  }

  const postIds = posts.map((p) => p._id);
  const [friendViewRows, commSaveRows] = await Promise.all([
    repo.aggregateFriendViews(friends, postIds),
    repo.aggregateCommunitySaves(communityIds, postIds),
  ]);

  const friendViewersMap = new Map();
  for (const row of friendViewRows) {
    friendViewersMap.set(String(row._id), row.viewers.map((v) => ({
      name: (v.name || "A connection").split(" ")[0],
      avatar: v.avatar || null,
    })));
  }
  const communitySavesMap = new Map();
  for (const row of commSaveRows) {
    communitySavesMap.set(String(row._id), row.count);
  }

  // City velocity
  const cityVelocityMap = new Map();
  const cityPosts = new Map();
  for (const p of posts) {
    const city = (p.city || "other").toLowerCase();
    if (!cityPosts.has(city)) cityPosts.set(city, []);
    cityPosts.get(city).push({
      postId: String(p._id),
      savesCount: p.savesCount || (p.savedBy || []).length,
      createdAt: p.createdAt,
    });
  }
  for (const [city, cityListings] of cityPosts) {
    if (cityListings.length < 3) continue;
    const avgSaves = cityListings.reduce((s, l) => s + l.savesCount, 0) / cityListings.length;
    for (const l of cityListings) {
      if (avgSaves === 0) continue;
      const multiplier = l.savesCount / avgSaves;
      if (multiplier >= 2) {
        cityVelocityMap.set(l.postId, {
          multiplier: Math.round(multiplier * 10) / 10,
          label: `${Math.round(multiplier * 10) / 10}× more saves than similar homes`,
        });
      }
    }
  }

  const postObjectIds = posts.map((p) => p._id).filter(Boolean);
  const [likers, { visitStats, offerStats }] = await Promise.all([
    repo.findUsersByIds([...wanted]),
    repo.aggregateInquiryStats(postObjectIds),
  ]);

  const byId = new Map(likers.map((u) => [String(u._id), u]));
  const realInquiriesTodayMap = new Map();
  const realInquiriesWeekMap = new Map();
  for (const item of [...visitStats, ...offerStats]) {
    const pid = String(item._id);
    realInquiriesTodayMap.set(pid, (realInquiriesTodayMap.get(pid) || 0) + (item.today || 0));
    realInquiriesWeekMap.set(pid, (realInquiriesWeekMap.get(pid) || 0) + (item.week || 0));
  }

  return posts.map((p) => {
    const pid = String(p._id);
    const socialProof = {};

    const u = byId.get(picks.get(pid));
    if (u) {
      socialProof.name = (u.fullName || "A connection").split(" ")[0];
      socialProof.fullName = u.fullName || "A connection";
      socialProof.avatar = u.profilePic || null;
      socialProof.isFriend = true;
      socialProof.isOwnerVerified = Boolean(u.isOwnerVerified);
      socialProof.othersCount = Math.max(0, (p.likesCount || 0) - 1);
    }

    const friendViewers = friendViewersMap.get(pid);
    if (friendViewers && friendViewers.length > 0) {
      socialProof.friendsViewed = friendViewers.slice(0, 3);
      socialProof.friendsViewedCount = friendViewers.length;
    }

    const commSaves = communitySavesMap.get(pid);
    if (commSaves && commSaves > 0) {
      socialProof.communitySaves = commSaves;
      socialProof.communityProof = `${commSaves} member${commSaves > 1 ? "s" : ""} from your communities saved this`;
    }

    const velocity = cityVelocityMap.get(pid);
    if (velocity) socialProof.cityVelocity = velocity;

    if (p.author?.responseRate != null) {
      const rate = p.author.responseRate;
      if (rate >= 90) socialProof.authorResponseTime = "~15 mins";
      else if (rate >= 70) socialProof.authorResponseTime = "~2 hrs";
      else if (rate >= 50) socialProof.authorResponseTime = "~6 hrs";
      else socialProof.authorResponseTime = "~1 day";
    }

    const postForecast = forecastMap?.get(`${String(p.city || "").toLowerCase()}:${String(p.locality || "").toLowerCase()}`) || null;
    const dealProbability = calculateDealProbability(p, p.author);

    const basePost = {
      ...p,
      realInquiriesToday: realInquiriesTodayMap.get(pid) || 0,
      realInquiriesWeek: realInquiriesWeekMap.get(pid) || 0,
      ...(Object.keys(socialProof).length > 0 ? { socialProof } : {}),
      ...(postForecast?.annualizedRate ? { appreciationForecast: postForecast } : {}),
      ...(dealProbability ? { dealProbability } : {}),
    };

    return CardCTRService.enrichPostSignals(basePost, viewer);
  });
}

// ── Price insight ───────────────────────────────────────────────────────

export async function priceBenchmarkFor(cityRaw, propertyType, beds, excludeId, intent = "buy") {
  const cityKey = String(cityRaw || "").toLowerCase().trim();
  if (!cityKey || !propertyType) return { medianPsf: 0, sampleSize: 0 };
  const wantRent = intent === "rent";
  const cacheKey = `price:insight:${cityKey}:${String(propertyType).toLowerCase()}:${Number(beds) || 0}:${wantRent ? "rent" : "buy"}`;

  const cached = await repo.getFromCache(cacheKey);
  if (cached) return cached;

  const rows = await repo.findPriceBenchmarkListings(cityKey, propertyType, wantRent);

  let pool = rows;
  if (Number(beds) > 0) {
    const sameBeds = rows.filter((r) => Number(r.bedrooms) === Number(beds));
    if (sameBeds.length >= PRICE_INSIGHT_MIN_SAMPLE) pool = sameBeds;
  }
  const bounds = PSF_BOUNDS[wantRent ? "rent" : "buy"];
  const psfs = pool
    .filter((r) => String(r._id) !== String(excludeId || ""))
    .map((r) => r.price / r.areaSqft)
    .filter((v) => Number.isFinite(v) && v >= bounds.min && v <= bounds.max);

  const benchmark = { medianPsf: Math.round(median(psfs)), sampleSize: psfs.length };
  await repo.setCache(cacheKey, 3600, benchmark);
  return benchmark;
}

export function insightFromBenchmark(post, benchmark) {
  const sp = subjectPsfOf(post, intentOf(post));
  if (!sp || !benchmark || benchmark.sampleSize < PRICE_INSIGHT_MIN_SAMPLE || !benchmark.medianPsf) {
    return { available: false };
  }
  const deltaPct = Math.round(((sp - benchmark.medianPsf) / benchmark.medianPsf) * 100);
  return {
    available: true,
    subjectPricePerSqft: Math.round(sp),
    medianPricePerSqft: benchmark.medianPsf,
    sampleSize: benchmark.sampleSize,
    deltaPct,
    verdict: deltaPct <= -8 ? "below" : deltaPct >= 12 ? "above" : "around",
  };
}

export { subjectPsfOf };

// ── Price change notifications ──────────────────────────────────────────

export async function handlePriceChangeFanout(post, oldPrice) {
  try {
    const { enqueuePriceDropFanout } = await import("../../jobs/producers/ingestion.producer.js");
    await enqueuePriceDropFanout(post._id, oldPrice);
  } catch {
    const alertedUserIds = await notifyTriggeredPriceAlerts(post, oldPrice);
    await notifyPriceChange(post, oldPrice, new Set(alertedUserIds.map(String)));
  }
}

export async function notifyPriceChange(post, oldPrice, excludeUserIds = new Set()) {
  const drop = Number(oldPrice) - Number(post.price);
  if (drop <= 0) return;
  if (drop < PRICE_DROP_MIN_ABS && drop / oldPrice < PRICE_DROP_MIN_PCT) return;
  if (post.lastPriceDropNotifyAt && Date.now() - new Date(post.lastPriceDropNotifyAt).getTime() < PRICE_DROP_COOLDOWN_MS) return;

  let alertUsers = [];
  try { alertUsers = await activeAlertUserIdsForPost(post._id); } catch { alertUsers = []; }
  const skip = new Set([...excludeUserIds, ...alertUsers.map(String), String(post.author)]);

  const interestedIds = [
    ...new Set([...(post.likedBy || []), ...(post.savedBy || [])].map((id) => String(id))),
  ].filter((id) => !skip.has(id));

  if (interestedIds.length === 0) return;

  const oldFormatted = `₹${Number(oldPrice).toLocaleString("en-IN")}`;
  const newFormatted = `₹${Number(post.price).toLocaleString("en-IN")}`;
  const pct = Math.round((drop / oldPrice) * 100);

  await Promise.allSettled(
    interestedIds.map((recipientId) =>
      NotificationService.send({
        recipientId,
        actorId: post.author,
        type: "price_drop",
        title: "Price drop on a property you saved",
        message: `Price dropped ${pct}% from ${oldFormatted} to ${newFormatted} on "${post.title}"`,
        data: { propertyPost: post._id, priceBefore: oldPrice, priceAfter: post.price },
        channels: [NotificationChannel.IN_APP, NotificationChannel.REALTIME, NotificationChannel.FIREBASE],
      }),
    ),
  );

  await repo.updatePostFields(post._id, { $set: { lastPriceDropNotifyAt: new Date() } }, { timestamps: false });
}

export async function notifyActiveOfferBuyersOfPriceChange(post, oldPrice) {
  const { default: Offer } = await import("../../models/Offer.model.js");
  const activeOffers = await Offer.find({ post: post._id, status: { $in: ["pending", "countered"] } }).select("buyer currentPrice").lean() || [];
  if (activeOffers.length === 0) return;

  const oldFormatted = `₹${Number(oldPrice).toLocaleString("en-IN")}`;
  const newFormatted = `₹${Number(post.price).toLocaleString("en-IN")}`;

  await Promise.allSettled(
    activeOffers.map((offer) => {
      const offerFormatted = `₹${Number(offer.currentPrice).toLocaleString("en-IN")}`;
      return NotificationService.send({
        recipientId: offer.buyer,
        actorId: post.author,
        type: "offer_price_changed",
        title: `Listed price changed on "${post.title}"`,
        message: `The listed price on "${post.title}" changed from ${oldFormatted} to ${newFormatted} — your open offer of ${offerFormatted} is unaffected and still active`,
        data: { propertyPost: post._id },
        channels: [NotificationChannel.IN_APP, NotificationChannel.REALTIME, NotificationChannel.FIREBASE],
      });
    }),
  );
}

// ── Post CRUD business logic ────────────────────────────────────────────

export async function createPost(user, body) {
  const activeRole = resolveActiveRole(user);
  const allowedPostTypes = getAllowedPostTypesForRole(activeRole);
  const requestedPostType = normalizePostType(body?.postType) || allowedPostTypes[0];
  const effectivePostType = canRoleCreatePostType(activeRole, requestedPostType) ? requestedPostType : allowedPostTypes[0];

  if (effectivePostType !== requestedPostType) {
    logger.warn(`Post type ${requestedPostType} not allowed for role ${activeRole || "UNKNOWN"}. Falling back to ${effectivePostType}.`);
  }

  const postTypeDefaults = getPostTypeDefaults(effectivePostType);
  let title = String(body?.title || "").trim();
  if (!title) {
    const locality = String(body?.locality || "").trim();
    const city = String(body?.city || "").trim();
    const locationHint = [locality, city].filter(Boolean).join(", ");
    title = locationHint ? `Post for ${locationHint}` : "NearMySpace Post";
  }

  const status = String(body?.status || "PUBLISHED").trim().toUpperCase();
  const visibility = String(body?.visibility || "PUBLIC").trim().toUpperCase();
  const safeStatus = POST_STATUSES.includes(status) ? status : "PUBLISHED";
  const safeVisibility = POST_VISIBILITIES.includes(visibility) ? visibility : "PUBLIC";

  const meta = sanitizePostMeta(body?.postMeta);
  const billUrl = meta?.residential?.electricityBillUrl || meta?.electricityBillUrl;
  if (billUrl) {
    if (!meta.residential) meta.residential = {};
    meta.residential.electricityBillStatus = "PENDING";
  } else if (meta?.residential) {
    meta.residential.electricityBillStatus = "NONE";
  }

  const post = await repo.createPost({
    author: user._id,
    authorRole: activeRole,
    postType: effectivePostType,
    status: safeStatus,
    visibility: safeVisibility,
    publishedAt: safeStatus === "PUBLISHED" ? new Date() : undefined,
    listingType: String(body?.listingType || postTypeDefaults.listingType || "Buy").trim(),
    propertyType: String(body?.propertyType || postTypeDefaults.propertyType || "Apartment").trim(),
    title,
    caption: String(body?.caption || "").trim(),
    city: String(body?.city || "").trim(),
    locality: String(body?.locality || "").trim(),
    price: Number(body?.price || 0),
    priceHistory: [{ price: Number(body?.price || 0), changedAt: new Date() }],
    bedrooms: Number(body?.bedrooms || 0),
    bathrooms: Number(body?.bathrooms || 0),
    areaSqft: Number(body?.areaSqft || 0),
    mediaUrls: normalizeMediaUrls(body?.mediaUrls),
    postMeta: meta,
    latitude: body?.latitude ? Number(body.latitude) : undefined,
    longitude: body?.longitude ? Number(body.longitude) : undefined,
  });

  const populated = await repo.findPostByIdPopulated(post._id);

  if (safeStatus === "PUBLISHED" && safeVisibility === "PUBLIC") {
    notifySavedSearchMatches(populated).catch((error) => {
      logger.error("Failed to notify saved-search matches (non-fatal):", error);
    });
  }

  await invalidateDiscoverCache(user._id);

  try {
    const { enqueuePostEnrichment } = await import("../../jobs/producers/ingestion.producer.js");
    await enqueuePostEnrichment(post._id, post.city);
  } catch {}

  await repo.invalidateFeedCache();

  return {
    ...populated,
    likesCount: 0,
    isLikedByMe: false,
    savesCount: 0,
    isSavedByMe: false,
  };
}

export async function updatePost(user, postId, body) {
  const post = await repo.findPostByIdMutable(postId);
  if (!post || post.isDeleted) throw Object.assign(new Error("Post not found"), { status: 404 });
  if (String(post.author) !== String(user._id)) throw Object.assign(new Error("You can only edit your own posts"), { status: 403 });

  const activeRole = resolveActiveRole(user);
  const allowedPostTypes = getAllowedPostTypesForRole(activeRole);
  const requestedPostType = normalizePostType(body?.postType) || post.postType;
  const effectivePostType = canRoleCreatePostType(activeRole, requestedPostType) ? requestedPostType : allowedPostTypes[0];

  let title = String(body?.title || "").trim();
  if (!title) {
    const locality = String(body?.locality || post.locality || "").trim();
    const city = String(body?.city || post.city || "").trim();
    const locationHint = [locality, city].filter(Boolean).join(", ");
    title = locationHint ? `Post for ${locationHint}` : "NearMySpace Post";
  }

  const status = String(body?.status || post.status || "PUBLISHED").trim().toUpperCase();
  const visibility = String(body?.visibility || post.visibility || "PUBLIC").trim().toUpperCase();
  const safeStatus = POST_STATUSES.includes(status) ? status : "PUBLISHED";
  const safeVisibility = POST_VISIBILITIES.includes(visibility) ? visibility : "PUBLIC";
  const wasPublished = post.status === "PUBLISHED";
  const isBeingUnpublished = wasPublished && safeStatus !== "PUBLISHED";
  const isBeingPublished = !wasPublished && safeStatus === "PUBLISHED" && safeVisibility === "PUBLIC";

  post.postType = effectivePostType;
  post.status = safeStatus;
  post.visibility = safeVisibility;
  if (isBeingPublished) post.publishedAt = new Date();
  post.listingType = String(body?.listingType || post.listingType).trim();
  post.propertyType = String(body?.propertyType || post.propertyType).trim();
  post.customBadge = String(body?.customBadge ?? post.customBadge ?? "").trim().slice(0, 40);
  post.title = title;
  post.caption = String(body?.caption || post.caption).trim();
  post.city = String(body?.city || post.city).trim();
  post.locality = String(body?.locality || post.locality).trim();
  const oldPrice = post.price;
  post.price = Number(body?.price ?? post.price);

  if (isBeingPublished) {
    post.priceHistory = [{ price: post.price, changedAt: post.publishedAt || new Date() }];
  } else if (safeStatus === "DRAFT") {
    post.priceHistory = [{ price: post.price, changedAt: post.createdAt || new Date() }];
  } else if (wasPublished && post.price !== oldPrice && oldPrice > 0 && post.price > 0) {
    if (!post.priceHistory || post.priceHistory.length === 0) {
      post.priceHistory = [{ price: oldPrice, changedAt: post.publishedAt || post.createdAt || new Date() }];
    }
    post.priceHistory.push({ price: post.price, changedAt: new Date() });
  }
  post.bedrooms = Number(body?.bedrooms ?? post.bedrooms);
  post.bathrooms = Number(body?.bathrooms ?? post.bathrooms);
  post.areaSqft = Number(body?.areaSqft ?? post.areaSqft);

  if (body?.mediaUrls) post.mediaUrls = normalizeMediaUrls(body.mediaUrls);

  if (body?.electricityBillUrl !== undefined && !body?.postMeta) {
    const billUrl = String(body.electricityBillUrl || "").trim();
    if (!post.postMeta) post.postMeta = {};
    if (!post.postMeta.residential) post.postMeta.residential = {};
    post.postMeta.residential.electricityBillUrl = billUrl;
    if (billUrl) {
      post.postMeta.residential.electricityBillStatus = "PENDING";
      post.postMeta.residential.electricityBillVerifiedAt = undefined;
      post.postMeta.residential.electricityBillVerifiedBy = undefined;
      post.postMeta.residential.electricityBillRejectionReason = undefined;
    } else {
      post.postMeta.residential.electricityBillStatus = "NONE";
    }
    post.markModified("postMeta");
  }

  if (body?.postMeta) {
    const sanitizedMeta = sanitizePostMeta(body.postMeta);
    const oldBill = post.postMeta?.residential?.electricityBillUrl || post.postMeta?.electricityBillUrl;
    const newBill = sanitizedMeta?.residential?.electricityBillUrl || sanitizedMeta?.electricityBillUrl;

    if (newBill) {
      if (newBill !== oldBill) {
        if (!sanitizedMeta.residential) sanitizedMeta.residential = {};
        sanitizedMeta.residential.electricityBillStatus = "PENDING";
        sanitizedMeta.residential.electricityBillVerifiedAt = undefined;
        sanitizedMeta.residential.electricityBillVerifiedBy = undefined;
        sanitizedMeta.residential.electricityBillRejectionReason = undefined;
      } else {
        if (!sanitizedMeta.residential) sanitizedMeta.residential = {};
        sanitizedMeta.residential.electricityBillStatus = post.postMeta?.residential?.electricityBillStatus || "PENDING";
        sanitizedMeta.residential.electricityBillVerifiedAt = post.postMeta?.residential?.electricityBillVerifiedAt;
        sanitizedMeta.residential.electricityBillVerifiedBy = post.postMeta?.residential?.electricityBillVerifiedBy;
        sanitizedMeta.residential.electricityBillRejectionReason = post.postMeta?.residential?.electricityBillRejectionReason;
      }
    } else if (sanitizedMeta?.residential) {
      sanitizedMeta.residential.electricityBillStatus = "NONE";
    }
    post.postMeta = sanitizedMeta;
  }

  if (body?.latitude !== undefined) post.latitude = body.latitude ? Number(body.latitude) : undefined;
  if (body?.longitude !== undefined) post.longitude = body.longitude ? Number(body.longitude) : undefined;

  await post.save();

  if (oldPrice > 0 && post.price > 0 && post.price !== oldPrice) {
    handlePriceChangeFanout(post, oldPrice).catch((error) => {
      logger.error("Failed to send price-change notifications (non-fatal):", error);
    });
  }
  if (post.price !== oldPrice) {
    notifyActiveOfferBuyersOfPriceChange(post, oldPrice).catch((error) => {
      logger.error("Failed to notify offer buyers of price change (non-fatal):", error);
    });
  }
  if (isBeingUnpublished) {
    closeActiveOffersForPost(post._id, user._id).catch((error) => {
      logger.error("Failed to close active offers on unpublished post (non-fatal):", error);
    });
  }

  const populated = await repo.findPostByIdPopulated(post._id);

  if (isBeingPublished) {
    notifySavedSearchMatches(populated).catch((error) => {
      logger.error("Failed to notify saved-search matches (non-fatal):", error);
    });
  }

  await invalidateDiscoverCache(user._id);
  await invalidateActivityCache(user._id);
  await invalidatePostDetailCache(post._id);
  await repo.invalidateFeedCache();

  return {
    ...populated,
    likesCount: populated.likedBy?.length || 0,
    isLikedByMe: populated.likedBy?.some((id) => String(id) === String(user._id)) || false,
    savesCount: populated.savedBy?.length || 0,
    isSavedByMe: populated.savedBy?.some((id) => String(id) === String(user._id)) || false,
  };
}

export async function deletePost(user, postId) {
  const post = await repo.findPostByIdMutable(postId);
  if (!post) throw Object.assign(new Error("Post not found"), { status: 404 });
  if (String(post.author) !== String(user._id)) throw Object.assign(new Error("You can only delete your own posts"), { status: 403 });

  const activeDeal = await repo.checkActiveDeal(postId);
  if (activeDeal) {
    throw Object.assign(new Error("Cannot delete listing while an active deal is in progress. Complete or cancel the deal first."), { status: 409 });
  }

  await repo.softDeletePost(post, user._id);

  await closeActiveOffersForPost(postId, user._id).catch((error) => {
    logger.error("Failed to close active offers on deleted post (non-fatal):", error);
  });
  await deletePriceAlertsForPost(postId).catch((error) => {
    logger.error("Failed to clear price alerts on deleted post (non-fatal):", error);
  });

  await invalidateDiscoverCache();
  await invalidateActivityCache(user._id);
  await invalidatePostDetailCache(postId);
  if (post.city) await invalidateHotCityCache(post.city);
}

// ── Engagement toggles ──────────────────────────────────────────────────

export async function toggleLike(user, postId) {
  const post = await repo.findPostById(postId, { select: "author isDeleted isBlocked title city locality postType price listingType", populate: { path: "author", select: "fullName" } });
  if (!post || post.isDeleted || post.isBlocked) throw Object.assign(new Error("Post not found"), { status: 404 });

  const { active: liked, count: likesCount } = await toggleEngagementRedis(postId, user._id, "like");

  if (liked) {
    setImmediate(() => {
      CardCTRService.recordWeightedEngagement(String(user._id), String(postId), "like", {
        locality: post.locality || post.city || "", postType: post.postType || "", price: post.price || 0, listingType: post.listingType || "",
      }).catch(() => {});
    });
  }

  const authorId = post.author?._id || post.author;
  if (liked && authorId && String(authorId) !== String(user._id)) {
    setImmediate(async () => {
      try {
        await NotificationService.send({
          recipientId: authorId, actorId: user._id, type: "property_like",
          title: "New like", message: `${user.fullName || "Someone"} liked your property: ${post.title}`,
          data: { propertyPost: post._id },
          channels: [NotificationChannel.IN_APP, NotificationChannel.REALTIME, NotificationChannel.FIREBASE],
        });
      } catch (notifErr) { logger.warn(`Async like notification failed for post ${post._id}:`, notifErr?.message); }
    });
  }

  setImmediate(async () => {
    try {
      await invalidateDiscoverCache(user._id);
      await invalidateActivityCache(user._id);
      await PersonalizationService.invalidatePersonalizationCache(user._id);
      if (post.city) await invalidateHotCityCache(post.city);
    } catch (cacheErr) { logger.warn("Async cache invalidation error on like:", cacheErr?.message); }
  });

  return { liked, likesCount };
}

export async function toggleSave(user, postId) {
  const post = await repo.findPostById(postId, { select: "author isDeleted isBlocked title city locality postType price listingType", populate: { path: "author", select: "fullName" } });
  if (!post || post.isDeleted || post.isBlocked) throw Object.assign(new Error("Post not found"), { status: 404 });

  const { active: saved, count: savesCount } = await toggleEngagementRedis(postId, user._id, "save");

  if (saved) {
    setImmediate(() => {
      CardCTRService.recordWeightedEngagement(String(user._id), String(postId), "save", {
        locality: post.locality || post.city || "", postType: post.postType || "", price: post.price || 0, listingType: post.listingType || "",
      }).catch(() => {});
    });
  }

  const authorId = post.author?._id || post.author;
  if (saved && authorId && String(authorId) !== String(user._id)) {
    setImmediate(async () => {
      try {
        await NotificationService.send({
          recipientId: authorId, actorId: user._id, type: "property_save",
          title: "New save", message: `${user.fullName || "Someone"} saved your property: ${post.title}`,
          data: { propertyPost: post._id },
          channels: [NotificationChannel.IN_APP, NotificationChannel.REALTIME, NotificationChannel.FIREBASE],
        });
      } catch (notifErr) { logger.warn(`Async save notification failed for post ${post._id}:`, notifErr?.message); }
    });
  }

  setImmediate(async () => {
    try {
      await invalidateDiscoverCache(user._id);
      await invalidateActivityCache(user._id);
      await PersonalizationService.invalidatePersonalizationCache(user._id);
      if (post.city) await invalidateHotCityCache(post.city);
    } catch (cacheErr) { logger.warn("Async cache invalidation error on save:", cacheErr?.message); }
  });

  return { saved, savesCount };
}

// ── Boost ───────────────────────────────────────────────────────────────

export async function boostPost(user, postId) {
  const { default: UserModel } = await import("../../models/User.model.js");
  const post = await repo.findPostByIdMutable(postId);
  if (!post || post.isDeleted) throw Object.assign(new Error("Post not found"), { status: 404 });
  if (post.isBlocked) throw Object.assign(new Error("Cannot boost a blocked property listing"), { status: 400 });

  const authorId = post.author?._id ? String(post.author._id) : String(post.author);
  if (authorId !== String(user._id)) throw Object.assign(new Error("You can only boost your own property listings"), { status: 403 });

  const debitResult = await debitCoins({
    userId: user._id, amount: 1, category: "POST_BOOST_SPEND",
    description: `Boosted listing "${post.title || "Property"}" for 24 hours`,
    referenceId: post._id, referenceModel: "PropertyPost",
  });

  if (!debitResult.success) {
    const userExists = await UserModel.exists({ _id: user._id });
    if (!userExists) throw Object.assign(new Error("User not found"), { status: 404 });
    throw Object.assign(new Error("Insufficient referral coins. You need 1 referral coin to boost this property."), { status: 400 });
  }

  const now = Date.now();
  const currentExpiry = post.isBoosted && post.boostExpiresAt ? new Date(post.boostExpiresAt).getTime() : 0;
  const baseTime = currentExpiry > now ? currentExpiry : now;
  const boostDurationMs = 24 * 60 * 60 * 1000;
  const boostedAt = new Date();
  const boostExpiresAt = new Date(baseTime + boostDurationMs);
  const newBoostCount = (post.boostCount || 0) + 1;

  await repo.updatePostFields(postId, {
    $set: { isBoosted: true, boostedAt, boostExpiresAt },
    $inc: { boostCount: 1 },
  });

  post.isBoosted = true;
  post.boostedAt = boostedAt;
  post.boostExpiresAt = boostExpiresAt;
  post.boostCount = newBoostCount;

  try {
    await invalidateDiscoverCache(user._id);
    await invalidateActivityCache(user._id);
    await invalidatePostDetailCache(postId);
    await PersonalizationService.invalidatePersonalizationCache(user._id);
    await repo.invalidateFeedCache();
    if (post.city) await invalidateHotCityCache(post.city);
  } catch (cacheError) { logger.warn("Cache invalidation error on boost (non-fatal):", cacheError); }

  try {
    await NotificationService.send({
      recipientId: user._id, actorId: user._id, type: "post_boosted",
      title: "Property Boosted! 🚀",
      message: `Your property "${post.title}" is now boosted for 24 hours with priority feed visibility.`,
      data: { propertyPost: post._id },
      channels: [NotificationChannel.IN_APP, NotificationChannel.REALTIME],
    });
  } catch (notifyErr) { logger.warn("Failed to send boost notification (non-fatal):", notifyErr); }

  await post.populate("author", "fullName profilePic activeRole primaryRole city isVerified isOwnerVerified ratingAvg ratingCount responseRate");

  return {
    post: { ...post.toObject(), isBoosted: true, boostExpiresAt: post.boostExpiresAt, boostCount: post.boostCount },
    remainingCredits: debitResult.wallet.balance,
  };
}

// ── Media upload signature ──────────────────────────────────────────────

export function generateUploadSignature() {
  const timestamp = Math.round(Date.now() / 1000);
  const paramsToSign = { timestamp, folder: PROPERTY_MEDIA_FOLDER, allowed_formats: PROPERTY_MEDIA_ALLOWED_FORMATS };
  const signature = cloudinaryInstance.utils.api_sign_request(paramsToSign, cloudinaryInstance.config().api_secret);
  return {
    ...paramsToSign, signature,
    apiKey: cloudinaryInstance.config().api_key,
    cloudName: cloudinaryInstance.config().cloud_name,
  };
}

// ── Cache invalidation helpers (re-exported for external consumers) ─────

export { invalidateDiscoverCache, invalidateActivityCache, invalidatePostDetailCache };
export { PersonalizationService, CardCTRService };
export { toggleEngagementRedis, getLikersFromCache, incrementViewCountRedis, getPostEngagement };
export { getCachedForecastOrRecompute, calculateFlatmateCompatibility, centroidForCity };
export { NotificationService, NotificationChannel };
