import mongoose from "mongoose";
import PropertyPost from "../../models/PropertyPost.model.js";
import User from "../../models/User.model.js";
import PostReport, { REPORT_REASON_CODES } from "../../models/PostReport.model.js";
import Offer from "../../models/Offer.model.js";
import VisitRequest from "../../models/VisitRequest.model.js";
import { sendSuccessResponse, sendErrorResponse } from "../../utils/responseHandler.js";
import { logger } from "../../utils/logger.js";
import redisClient from "../../config/redisClient.config.js";
import { normalizePostType } from "../../utils/postPolicy.js";
import { getHotPostsByCity } from "../../services/HotFeedCacheService.js";
import PersonalizationService from "../../services/PersonalizationService.js";
import CardCTRService from "../../services/CardCTRService.js";
import { calculateLivePropertyValuation } from "../../utils/propertyValuationService.js";
import * as service from "./propertyPost.service.js";
import * as repo from "./propertyPost.repository.js";
import { toAnalyticsDTO, toMyPostDTO, toComparisonDTO, toLikerDTO } from "./propertyPost.dto.js";
import {
  NEAR_ME_MAX_METERS,
  NEAR_ME_BANDS_KM,
  SAVED_LOCATION_MAX_AGE_MS,
  MAP_PINS_PROJECTION,
  MAP_PINS_CACHE_KEY,
  MAP_PINS_CACHE_TTL,
  AUTHOR_POPULATE_FIELDS,
  AUTHOR_DETAIL_POPULATE_FIELDS,
} from "./propertyPost.constants.js";

// ── Analytics ───────────────────────────────────────────────────────────

export async function getPropertyAnalytics(req, res) {
  try {
    const { propertyId } = req.params;
    const currentUserId = req.user?._id ? String(req.user._id) : "";

    const property = await PropertyPost.findById(propertyId).lean();
    if (!property) return sendErrorResponse(res, 404, "Property not found");
    if (String(property.author) !== currentUserId) {
      return sendErrorResponse(res, 403, "You don't have permission to view analytics for this property");
    }

    return sendSuccessResponse(res, 200, "Property analytics retrieved successfully", {
      analytics: toAnalyticsDTO(property),
    });
  } catch (error) {
    logger.error("Error in getPropertyAnalytics:", error);
    return sendErrorResponse(res, 500, "Failed to retrieve property analytics");
  }
}

// ── Comparison ──────────────────────────────────────────────────────────

export async function compareProperties(req, res) {
  try {
    const { propertyIds, preferenceCriteria = "balanced" } = req.body;
    const userId = req.user?._id;

    if (!propertyIds || !Array.isArray(propertyIds) || propertyIds.length < 2) {
      return sendErrorResponse(res, 400, "Please provide at least 2 property IDs for comparison");
    }
    if (propertyIds.length > 4) {
      return sendErrorResponse(res, 400, "Maximum 4 properties can be compared at once");
    }

    const cacheKey = `property:compare:${propertyIds.sort().join(",")}:${preferenceCriteria}`;
    try {
      const cachedData = await redisClient.get(cacheKey);
      if (cachedData) {
        return sendSuccessResponse(res, 200, "Properties retrieved for comparison (cached)", JSON.parse(cachedData));
      }
    } catch (cacheError) {
      logger.warn("Redis cache read error:", cacheError);
    }

    const properties = await repo.findPostsForComparison(propertyIds) || [];
    if (properties.length === 0) return sendErrorResponse(res, 404, "No properties found");

    const scoredProperties = properties.map((property) => {
      const score = service.calculatePropertyScore(property, properties, preferenceCriteria);
      return {
        ...property,
        id: property._id,
        comparisonScore: score.total,
        scoreBreakdown: score.breakdown,
        author: {
          id: property.author._id,
          fullName: property.author.fullName,
          profilePic: property.author.profilePic,
          isVerified: property.author.isVerified || false,
          isOwnerVerified: Boolean(property.author.isOwnerVerified),
        },
      };
    });

    const bestProperty = scoredProperties.reduce((best, current) =>
      current.comparisonScore > best.comparisonScore ? current : best,
    );

    let recommendations = [];
    if (userId) {
      try {
        const userBehavior = await PersonalizationService.getUserBehavior(userId);
        const avgPrice = properties.reduce((sum, p) => sum + (p.price || 0), 0) / properties.length;
        const commonCities = [...new Set(properties.map((p) => p.city).filter(Boolean))];
        const commonTypes = [...new Set(properties.map((p) => p.propertyType).filter(Boolean))];

        const similarProperties = await repo.findSimilarForRecommendation(propertyIds, commonCities, commonTypes, avgPrice) || [];

        recommendations = await Promise.all(
          similarProperties.map(async (prop) => ({
            id: prop._id,
            title: prop.title,
            price: prop.price,
            propertyType: prop.propertyType,
            city: prop.city,
            locality: prop.locality,
            bedrooms: prop.bedrooms,
            bathrooms: prop.bathrooms,
            areaSqft: prop.areaSqft,
            mediaUrls: prop.mediaUrls,
            author: { id: prop.author._id, fullName: prop.author.fullName, profilePic: prop.author.profilePic },
            recommendationScore: await PersonalizationService.calculatePropertyScore(prop, { city: commonCities[0] }, userBehavior),
            matchReason: service.getMatchReason(prop, properties, userBehavior),
          })),
        );
        recommendations = recommendations.sort((a, b) => b.recommendationScore - a.recommendationScore).slice(0, 4);
      } catch (error) {
        logger.warn("Failed to get recommendations:", error);
      }
    }

    const comparisonData = scoredProperties.map((p) => toComparisonDTO(p));
    const responseData = {
      properties: comparisonData,
      bestProperty: {
        id: bestProperty.id,
        title: bestProperty.title,
        reason: service.getBestPropertyReason(bestProperty, scoredProperties),
      },
      recommendations,
    };

    try {
      await redisClient.setEx(cacheKey, 600, JSON.stringify(responseData));
    } catch (cacheError) {
      logger.warn("Redis cache write error:", cacheError);
    }

    return sendSuccessResponse(res, 200, "Properties retrieved for comparison", responseData);
  } catch (error) {
    logger.error("Error in compareProperties:", error);
    return sendErrorResponse(res, 500, "Failed to compare properties");
  }
}

// ── Latest feed post ────────────────────────────────────────────────────

export async function getLatestFeedPost(req, res) {
  try {
    const latestPost = await repo.findLatestPost();
    return sendSuccessResponse(res, 200, "Latest post retrieved", {
      latestPostId: latestPost?._id || null,
      latestCreatedAt: latestPost?.createdAt || null,
    });
  } catch (error) {
    logger.error("Error in getLatestFeedPost:", error);
    return sendErrorResponse(res, 500, "Internal Server Error");
  }
}

// ── Property Feed ───────────────────────────────────────────────────────

