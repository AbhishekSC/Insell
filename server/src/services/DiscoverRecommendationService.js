import FriendRequest from "../models/FriendRequest.model.js";
import PropertyPost from "../models/PropertyPost.model.js";
import User from "../models/User.model.js";
import { redisClient } from "../config/redis.js";
import { logger } from "../utils/logger.js";

const CACHE_TTL_SECONDS = 30 * 60;
const MAX_CANDIDATES = 500;

const normalized = (value) => String(value || "").trim().toLowerCase();
const overlap = (left = [], right = []) => left.some((value) => right.map(normalized).includes(normalized(value)));

export async function invalidateDiscoverCache(userId) {
  try {
    const pattern = `discover:${userId}:*`;
    for await (const key of redisClient.scanIterator({ MATCH: pattern, COUNT: 100 })) {
      await redisClient.del(key);
    }
  } catch {
    // Cache invalidation must not block profile, listing, or connection updates.
  }
}

function profileCompletion(user) {
  const fields = [user.fullName, user.profilePic, user.city || user.homeBase, user.primaryRole || user.activeRole, ...(user.propertyTypePreferences || [])];
  return Math.round((fields.filter(Boolean).length / 5) * 100);
}

function reasonFor({ sameCity, mutualCount, verified, rating, activeToday, interestMatch, trending, recentlyJoined, commentMatch, distance, searchMatch, likedMatch, savedMatch, budgetMatch, intentMatch }) {
  if (mutualCount > 0) return `${mutualCount} mutual connection${mutualCount === 1 ? "" : "s"}`;
  if (intentMatch) return "Complementary listing intent";
  if (budgetMatch > 10) return "Compatible budget range";
  if (likedMatch) return "Similar property preferences";
  if (savedMatch) return "Shared saved properties";
  if (searchMatch) return "Similar search interests";
  if (commentMatch) return "Similar comment interests";
  if (distance !== null && distance !== undefined) return `Within ${Math.round(distance)} km`;
  if (sameCity) return "Based in your city";
  if (verified) return "Verified professional";
  if (rating >= 4.8) return "Highly rated professional";
  if (trending) return "Trending this week";
  if (activeToday) return "Recently active";
  if (interestMatch) return "Shared property interests";
  if (recentlyJoined) return "New member on NearMySpace";
  return "Recommended for your network";
}

function sectionFor(candidate) {
  if (candidate.verified && candidate.rating >= 4.5) return "featured";
  if (candidate.mutualConnections > 0) return "peopleYouMayKnow";
  if (candidate.sameCity) return "nearby";
  if (candidate.trending) return "trending";
  if (candidate.recentlyJoined) return "recentlyJoined";
  if (candidate.rating >= 4.5) return "topRated";
  return "active";
}

function matchesFilter(candidate, filter, city, profession, verified, nearby) {
  if (city && normalized(candidate.city) !== normalized(city)) return false;
  if (profession && !normalized(candidate.primaryRole).includes(normalized(profession))) return false;
  if (verified === "true" && !candidate.verified) return false;
  if (nearby === "true" && !candidate.sameCity) return false;
  const key = normalized(filter);
  if (!key || key === "all") return true;
  if (key === "nearby") return candidate.sameCity;
  if (key === "verified") return candidate.verified;
  if (key === "recently active") return candidate.activeToday;
  return normalized(candidate.primaryRole).includes(key.replace(/s$/, ""));
}

