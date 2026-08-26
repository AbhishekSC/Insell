import PropertyPost from "../models/PropertyPost.model.js";
import PostReport, { REPORT_REASON_CODES } from "../models/PostReport.model.js";
import Notification from "../models/Notification.model.js";
import { sendSuccessResponse, sendErrorResponse } from "../utils/responseHandler.js";
import { logger } from "../utils/logger.js";
import redisClient from "../config/redisClient.config.js";
import {
  canRoleCreatePostType,
  getAllowedPostTypesForRole,
  getPostTypeDefaults,
  normalizePostType,
  resolveActiveRole,
  sanitizePostMeta,
} from "../utils/postPolicy.js";
import path from "path";
import { invalidateDiscoverCache } from "../services/DiscoverRecommendationService.js";
import { invalidateActivityCache } from "../services/UserServiceHandlers.js";
import PersonalizationService from "../services/PersonalizationService.js";
import * as NotificationService from "../services/NotificationService.js";
import { NotificationChannel } from "../services/NotificationService.js";

function normalizeMediaUrls(raw) {
  if (Array.isArray(raw)) {
    return raw.map((item) => String(item || "").trim()).filter(Boolean);
  }

  if (typeof raw === "string") {
    return raw.split(",").map((item) => String(item || "").trim()).filter(Boolean);
  }

  return [];
}

export async function getPropertyAnalytics(req, res) {
  try {
    const { propertyId } = req.params;
    const currentUserId = req.user?._id ? String(req.user._id) : "";

    const property = await PropertyPost.findById(propertyId).lean();
    if (!property) {
      return sendErrorResponse(res, 404, "Property not found");
    }

    // Check if user is the owner
    if (String(property.author) !== currentUserId) {
      return sendErrorResponse(res, 403, "You don't have permission to view analytics for this property");
    }

    const analytics = {
      viewCount: property.viewCount || 0,
      shareCount: property.shareCount || 0,
      commentCount: property.commentCount || 0,
      chatCount: property.chatCount || 0,
      engagementScore: property.engagementScore || 0,
      likesCount: property.likedBy?.length || 0,
      savesCount: property.savedBy?.length || 0,
      createdAt: property.createdAt,
      publishedAt: property.publishedAt,
    };

    return sendSuccessResponse(res, 200, "Property analytics retrieved successfully", { analytics });
  } catch (error) {
    logger.error("Error in getPropertyAnalytics:", error);
    return sendErrorResponse(res, 500, "Failed to retrieve property analytics");
  }
}

export async function compareProperties(req, res) {
  try {
    const { propertyIds, preferenceCriteria = 'balanced' } = req.body;
    const userId = req.user?._id;

    if (!propertyIds || !Array.isArray(propertyIds) || propertyIds.length < 2) {
      return sendErrorResponse(res, 400, "Please provide at least 2 property IDs for comparison");
    }

    if (propertyIds.length > 4) {
      return sendErrorResponse(res, 400, "Maximum 4 properties can be compared at once");
    }

    // Generate cache key
    const cacheKey = `property:compare:${propertyIds.sort().join(',')}:${preferenceCriteria}`;
    
    // Try to get from cache
    try {
      const cachedData = await redisClient.get(cacheKey);
      if (cachedData) {
        logger.info("Cache hit for property comparison");
        return sendSuccessResponse(res, 200, "Properties retrieved for comparison (cached)", JSON.parse(cachedData));
      }
    } catch (cacheError) {
      logger.warn("Redis cache read error:", cacheError);
    }

    const properties = await PropertyPost.find({
      _id: { $in: propertyIds },
      isDeleted: { $ne: true },
      isBlocked: { $ne: true }
    }).populate('author', 'fullName profilePic isVerified').lean();

    if (properties.length === 0) {
      return sendErrorResponse(res, 404, "No properties found");
    }

    // Calculate property scores based on user preference
    const scoredProperties = properties.map(property => {
      const score = calculatePropertyScore(property, properties, preferenceCriteria);
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
        },
      };
    });

    // Find best property
    const bestProperty = scoredProperties.reduce((best, current) => 
      current.comparisonScore > best.comparisonScore ? current : best
    );

    // Get personalized recommendations if user is logged in
    let recommendations = [];
    if (userId) {
      try {
        const { PersonalizationService } = await import('../services/PersonalizationService.js');
        const userBehavior = await PersonalizationService.getUserBehavior(userId);
        
        // Get similar properties based on compared properties
        const avgPrice = properties.reduce((sum, p) => sum + (p.price || 0), 0) / properties.length;
        const commonCities = [...new Set(properties.map(p => p.city).filter(Boolean))];
        const commonTypes = [...new Set(properties.map(p => p.propertyType).filter(Boolean))];
        
        const similarProperties = await PropertyPost.find({
          _id: { $nin: propertyIds },
          isDeleted: { $ne: true },
          isBlocked: { $ne: true },
          status: 'PUBLISHED',
          visibility: 'PUBLIC',
          $or: [
            { city: { $in: commonCities } },
            { propertyType: { $in: commonTypes } },
            { price: { $gte: avgPrice * 0.7, $lte: avgPrice * 1.3 } }
          ]
        })
        .populate('author', 'fullName profilePic')
        .limit(6)
        .lean();

        // Score recommendations
        recommendations = similarProperties.map(prop => ({
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
          author: {
            id: prop.author._id,
            fullName: prop.author.fullName,
            profilePic: prop.author.profilePic,
          },
          recommendationScore: PersonalizationService.calculatePropertyScore(prop, { city: commonCities[0] }, userBehavior),
          matchReason: getMatchReason(prop, properties, userBehavior),
        })).sort((a, b) => b.recommendationScore - a.recommendationScore).slice(0, 4);
      } catch (error) {
        logger.warn("Failed to get recommendations:", error);
      }
    }

    const comparisonData = scoredProperties.map(property => ({
      id: property.id,
      title: property.title,
      price: property.price,
      propertyType: property.propertyType,
      listingType: property.listingType,
      bedrooms: property.bedrooms,
      bathrooms: property.bathrooms,
      areaSqft: property.areaSqft,
      city: property.city,
      locality: property.locality,
      latitude: property.latitude,
      longitude: property.longitude,
      mediaUrls: property.mediaUrls,
      author: property.author,
      viewCount: property.viewCount || 0,
      likesCount: property.likedBy?.length || 0,
      savesCount: property.savedBy?.length || 0,
      commentCount: property.commentCount || 0,
      shareCount: property.shareCount || 0,
      publishedAt: property.publishedAt,
      comparisonScore: property.comparisonScore,
      isBest: property.id === bestProperty.id,
      // Additional comparison fields
      furnished: property.furnished,
      parking: property.parking,
      facing: property.facing,
      floorNumber: property.floorNumber,
      totalFloors: property.totalFloors,
      ageOfProperty: property.ageOfProperty,
      possessionStatus: property.possessionStatus,
      amenities: property.postMeta?.amenities || [],
    }));

    const responseData = {
      properties: comparisonData,
      bestProperty: {
        id: bestProperty.id,
        title: bestProperty.title,
        reason: getBestPropertyReason(bestProperty, scoredProperties),
      },
      recommendations
    };

    // Cache the response for 10 minutes
    try {
      await redisClient.setEx(cacheKey, 600, JSON.stringify(responseData));
      logger.info("Cached property comparison data");
    } catch (cacheError) {
      logger.warn("Redis cache write error:", cacheError);
    }

    return sendSuccessResponse(res, 200, "Properties retrieved for comparison", responseData);
  } catch (error) {
    logger.error("Error in compareProperties:", error);
    return sendErrorResponse(res, 500, "Failed to compare properties");
  }
}