export async function getPropertyFeed(req, res) {
  try {
    const page = Math.max(1, Number.parseInt(req.query.page, 10) || 1);
    const limit = Math.min(50, Math.max(1, Number.parseInt(req.query.limit, 10) || 12));
    const cursor = String(req.query.cursor || req.query.lastSeenId || "").trim();
    const hasCursor = Boolean(cursor && mongoose.Types.ObjectId.isValid(cursor));
    const skip = hasCursor ? 0 : (page - 1) * limit;
    const query = String(req.query.q || "").trim();
    const city = String(req.query.city || "").trim();
    const listingType = String(req.query.listingType || "").trim();
    const propertyType = String(req.query.propertyType || "").trim();
    const postType = normalizePostType(req.query.postType);
    const authorId = String(req.query.authorId || "").trim();
    const priceMinRaw = Number(req.query.priceMin);
    const priceMin = Number.isFinite(priceMinRaw) && priceMinRaw > 0 ? priceMinRaw : undefined;
    const priceMaxRaw = Number(req.query.priceMax);
    const priceMax = Number.isFinite(priceMaxRaw) && priceMaxRaw > 0 ? priceMaxRaw : undefined;
    const amenities = String(req.query.amenities || "").split(",").map((a) => a.trim()).filter(Boolean);
    const savedBy = String(req.query.savedBy || "").trim();
    const category = String(req.query.category || "").trim().toLowerCase();
    const statusFilter = String(req.query.status || "").trim().toUpperCase();
    const currentUserId = req.user?._id ? String(req.user._id) : "";
    const isRefresh = req.query.refresh === "true" || req.query.refresh === "1";
    const refreshSeed = parseInt(req.query.seed, 10) || 0;

    const isStandardPublicFeed =
      page === 1 && !hasCursor && !query && !authorId && !savedBy &&
      category !== "for you" && category !== "near me" &&
      priceMin === undefined && priceMax === undefined && amenities.length === 0;

    const sharedCacheKey = `property:feed:shared:${page}:${limit}:${city}:${listingType}:${propertyType}:${postType}:${category}`;
    const userCacheKey = `property:feed:${page}:${limit}:${query}:${city}:${listingType}:${propertyType}:${postType}:${authorId}:${savedBy}:${category}:${currentUserId}:${priceMin ?? ""}:${priceMax ?? ""}:${amenities.join("|")}`;

    // Try cache
    try {
      if (!isRefresh && isStandardPublicFeed) {
        const cachedRaw = await redisClient.get(sharedCacheKey);
        if (cachedRaw) {
          const { posts: rawPosts, total } = JSON.parse(cachedRaw);
          const userReportedIds = currentUserId ? await repo.getUserReportedPostIds(currentUserId) : new Set();
          const visiblePosts = userReportedIds.size > 0 ? rawPosts.filter((p) => !userReportedIds.has(String(p._id))) : rawPosts;
          const decoratedPosts = await service.attachSocialProof(await service.batchDecoratePosts(visiblePosts, currentUserId), currentUserId);
          let rankedPosts = decoratedPosts;
          if (currentUserId) {
            try {
              rankedPosts = await CardCTRService.applySessionMomentum(rankedPosts, currentUserId);
              const viewer = await User.findById(currentUserId).select("flatmateProfile locationDetails workLocation").lean();
              if (rankedPosts.some((p) => p.postType === "FLATMATE_OFFER" || p.postType === "FLATMATE_SEEKING")) {
                rankedPosts = service.scoreFlatmatePosts(rankedPosts, viewer, category);
              }
              if (category !== "near me") rankedPosts = service.applyDistanceAndFreshnessRanking(rankedPosts, viewer);
            } catch (err) {
              logger.warn("Shared cache ranking error:", err?.message);
            }
          }
          return sendSuccessResponse(res, 200, "Property feed retrieved (cached)", {
            posts: rankedPosts,
            pagination: { page, limit, total, totalPages: Math.max(1, Math.ceil(total / limit)), nextCursor: visiblePosts.length === limit ? String(visiblePosts[visiblePosts.length - 1]._id) : null, hasMore: visiblePosts.length === limit },
          });
        }
      } else if (!isRefresh && page === 1 && !query && !authorId && !savedBy && category !== "near me" && priceMin === undefined && priceMax === undefined && amenities.length === 0) {
        const cachedData = await redisClient.get(userCacheKey);
        if (cachedData) {
          const parsed = JSON.parse(cachedData);
          if (parsed.posts) {
            parsed.posts = await service.batchDecoratePosts(parsed.posts, currentUserId);
            if (currentUserId) {
              try {
                parsed.posts = await CardCTRService.applySessionMomentum(parsed.posts, currentUserId);
                const viewer = await User.findById(currentUserId).select("flatmateProfile locationDetails workLocation").lean();
                if (parsed.posts.some((p) => p.postType === "FLATMATE_OFFER" || p.postType === "FLATMATE_SEEKING")) {
                  parsed.posts = service.scoreFlatmatePosts(parsed.posts, viewer, category);
                }
                if (category !== "near me") parsed.posts = service.applyDistanceAndFreshnessRanking(parsed.posts, viewer);
              } catch (err) {
                logger.warn("User cache ranking error:", err?.message);
              }
            }
          }
          return sendSuccessResponse(res, 200, "Property feed retrieved (cached)", parsed);
        }
      }
    } catch (cacheError) {
      logger.warn("Redis cache read error:", cacheError);
    }

    // Build filter
    const filter = { isDeleted: { $ne: true } };
    const isViewingOwnPosts = Boolean(authorId) && currentUserId && String(authorId) === currentUserId;
    if (!isViewingOwnPosts) filter.isBlocked = { $ne: true };
    if (isViewingOwnPosts && ["DRAFT", "PUBLISHED", "ARCHIVED"].includes(statusFilter)) filter.status = statusFilter;

    let reportedPostIds = new Set();
    if (currentUserId) {
      reportedPostIds = await repo.getUserReportedPostIds(currentUserId);
      if (reportedPostIds.size > 0) {
        filter._id = { $nin: Array.from(reportedPostIds).map((id) => new mongoose.Types.ObjectId(id)) };
      }
    }

    if (authorId) filter.author = authorId;
    if (savedBy) filter.savedBy = savedBy;
    if (city) {
      const escapedCity = city.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      filter.city = new RegExp(`^${escapedCity}$`, "i");
    }
    if (query) {
      const escaped = query.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      const regex = new RegExp(escaped, "i");
      filter.$or = [
        { title: regex }, { caption: regex }, { city: regex }, { locality: regex },
        { propertyType: regex },
        { "postMeta.residential.spaceType": regex }, { "postMeta.spaceType": regex },
        { "postMeta.residential.furnishing": regex }, { "postMeta.furnishing": regex },
        { authorRole: regex },
      ];
      const bhkMatch = query.match(/(\d+)\s*bhk/i);
      if (bhkMatch) filter.$or.push({ bedrooms: parseInt(bhkMatch[1], 10) });
      if (/parking/i.test(query)) filter.$or.push({ "postMeta.amenities": /parking/i }, { "postMeta.residential.amenities": /parking/i }, { "postMeta.parkingRequired": true });
      if (/ready/i.test(query)) filter.$or.push({ "postMeta.possessionStatus": /ready/i }, { "postMeta.residential.possessionStatus": /ready/i }, { "postMeta.projectStatus": /ready/i });
      if (/security|gated|cctv/i.test(query)) filter.$or.push({ "postMeta.amenities": /security|cctv/i }, { "postMeta.residential.amenities": /security|cctv/i });
      if (/family/i.test(query)) filter.$or.push({ "postMeta.residential.preferredTenants": /family/i });
      if (/verified/i.test(query)) filter.$or.push({ addressVerified: true }, { "postMeta.residential.electricityBillStatus": "VERIFIED" }, { "postMeta.electricityBillStatus": "VERIFIED" });
      if (/pet/i.test(query)) filter.$or.push({ caption: /pet/i }, { "postMeta.residential.houseRules": /pet/i });
      if (/bachelor/i.test(query)) filter.$or.push({ caption: /bachelor/i }, { "postMeta.residential.preferredTenants": /bachelor/i });
      const matchingUsers = await User.find({ fullName: regex }).select("_id").lean() || [];
      if (matchingUsers.length > 0) filter.$or.push({ author: { $in: matchingUsers.map((u) => u._id) } });
    }
    if (listingType) filter.listingType = listingType;
    if (propertyType) {
      const propertyTypes = propertyType.split(",").map((t) => t.trim()).filter(Boolean);
      filter.propertyType = propertyTypes.length > 1 ? { $in: propertyTypes } : propertyTypes[0];
    }
    if (postType) filter.postType = postType;
    if (priceMin !== undefined || priceMax !== undefined) {
      filter.price = {};
      if (priceMin !== undefined) filter.price.$gte = priceMin;
      if (priceMax !== undefined) filter.price.$lte = priceMax;
    }
    if (amenities.length > 0) filter["postMeta.amenities"] = { $in: amenities };

    // Category filters
    if (category && category !== "for you") {
      switch (category) {
        case "following":
          if (currentUserId) {
            const currentUser = await User.findById(currentUserId).select("friends").lean();
            filter.author = { $in: currentUser?.friends || [] };
          }
          break;
        case "near me": break;
        case "luxury": filter.price = { $gt: 30000000 }; break;
        case "commercial": filter.propertyType = "Commercial"; break;
        case "agricultural": filter.propertyType = "Agricultural Land"; break;
        case "investment": filter.areaSqft = { $gte: 2000 }; break;
        case "verified": {
          const verifiedUserIds = await repo.getVerifiedUserIds();
          filter.$or = [
            { author: { $in: verifiedUserIds } },
            { electricityBillStatus: "VERIFIED" },
            { "postMeta.residential.electricityBillStatus": "VERIFIED" },
            { "postMeta.commercial.electricityBillStatus": "VERIFIED" },
            { "postMeta.land.electricityBillStatus": "VERIFIED" },
            { "postMeta.pgHostel.electricityBillStatus": "VERIFIED" },
          ];
          break;
        }
        case "recent": break;
        case "rooms": filter.postType = "FLATMATE_OFFER"; break;
        case "flatmates": filter.postType = "FLATMATE_SEEKING"; break;
      }
    }

    // "For you" personalization
    let personalizedPosts = [];
    if (category === "for you" && currentUserId) {
      try {
        const candidateKey = `user:${currentUserId}:feed_candidates`;
        const offset = (page - 1) * limit;
        let precomputedIds = [];
        try { precomputedIds = await redisClient.zRange(candidateKey, offset, offset + limit - 1, { REV: true }); } catch {}

        if (Array.isArray(precomputedIds) && precomputedIds.length > 0) {
          const [seenIds, suppressedIds] = await Promise.all([
            PersonalizationService.getRecentlySeenPostIds(currentUserId),
            PersonalizationService.getSuppressedPostIds(currentUserId),
          ]);
          const excludeSet = new Set([...seenIds, ...suppressedIds].map(String));
          const filteredIds = precomputedIds.filter((id) => !excludeSet.has(String(id)));

          if (filteredIds.length > 0) {
            const candidateDocs = await PropertyPost.find({
              _id: { $in: filteredIds.map((id) => new mongoose.Types.ObjectId(id)) },
              isDeleted: { $ne: true }, isBlocked: { $ne: true },
            }).populate("author", AUTHOR_POPULATE_FIELDS).lean() || [];

            if (candidateDocs.length > 0) {
              const idOrderMap = new Map(filteredIds.map((id, idx) => [String(id), idx]));
              candidateDocs.sort((a, b) => (idOrderMap.get(String(a._id)) ?? 999) - (idOrderMap.get(String(b._id)) ?? 999));
              personalizedPosts = await service.batchDecoratePosts(candidateDocs, currentUserId);
              personalizedPosts = await service.attachSocialProof(personalizedPosts, currentUserId);
            }
          }
        }

        if (personalizedPosts.length === 0 && page === 1) {
          personalizedPosts = await PersonalizationService.getPersonalizedRecommendations(currentUserId, limit);
          personalizedPosts = await service.batchDecoratePosts(personalizedPosts, currentUserId);
          personalizedPosts = personalizedPosts.map((p) => ({ ...p, personalizationScore: p.personalizationScore }));
          personalizedPosts = await service.attachSocialProof(personalizedPosts, currentUserId);
          import("../../jobs/producers/ingestion.producer.js")
            .then(({ enqueueUserRecommendationPrecompute }) => enqueueUserRecommendationPrecompute(currentUserId))
            .catch(() => {});
        }

        if (personalizedPosts.length > 0) {
          let userPrefs = null;
          try { userPrefs = await CardCTRService.getPreferenceVector(currentUserId); } catch {}
          const userCity = req.user?.city || req.user?.homeBase || "";
          personalizedPosts = personalizedPosts.map((p) => ({
            ...p,
            feedReasons: service.generateFeedReason(p, userCity, userPrefs),
            matchScore: typeof p.personalizationScore === "number" ? Math.min(99, Math.round(p.personalizationScore)) : null,
          }));
        }
      } catch (error) {
        logger.error("Personalization error, falling back to standard feed:", error);
      }
    }

    // Visibility/status filtering for non-own posts
    if (!isViewingOwnPosts) {
      filter.$and = [
        { $or: [{ status: "PUBLISHED" }, { status: { $exists: false } }, { status: null }] },
        { $or: [{ visibility: "PUBLIC" }, { visibility: { $exists: false } }, { visibility: null }] },
      ];
    }

    if (category === "near me") {
      return await getNearMeFeed(req, res, { filter, page, limit, skip, currentUserId });
    }

    const queryFilter = { ...filter };
    const isProfileFeed = Boolean(authorId);
    if (hasCursor) {
      if (!isProfileFeed) queryFilter.isBoosted = { $ne: true };
      queryFilter._id = { $lt: new mongoose.Types.ObjectId(cursor) };
    }

    const sortOption = isProfileFeed
      ? { createdAt: -1, _id: -1 }
      : hasCursor ? { createdAt: -1, _id: -1 } : { isBoosted: -1, createdAt: -1 };

    const feedQuery = PropertyPost.find(queryFilter)
      .sort(sortOption)
      .limit(limit)
      .populate("author", AUTHOR_POPULATE_FIELDS);

    if (!hasCursor && skip > 0) feedQuery.skip(skip);

    let posts, total;
    if (hasCursor) {
      feedQuery.limit(limit + 1);
      const rawPosts = await feedQuery.lean() || [];
      const hasMore = rawPosts.length > limit;
      posts = hasMore ? rawPosts.slice(0, limit) : rawPosts;
      total = hasMore ? page * limit + 1 : (page - 1) * limit + posts.length;
    } else {
      [posts, total] = await Promise.all([feedQuery.lean().then(r => r || []), PropertyPost.countDocuments(filter)]);
    }

    const postsWithEngagement = await service.batchDecoratePosts(posts, currentUserId);
    const decoratedPosts = await service.attachSocialProof(postsWithEngagement, currentUserId);

    // "For you" bucketing
    if (category === "for you" && !isProfileFeed) {
      const now = new Date();
      const oneDayAgo = new Date(now.getTime() - 86400000);
      const twoDaysAgo = new Date(now.getTime() - 172800000);
      const newPosts = decoratedPosts.filter((post) => new Date(post.createdAt) > oneDayAgo);
      const recentPosts = decoratedPosts.filter((post) => {
        const d = new Date(post.createdAt);
        return d <= oneDayAgo && d > twoDaysAgo;
      });

      const combinedPosts = [
        ...newPosts, ...recentPosts,
        ...personalizedPosts.filter((p) => !decoratedPosts.some((dp) => String(dp._id) === String(p._id))),
      ].filter((p) => {
        const pId = String(p._id);
        const pAuthorId = typeof p.author === "object" ? p.author?._id : p.author;
        const isOwn = currentUserId && String(pAuthorId) === currentUserId;
        if (p.isBlocked && !isOwn) return false;
        return !reportedPostIds.has(pId);
      });

      const nowMs = Date.now();
      const FRESH_WINDOW_MS = 86400000;
      const freshPosts = [];
      const maturePosts = [];
      for (const p of combinedPosts) {
        const pCreated = new Date(p.createdAt || 0).getTime();
        const pAuthorId = typeof p.author === "object" ? p.author?._id : p.author;
        const isOwn = currentUserId && String(pAuthorId) === currentUserId;
        if (isOwn || nowMs - pCreated <= FRESH_WINDOW_MS) freshPosts.push(p);
        else maturePosts.push(p);
      }

      freshPosts.sort((a, b) => {
        if (Boolean(a.isBoosted) !== Boolean(b.isBoosted)) return a.isBoosted ? -1 : 1;
        return new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime();
      });

      maturePosts.sort((a, b) => {
        if (Boolean(a.isBoosted) !== Boolean(b.isBoosted)) return a.isBoosted ? -1 : 1;
        const aVerified = a.electricityBillStatus === "VERIFIED" || a.postMeta?.residential?.electricityBillStatus === "VERIFIED" || a.postMeta?.commercial?.electricityBillStatus === "VERIFIED" || a.postMeta?.land?.electricityBillStatus === "VERIFIED" || a.postMeta?.pgHostel?.electricityBillStatus === "VERIFIED";
        const bVerified = b.electricityBillStatus === "VERIFIED" || b.postMeta?.residential?.electricityBillStatus === "VERIFIED" || b.postMeta?.commercial?.electricityBillStatus === "VERIFIED" || b.postMeta?.land?.electricityBillStatus === "VERIFIED" || b.postMeta?.pgHostel?.electricityBillStatus === "VERIFIED";
        if (Boolean(aVerified) !== Boolean(bVerified)) return aVerified ? -1 : 1;
        return new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime();
      });

      let rankedMaturePosts = maturePosts;
      if (currentUserId && maturePosts.length > 0) {
        rankedMaturePosts = await CardCTRService.applySessionMomentum(maturePosts, currentUserId);
      }

      let finalForYouPosts = [...freshPosts, ...rankedMaturePosts];

      if (isRefresh && page === 1 && currentUserId && finalForYouPosts.length > 3) {
        try {
          const seenIds = await redisClient.zRange(`personalization:seen:${currentUserId}`, 0, -1);
          if (Array.isArray(seenIds) && seenIds.length > 0) {
            const seenSet = new Set(seenIds.map(String));
            const unseen = finalForYouPosts.filter((p) => !seenSet.has(String(p._id)));
            const seen = finalForYouPosts.filter((p) => seenSet.has(String(p._id)));
            if (unseen.length >= 2) finalForYouPosts = [...unseen, ...seen];
          }
          const windowSize = Math.min(8, finalForYouPosts.length);
          if (windowSize > 2) {
            const shift = (refreshSeed || Math.floor(Date.now() / 15000)) % (windowSize - 1) + 1;
            const topWindow = finalForYouPosts.slice(0, windowSize);
            const rotated = [...topWindow.slice(shift), ...topWindow.slice(0, shift)];
            finalForYouPosts = [...rotated, ...finalForYouPosts.slice(windowSize)];
          }
        } catch (rotationErr) {
          logger.warn("For-You refresh rotation error:", rotationErr?.message);
        }
      }

      if (currentUserId && finalForYouPosts.length > 0) {
        try {
          const now2 = Date.now();
          const topToMark = finalForYouPosts.slice(0, 10).map((p) => ({ score: now2, value: String(p._id) }));
          await redisClient.zAdd(`personalization:seen:${currentUserId}`, topToMark);
          await redisClient.expire(`personalization:seen:${currentUserId}`, 86400);
        } catch {}
      }

      if (currentUserId) {
        try {
          const viewer = await User.findById(currentUserId).select("flatmateProfile locationDetails workLocation").lean();
          if (finalForYouPosts.some((p) => p.postType === "FLATMATE_OFFER" || p.postType === "FLATMATE_SEEKING")) {
            finalForYouPosts = service.scoreFlatmatePosts(finalForYouPosts, viewer, category);
          }
          if (category !== "near me") finalForYouPosts = service.applyDistanceAndFreshnessRanking(finalForYouPosts, viewer);
        } catch {}
      }

      const forYouHasMore = personalizedPosts.length >= limit || finalForYouPosts.length >= limit;
      const responseData = {
        posts: finalForYouPosts,
        sections: { new: newPosts.length, recent: recentPosts.length, personalized: personalizedPosts.length },
        pagination: {
          page,
          totalPages: Math.max(page + (forYouHasMore ? 1 : 0), Math.ceil(total / limit)),
          total, hasMore: forYouHasMore,
          nextCursor: finalForYouPosts.length > 0 ? String(finalForYouPosts[finalForYouPosts.length - 1]._id) : null,
          structured: true,
        },
      };

      try {
        if (page === 1 && !query && !authorId && !savedBy && priceMin === undefined && priceMax === undefined && amenities.length === 0) {
          await redisClient.setEx(userCacheKey, 180, JSON.stringify(responseData));
        }
      } catch {}

      return sendSuccessResponse(res, responseData);
    }

    // Standard feed path
    const nextCursor = posts.length === limit ? String(posts[posts.length - 1]._id) : null;
    const hasMore = posts.length === limit;

    let finalDecoratedPosts = decoratedPosts;
    if (currentUserId) {
      finalDecoratedPosts = await CardCTRService.applySessionMomentum(decoratedPosts, currentUserId);
    }

    if (currentUserId && finalDecoratedPosts.length > 3) {
      try {
        const seenIds = await redisClient.zRange(`personalization:seen:${currentUserId}`, 0, -1);
        if (Array.isArray(seenIds) && seenIds.length > 0) {
          const seenSet = new Set(seenIds.map(String));
          const unseen = finalDecoratedPosts.filter((p) => !seenSet.has(String(p._id)));
          const seen = finalDecoratedPosts.filter((p) => seenSet.has(String(p._id)));
          if (unseen.length >= 2) finalDecoratedPosts = [...unseen, ...seen];
        }
      } catch {}

      if (isRefresh && page === 1) {
        const windowSize = Math.min(8, finalDecoratedPosts.length);
        if (windowSize > 2) {
          const shift = (refreshSeed || Math.floor(Date.now() / 15000)) % (windowSize - 1) + 1;
          const topWindow = finalDecoratedPosts.slice(0, windowSize);
          const rotated = [...topWindow.slice(shift), ...topWindow.slice(0, shift)];
          finalDecoratedPosts = [...rotated, ...finalDecoratedPosts.slice(windowSize)];
        }
      }
    }

    if (currentUserId && finalDecoratedPosts.length > 0) {
      try {
        const now2 = Date.now();
        const topToMark = finalDecoratedPosts.slice(0, 10).map((p) => ({ score: now2, value: String(p._id) }));
        await redisClient.zAdd(`personalization:seen:${currentUserId}`, topToMark);
        await redisClient.expire(`personalization:seen:${currentUserId}`, 86400);
      } catch {}
    }

    if (currentUserId) {
      try {
        const viewer = await User.findById(currentUserId).select("flatmateProfile locationDetails workLocation").lean();
        if (finalDecoratedPosts.some((p) => p.postType === "FLATMATE_OFFER" || p.postType === "FLATMATE_SEEKING")) {
          finalDecoratedPosts = service.scoreFlatmatePosts(finalDecoratedPosts, viewer, category);
        }
        if (category !== "near me") finalDecoratedPosts = service.applyDistanceAndFreshnessRanking(finalDecoratedPosts, viewer);
      } catch {}
    }

    const responseData = {
      posts: finalDecoratedPosts,
      pagination: { page, limit, total, totalPages: Math.max(1, Math.ceil(total / limit)), nextCursor, hasMore },
    };

    try {
      if (isStandardPublicFeed) {
        await redisClient.setEx(sharedCacheKey, 180, JSON.stringify({ posts, total }));
      } else if (page === 1 && !query && !authorId && !savedBy && priceMin === undefined && priceMax === undefined && amenities.length === 0) {
        await redisClient.setEx(userCacheKey, 180, JSON.stringify(responseData));
      }
    } catch {}

    return sendSuccessResponse(res, 200, "Property feed fetched successfully", responseData);
  } catch (error) {
    logger.error("Error fetching property feed:", error);
    return sendErrorResponse(res, 500, "Internal Server Error");
  }
}