export async function getDiscoverRecommendations(currentUserId, query = {}) {
  const page = Math.max(1, Number.parseInt(query.page, 10) || 1);
  const limit = Math.min(20, Math.max(1, Number.parseInt(query.limit, 10) || 12));
  const cacheable = !query.q && !query.filter && !query.city && !query.profession && !query.verified && !query.nearby && !query.radius;
  const cacheKey = `discover:${currentUserId}:${page}:${limit}`;

  if (cacheable) {
    try {
      const cached = await redisClient.get(cacheKey);
      if (cached) {
        logger.info(`✅ CACHE HIT: Discover recommendations for user ID: ${currentUserId}`);
        return JSON.parse(cached);
      }
      logger.info(`❌ CACHE MISS: Discover recommendations for user ID: ${currentUserId} - fetching from database`);
    } catch {
      logger.warn("Redis cache read failed for discover recommendations, falling back to database");
      // Recommendations should remain available when Redis is temporarily unavailable.
    }
  }

  const currentUser = await User.findById(currentUserId).select("fullName city homeBase friends propertyTypePreferences preferredLocalities primaryRole activeRole commentAnalytics locationDetails searchHistory viewedPosts likedPosts savedPosts budgetMin budgetMax listingIntent").lean();
  if (!currentUser) throw new Error("USER_NOT_FOUND");

  const currentId = String(currentUser._id);
  const friendIds = (currentUser.friends || []).map(String);
  const pendingRequests = await FriendRequest.find({ status: "pending", $or: [{ sender: currentUserId }, { receiver: currentUserId }] }).select("sender receiver").lean();
  const excluded = new Set([currentId, ...friendIds]);
  pendingRequests.forEach((request) => { excluded.add(String(request.sender)); excluded.add(String(request.receiver)); });

  const search = String(query.q || "").trim();
  const baseQuery = { _id: { $nin: [...excluded] } };
  if (search) {
    const regex = new RegExp(search.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i");
    baseQuery.$or = [{ fullName: regex }, { city: regex }, { primaryRole: regex }, { activeRole: regex }, { preferredLocalities: regex }, { propertyTypePreferences: regex }];
  }

  const candidates = await User.find(baseQuery).select("fullName profilePic city homeBase location primaryRole activeRole friends propertyTypePreferences preferredLocalities isVerified profileCompletion responseRate createdAt updatedAt commentAnalytics locationDetails").limit(MAX_CANDIDATES).lean();
  const candidateIds = candidates.map((user) => user._id);
  const listingStats = await PropertyPost.aggregate([
    { $match: { author: { $in: candidateIds }, status: "PUBLISHED", visibility: "PUBLIC" } },
    { $group: { _id: "$author", listingsCount: { $sum: 1 }, engagement: { $sum: { $add: ["$engagementScore", "$viewCount", "$shareCount", "$commentCount", "$chatCount"] } }, lastPostAt: { $max: "$publishedAt" } } },
  ]);
  const statsByAuthor = new Map(listingStats.map((stat) => [String(stat._id), stat]));
  const now = Date.now();
  const currentCity = normalized(currentUser.city || currentUser.homeBase);
  const currentInterests = [...(currentUser.propertyTypePreferences || []), ...(currentUser.preferredLocalities || [])];
  
  // Extract comment analytics for matching
  const currentUserKeywords = new Set(currentUser.commentAnalytics?.commonKeywords || []);
  const currentUserIntents = new Set(currentUser.commentAnalytics?.detectedIntents || []);
  const currentUserPropertyInterests = (currentUser.commentAnalytics?.propertyTypeInterests || []).map(pi => pi.type);
  
  // Extract search history keywords and locations with time decay
  const searchKeywords = new Set();
  const searchLocations = new Set();
  const thirtyDaysAgo = now - 30 * 24 * 60 * 60 * 1000;
  (currentUser.searchHistory || []).forEach(search => {
    const searchAge = now - new Date(search.searchedAt).getTime();
    if (searchAge < thirtyDaysAgo) {
      const words = search.query.toLowerCase().split(/\s+/);
      words.forEach(word => {
        if (word.length > 2) searchKeywords.add(word);
      });
      // Extract potential location names from search
      if (search.query.match(/^[A-Z][a-z]+(?:\s+[A-Z][a-z]+)?$/)) {
        searchLocations.add(normalized(search.query));
      }
    }
  });
  
  // Extract viewed posts preferences with time decay
  const viewedPropertyTypes = new Map();
  const viewedLocations = new Map();
  const viewedBudgets = [];
  (currentUser.viewedPosts || []).forEach(view => {
    const viewAge = now - new Date(view.viewedAt).getTime();
    if (viewAge < thirtyDaysAgo) {
      const decayFactor = Math.max(0.1, 1 - (viewAge / thirtyDaysAgo));
      viewedBudgets.push({ budget: null, decay: decayFactor }); // Will be populated from post data
    }
  });
  
  // Extract liked/saved posts preferences
  const likedPropertyTypes = new Set();
  const likedLocations = new Set();
  const likedBudgets = [];
  const savedPropertyTypes = new Set();
  const savedLocations = new Set();
  const savedBudgets = [];
  
  // Get property details for liked/saved posts
  const likedPostIds = (currentUser.likedPosts || []).map(String);
  const savedPostIds = (currentUser.savedPosts || []).map(String);
  const propertyDetails = await PropertyPost.find({ _id: { $in: [...likedPostIds, ...savedPostIds] } })
    .select("propertyType city price budgetMin budgetMax")
    .lean();
  
  propertyDetails.forEach(post => {
    const isLiked = likedPostIds.includes(String(post._id));
    const isSaved = savedPostIds.includes(String(post._id));
    
    if (post.propertyType) {
      if (isLiked) likedPropertyTypes.add(post.propertyType.toLowerCase());
      if (isSaved) savedPropertyTypes.add(post.propertyType.toLowerCase());
    }
    if (post.city) {
      if (isLiked) likedLocations.add(normalized(post.city));
      if (isSaved) savedLocations.add(normalized(post.city));
    }
    if (post.price || post.budgetMin || post.budgetMax) {
      const budget = post.price || post.budgetMax || post.budgetMin || 0;
      if (isLiked) likedBudgets.push(budget);
      if (isSaved) savedBudgets.push(budget);
    }
  });
  
  // Calculate user's budget range from interactions
  const allBudgets = [...likedBudgets, ...savedBudgets];
  const avgBudget = allBudgets.length > 0 ? allBudgets.reduce((a, b) => a + b, 0) / allBudgets.length : 0;
  const userBudgetMin = currentUser.budgetMin || (avgBudget > 0 ? avgBudget * 0.8 : 0);
  const userBudgetMax = currentUser.budgetMax || (avgBudget > 0 ? avgBudget * 1.2 : 0);
  const userListingIntent = normalized(currentUser.listingIntent || "");
  
  // Handle nearby radius filtering
  const nearby = query.nearby === "true";
  const radiusKm = Number.parseInt(query.radius, 10) || 0;
  const currentUserLat = currentUser.locationDetails?.latitude;
  const currentUserLng = currentUser.locationDetails?.longitude;
  
  // Calculate distance between two coordinates in kilometers using Haversine formula
  const calculateDistance = (lat1, lon1, lat2, lon2) => {
    if (!lat1 || !lon1 || !lat2 || !lon2) return Infinity;
    const R = 6371; // Earth's radius in km
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
              Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
              Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  };

  const ranked = candidates.map((user) => {
    const stats = statsByAuthor.get(String(user._id)) || {};
    const city = user.city || user.homeBase || user.location || "";
    const sameCity = Boolean(currentCity && normalized(city) === currentCity);
    const mutualConnections = (user.friends || []).map(String).filter((id) => friendIds.includes(id)).length;
    const completion = Number(user.profileCompletion) || profileCompletion(user);
    const verified = Boolean(user.isVerified);
    const rating = Number(user.averageRating || user.rating || 0);
    const activeToday = now - new Date(user.updatedAt || user.createdAt).getTime() < 24 * 60 * 60 * 1000;
    const activeThisWeek = now - new Date(user.updatedAt || user.createdAt).getTime() < 7 * 24 * 60 * 60 * 1000;
    const recentlyJoined = now - new Date(user.createdAt).getTime() < 30 * 24 * 60 * 60 * 1000;
    const interestMatch = overlap(currentInterests, [...(user.propertyTypePreferences || []), ...(user.preferredLocalities || [])]);
    const trending = Number(stats.engagement || 0) > 0 && now - new Date(stats.lastPostAt || user.createdAt).getTime() < 7 * 24 * 60 * 60 * 1000;
    
    // Calculate distance if nearby filtering is enabled
    const userLat = user.locationDetails?.latitude;
    const userLng = user.locationDetails?.longitude;
    const distance = nearby && currentUserLat && currentUserLng && userLat && userLng 
      ? calculateDistance(currentUserLat, currentUserLng, userLat, userLng) 
      : Infinity;
    
    // Filter out users outside the radius if nearby is enabled
    if (nearby && radiusKm > 0 && distance > radiusKm) {
      return null;
    }
    
    // Comment-based matching
    const candidateKeywords = new Set(user.commentAnalytics?.commonKeywords || []);
    const candidateIntents = new Set(user.commentAnalytics?.detectedIntents || []);
    const candidatePropertyInterests = (user.commentAnalytics?.propertyTypeInterests || []).map(pi => pi.type);
    
    // Calculate comment similarity score
    const keywordMatch = currentUserKeywords.size > 0 && candidateKeywords.size > 0 
      ? overlap([...currentUserKeywords], [...candidateKeywords]) ? 8 : 0 
      : 0;
    
    const intentMatch = currentUserIntents.size > 0 && candidateIntents.size > 0
      ? overlap([...currentUserIntents], [...candidateIntents]) ? 6 : 0
      : 0;
    
    const propertyInterestMatch = currentUserPropertyInterests.length > 0 && candidatePropertyInterests.length > 0
      ? overlap(currentUserPropertyInterests, candidatePropertyInterests) ? 10 : 0
      : 0;
    
    const commentActivityScore = (user.commentAnalytics?.totalComments || 0) >= 10 ? 5 : 0;
    const positiveSentimentBonus = user.commentAnalytics?.sentimentDistribution?.positive > user.commentAnalytics?.sentimentDistribution?.negative ? 3 : 0;
    
    const commentScore = keywordMatch + intentMatch + propertyInterestMatch + commentActivityScore + positiveSentimentBonus;
    
    // Search history matching
    const userSearchKeywords = [...searchKeywords];
    const candidateSearchKeywords = (user.searchHistory || [])
      .filter(s => now - new Date(s.searchedAt).getTime() < thirtyDaysAgo)
      .flatMap(s => s.query.toLowerCase().split(/\s+/).filter(w => w.length > 2));
    const searchKeywordMatch = userSearchKeywords.length > 0 && candidateSearchKeywords.length > 0
      ? overlap(userSearchKeywords, candidateSearchKeywords) ? 7 : 0
      : 0;
    
    const userCity = normalized(city);
    const searchLocationMatch = searchLocations.size > 0 && searchLocations.has(userCity) ? 8 : 0;
    
    // Liked/saved posts matching
    const candidatePropertyTypes = [...(user.propertyTypePreferences || [])].map(t => t.toLowerCase());
    const likedPropertyMatch = likedPropertyTypes.size > 0 && candidatePropertyTypes.some(t => likedPropertyTypes.has(t)) ? 12 : 0;
    const savedPropertyMatch = savedPropertyTypes.size > 0 && candidatePropertyTypes.some(t => savedPropertyTypes.has(t)) ? 10 : 0;
    const likedLocationMatch = likedLocations.size > 0 && likedLocations.has(userCity) ? 8 : 0;
    const savedLocationMatch = savedLocations.size > 0 && savedLocations.has(userCity) ? 6 : 0;
    
    // Budget compatibility matching
    const candidateBudgetMin = user.budgetMin || 0;
    const candidateBudgetMax = user.budgetMax || 0;
    let budgetMatchScore = 0;
    if (userBudgetMin > 0 && userBudgetMax > 0 && candidateBudgetMin > 0 && candidateBudgetMax > 0) {
      // Check if budget ranges overlap
      const rangesOverlap = !(userBudgetMax < candidateBudgetMin || candidateBudgetMax < userBudgetMin);
      if (rangesOverlap) {
        // Calculate overlap percentage
        const overlapMin = Math.max(userBudgetMin, candidateBudgetMin);
        const overlapMax = Math.min(userBudgetMax, candidateBudgetMax);
        const overlapRange = overlapMax - overlapMin;
        const userRange = userBudgetMax - userBudgetMin;
        const overlapPercentage = userRange > 0 ? overlapRange / userRange : 0;
        budgetMatchScore = Math.round(overlapPercentage * 15);
      }
    }
    
    // Listing intent matching (buyer-seller, renter-landlord compatibility)
    const candidateIntent = normalized(user.listingIntent || "");
    let intentCompatibilityScore = 0;
    if (userListingIntent && candidateIntent) {
      const complementaryIntents = {
        'buy': 'sell',
        'sell': 'buy',
        'rent': 'rentout',
        'rentout': 'rent',
        'lease': 'leaseout',
        'leaseout': 'lease'
      };
      if (complementaryIntents[userListingIntent] === candidateIntent) {
        intentCompatibilityScore = 15; // High score for complementary intents
      } else if (userListingIntent === candidateIntent) {
        intentCompatibilityScore = 5; // Lower score for same intent (less relevant for connections)
      }
    }
    
    // Distance-based scoring: closer users get higher scores
    const distanceScore = nearby && distance !== Infinity 
      ? Math.max(0, 50 - (distance / radiusKm) * 50) 
      : 0;
    
    const score = (sameCity ? 40 : 0) + (mutualConnections >= 15 ? 35 : mutualConnections >= 5 ? 20 : mutualConnections ? 10 : 0) + (activeToday ? 20 : activeThisWeek ? 10 : 0) + (completion >= 100 ? 15 : completion >= 80 ? 10 : completion >= 60 ? 5 : 0) + (verified ? 15 : 0) + (rating >= 4.8 ? 15 : rating >= 4.5 ? 10 : 0) + Math.min(10, Number(stats.listingsCount || 0)) + (interestMatch ? 12 : 0) + (recentlyJoined ? 10 : 0) + (Number(user.responseRate || 0) >= 80 ? 10 : 0) + commentScore + distanceScore + searchKeywordMatch + searchLocationMatch + likedPropertyMatch + savedPropertyMatch + likedLocationMatch + savedLocationMatch + budgetMatchScore + intentCompatibilityScore;
    
    return { ...user, city, listingsCount: Number(stats.listingsCount || 0), engagementScore: Number(stats.engagement || 0), profileCompletion: completion, rating, verified, mutualConnections, sameCity, activeToday, recentlyJoined, trending, distance, recommendationScore: score, recommendationReason: reasonFor({ sameCity, mutualCount: mutualConnections, verified, rating, activeToday, interestMatch, trending, recentlyJoined, commentMatch: commentScore > 0, distance: nearby && distance !== Infinity ? distance : null, searchMatch: searchKeywordMatch > 0 || searchLocationMatch > 0, likedMatch: likedPropertyMatch > 0 || likedLocationMatch > 0, savedMatch: savedPropertyMatch > 0 || savedLocationMatch > 0, budgetMatch: budgetMatchScore, intentMatch: intentCompatibilityScore > 10 }) };
  }).filter((candidate) => candidate !== null && candidate.profileCompletion >= 30 && now - new Date(candidate.updatedAt || candidate.createdAt).getTime() < 365 * 24 * 60 * 60 * 1000)
    .filter((candidate) => matchesFilter(candidate, query.filter, query.city, query.profession, query.verified, query.nearby))
    .sort((a, b) => b.recommendationScore - a.recommendationScore || b.engagementScore - a.engagementScore);

  const total = ranked.length;
  const users = ranked.slice((page - 1) * limit, page * limit).map((candidate) => ({ ...candidate, discoverySection: sectionFor(candidate), friends: undefined }));
  const result = { users, pagination: { page, limit, total, hasMore: page * limit < total } };
  if (cacheable) { try { await redisClient.set(cacheKey, JSON.stringify(result), { EX: CACHE_TTL_SECONDS }); logger.info(`💾 CACHE WRITE: Discover recommendations for user ID: ${currentUserId} (TTL: ${CACHE_TTL_SECONDS}s)`); } catch {} }
  return result;
}