function calculatePropertyScore(property, allProperties, preferenceCriteria = 'balanced') {
  let score = 0;
  const breakdown = {};

  // Define weight configurations based on preference
  const weightConfigs = {
    balanced: {
      price: 0.25,
      area: 0.20,
      bedrooms: 0.15,
      bathrooms: 0.15,
      engagement: 0.15,
      recency: 0.10,
    },
    price: {
      price: 0.50,
      area: 0.10,
      bedrooms: 0.08,
      bathrooms: 0.08,
      engagement: 0.12,
      recency: 0.12,
    },
    area: {
      price: 0.15,
      area: 0.40,
      bedrooms: 0.15,
      bathrooms: 0.15,
      engagement: 0.10,
      recency: 0.05,
    },
    amenities: {
      price: 0.15,
      area: 0.15,
      bedrooms: 0.20,
      bathrooms: 0.20,
      engagement: 0.20,
      recency: 0.10,
    },
    location: {
      price: 0.20,
      area: 0.15,
      bedrooms: 0.10,
      bathrooms: 0.10,
      engagement: 0.25,
      recency: 0.20,
    },
    popularity: {
      price: 0.10,
      area: 0.10,
      bedrooms: 0.10,
      bathrooms: 0.10,
      engagement: 0.50,
      recency: 0.10,
    },
  };

  const weights = weightConfigs[preferenceCriteria] || weightConfigs.balanced;

  // Price score (lower is better, normalized)
  const prices = allProperties.map(p => p.price || 0).filter(p => p > 0);
  const minPrice = Math.min(...prices);
  const maxPrice = Math.max(...prices);
  const priceScore = maxPrice > minPrice ? ((maxPrice - (property.price || 0)) / (maxPrice - minPrice)) * 100 : 50;
  score += priceScore * weights.price;
  breakdown.price = Math.round(priceScore);

  // Area score (higher is better)
  const areas = allProperties.map(p => p.areaSqft || 0).filter(a => a > 0);
  const maxArea = Math.max(...areas);
  const areaScore = maxArea > 0 ? ((property.areaSqft || 0) / maxArea) * 100 : 50;
  score += areaScore * weights.area;
  breakdown.area = Math.round(areaScore);

  // Bedroom score (higher is better)
  const bedrooms = allProperties.map(p => p.bedrooms || 0);
  const maxBedrooms = Math.max(...bedrooms);
  const bedroomScore = maxBedrooms > 0 ? ((property.bedrooms || 0) / maxBedrooms) * 100 : 50;
  score += bedroomScore * weights.bedrooms;
  breakdown.bedrooms = Math.round(bedroomScore);

  // Bathroom score (higher is better)
  const bathrooms = allProperties.map(p => p.bathrooms || 0);
  const maxBathrooms = Math.max(...bathrooms);
  const bathroomScore = maxBathrooms > 0 ? ((property.bathrooms || 0) / maxBathrooms) * 100 : 50;
  score += bathroomScore * weights.bathrooms;
  breakdown.bathrooms = Math.round(bathroomScore);

  // Engagement score (higher is better)
  const engagementScore = Math.min(100, (
    (property.viewCount || 0) * 0.3 +
    (property.likedBy?.length || 0) * 5 +
    (property.savedBy?.length || 0) * 8 +
    (property.commentCount || 0) * 10
  ));
  score += engagementScore * weights.engagement;
  breakdown.engagement = Math.round(engagementScore);

  // Recency score (newer is better)
  const daysSincePublish = property.publishedAt 
    ? (new Date() - new Date(property.publishedAt)) / (1000 * 60 * 60 * 24)
    : 365;
  const recencyScore = Math.max(0, 100 - (daysSincePublish / 3)); // Decays over ~300 days
  score += recencyScore * weights.recency;
  breakdown.recency = Math.round(recencyScore);

  return { total: Math.round(score), breakdown };
}