// ── Near Me Feed ────────────────────────────────────────────────────────

async function getNearMeFeed(req, res, { filter, page, limit, skip, currentUserId }) {
  try {
    const geoQuery = { ...filter, offerStatus: { $ne: "ACCEPTED" } };

    const qLat = Number(req.query.lat);
    const qLon = Number(req.query.lon);
    const hasFreshGps = Number.isFinite(qLat) && Number.isFinite(qLon) && Math.abs(qLat) <= 90 && Math.abs(qLon) <= 180;

    let point = null;
    let pointSource = null;
    let profileCity = "";

    if (hasFreshGps) { point = [qLon, qLat]; pointSource = "gps"; }

    if (currentUserId) {
      const me = await User.findById(currentUserId).select("city homeBase locationDetails").lean();
      profileCity = me?.city || me?.homeBase || me?.locationDetails?.city || "";
      if (!point) {
        const ld = me?.locationDetails;
        const savedAt = ld?.capturedAt ? new Date(ld.capturedAt).getTime() : 0;
        const isRecent = savedAt && Date.now() - savedAt < SAVED_LOCATION_MAX_AGE_MS;
        if (Number.isFinite(ld?.latitude) && Number.isFinite(ld?.longitude) && (isRecent || !ld?.capturedAt)) {
          point = [ld.longitude, ld.latitude]; pointSource = "saved";
        } else if (ld?.city || profileCity) {
          const c = service.centroidForCity(ld?.city || profileCity);
          if (c) { point = c; pointSource = "city"; }
        }
      }
    }

    if (point) {
      const rows = await PropertyPost.aggregate([
        { $geoNear: { near: { type: "Point", coordinates: point }, distanceField: "distanceMeters", maxDistance: NEAR_ME_MAX_METERS, spherical: true, query: geoQuery } },
        { $limit: 300 },
      ]);

      const decoratedRows = await service.batchDecoratePosts(rows, currentUserId);
      const scored = decoratedRows
        .map((post, i) => {
          const distanceKm = rows[i].distanceMeters / 1000;
          return { ...post, distanceKm: Math.round(distanceKm * 10) / 10, _band: service.nearMeBand(distanceKm), _score: service.nearMeWithinBandScore(post) };
        })
        .sort((a, b) => a._band - b._band || b._score - a._score || new Date(b.createdAt) - new Date(a.createdAt) || String(b._id).localeCompare(String(a._id)));

      const total = scored.length;
      const pageItems = scored.slice(skip, skip + limit);
      await PropertyPost.populate(pageItems, { path: "author", select: AUTHOR_POPULATE_FIELDS });
      pageItems.forEach((p) => { delete p._band; delete p._score; delete p.distanceMeters; delete p.location; });

      const farthestKm = scored.length ? scored[Math.min(scored.length, skip + limit) - 1].distanceKm : 0;
      const radiusKm = NEAR_ME_BANDS_KM.find((b) => b >= farthestKm) || 100;

      return sendSuccessResponse(res, 200, "Property feed fetched successfully", {
        posts: await service.attachSocialProof(pageItems, currentUserId),
        pagination: { page, limit, total, totalPages: Math.max(1, Math.ceil(total / limit)) },
        meta: { nearMe: { mode: "geo", pointSource, radiusKm, withinRadius: total } },
      });
    }

    let cityFilter = geoQuery;
    let mode = "all";
    if (profileCity) {
      const escaped = profileCity.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      cityFilter = { ...geoQuery, city: { $regex: new RegExp(escaped, "i") } };
      mode = "city";
    }

    let [posts, total] = await Promise.all([
      PropertyPost.find(cityFilter).sort({ createdAt: -1 }).skip(skip).limit(limit).populate("author", AUTHOR_POPULATE_FIELDS).lean().then(r => r || []),
      PropertyPost.countDocuments(cityFilter),
    ]);

    if (mode === "city" && total === 0) {
      mode = "all";
      [posts, total] = await Promise.all([
        PropertyPost.find(geoQuery).sort({ createdAt: -1 }).skip(skip).limit(limit).populate("author", AUTHOR_POPULATE_FIELDS).lean().then(r => r || []),
        PropertyPost.countDocuments(geoQuery),
      ]);
    }

    return sendSuccessResponse(res, 200, "Property feed fetched successfully", {
      posts: await service.attachSocialProof(await Promise.all(posts.map((p) => service.batchDecoratePosts([p], currentUserId).then((r) => r[0]))), currentUserId),
      pagination: { page, limit, total, totalPages: Math.max(1, Math.ceil(total / limit)) },
      meta: { nearMe: { mode, city: mode === "city" ? profileCity : undefined } },
    });
  } catch (error) {
    logger.error("Error in getNearMeFeed:", error);
    return sendErrorResponse(res, 500, "Failed to load nearby properties");
  }
}