function getBestPropertyReason(bestProperty, allProperties) {
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

function getMatchReason(property, comparedProperties, userBehavior) {
  const reasons = [];
  
  // Check location match
  const comparedCities = comparedProperties.map(p => p.city);
  if (comparedCities.includes(property.city)) {
    reasons.push("Same location as compared properties");
  }

  // Check type match
  const comparedTypes = comparedProperties.map(p => p.propertyType);
  if (comparedTypes.includes(property.propertyType)) {
    reasons.push("Similar property type");
  }

  // Check price range
  const avgPrice = comparedProperties.reduce((sum, p) => sum + (p.price || 0), 0) / comparedProperties.length;
  if (property.price >= avgPrice * 0.8 && property.price <= avgPrice * 1.2) {
    reasons.push("Within your budget range");
  }

  // Check user preferences
  if (userBehavior.preferredPropertyTypes?.some(pt => pt.type === property.propertyType)) {
    reasons.push("Matches your preferences");
  }

  return reasons.length > 0 ? reasons[0] : "Similar to properties you viewed";
}

// Cheap "is there anything new" check for feed polling — returns just the
// newest visible post's id/createdAt instead of re-running the full ranked
// feed query, so the client can poll frequently without the cost of
// personalization/pagination on every tick.
export async function getLatestFeedPost(req, res) {
  try {
    const latestPost = await PropertyPost.findOne({
      isDeleted: { $ne: true },
      isBlocked: { $ne: true },
      $and: [
        { $or: [{ status: "PUBLISHED" }, { status: { $exists: false } }, { status: null }] },
        { $or: [{ visibility: "PUBLIC" }, { visibility: { $exists: false } }, { visibility: null }] },
      ],
    })
      .sort({ createdAt: -1 })
      .select("createdAt")
      .lean();

    return sendSuccessResponse(res, 200, "Latest post retrieved", {
      latestPostId: latestPost?._id || null,
      latestCreatedAt: latestPost?.createdAt || null,
    });
  } catch (error) {
    logger.error("Error in getLatestFeedPost:", error);
    return sendErrorResponse(res, 500, "Internal Server Error");
  }
}

export async function getPropertyFeed(req, res) {
  try {
    const page = Math.max(1, Number.parseInt(req.query.page, 10) || 1);
    const limit = Math.min(50, Math.max(1, Number.parseInt(req.query.limit, 10) || 12));
    const skip = (page - 1) * limit;
    const query = String(req.query.q || "").trim();
    const listingType = String(req.query.listingType || "").trim();
    const propertyType = String(req.query.propertyType || "").trim();
    const postType = normalizePostType(req.query.postType);
    const authorId = String(req.query.authorId || "").trim();
    const savedBy = String(req.query.savedBy || "").trim();
    const category = String(req.query.category || "").trim().toLowerCase();
    const statusFilter = String(req.query.status || "").trim().toUpperCase();
    const currentUserId = req.user?._id ? String(req.user._id) : "";

    // Generate cache key based on query parameters
    const cacheKey = `property:feed:${page}:${limit}:${query}:${listingType}:${propertyType}:${postType}:${authorId}:${savedBy}:${category}:${currentUserId}`;
    
    // Try to get from cache (only for first page without complex filters)
    try {
      if (page === 1 && !query && !authorId && !savedBy) {
        const cachedData = await redisClient.get(cacheKey);
        if (cachedData) {
          logger.info("Cache hit for property feed");
          return sendSuccessResponse(res, 200, "Property feed retrieved (cached)", JSON.parse(cachedData));
        }
      }
    } catch (cacheError) {
      logger.warn("Redis cache read error:", cacheError);
    }

    const filter = { isDeleted: { $ne: true } };
    // Blocked posts are hidden everywhere this feed is used to view OTHER
    // people's posts (the public feed, someone else's profile, a "saved by"
    // list) — except when authorId is the requester's own id ("my posts"),
    // where the owner should still see their own blocked posts (badged on
    // the frontend), same as how the single-post detail view works below.
    const isViewingOwnPosts = Boolean(authorId) && currentUserId && String(authorId) === currentUserId;
    if (!isViewingOwnPosts) {
      filter.isBlocked = { $ne: true };
    }

    // Only the owner can filter their own feed by status (e.g. "My Drafts")
    // — a stranger can't use this to discover someone else's drafts.
    if (isViewingOwnPosts && ["DRAFT", "PUBLISHED", "ARCHIVED"].includes(statusFilter)) {
      filter.status = statusFilter;
    }

    // Reporting a post hides it from that reporter's own feed immediately —
    // it's not blocked for everyone until an admin reviews it and blocks it.
    if (currentUserId) {
      const myReports = await PostReport.find({ reporter: currentUserId }).select("post").lean();
      if (myReports.length > 0) {
        filter._id = { $nin: myReports.map((report) => report.post) };
      }
    }

    if (authorId) {
      filter.author = authorId;
    }
    if (savedBy) {
      filter.savedBy = savedBy;
    }
    if (query) {
      const escaped = query.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      const regex = new RegExp(escaped, "i");
      filter.$or = [
        { title: regex }, 
        { caption: regex }, 
        { city: regex }, 
        { locality: regex }
      ];
      
      // Also search by author name
      const User = (await import("../models/User.model.js")).default;
      const matchingUsers = await User.find({ fullName: regex }).select('_id').lean();
      const authorIds = matchingUsers.map(u => u._id);
      
      if (authorIds.length > 0) {
        filter.$or.push({ author: { $in: authorIds } });
      }
    }
    if (listingType) {
      filter.listingType = listingType;
    }
    if (propertyType) {
      filter.propertyType = propertyType;
    }
    if (postType) {
      filter.postType = postType;
    }

    // Handle category filters
    if (category && category !== "for you") {
      switch (category) {
        case "following":
          // Only show posts from users the current user is following
          if (currentUserId) {
            const User = (await import("../models/User.model.js")).default;
            const currentUser = await User.findById(currentUserId).select("friends").lean();
            const followingIds = currentUser?.friends || [];
            filter.author = { $in: followingIds };
          }
          break;
        case "near me":
          // Prefer real coordinates (a ~50km bounding box around the user's
          // last-known lat/lon) over city-string matching — this also covers
          // users near a city border, or whose profile city doesn't exactly
          // match how the post's city was typed in. Falls back to the old
          // city regex when the user has no stored coordinates yet.
          if (currentUserId) {
            const User = (await import("../models/User.model.js")).default;
            const currentUser = await User.findById(currentUserId).select("city locationDetails").lean();
            const userLat = currentUser?.locationDetails?.latitude;
            const userLon = currentUser?.locationDetails?.longitude;

            if (userLat != null && userLon != null) {
              const RADIUS_KM = 50;
              const latDelta = RADIUS_KM / 111;
              const lonDelta = RADIUS_KM / (111 * Math.cos((userLat * Math.PI) / 180) || 1);
              filter.latitude = { $gte: userLat - latDelta, $lte: userLat + latDelta };
              filter.longitude = { $gte: userLon - lonDelta, $lte: userLon + lonDelta };
            } else if (currentUser?.city) {
              filter.city = { $regex: new RegExp(currentUser.city, "i") };
            }
          }
          break;
        case "luxury":
          // Only show posts with price > 30,000,000
          filter.price = { $gt: 30000000 };
          break;
        case "commercial":
          // Only show commercial property type
          filter.propertyType = "Commercial";
          break;
        case "agricultural":
          // Only show agricultural land property type
          filter.propertyType = "Agricultural Land";
          break;
        case "investment":
          // Only show posts with area >= 2000 sqft
          filter.areaSqft = { $gte: 2000 };
          break;
        case "verified":
          // Only show posts from verified users (Broker, Seller, Landlord)
          filter.author = { $in: await getVerifiedUserIds() };
          break;
        case "recent":
          // Show recent posts (already the default sort, no filter needed)
          break;
      }
    }

    // Apply personalization for "for you" category — only computed for page 1,
    // since getPersonalizedRecommendations always returns the same top-N and
    // isn't paginated; running it on later pages would just repeat page 1's picks.
    let personalizedPosts = [];
    if (category === "for you" && currentUserId && page === 1) {
      try {
        personalizedPosts = await PersonalizationService.getPersonalizedRecommendations(currentUserId, limit);
        // Decorate personalized posts
        personalizedPosts = personalizedPosts.map((post) => {
          const likedBy = Array.isArray(post.likedBy) ? post.likedBy.map((item) => String(item)) : [];
          const savedBy = Array.isArray(post.savedBy) ? post.savedBy.map((item) => String(item)) : [];
          return {
            ...post,
            likesCount: likedBy.length,
            isLikedByMe: currentUserId ? likedBy.includes(currentUserId) : false,
            savesCount: savedBy.length,
            isSavedByMe: currentUserId ? savedBy.includes(currentUserId) : false,
            personalizationScore: post.personalizationScore
          };
        });
      } catch (error) {
        logger.error("Personalization error, falling back to standard feed:", error);
        // Continue with standard feed if personalization fails
      }
    }

    // Backward-compatible visibility/status filtering so legacy posts still
    // show — skipped when viewing your own posts, so drafts (and any
    // private posts) show up in "My Posts"/"My Drafts" instead of being
    // invisible to their own author.
    if (!isViewingOwnPosts) {
      filter.$and = [
        {
          $or: [
            { status: "PUBLISHED" },
            { status: { $exists: false } },
            { status: null },
          ],
        },
        {
          $or: [
            { visibility: "PUBLIC" },
            { visibility: { $exists: false } },
            { visibility: null },
          ],
        },
      ];
    }

    async function getVerifiedUserIds() {
      const User = (await import("../models/User.model.js")).default;
      const verifiedUsers = await User.find({
        $or: [
          { activeRole: { $in: ["Broker", "Seller", "Landlord"] } },
          { primaryRole: { $in: ["Broker", "Seller", "Landlord"] } },
        ],
      }).select("_id").lean();
      return verifiedUsers.map(u => String(u._id));
    }

    const [posts, total] = await Promise.all([
      PropertyPost.find(filter)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .populate("author", "fullName profilePic activeRole primaryRole city isVerified")
        .lean(),
      PropertyPost.countDocuments(filter),
    ]);

    const decoratedPosts = posts.map((post) => {
      const likedBy = Array.isArray(post.likedBy) ? post.likedBy.map((item) => String(item)) : [];
      const savedBy = Array.isArray(post.savedBy) ? post.savedBy.map((item) => String(item)) : [];
      return {
        ...post,
        likesCount: likedBy.length,
        isLikedByMe: currentUserId ? likedBy.includes(currentUserId) : false,
        savesCount: savedBy.length,
        isSavedByMe: currentUserId ? savedBy.includes(currentUserId) : false,
      };
    });

    // Structure the feed for "for you" category — only on page 1. Later pages
    // fall through to plain chronological pagination below: the new/recent
    // date buckets are computed from that page's own slice, which is almost
    // always older than the 48h window once there's real post volume, and
    // personalizedPosts is intentionally empty past page 1 (see above) — so
    // bucketing every page here would return an empty `posts` array on page 2+
    // even though pagination.totalPages still claims more pages exist.
    if (category === "for you" && page === 1) {
      const now = new Date();
      const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
      const twoDaysAgo = new Date(now.getTime() - 2 * 24 * 60 * 60 * 1000);
      
      const newPosts = decoratedPosts.filter(post => new Date(post.createdAt) > oneDayAgo);
      const recentPosts = decoratedPosts.filter(post => {
        const postDate = new Date(post.createdAt);
        return postDate <= oneDayAgo && postDate > twoDaysAgo;
      });
      
      // Combine: new posts + recent posts + personalized recommendations
      const combinedPosts = [
        ...newPosts,
        ...recentPosts,
        ...personalizedPosts.filter(p => !decoratedPosts.some(dp => String(dp._id) === String(p._id)))
      ];

      const responseData = {
        posts: combinedPosts,
        sections: {
          new: newPosts.length,
          recent: recentPosts.length,
          personalized: personalizedPosts.length
        },
        pagination: {
          page,
          totalPages: Math.ceil(total / limit),
          total,
          structured: true
        }
      };

      // Cache the response for 5 minutes (only for first page)
      try {
        if (page === 1 && !query && !authorId && !savedBy) {
          await redisClient.setEx(cacheKey, 180, JSON.stringify(responseData));
          logger.info("Cached property feed data");
        }
      } catch (cacheError) {
        logger.warn("Redis cache write error:", cacheError);
      }

      return sendSuccessResponse(res, responseData);
    }

    const responseData = {
      posts: decoratedPosts,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.max(1, Math.ceil(total / limit)),
      },
    };

    // Cache the response for 5 minutes (only for first page without complex filters)
    try {
      if (page === 1 && !query && !authorId && !savedBy) {
        await redisClient.setEx(cacheKey, 180, JSON.stringify(responseData));
        logger.info("Cached property feed data");
      }
    } catch (cacheError) {
      logger.warn("Redis cache write error:", cacheError);
    }

    return sendSuccessResponse(res, 200, "Property feed fetched successfully", responseData);
  } catch (error) {
    logger.error("Error fetching property feed:", error);
    return sendErrorResponse(res, 500, "Internal Server Error");
  }
}

export async function createPropertyPost(req, res) {
  try {
    const userId = req.user?._id;
    if (!userId) {
      return sendErrorResponse(res, 401, "Unauthorized");
    }

    const activeRole = resolveActiveRole(req.user);
    const allowedPostTypes = getAllowedPostTypesForRole(activeRole);
    const requestedPostType = normalizePostType(req.body?.postType) || allowedPostTypes[0];
    const effectivePostType = canRoleCreatePostType(activeRole, requestedPostType)
      ? requestedPostType
      : allowedPostTypes[0];

    if (effectivePostType !== requestedPostType) {
      logger.warn(
        `Post type ${requestedPostType} not allowed for role ${activeRole || "UNKNOWN"}. Falling back to ${effectivePostType}.`
      );
    }

    const postTypeDefaults = getPostTypeDefaults(effectivePostType);
    let title = String(req.body?.title || "").trim();
    if (!title) {
      const locality = String(req.body?.locality || "").trim();
      const city = String(req.body?.city || "").trim();
      const locationHint = [locality, city].filter(Boolean).join(", ");
      title = locationHint ? `Post for ${locationHint}` : "NearMySpace Post";
    }

    const status = String(req.body?.status || "PUBLISHED").trim().toUpperCase();
    const visibility = String(req.body?.visibility || "PUBLIC").trim().toUpperCase();
    const safeStatus = ["DRAFT", "PUBLISHED", "ARCHIVED"].includes(status) ? status : "PUBLISHED";
    const safeVisibility = ["PUBLIC", "PRIVATE"].includes(visibility) ? visibility : "PUBLIC";

    const post = await PropertyPost.create({
      author: userId,
      authorRole: activeRole,
      postType: effectivePostType,
      status: safeStatus,
      visibility: safeVisibility,
      publishedAt: safeStatus === "PUBLISHED" ? new Date() : undefined,
      listingType: String(req.body?.listingType || postTypeDefaults.listingType || "Buy").trim(),
      propertyType: String(req.body?.propertyType || postTypeDefaults.propertyType || "Apartment").trim(),
      title,
      caption: String(req.body?.caption || "").trim(),
      city: String(req.body?.city || "").trim(),
      locality: String(req.body?.locality || "").trim(),
      price: Number(req.body?.price || 0),
      bedrooms: Number(req.body?.bedrooms || 0),
      bathrooms: Number(req.body?.bathrooms || 0),
      areaSqft: Number(req.body?.areaSqft || 0),
      mediaUrls: normalizeMediaUrls(req.body?.mediaUrls),
      postMeta: sanitizePostMeta(req.body?.postMeta),
      latitude: req.body?.latitude ? Number(req.body.latitude) : undefined,
      longitude: req.body?.longitude ? Number(req.body.longitude) : undefined,
    });

    const populated = await PropertyPost.findById(post._id)
      .populate("author", "fullName profilePic activeRole primaryRole city isVerified")
      .lean();

    await invalidateDiscoverCache(userId);

    // Invalidate property feed cache
    try {
      const keys = await redisClient.keys("property:feed:*");
      if (keys.length > 0) {
        await redisClient.del(keys);
        logger.info(`Invalidated ${keys.length} property feed cache entries`);
      }
    } catch (cacheError) {
      logger.warn("Redis cache invalidation error:", cacheError);
    }

    return sendSuccessResponse(res, 201, "Property post created successfully", {
      post: {
        ...populated,
        likesCount: 0,
        isLikedByMe: false,
        savesCount: 0,
        isSavedByMe: false,
      },
    });
  } catch (error) {
    logger.error("Error creating property post:", error);
    return sendErrorResponse(res, 500, "Internal Server Error");
  }
}