// ── CRUD ────────────────────────────────────────────────────────────────

export async function createPropertyPost(req, res) {
  try {
    if (!req.user?._id) return sendErrorResponse(res, 401, "Unauthorized");
    const post = await service.createPost(req.user, req.body);
    return sendSuccessResponse(res, 201, "Property post created successfully", { post });
  } catch (error) {
    logger.error("Error creating property post:", error);
    return sendErrorResponse(res, error.status || 500, error.message || "Internal Server Error");
  }
}

export async function updatePropertyPost(req, res) {
  try {
    if (!req.user?._id) return sendErrorResponse(res, 401, "Unauthorized");
    if (!req.params?.id) return sendErrorResponse(res, 400, "Post ID is required");
    const post = await service.updatePost(req.user, req.params.id, req.body);
    return sendSuccessResponse(res, 200, "Property post updated successfully", { post });
  } catch (error) {
    logger.error("Error updating property post:", error);
    return sendErrorResponse(res, error.status || 500, error.message || "Internal Server Error");
  }
}

export async function deletePropertyPost(req, res) {
  try {
    if (!req.params?.id) return sendErrorResponse(res, 400, "Post ID is required");
    await service.deletePost(req.user, req.params.id);
    return sendSuccessResponse(res, 200, "Post deleted successfully");
  } catch (error) {
    logger.error("Error deleting property post:", error);
    return sendErrorResponse(res, error.status || 500, error.message || "Internal Server Error");
  }
}