export async function updatePropertyPost(req, res) {
  try {
    const userId = req.user?._id;
    const postId = req.params?.id;

    if (!userId) {
      return sendErrorResponse(res, 401, "Unauthorized");
    }

    if (!postId) {
      return sendErrorResponse(res, 400, "Post ID is required");
    }

    const post = await PropertyPost.findById(postId);
    if (!post || post.isDeleted) {
      return sendErrorResponse(res, 404, "Post not found");
    }

    // Check if user is the author of the post
    if (String(post.author) !== String(userId)) {
      return sendErrorResponse(res, 403, "You can only edit your own posts");
    }

    const activeRole = resolveActiveRole(req.user);
    const allowedPostTypes = getAllowedPostTypesForRole(activeRole);
    const requestedPostType = normalizePostType(req.body?.postType) || post.postType;
    const effectivePostType = canRoleCreatePostType(activeRole, requestedPostType)
      ? requestedPostType
      : allowedPostTypes[0];

    let title = String(req.body?.title || "").trim();
    if (!title) {
      const locality = String(req.body?.locality || post.locality || "").trim();
      const city = String(req.body?.city || post.city || "").trim();
      const locationHint = [locality, city].filter(Boolean).join(", ");
      title = locationHint ? `Post for ${locationHint}` : "NearMySpace Post";
    }

    const status = String(req.body?.status || post.status || "PUBLISHED").trim().toUpperCase();
    const visibility = String(req.body?.visibility || post.visibility || "PUBLIC").trim().toUpperCase();
    const safeStatus = ["DRAFT", "PUBLISHED", "ARCHIVED"].includes(status) ? status : "PUBLISHED";
    const safeVisibility = ["PUBLIC", "PRIVATE"].includes(visibility) ? visibility : "PUBLIC";

    // Update post fields
    post.postType = effectivePostType;
    post.status = safeStatus;
    post.visibility = safeVisibility;
    post.publishedAt = safeStatus === "PUBLISHED" && post.status !== "PUBLISHED" ? new Date() : post.publishedAt;
    post.listingType = String(req.body?.listingType || post.listingType).trim();
    post.propertyType = String(req.body?.propertyType || post.propertyType).trim();
    post.customBadge = String(req.body?.customBadge ?? post.customBadge ?? "").trim().slice(0, 40);
    post.title = title;
    post.caption = String(req.body?.caption || post.caption).trim();
    post.city = String(req.body?.city || post.city).trim();
    post.locality = String(req.body?.locality || post.locality).trim();
    post.price = Number(req.body?.price ?? post.price);
    post.bedrooms = Number(req.body?.bedrooms ?? post.bedrooms);
    post.bathrooms = Number(req.body?.bathrooms ?? post.bathrooms);
    post.areaSqft = Number(req.body?.areaSqft ?? post.areaSqft);
    
    if (req.body?.mediaUrls) {
      post.mediaUrls = normalizeMediaUrls(req.body.mediaUrls);
    }
    
    if (req.body?.postMeta) {
      post.postMeta = sanitizePostMeta(req.body.postMeta);
    }
    
    if (req.body?.latitude !== undefined) {
      post.latitude = req.body.latitude ? Number(req.body.latitude) : undefined;
    }
    
    if (req.body?.longitude !== undefined) {
      post.longitude = req.body.longitude ? Number(req.body.longitude) : undefined;
    }

    await post.save();

    const populated = await PropertyPost.findById(post._id)
      .populate("author", "fullName profilePic activeRole primaryRole city isVerified")
      .lean();

    await invalidateDiscoverCache(userId);
    await invalidateActivityCache(userId);

    // Invalidate property feed cache
    try {
      const keys = await redisClient.keys("property:feed:*");
      if (keys.length > 0) {
        await redisClient.del(keys);
        logger.info(`Invalidated ${keys.length} property feed cache entries`);
      }
    } catch (cacheError) {
      logger.warn("Redis cache invalidation error:", cacheError);
    }

    return sendSuccessResponse(res, 200, "Property post updated successfully", {
      post: {
        ...populated,
        likesCount: populated.likedBy?.length || 0,
        isLikedByMe: populated.likedBy?.some(id => String(id) === String(userId)) || false,
        savesCount: populated.savedBy?.length || 0,
        isSavedByMe: populated.savedBy?.some(id => String(id) === String(userId)) || false,
      },
    });
  } catch (error) {
    logger.error("Error updating property post:", error);
    return sendErrorResponse(res, 500, "Internal Server Error");
  }
}