// ── Engagement toggles ──────────────────────────────────────────────────

export async function togglePropertyPostLike(req, res) {
  try {
    if (!req.user?._id) return sendErrorResponse(res, 401, "Unauthorized");
    const result = await service.toggleLike(req.user, req.params.id);
    return sendSuccessResponse(res, 200, "Post like status updated", result);
  } catch (error) {
    logger.error("Error toggling property post like:", error);
    return sendErrorResponse(res, error.status || 500, error.message || "Internal Server Error");
  }
}

export async function togglePropertyPostSave(req, res) {
  try {
    if (!req.user?._id) return sendErrorResponse(res, 401, "Unauthorized");
    const result = await service.toggleSave(req.user, req.params.id);
    return sendSuccessResponse(res, 200, "Post save status updated", result);
  } catch (error) {
    logger.error("Error toggling property post save:", error);
    return sendErrorResponse(res, error.status || 500, error.message || "Internal Server Error");
  }
}

// ── Boost ───────────────────────────────────────────────────────────────

export async function boostPropertyPost(req, res) {
  try {
    if (!req.user?._id) return sendErrorResponse(res, 401, "Unauthorized");
    const result = await service.boostPost(req.user, req.params.id);
    return sendSuccessResponse(res, 200, "Property successfully boosted for 24 hours", result);
  } catch (error) {
    logger.error("Error boosting property post:", error);
    return sendErrorResponse(res, error.status || 500, error.message || "Internal Server Error");
  }
}

export async function expireBoostedPostsSweep(req, res) {
  try {
    const configuredSecret = process.env.CRON_SECRET;
    const incomingSecret = req.get("x-cron-secret") || req.query?.secret || req.get("authorization")?.replace(/^Bearer\s+/i, "");
    if (!configuredSecret || incomingSecret !== configuredSecret) {
      return sendErrorResponse(res, 401, "Unauthorized: Invalid or missing cron secret");
    }
    const result = await repo.expireBoosts();
    if (result.modifiedCount > 0) {
      try {
        await PersonalizationService.invalidatePersonalizationCache();
        await repo.invalidateFeedCache();
      } catch {}
    }
    return sendSuccessResponse(res, 200, "Boost expiration sweep executed successfully", {
      expiredCount: result.modifiedCount || 0,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    logger.error("Error in expireBoostedPostsSweep:", error);
    return sendErrorResponse(res, 500, "Internal Server Error");
  }
}

// ── My Posts ────────────────────────────────────────────────────────────

export async function getMyPropertyPosts(req, res) {
  try {
    if (!req.user?._id) return sendErrorResponse(res, 401, "Authentication required");
    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const limit = Math.min(50, Math.max(1, parseInt(req.query.limit, 10) || 50));
    const posts = await repo.findMyPosts(req.user._id, page, limit) || [];
    return sendSuccessResponse(res, 200, "User posts fetched successfully", {
      posts: posts.map(toMyPostDTO),
      total: posts.length,
    });
  } catch (error) {
    logger.error("Error in getMyPropertyPosts:", error);
    return sendErrorResponse(res, 500, "Internal Server Error");
  }
}

// ── Post Detail ─────────────────────────────────────────────────────────

export async function getPropertyPostById(req, res) {
  try {
    const postId = req.params?.id;
    const currentUserId = req.user?._id ? String(req.user._id) : "";

    if (!postId || !mongoose.Types.ObjectId.isValid(postId)) {
      return sendErrorResponse(res, 404, "Post not found");
    }

    let post = null;
    const cacheKey = `post:${postId}:detail`;
    try {
      const cached = await redisClient.get(cacheKey);
      if (cached) post = JSON.parse(cached);
    } catch {}

    if (!post) {
      post = await PropertyPost.findById(postId).populate("author", AUTHOR_DETAIL_POPULATE_FIELDS).lean();
      if (!post || post.isDeleted) return sendErrorResponse(res, 404, "Post not found");
      try { await redisClient.setEx(cacheKey, 300, JSON.stringify(post)); } catch {}
    }

    if (!post || post.isDeleted) return sendErrorResponse(res, 404, "Post not found");
    const isPostOwner = currentUserId && post.author && String(post.author._id) === currentUserId;
    if (post.isBlocked && !isPostOwner) return sendErrorResponse(res, 404, "Post not found");

    const authorCopy = post.author ? { ...post.author } : null;
    if (authorCopy) {
      const isOwner = currentUserId && String(authorCopy._id) === currentUserId;
      const isFriend = currentUserId && (authorCopy.friends || []).some((friendId) => String(friendId) === currentUserId);
      if (!isOwner && !isFriend) delete authorCopy.mobileNumber;
      delete authorCopy.friends;
    }

    const { getPostEngagement, getCachedForecastOrRecompute } = service;
    const [likeEngagement, saveEngagement, cachedViews, activeOfferCount, sellerListingCount, forecast] = await Promise.all([
      getPostEngagement(postId, currentUserId, "like"),
      getPostEngagement(postId, currentUserId, "save"),
      redisClient.get(`post:${postId}:views`).catch(() => null),
      Offer.countDocuments({ post: post._id, status: { $in: ["pending", "countered"] } }),
      authorCopy?._id ? PropertyPost.countDocuments({ author: authorCopy._id, status: "PUBLISHED", visibility: "PUBLIC", isDeleted: { $ne: true }, isBlocked: { $ne: true } }) : Promise.resolve(0),
      post.city ? getCachedForecastOrRecompute(post.city, post.locality) : null,
    ]);

    const { calculateDealProbability } = await import("../../services/DealProbabilityService.js");
    const dealProbability = calculateDealProbability(post, authorCopy);

    let flatmateMatchScore = null;
    const pt = String(post.postType || "").toUpperCase();
    if ((pt === "FLATMATE_OFFER" || pt === "FLATMATE_SEEKING") && currentUserId) {
      try {
        const viewer = req.user || await User.findById(currentUserId).select("flatmateProfile").lean();
        const fp = viewer?.flatmateProfile;
        if (fp?.updatedAt) flatmateMatchScore = service.calculateFlatmateCompatibility(fp, post);
      } catch {}
    }

    const likesCount = likeEngagement !== null ? likeEngagement.count : (post.likedBy?.length || 0);
    const isLikedByMe = likeEngagement !== null ? Boolean(likeEngagement.isEngaged) : (currentUserId && Array.isArray(post.likedBy) && post.likedBy.some((id) => String(id) === currentUserId));
    const savesCount = saveEngagement !== null ? saveEngagement.count : (post.savedBy?.length || 0);
    const isSavedByMe = saveEngagement !== null ? Boolean(saveEngagement.isEngaged) : (currentUserId && Array.isArray(post.savedBy) && post.savedBy.some((id) => String(id) === currentUserId));
    const viewCount = cachedViews !== null ? parseInt(cachedViews, 10) : (post.viewCount || 0);

    if (currentUserId && !isPostOwner) {
      User.updateOne({ _id: currentUserId }, { $pull: { viewedPosts: { post: postId } } })
        .then(() => User.updateOne({ _id: currentUserId }, { $push: { viewedPosts: { $each: [{ post: postId, viewedAt: new Date() }], $slice: -100 } } }).catch(() => {}))
        .catch(() => {});
    }

    return sendSuccessResponse(res, 200, "Property post fetched successfully", {
      post: {
        ...post, author: authorCopy, viewCount, likesCount, isLikedByMe: Boolean(isLikedByMe), savesCount, isSavedByMe: Boolean(isSavedByMe),
        activeOfferCount, sellerListingCount,
        priceHistory: service.sanitizePriceHistory(post.priceHistory, post.price),
        appreciationForecast: forecast?.annualizedRate ? forecast : null,
        dealProbability, flatmateMatchScore,
      },
    });
  } catch (error) {
    logger.error("Error fetching property post:", error);
    return sendErrorResponse(res, 500, "Internal Server Error");
  }
}

// ── Likers ──────────────────────────────────────────────────────────────

export async function getPostLikers(req, res) {
  try {
    const { id } = req.params;
    const currentUserId = String(req.user._id);
    const page = Math.max(1, Number(req.query.page) || 1);
    const limit = 30;

    let pageIds = [];
    let total = 0;

    const { getLikersFromCache } = service;
    const cached = await getLikersFromCache(id, (page - 1) * limit, limit);
    if (cached && typeof cached.total === "number" && (cached.total > 0 || page === 1)) {
      pageIds = cached.items.map((i) => String(i.userId));
      total = cached.total;
    } else {
      const post = await PropertyPost.findById(id).select("likedBy likedByTimestamps isDeleted").lean();
      if (!post || post.isDeleted) return sendErrorResponse(res, 404, "Post not found");
      let ordered;
      if (Array.isArray(post.likedByTimestamps) && post.likedByTimestamps.length) {
        ordered = [...post.likedByTimestamps].sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp)).map((x) => String(x.userId));
      } else {
        ordered = (post.likedBy || []).map(String).reverse();
      }
      ordered = [...new Set(ordered)];
      total = ordered.length;
      pageIds = ordered.slice((page - 1) * limit, page * limit);
    }

    const FriendRequest = (await import("../../models/FriendRequest.model.js")).default;
    const [users, me, pending] = await Promise.all([
      User.find({ _id: { $in: pageIds }, isBlocked: { $ne: true } }).select("fullName profilePic isVerified isOwnerVerified city").lean(),
      User.findById(currentUserId).select("friends").lean(),
      FriendRequest.find({ status: "pending", $or: [{ sender: currentUserId, receiver: { $in: pageIds } }, { receiver: currentUserId, sender: { $in: pageIds } }] }).select("sender receiver").lean(),
    ]);

    const byId = new Map(users.map((u) => [String(u._id), u]));
    const myFriends = new Set((me?.friends || []).map(String));
    const sentTo = new Set();
    const receivedFrom = new Set();
    for (const r of pending) {
      if (String(r.sender) === currentUserId) sentTo.add(String(r.receiver));
      else receivedFrom.add(String(r.sender));
    }

    const likers = pageIds
      .map((pid) => byId.get(pid))
      .filter(Boolean)
      .map((u) => {
        const uid = String(u._id);
        let connectionStatus = "none";
        if (uid === currentUserId) connectionStatus = "self";
        else if (myFriends.has(uid)) connectionStatus = "friends";
        else if (sentTo.has(uid)) connectionStatus = "pending_sent";
        else if (receivedFrom.has(uid)) connectionStatus = "pending_received";
        return toLikerDTO(u, connectionStatus);
      });

    return sendSuccessResponse(res, 200, "Likers", {
      likers,
      pagination: { page, limit, total, totalPages: Math.max(1, Math.ceil(total / limit)) },
    });
  } catch (error) {
    logger.error("Error in getPostLikers:", error);
    return sendErrorResponse(res, 500, "Failed to load likers");
  }
}