export async function togglePropertyPostLike(req, res) {
  try {
    const userId = req.user?._id;
    const postId = req.params?.id;

    if (!userId) {
      return sendErrorResponse(res, 401, "Unauthorized");
    }

    const post = await PropertyPost.findById(postId).populate("author", "fullName");
    if (!post || post.isDeleted || post.isBlocked) {
      return sendErrorResponse(res, 404, "Post not found");
    }

    const userIdString = String(userId);
    const hasLiked = post.likedBy.some((id) => String(id) === userIdString);

    if (hasLiked) {
      post.likedBy = post.likedBy.filter((id) => String(id) !== userIdString);
      post.likedByTimestamps = post.likedByTimestamps.filter((item) => String(item.userId) !== userIdString);
    } else {
      post.likedBy.push(userId);
      post.likedByTimestamps.push({ userId: userId, timestamp: new Date() });
      
      // Create notification for post author (if not self-like)
      if (String(post.author._id) !== userIdString) {
        await NotificationService.send({
          recipientId: post.author._id,
          actorId: userId,
          type: "property_like",
          title: "New like",
          message: `${req.user.fullName} liked your property: ${post.title}`,
          data: { propertyPost: post._id, url: `/property/${post._id}` },
          channels: [NotificationChannel.IN_APP, NotificationChannel.REALTIME, NotificationChannel.FIREBASE],
        });
        logger.info("Like notification sent for post:", post._id);
      }
    }

    await post.save();

    await invalidateDiscoverCache(userId);
    await invalidateActivityCache(userId);
    await PersonalizationService.invalidatePersonalizationCache(userId);

    // Invalidate property feed cache
    try {
      const keys = await redisClient.keys("property:feed:*");
      if (keys.length > 0) {
        await redisClient.del(keys);
        logger.info(`Invalidated ${keys.length} property feed cache entries on like`);
      }
    } catch (cacheError) {
      logger.warn("Redis cache invalidation error:", cacheError);
    }

    return sendSuccessResponse(res, 200, "Post like status updated", {
      liked: !hasLiked,
      likesCount: post.likedBy.length,
    });
  } catch (error) {
    logger.error("Error toggling property post like:", error);
    return sendErrorResponse(res, 500, "Internal Server Error");
  }
}