// ── Similar Properties ──────────────────────────────────────────────────

export async function getSimilarProperties(req, res) {
  try {
    const { id } = req.params;
    const limit = Math.min(Number(req.query.limit) || 8, 20);
    const currentUserId = req.user?._id ? String(req.user._id) : "";

    const ref = await PropertyPost.findById(id).select("postType propertyType city locality price bedrooms author").lean();
    if (!ref) return sendErrorResponse(res, 404, "Post not found");

    const candidates = await repo.findSimilarCandidates(ref) || [];
    const scored = candidates
      .map((p) => {
        let score = 0;
        if (p.postType && p.postType === ref.postType) score += 35;
        if (p.propertyType && p.propertyType === ref.propertyType) score += 20;
        if (ref.city && p.city && p.city.toLowerCase() === ref.city.toLowerCase()) score += 25;
        if (ref.locality && p.locality && p.locality.toLowerCase() === ref.locality.toLowerCase()) score += 15;
        if (ref.price > 0 && p.price > 0) {
          const diff = Math.abs(p.price - ref.price) / ref.price;
          if (diff <= 0.1) score += 25;
          else if (diff <= 0.25) score += 15;
          else if (diff <= 0.5) score += 6;
        }
        if (ref.bedrooms > 0 && p.bedrooms === ref.bedrooms) score += 8;
        return { ...p, similarityScore: score };
      })
      .filter((p) => p.similarityScore > 0)
      .sort((a, b) => b.similarityScore - a.similarityScore)
      .slice(0, limit)
      .map((p) => {
        const likedBy = Array.isArray(p.likedBy) ? p.likedBy.map(String) : [];
        const savedBy = Array.isArray(p.savedBy) ? p.savedBy.map(String) : [];
        return { ...p, likesCount: likedBy.length, savesCount: savedBy.length, isLikedByMe: currentUserId ? likedBy.includes(currentUserId) : false, isSavedByMe: currentUserId ? savedBy.includes(currentUserId) : false };
      });

    return sendSuccessResponse(res, 200, "Similar properties retrieved", { posts: scored });
  } catch (error) {
    logger.error("Error in getSimilarProperties:", error);
    return sendErrorResponse(res, 500, "Failed to retrieve similar properties");
  }
}

// ── Price Insight ───────────────────────────────────────────────────────

export async function getPriceInsight(req, res) {
  try {
    const { id } = req.params;
    const ref = await PropertyPost.findById(id).select("city propertyType postType listingType bedrooms price areaSqft postMeta isDeleted").lean();
    if (!ref || ref.isDeleted) return sendErrorResponse(res, 404, "Post not found");

    if (!service.subjectPsfOf(ref) || !ref.city || !ref.propertyType) {
      return sendSuccessResponse(res, 200, "Not enough data for a price insight", { insight: { available: false } });
    }

    const benchmark = await service.priceBenchmarkFor(ref.city, ref.propertyType, ref.bedrooms, ref._id, service.intentOf(ref));
    const insight = service.insightFromBenchmark(ref, benchmark);
    if (insight.available) insight.scope = { city: ref.city, propertyType: ref.propertyType, bedrooms: Number(ref.bedrooms) || null };
    return sendSuccessResponse(res, 200, "Price insight ready", { insight });
  } catch (error) {
    logger.error("Error in getPriceInsight:", error);
    return sendErrorResponse(res, 500, "Failed to compute price insight");
  }
}

// ── Valuation ───────────────────────────────────────────────────────────

export async function getPropertyValuation(req, res) {
  try {
    const post = await PropertyPost.findById(req.params.id).lean();
    if (!post || post.isDeleted) return sendErrorResponse(res, 404, "Post not found");
    const valuation = await calculateLivePropertyValuation(post);
    return sendSuccessResponse(res, 200, "Property valuation computed", valuation);
  } catch (error) {
    logger.error("Error in getPropertyValuation:", error);
    return sendErrorResponse(res, 500, "Failed to compute property valuation");
  }
}

// ── Card Signals ────────────────────────────────────────────────────────

export async function getCardSignals(req, res) {
  try {
    const ids = Array.isArray(req.body?.ids) ? req.body.ids.slice(0, 40).filter(Boolean) : [];
    if (ids.length === 0) return sendSuccessResponse(res, 200, "No ids", { signals: {} });

    const [posts, offerRows] = await Promise.all([
      PropertyPost.find({ _id: { $in: ids }, isDeleted: { $ne: true } }).select("city propertyType postType listingType bedrooms price areaSqft postMeta").lean().then(r => r || []),
      Offer.aggregate([
        { $match: { post: { $in: ids.map((x) => new mongoose.Types.ObjectId(String(x))) }, status: { $in: ["pending", "countered"] } } },
        { $group: { _id: "$post", n: { $sum: 1 } } },
      ]),
    ]);

    const offerCount = new Map(offerRows.map((r) => [String(r._id), r.n]));
    const groupKey = (p) => `${String(p.city || "").toLowerCase().trim()}|${String(p.propertyType || "").toLowerCase()}|${Number(p.bedrooms) || 0}|${service.intentOf(p)}`;
    const groups = new Map();
    for (const p of posts) {
      if (!service.subjectPsfOf(p) || !p.city || !p.propertyType) continue;
      const key = groupKey(p);
      if (!groups.has(key)) groups.set(key, { city: p.city, propertyType: p.propertyType, beds: Number(p.bedrooms) || 0, intent: service.intentOf(p) });
    }
    const benchmarks = new Map();
    await Promise.all([...groups.entries()].map(async ([key, g]) => {
      benchmarks.set(key, await service.priceBenchmarkFor(g.city, g.propertyType, g.beds, null, g.intent));
    }));

    const signals = {};
    for (const p of posts) {
      const key = groupKey(p);
      const insight = service.insightFromBenchmark(p, benchmarks.get(key));
      signals[String(p._id)] = {
        activeOffers: offerCount.get(String(p._id)) || 0,
        priceInsight: insight.available ? { verdict: insight.verdict, deltaPct: insight.deltaPct } : null,
      };
    }
    return sendSuccessResponse(res, 200, "Card signals ready", { signals });
  } catch (error) {
    logger.error("Error in getCardSignals:", error);
    return sendErrorResponse(res, 500, "Failed to load card signals");
  }
}

// ── Price Suggestion ────────────────────────────────────────────────────

export async function getPriceSuggestion(req, res) {
  try {
    const city = String(req.query.city || "").trim();
    const propertyType = String(req.query.propertyType || "").trim();
    const bedrooms = Number(req.query.bedrooms) || 0;
    const areaSqft = Number(req.query.areaSqft) || 0;
    const intent = String(req.query.intent || "").toLowerCase() === "rent" ? "rent" : "buy";

    if (!city || !propertyType || !areaSqft) {
      return sendSuccessResponse(res, 200, "Not enough info", { suggestion: { available: false } });
    }

    const benchmark = await service.priceBenchmarkFor(city, propertyType, bedrooms, null, intent);
    if (benchmark.sampleSize < 4 || !benchmark.medianPsf) {
      return sendSuccessResponse(res, 200, "Not enough comparable listings", { suggestion: { available: false } });
    }

    const mid = Math.round(benchmark.medianPsf * areaSqft);
    return sendSuccessResponse(res, 200, "Price suggestion ready", {
      suggestion: { available: true, intent, medianPricePerSqft: benchmark.medianPsf, sampleSize: benchmark.sampleSize, mid, low: Math.round(mid * 0.85), high: Math.round(mid * 1.15), scope: { city, propertyType, bedrooms: bedrooms || null } },
    });
  } catch (error) {
    logger.error("Error in getPriceSuggestion:", error);
    return sendErrorResponse(res, 500, "Failed to compute price suggestion");
  }
}

// ── View Count ──────────────────────────────────────────────────────────