export async function togglePropertyPostSave(req, res) {
  try {
    const userId = req.user?._id;
    const postId = req.params?.id;

    if (!userId) {
      return sendErrorResponse(res, 401, "Unauthorized");
    }

    const post = await PropertyPost.findById(postId).populate("author", "fullName");
    if (!post || post.isDeleted || post.isBlocked) {
      return sendErrorResponse(res, 404, "Post not found");
    }

    const userIdString = String(userId);
    const hasSaved = post.savedBy.some((id) => String(id) === userIdString);

    if (hasSaved) {
      post.savedBy = post.savedBy.filter((id) => String(id) !== userIdString);
      post.savedByTimestamps = post.savedByTimestamps.filter((item) => String(item.userId) !== userIdString);
    } else {
      post.savedBy.push(userId);
      post.savedByTimestamps.push({ userId: userId, timestamp: new Date() });
      
      // Create notification for post author (if not self-save)
      if (String(post.author._id) !== userIdString) {
        await NotificationService.send({
          recipientId: post.author._id,
          actorId: userId,
          type: "property_save",
          title: "New save",
          message: `${req.user.fullName} saved your property: ${post.title}`,
          data: { propertyPost: post._id, url: `/property/${post._id}` },
          channels: [NotificationChannel.IN_APP, NotificationChannel.REALTIME, NotificationChannel.FIREBASE],
        });
        logger.info("Save notification sent for post:", post._id);
      }
    }

    await post.save();

    await invalidateDiscoverCache(userId);
    await invalidateActivityCache(userId);
    await PersonalizationService.invalidatePersonalizationCache(userId);

    // Invalidate property feed cache
    try {
      const keys = await redisClient.keys("property:feed:*");
      if (keys.length > 0) {
        await redisClient.del(keys);
        logger.info(`Invalidated ${keys.length} property feed cache entries on save`);
      }
    } catch (cacheError) {
      logger.warn("Redis cache invalidation error:", cacheError);
    }

    return sendSuccessResponse(res, 200, "Post save status updated", {
      saved: !hasSaved,
      savesCount: post.savedBy.length,
    });
  } catch (error) {
    logger.error("Error toggling property post save:", error);
    return sendErrorResponse(res, 500, "Internal Server Error");
  }
}

export async function getPropertyPostById(req, res) {
  try {
    const postId = req.params?.id;
    const currentUserId = req.user?._id ? String(req.user._id) : "";

    if (!postId) {
      return sendErrorResponse(res, 400, "Post ID is required");
    }

    const post = await PropertyPost.findById(postId)
      .populate("author", "fullName profilePic activeRole primaryRole city isVerified mobileNumber friends")
      .lean();

    if (!post || post.isDeleted) {
      return sendErrorResponse(res, 404, "Post not found");
    }

    const isPostOwner = currentUserId && post.author && String(post.author._id) === currentUserId;
    if (post.isBlocked && !isPostOwner) {
      return sendErrorResponse(res, 404, "Post not found");
    }

    // Only the owner and their friends can see the contact number — not every logged-in viewer.
    if (post.author) {
      const isOwner = currentUserId && String(post.author._id) === currentUserId;
      const isFriend = currentUserId && (post.author.friends || []).some((friendId) => String(friendId) === currentUserId);
      if (!isOwner && !isFriend) {
        delete post.author.mobileNumber;
      }
      delete post.author.friends;
    }

    const likedBy = Array.isArray(post.likedBy) ? post.likedBy.map((item) => String(item)) : [];
    const savedBy = Array.isArray(post.savedBy) ? post.savedBy.map((item) => String(item)) : [];

    return sendSuccessResponse(res, 200, "Property post fetched successfully", {
      post: {
        ...post,
        likesCount: likedBy.length,
        isLikedByMe: currentUserId ? likedBy.includes(currentUserId) : false,
        savesCount: savedBy.length,
        isSavedByMe: currentUserId ? savedBy.includes(currentUserId) : false,
      },
    });
  } catch (error) {
    logger.error("Error fetching property post:", error);
    return sendErrorResponse(res, 500, "Internal Server Error");
  }
}