export async function incrementViewCount(req, res) {
  try {
    const postId = req.params?.id;
    const userId = req.user?._id;
    if (!postId) return sendErrorResponse(res, 400, "Post ID is required");

    const post = await PropertyPost.findById(postId).select("author isDeleted isBlocked viewCount").lean();
    if (!post || post.isDeleted || (post.isBlocked && String(post.author) !== String(userId))) {
      return sendErrorResponse(res, 404, "Post not found");
    }
    if (String(post.author) === String(userId)) {
      return sendSuccessResponse(res, 200, "View count not incremented (own post)", { viewCount: post.viewCount || 0 });
    }

    const { incrementViewCountRedis } = service;
    const viewCount = await incrementViewCountRedis(postId, post.viewCount || 0);

    if (userId) {
      User.updateOne({ _id: userId }, { $pull: { viewedPosts: { post: postId } } })
        .then(() => User.updateOne({ _id: userId }, { $push: { viewedPosts: { $each: [{ post: postId, viewedAt: new Date() }], $slice: -100 } } }).catch(() => {}))
        .catch(() => {});
    }
    return sendSuccessResponse(res, 200, "View count incremented", { viewCount });
  } catch (error) {
    logger.error("Error incrementing view count:", error);
    return sendErrorResponse(res, 500, "Internal Server Error");
  }
}

// ── Media Upload ────────────────────────────────────────────────────────

export async function getPropertyMediaUploadSignature(req, res) {
  try {
    const signature = service.generateUploadSignature();
    return sendSuccessResponse(res, 200, "Upload signature generated", signature);
  } catch (error) {
    logger.error("Error generating property media upload signature:", error);
    return sendErrorResponse(res, 500, "Internal Server Error");
  }
}

export async function uploadPropertyMedia(req, res) {
  try {
    if (!req.files || req.files.length === 0) return sendErrorResponse(res, 400, "No files uploaded");
    const mediaUrls = req.files.map((file) => file.path);
    return sendSuccessResponse(res, 200, "Media uploaded successfully", { mediaUrls, count: mediaUrls.length });
  } catch (error) {
    logger.error("Error uploading property media:", error);
    return sendErrorResponse(res, 500, "Internal Server Error");
  }
}

// ── Report ──────────────────────────────────────────────────────────────

export async function reportPost(req, res) {
  try {
    const userId = req.user?._id;
    const postId = req.params?.id;
    const { reasonCode, description } = req.body || {};

    if (!userId) return sendErrorResponse(res, 401, "Unauthorized");
    if (!REPORT_REASON_CODES.includes(reasonCode)) return sendErrorResponse(res, 400, "A valid reason is required");

    const post = await PropertyPost.findById(postId).select("author isDeleted title").lean();
    if (!post || post.isDeleted) return sendErrorResponse(res, 404, "Post not found");
    if (String(post.author) === String(userId)) return sendErrorResponse(res, 400, "You cannot report your own post");

    try {
      await repo.createReport(postId, userId, reasonCode, description);
      await repo.addToReportedPostsCache(userId, postId);
    } catch (error) {
      if (error.code === 11000) return sendErrorResponse(res, 400, "You've already reported this post");
      throw error;
    }

    try {
      const { NotificationService, NotificationChannel } = service;
      await NotificationService.send({
        recipientId: post.author, type: "post_reported", realtimeEventType: "post_moderation_notice",
        title: "Post reported", message: `Your post "${post.title}" was reported and is under review by our team`,
        data: { propertyPost: post._id },
        channels: [NotificationChannel.IN_APP, NotificationChannel.REALTIME, NotificationChannel.FIREBASE],
      });
    } catch {}

    await repo.invalidateUserFeedCache(userId);

    return sendSuccessResponse(res, 201, "Thanks for the report. Our team will review it.");
  } catch (error) {
    logger.error("Error reporting post:", error);
    return sendErrorResponse(res, 500, "Internal Server Error");
  }
}

// ── Hot Feed ────────────────────────────────────────────────────────────

export async function getHotPropertiesFeed(req, res) {
  try {
    const city = String(req.query.city || "").trim();
    const limit = Math.min(50, Math.max(1, Number.parseInt(req.query.limit, 10) || 20));
    const currentUserId = req.user?._id ? String(req.user._id) : "";

    const hotPosts = await getHotPostsByCity(city, limit);
    const decoratedPosts = await service.attachSocialProof(
      hotPosts.map((post) => {
        const likedBy = Array.isArray(post.likedBy) ? post.likedBy.map(String) : [];
        const savedBy = Array.isArray(post.savedBy) ? post.savedBy.map(String) : [];
        return { ...post, likesCount: likedBy.length, isLikedByMe: currentUserId ? likedBy.includes(currentUserId) : false, savesCount: savedBy.length, isSavedByMe: currentUserId ? savedBy.includes(currentUserId) : false };
      }),
      currentUserId,
    );

    return sendSuccessResponse(res, 200, "Hot properties feed retrieved successfully", { city: city || "all", posts: decoratedPosts, total: decoratedPosts.length });
  } catch (error) {
    logger.error("Error in getHotPropertiesFeed:", error);
    return sendErrorResponse(res, 500, "Failed to retrieve hot properties feed");
  }
}

// ── Micro-engagement ────────────────────────────────────────────────────

export async function recordMicroEngagement(req, res) {
  try {
    const userId = req.user?._id;
    const { postId, dwellTimeMs, swipedPhotosCount, engagementType, locality, postType, bhk, price, listingType } = req.body || {};
    if (!userId || !postId) return sendErrorResponse(res, 400, "Missing required fields");

    const meta = { locality, postType, bhk, price, listingType };
    await CardCTRService.recordMicroEngagement(String(userId), String(postId), Number(dwellTimeMs) || 0, Number(swipedPhotosCount) || 0, meta);

    if (engagementType) {
      await CardCTRService.recordWeightedEngagement(String(userId), String(postId), engagementType, meta);
      if (engagementType === "not_interested") {
        try {
          const suppressKey = `user:${userId}:suppressed_reco`;
          const existing = await redisClient.get(suppressKey);
          const ids = existing ? JSON.parse(existing) : [];
          ids.push(String(postId));
          await redisClient.setEx(suppressKey, 86400 * 7, JSON.stringify(ids));
        } catch {}
      }
    }
    return sendSuccessResponse(res, 200, "Micro-engagement recorded");
  } catch (error) {
    logger.warn("Error recording micro-engagement:", error.message);
    return sendSuccessResponse(res, 200, "OK");
  }
}

export async function recordCoverClick(req, res) {
  try {
    const { id } = req.params;
    const { coverIndex } = req.body || {};
    if (id) await CardCTRService.recordCoverClick(String(id), Number(coverIndex) || 0);
    return sendSuccessResponse(res, 200, "Cover click logged");
  } catch {
    return sendSuccessResponse(res, 200, "OK");
  }
}

// ── Map Pins ────────────────────────────────────────────────────────────

export async function getMapPins(req, res) {
  try {
    let pins;
    try {
      const cached = await redisClient.get(MAP_PINS_CACHE_KEY);
      if (cached) {
        pins = JSON.parse(cached);
        return sendSuccessResponse(res, 200, "Map pins (cached)", { posts: pins });
      }
    } catch {}

    pins = await repo.findMapPins();
    pins = pins.map((p) => ({ ...p, mediaUrls: p.mediaUrls?.length ? [p.mediaUrls[0]] : [] }));
    try { await redisClient.setEx(MAP_PINS_CACHE_KEY, MAP_PINS_CACHE_TTL, JSON.stringify(pins)); } catch {}
    return sendSuccessResponse(res, 200, "Map pins", { posts: pins });
  } catch (error) {
    logger.error("getMapPins error:", error);
    return sendErrorResponse(res, 500, "Failed to load map pins");
  }
}

// ── Re-exports for backward compatibility (dynamic imports from workers) ─

export { sanitizePriceHistory, handlePriceChangeFanout, notifyPriceChange, notifyActiveOfferBuyersOfPriceChange } from "./propertyPost.service.js";
export { getUserReportedPostIds, getUserSocialGraph, invalidateUserSocialGraph } from "./propertyPost.repository.js";
export { batchDecoratePosts } from "./propertyPost.service.js";