export async function incrementViewCount(req, res) {
  try {
    const postId = req.params?.id;
    const userId = req.user?._id;

    if (!postId) {
      return sendErrorResponse(res, 400, "Post ID is required");
    }

    const post = await PropertyPost.findById(postId);
    if (!post || post.isDeleted || (post.isBlocked && String(post.author) !== String(userId))) {
      return sendErrorResponse(res, 404, "Post not found");
    }

    // Don't count views from the post author
    if (String(post.author) === String(userId)) {
      return sendSuccessResponse(res, 200, "View count not incremented (own post)", {
        viewCount: post.viewCount,
      });
    }

    post.viewCount = (post.viewCount || 0) + 1;
    await post.save();

    // Invalidate property feed cache
    try {
      const keys = await redisClient.keys("property:feed:*");
      if (keys.length > 0) {
        await redisClient.del(keys);
        logger.info(`Invalidated ${keys.length} property feed cache entries on view`);
      }
    } catch (cacheError) {
      logger.warn("Redis cache invalidation error:", cacheError);
    }

    return sendSuccessResponse(res, 200, "View count incremented", {
      viewCount: post.viewCount,
    });
  } catch (error) {
    logger.error("Error incrementing view count:", error);
    return sendErrorResponse(res, 500, "Internal Server Error");
  }
}

export async function uploadPropertyMedia(req, res) {
  try {
    if (!req.files || req.files.length === 0) {
      return sendErrorResponse(res, 400, "No files uploaded");
    }

    const mediaUrls = req.files.map((file) => file.path);

    return sendSuccessResponse(res, 200, "Media uploaded successfully", {
      mediaUrls,
      count: mediaUrls.length,
    });
  } catch (error) {
    logger.error("Error uploading property media:", error);
    return sendErrorResponse(res, 500, "Internal Server Error");
  }
}

export async function deletePropertyPost(req, res) {
  try {
    const postId = req.params?.id;
    const userId = req.user?._id;

    if (!postId) {
      return sendErrorResponse(res, 400, "Post ID is required");
    }

    const post = await PropertyPost.findById(postId);
    if (!post) {
      return sendErrorResponse(res, 404, "Post not found");
    }

    // Check if user is the author of the post
    if (String(post.author) !== String(userId)) {
      return sendErrorResponse(res, 403, "You can only delete your own posts");
    }

    // Soft delete - mark as deleted instead of removing from database
    post.isDeleted = true;
    post.deletedAt = new Date();
    post.deletedBy = userId;
    await post.save();

    // Invalidate caches
    await invalidateDiscoverCache();
    await invalidateActivityCache(userId);

    logger.info(`Post soft deleted successfully`, { postId, userId });

    return sendSuccessResponse(res, 200, "Post deleted successfully");
  } catch (error) {
    logger.error("Error deleting property post:", error);
    return sendErrorResponse(res, 500, "Internal Server Error");
  }
}

// A user reports a post for review — this does NOT block the post; it just
// creates a moderation case for an admin to review (see admin.controller.js).
export async function reportPost(req, res) {
  try {
    const userId = req.user?._id;
    const postId = req.params?.id;
    const { reasonCode, description } = req.body || {};

    if (!userId) {
      return sendErrorResponse(res, 401, "Unauthorized");
    }

    if (!REPORT_REASON_CODES.includes(reasonCode)) {
      return sendErrorResponse(res, 400, "A valid reason is required");
    }

    const post = await PropertyPost.findById(postId).select("author isDeleted title");
    if (!post || post.isDeleted) {
      return sendErrorResponse(res, 404, "Post not found");
    }

    if (String(post.author) === String(userId)) {
      return sendErrorResponse(res, 400, "You cannot report your own post");
    }

    try {
      await PostReport.create({
        post: postId,
        reporter: userId,
        reasonCode,
        description: String(description || "").trim().slice(0, 1000),
      });
    } catch (error) {
      if (error.code === 11000) {
        return sendErrorResponse(res, 400, "You've already reported this post");
      }
      throw error;
    }

    logger.info(`Post ${postId} reported by user ${userId} (reason: ${reasonCode})`);

    // Let the owner know, without naming the reporter — the report modal
    // promises the reporter anonymity, so no `actor` is set here.
    try {
      await NotificationService.send({
        recipientId: post.author,
        type: "post_reported",
        realtimeEventType: "post_moderation_notice",
        title: "Post reported",
        message: `Your post "${post.title}" was reported and is under review by our team`,
        data: { propertyPost: post._id, url: `/property/${post._id}` },
        channels: [NotificationChannel.IN_APP, NotificationChannel.REALTIME, NotificationChannel.FIREBASE],
      });
    } catch (error) {
      logger.error("Failed to notify owner of post report (non-fatal):", { message: error.message });
    }

    return sendSuccessResponse(res, 201, "Thanks for the report. Our team will review it.");
  } catch (error) {
    logger.error("Error reporting post:", error);
    return sendErrorResponse(res, 500, "Internal Server Error");
  }
}
