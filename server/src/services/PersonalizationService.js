import PropertyPost from "../models/PropertyPost.model.js";
import User from "../models/User.model.js";
import { redisClient } from "../config/redis.js";
import { logger } from "../utils/logger.js";

const PERSONALIZATION_CACHE_TTL_BASE = 10 * 60; // 10 minutes base
const PERSONALIZATION_CACHE_KEY = (userId, type) => `personalization:${type}:${userId}`;

/**
 * Calculate dynamic TTL based on user activity level
 * More active users get shorter cache for fresher recommendations
 */
const calculateDynamicTTL = (totalEngagements) => {
  if (totalEngagements > 50) return 5 * 60; // 5 minutes for highly active users
  if (totalEngagements > 20) return 10 * 60; // 10 minutes for moderately active users
  if (totalEngagements > 5) return 15 * 60; // 15 minutes for occasional users
  return 30 * 60; // 30 minutes for new/inactive users
};

/**
 * Personalization Service
 * Handles all personalization logic for property recommendations, feed ranking, and user suggestions
 */

class PersonalizationService {
  /**
   * Calculate a personalization score for a property based on user preferences and behavior
   * @param {Object} property - The property to score
   * @param {Object} user - The user to personalize for
   * @param {Object} userBehavior - User's historical behavior data
   * @returns {Number} - Score between 0 and 100
   */
  static calculatePropertyScore(property, user, userBehavior = {}) {
    let score = 0;
    const weights = {
      location: 25,
      budget: 20,
      propertyType: 20,
      engagement: 20,
      following: 10,
      contentFeatures: 5, // New: content-based filtering
    };

    // Location-based scoring
    score += this.getLocationScore(property, user) * (weights.location / 100);

    // Budget-based scoring
    score += this.getBudgetScore(property, userBehavior) * (weights.budget / 100);

    // Property type scoring
    score += this.getPropertyTypeScore(property, userBehavior) * (weights.propertyType / 100);

    // Engagement history scoring
    score += this.getEngagementScore(property, userBehavior) * (weights.engagement / 100);

    // Following boost
    score += this.getFollowingScore(property, user) * (weights.following / 100);

    // Content-based feature matching
    score += this.getContentFeatureScore(property, userBehavior) * (weights.contentFeatures / 100);

    return Math.min(100, Math.max(0, score));
  }

  /**
   * Calculate location-based score
   * Higher score for properties in user's city or nearby areas
   */
  static getLocationScore(property, user) {
    if (!user.city || !property.city) return 0;

    const userCity = user.city.toLowerCase();
    const propertyCity = property.city.toLowerCase();

    // Exact city match
    if (userCity === propertyCity) return 100;

    // Same state/region (simplified - in production, use proper geolocation)
    const userCityParts = userCity.split(' ');
    const propertyCityParts = propertyCity.split(' ');
    
    // Check if they share any part (e.g., "North Mumbai" and "South Mumbai")
    const hasCommonPart = userCityParts.some(part => 
      propertyCityParts.some(propPart => propPart.includes(part) || part.includes(propPart))
    );

    return hasCommonPart ? 60 : 20;
  }

  /**
   * Calculate budget-based score
   * Higher score for properties within user's typical price range
   */
  static getBudgetScore(property, userBehavior) {
    if (!userBehavior.typicalPriceRange) return 50; // Neutral score

    const { min, max } = userBehavior.typicalPriceRange;
    const propertyPrice = property.price || 0;

    if (propertyPrice >= min && propertyPrice <= max) {
      return 100; // Perfect match
    }

    // Calculate how far outside the range
    const range = max - min;
    const deviation = propertyPrice < min ? min - propertyPrice : propertyPrice - max;
    const deviationRatio = deviation / range;

    if (deviationRatio <= 0.2) return 80; // Close to range
    if (deviationRatio <= 0.5) return 50; // Moderately outside
    return 20; // Far outside range
  }

  /**
   * Calculate property type score based on user's preferences
   */
  static getPropertyTypeScore(property, userBehavior) {
    if (!userBehavior.preferredPropertyTypes || userBehavior.preferredPropertyTypes.length === 0) {
      return 50; // Neutral score
    }

    const propertyType = property.propertyType;
    const preferences = userBehavior.preferredPropertyTypes;

    // Check if this property type is in user's preferences
    const typePreference = preferences.find(pref => pref.type === propertyType);
    if (typePreference) {
      return Math.min(100, typePreference.score + 50);
    }

    return 30; // Low score for non-preferred types
  }

  /**
   * Calculate engagement score based on similar properties user has engaged with
   */
  static getEngagementScore(property, userBehavior) {
    if (!userBehavior.engagedProperties || userBehavior.engagedProperties.length === 0) {
      return 50; // Neutral score
    }

    // Find similar properties based on price, type, and location
    const similarProperties = userBehavior.engagedProperties.filter(engaged => {
      const priceSimilarity = Math.abs((engaged.price - property.price) / (engaged.price || 1)) < 0.3;
      const typeMatch = engaged.propertyType === property.propertyType;
      const locationMatch = engaged.city === property.city;

      return priceSimilarity || typeMatch || locationMatch;
    });

    // Score based on number of similar engaged properties
    const similarityScore = Math.min(100, similarProperties.length * 20);
    return similarityScore;
  }

  /**
   * Calculate following boost score
   * Higher score for posts from friends/following
   */
  static getFollowingScore(property, user) {
    if (!user.friends || !property.author) return 0;

    const authorId = typeof property.author === 'object' ? property.author._id : property.author;
    const isFriend = user.friends.some(friendId => String(friendId) === String(authorId));

    return isFriend ? 100 : 0;
  }

  /**
   * Calculate content-based feature score
   * Matches property features (amenities, specifications) with user preferences
   */
  static getContentFeatureScore(property, userBehavior) {
    if (!userBehavior.engagedProperties || userBehavior.engagedProperties.length === 0) {
      return 50; // Neutral score
    }

    let featureScore = 50;

    // Extract common features from engaged properties
    const engagedFeatures = new Set();
    userBehavior.engagedProperties.forEach(prop => {
      if (prop.amenities) {
        prop.amenities.forEach(amenity => engagedFeatures.add(amenity));
      }
      if (prop.specifications) {
        Object.keys(prop.specifications).forEach(spec => engagedFeatures.add(spec));
      }
    });

    // Check if current property has similar features
    const propertyFeatures = new Set();
    if (property.amenities) {
      property.amenities.forEach(amenity => propertyFeatures.add(amenity));
    }
    if (property.specifications) {
      Object.keys(property.specifications).forEach(spec => propertyFeatures.add(spec));
    }

    // Calculate feature overlap
    const overlap = [...engagedFeatures].filter(feature => propertyFeatures.has(feature));
    const overlapRatio = overlap.length / Math.max(1, engagedFeatures.size);

    featureScore = 50 + (overlapRatio * 50); // Up to 100 based on feature overlap

    return Math.min(100, featureScore);
  }

  /**
   * Get user's behavior data (likes, saves, views, comments, etc.)
   */
  static async getUserBehavior(userId) {
    try {
      logger.info(`🔍 [RECOMMENDATION] Starting user behavior analysis for user ID: ${userId}`);
      const cacheKey = PERSONALIZATION_CACHE_KEY(userId, 'behavior');
      
      // Try to get from cache first
      try {
        const cached = await redisClient.get(cacheKey);
        if (cached) {
          logger.info(`✅ CACHE HIT: User behavior data for user ID: ${userId}`);
          return JSON.parse(cached);
        }
        logger.info(`❌ CACHE MISS: User behavior data for user ID: ${userId} - fetching from database`);
      } catch (error) {
        logger.warn("Redis cache read failed for user behavior, falling back to database:", error);
      }

      const user = await User.findById(userId)
        .select('isVerified likedPosts savedPosts viewedPosts commentAnalytics')
        .populate('likedPosts')
        .populate('savedPosts')
        .populate('viewedPosts.post')
        .lean();

      if (!user) {
        logger.warn(`⚠️ User not found for ID: ${userId}`);
        return {};
      }

      logger.info(`📊 [RECOMMENDATION] User found - Verified: ${user.isVerified}, LikedPosts: ${(user.likedPosts || []).length}, SavedPosts: ${(user.savedPosts || []).length}, ViewedPosts: ${(user.viewedPosts || []).length}`);

      // Log comment analytics
      const commentAnalytics = user.commentAnalytics || {};
      logger.info(`💬 [RECOMMENDATION] Comment Analytics - TotalComments: ${commentAnalytics.totalComments || 0}, Keywords: [${(commentAnalytics.commonKeywords || []).slice(0, 5).join(', ')}], Intents: [${(commentAnalytics.detectedIntents || []).join(', ')}]`);

      // Time-based weight decay: recent engagement matters more
      const now = new Date();
      const DECAY_DAYS = 30; // Engagement older than 30 days has minimal weight
      const decayFactor = (engagementDate) => {
        const daysSince = (now - new Date(engagementDate)) / (1000 * 60 * 60 * 24);
        return Math.max(0.1, 1 - (daysSince / DECAY_DAYS)); // Minimum weight of 0.1
      };

      // Extract engaged properties with time-based weights
      const engagedProperties = [
        ...(user.likedPosts || []).map(post => ({
          ...post,
          engagementType: 'like',
          weight: 3.0 * decayFactor(post.updatedAt || now) // Likes have high weight
        })),
        ...(user.savedPosts || []).map(post => ({
          ...post,
          engagementType: 'save',
          weight: 2.5 * decayFactor(post.updatedAt || now) // Saves have medium-high weight
        })),
        ...(user.viewedPosts || []).map(view => ({
          ...(view.post || {}),
          engagementType: 'view',
          weight: Math.min(1.0, (view.duration || 0) / 30) * decayFactor(view.viewedAt) // Views weighted by duration
        }))
      ];

      logger.info(`🎯 [RECOMMENDATION] Total engaged properties: ${engagedProperties.length} (Likes: ${(user.likedPosts || []).length}, Saves: ${(user.savedPosts || []).length}, Views: ${(user.viewedPosts || []).length})`);

      // Calculate typical price range using weighted average
      const weightedPrices = engagedProperties.map(p => ({ price: p.price, weight: p.weight })).filter(p => p.price);
      const typicalPriceRange = weightedPrices.length > 0 ? {
        min: Math.min(...weightedPrices.map(p => p.price)) * 0.8,
        max: Math.max(...weightedPrices.map(p => p.price)) * 1.2
      } : null;

      if (typicalPriceRange) {
        logger.info(`💰 [RECOMMENDATION] Typical price range: ₹${typicalPriceRange.min.toLocaleString()} - ₹${typicalPriceRange.max.toLocaleString()}`);
      }

      // Calculate preferred property types with weights
      const propertyTypeCounts = {};
      engagedProperties.forEach(property => {
        const type = property.propertyType;
        const weight = property.weight || 1;
        propertyTypeCounts[type] = (propertyTypeCounts[type] || 0) + weight;
      });

      const preferredPropertyTypes = Object.entries(propertyTypeCounts)
        .map(([type, count]) => ({
          type,
          score: Math.min(100, count * 10) // Adjusted for weighted counts
        }))
        .sort((a, b) => b.score - a.score);

      logger.info(`🏠 [RECOMMENDATION] Preferred property types: ${preferredPropertyTypes.slice(0, 5).map(pt => `${pt.type}(${pt.score.toFixed(1)})`).join(', ')}`);

      // Extract comment analytics for enhanced personalization
      const commentKeywords = commentAnalytics.commonKeywords || [];
      const commentIntents = commentAnalytics.detectedIntents || [];
      const commentPropertyInterests = (commentAnalytics.propertyTypeInterests || []).map(pi => pi.type);
      const commentSentiment = commentAnalytics.sentimentDistribution || { positive: 0, neutral: 0, negative: 0 };
      const totalComments = commentAnalytics.totalComments || 0;

      // Calculate dominant intent from comments
      const dominantIntent = commentIntents.length > 0 ? commentIntents[0] : null;

      // Calculate sentiment ratio
      const totalSentiment = commentSentiment.positive + commentSentiment.neutral + commentSentiment.negative;
      const positiveRatio = totalSentiment > 0 ? commentSentiment.positive / totalSentiment : 0;

      logger.info(`🎭 [RECOMMENDATION] Comment-based personalization - DominantIntent: ${dominantIntent}, PositiveRatio: ${(positiveRatio * 100).toFixed(1)}%, ActivityLevel: ${totalComments >= 10 ? 'high' : totalComments >= 5 ? 'medium' : 'low'}`);

      const behaviorData = {
        engagedProperties,
        typicalPriceRange,
        preferredPropertyTypes,
        totalEngagements: engagedProperties.length,
        isVerified: user.isVerified || false,
        // New comment-based analytics
        commentKeywords,
        commentIntents,
        commentPropertyInterests,
        dominantIntent,
        positiveSentimentRatio: positiveRatio,
        commentActivityLevel: totalComments >= 10 ? 'high' : totalComments >= 5 ? 'medium' : 'low',
      };

      // Cache the result with dynamic TTL based on user activity
      const dynamicTTL = calculateDynamicTTL(behaviorData.totalEngagements + totalComments);
      try {
        await redisClient.set(cacheKey, JSON.stringify(behaviorData), { EX: dynamicTTL });
        logger.info(`💾 CACHE WRITE: User behavior data for user ID: ${userId} (TTL: ${dynamicTTL}s, Engagements: ${behaviorData.totalEngagements})`);
      } catch (error) {
        logger.warn("Redis cache write failed for user behavior:", error);
      }

      logger.info(`✅ [RECOMMENDATION] User behavior analysis complete for user ID: ${userId}`);
      return behaviorData;
    } catch (error) {
      logger.error('Error fetching user behavior:', error);
      return {};
    }
  }

  /**
   * Invalidate personalization cache for a user
   */
  static async invalidatePersonalizationCache(userId) {
    try {
      const pattern = `personalization:*:${userId}`;
      for await (const key of redisClient.scanIterator({ MATCH: pattern, COUNT: 100 })) {
        await redisClient.del(key);
      }
      logger.info(`Invalidated personalization cache for user ID: ${userId}`);
    } catch (error) {
      logger.warn("Failed to invalidate personalization cache:", error);
    }
  }

  /**
   * Track comment engagement for personalization
   * @param {String} userId - User ID
   * @param {String} commentId - Comment ID being engaged with
   * @param {String} engagementType - Type of engagement ('like', 'reply', 'view_replies')
   * @param {String} postId - Post ID the comment belongs to
   */
  static async trackCommentEngagement(userId, commentId, engagementType, postId) {
    try {
      logger.info(`📊 [COMMENT ENGAGEMENT] User ${userId} ${engagementType} comment ${commentId} on post ${postId}`);
      
      // Update user's comment engagement tracking
      const user = await User.findById(userId);
      if (!user) {
        logger.warn(`User not found for comment engagement tracking: ${userId}`);
        return;
      }

      // Initialize commentEngagement if not exists
      if (!user.commentEngagement) {
        user.commentEngagement = {
          totalEngagements: 0,
          likes: 0,
          replies: 0,
          viewReplies: 0,
          engagedComments: [],
          engagedPosts: [],
        };
      }

      // Update engagement counts
      user.commentEngagement.totalEngagements++;
      switch (engagementType) {
        case 'like':
          user.commentEngagement.likes++;
          break;
        case 'reply':
          user.commentEngagement.replies++;
          break;
        case 'view_replies':
          user.commentEngagement.viewReplies++;
          break;
      }

      // Track engaged comments (avoid duplicates)
      const commentIndex = user.commentEngagement.engagedComments.findIndex(
        c => String(c.commentId) === String(commentId)
      );
      if (commentIndex === -1) {
        user.commentEngagement.engagedComments.push({
          commentId,
          postId,
          engagementType,
          timestamp: new Date(),
        });
      } else {
        // Update existing engagement with latest type
        user.commentEngagement.engagedComments[commentIndex].engagementType = engagementType;
        user.commentEngagement.engagedComments[commentIndex].timestamp = new Date();
      }

      // Track engaged posts (avoid duplicates)
      const postIndex = user.commentEngagement.engagedPosts.findIndex(
        p => String(p.postId) === String(postId)
      );
      if (postIndex === -1) {
        user.commentEngagement.engagedPosts.push({
          postId,
          engagementCount: 1,
          lastEngagement: new Date(),
        });
      } else {
        user.commentEngagement.engagedPosts[postIndex].engagementCount++;
        user.commentEngagement.engagedPosts[postIndex].lastEngagement = new Date();
      }

      await user.save();

      // Invalidate personalization cache to reflect new engagement data
      await this.invalidatePersonalizationCache(userId);

      logger.info(`✅ [COMMENT ENGAGEMENT] Tracked successfully for user ${userId}`);
    } catch (error) {
      logger.error('Error tracking comment engagement:', error);
    }
  }

  /**
   * Get trending locations based on user location and activity
   */
  static async getTrendingLocations(userId, limit = 5) {
    try {
      logger.info(`🌍 [TRENDING LOCATIONS] Starting trending locations analysis for user ID: ${userId}`);
      const user = await User.findById(userId).select("city homeBase preferredLocalities budgetMin budgetMax propertyTypePreferences commentAnalytics").lean();
      if (!user) return [];

      const userCity = user.city || user.homeBase;
      const preferredLocations = user.preferredLocalities || [];
      const userBudget = { min: user.budgetMin || 0, max: user.budgetMax || Infinity };
      const userPropertyTypes = user.propertyTypePreferences || [];
      
      logger.info(`📍 [TRENDING LOCATIONS] User context - City: ${userCity}, PreferredLocalities: [${preferredLocations.join(', ')}], Budget: ₹${userBudget.min.toLocaleString()} - ₹${userBudget.max === Infinity ? '∞' : userBudget.max.toLocaleString()}, PropertyTypes: [${userPropertyTypes.join(', ')}]`);
      
      // Extract comment analytics for enhanced personalization
      const commentKeywords = new Set(user.commentAnalytics?.commonKeywords || []);
      const commentPropertyInterests = (user.commentAnalytics?.propertyTypeInterests || []).map(pi => pi.type);
      const dominantIntent = user.commentAnalytics?.detectedIntents?.[0] || null;

      logger.info(`💬 [TRENDING LOCATIONS] Comment analytics - Keywords: [${[...commentKeywords].slice(0, 5).join(', ')}], PropertyInterests: [${commentPropertyInterests.join(', ')}], DominantIntent: ${dominantIntent}`);

      // Get all published properties with more details for better scoring
      const properties = await PropertyPost.find({
        status: "PUBLISHED",
        visibility: "PUBLIC",
      })
        .select("city location price propertyType createdAt postMeta")
        .limit(1000)
        .lean();

      logger.info(`📊 [TRENDING LOCATIONS] Analyzing ${properties.length} published properties`);

      // Count properties by location and collect additional metrics
      const locationData = {};
      const now = new Date();
      const RECENT_DAYS = 7; // Consider properties from last 7 days as recent

      properties.forEach((property) => {
        const location = property.city || property.location || "Other";
        
        if (!locationData[location]) {
          locationData[location] = {
            count: 0,
            recentCount: 0,
            totalPrice: 0,
            priceCount: 0,
            propertyTypes: new Set(),
            amenities: new Set(),
            totalEngagement: 0,
          };
        }

        locationData[location].count++;
        
        // Count recent properties (last 7 days)
        const daysSincePost = (now - new Date(property.createdAt)) / (1000 * 60 * 60 * 24);
        if (daysSincePost <= RECENT_DAYS) {
          locationData[location].recentCount++;
        }

        // Track price data
        if (property.price) {
          locationData[location].totalPrice += property.price;
          locationData[location].priceCount++;
        }

        // Track property types
        if (property.propertyType) {
          locationData[location].propertyTypes.add(property.propertyType);
        }

        // Track amenities for keyword matching
        if (property.postMeta?.amenities) {
          property.postMeta.amenities.forEach(amenity => {
            locationData[location].amenities.add(amenity.toLowerCase());
          });
        }

        // Track engagement (likes, views, comments)
        locationData[location].totalEngagement += (property.engagementScore || 0) + (property.viewCount || 0) + (property.commentCount || 0);
      });

      logger.info(`🗺️ [TRENDING LOCATIONS] Found ${Object.keys(locationData).length} unique locations`);

      // Calculate trending score with multiple factors including comment analytics
      const trendingLocations = Object.entries(locationData).map(([location, data]) => {
        let score = 0;
        let scoreBreakdown = [];

        // Factor 1: Property count in location (base score)
        const countScore = data.count * 10;
        score += countScore;
        scoreBreakdown.push(`count:${countScore}`);

        // Factor 2: Recent activity boost (newer properties get higher score)
        const recentScore = data.recentCount * 25;
        score += recentScore;
        scoreBreakdown.push(`recent:${recentScore}`);

        // Factor 3: Engagement boost (popular locations)
        const engagementScore = Math.min(50, data.totalEngagement / 10);
        score += engagementScore;
        scoreBreakdown.push(`engagement:${engagementScore.toFixed(1)}`);

        // Factor 4: Proximity to user's city
        const proximityScore = userCity && location.toLowerCase().includes(userCity.toLowerCase()) ? 50 : 0;
        score += proximityScore;
        if (proximityScore > 0) scoreBreakdown.push(`proximity:${proximityScore}`);

        // Factor 5: User's preferred locations
        const prefScore = preferredLocations.some((pref) => location.toLowerCase().includes(pref.toLowerCase())) ? 30 : 0;
        score += prefScore;
        if (prefScore > 0) scoreBreakdown.push(`preferred:${prefScore}`);

        // Factor 6: Price range match
        let priceScore = 0;
        if (data.priceCount > 0) {
          const avgPrice = data.totalPrice / data.priceCount;
          if (avgPrice >= userBudget.min && avgPrice <= userBudget.max) {
            priceScore = 20; // Location has properties in user's budget
          } else if (avgPrice >= userBudget.min * 0.8 && avgPrice <= userBudget.max * 1.2) {
            priceScore = 10; // Close to budget range
          }
        }
        score += priceScore;
        if (priceScore > 0) scoreBreakdown.push(`price:${priceScore}`);

        // Factor 7: Property type availability
        let typeScore = 0;
        if (userPropertyTypes.length > 0) {
          const matchingTypes = [...data.propertyTypes].filter(type => 
            userPropertyTypes.some(pref => pref.toLowerCase() === type.toLowerCase())
          );
          if (matchingTypes.length > 0) {
            typeScore = matchingTypes.length * 15; // Boost for each matching property type
          }
        }
        score += typeScore;
        if (typeScore > 0) scoreBreakdown.push(`types:${typeScore}`);

        // Factor 8: Comment-based keyword matching with location amenities
        let keywordScore = 0;
        if (commentKeywords.size > 0) {
          const amenityMatches = [...data.amenities].filter(amenity => 
            commentKeywords.has(amenity) || [...commentKeywords].some(keyword => amenity.includes(keyword))
          );
          if (amenityMatches.length > 0) {
            keywordScore = amenityMatches.length * 8; // Boost for amenities matching comment keywords
          }
        }
        score += keywordScore;
        if (keywordScore > 0) scoreBreakdown.push(`keywords:${keywordScore}`);

        // Factor 9: Comment property interests matching
        let interestScore = 0;
        if (commentPropertyInterests.length > 0) {
          const matchingInterests = [...data.propertyTypes].filter(type =>
            commentPropertyInterests.some(interest => type.toLowerCase().includes(interest.toLowerCase()))
          );
          if (matchingInterests.length > 0) {
            interestScore = matchingInterests.length * 12; // Boost for property types mentioned in comments
          }
        }
        score += interestScore;
        if (interestScore > 0) scoreBreakdown.push(`interests:${interestScore}`);

        // Factor 10: Intent-based scoring
        let intentScore = 0;
        if (dominantIntent === 'buying' && data.priceCount > 0) {
          const avgPrice = data.totalPrice / data.priceCount;
          // Buyers prefer locations with properties in their budget
          if (avgPrice >= userBudget.min && avgPrice <= userBudget.max) {
            intentScore = 15;
          }
        } else if (dominantIntent === 'renting') {
          // Renters prefer locations with diverse property types
          if (data.propertyTypes.size >= 3) {
            intentScore = 10;
          }
        } else if (dominantIntent === 'investing') {
          // Investors prefer locations with high engagement (potential ROI)
          if (data.totalEngagement > 100) {
            intentScore = 15;
          }
        }
        score += intentScore;
        if (intentScore > 0) scoreBreakdown.push(`intent:${intentScore}`);

        return { 
          location, 
          count: data.count, 
          recentCount: data.recentCount,
          avgPrice: data.priceCount > 0 ? data.totalPrice / data.priceCount : null,
          propertyTypes: [...data.propertyTypes],
          score,
          scoreBreakdown,
          matchReasons: []
        };
      });

      // Sort by score and return top locations with match reasons
      const sortedLocations = trendingLocations
        .sort((a, b) => b.score - a.score)
        .slice(0, limit);

      logger.info(`🏆 [TRENDING LOCATIONS] Top ${limit} locations:`);
      sortedLocations.forEach((loc, idx) => {
        logger.info(`   ${idx + 1}. ${loc.location} - Score: ${loc.score.toFixed(1)} (${loc.scoreBreakdown.join(', ')}) - Properties: ${loc.count}, Recent: ${loc.recentCount}`);
      });

      // Add match reasons for UI display
      sortedLocations.forEach(location => {
        if (userCity && location.location.toLowerCase().includes(userCity.toLowerCase())) {
          location.matchReasons.push('Near your location');
        }
        if (location.recentCount > 2) {
          location.matchReasons.push('Trending area');
        }
        if (location.avgPrice && location.avgPrice >= userBudget.min && location.avgPrice <= userBudget.max) {
          location.matchReasons.push('Within budget');
        }
      });

      logger.info(`✅ [TRENDING LOCATIONS] Analysis complete for user ID: ${userId}`);
      return sortedLocations.map((item) => ({
        name: item.location,
        propertyCount: item.count,
        isNearUser: userCity && item.location.toLowerCase().includes(userCity.toLowerCase()),
        matchReasons: item.matchReasons.slice(0, 2), // Top 2 reasons
      }));
    } catch (error) {
      logger.error("Error fetching trending locations:", error);
      return [];
    }
  }

  /**
   * Get trending localities (granular neighborhoods/areas within cities)
   * This provides more specific location recommendations than city-level trending
   */
  static async getTrendingLocalities(userId, limit = 5) {
    try {
      logger.info(`🏘️ [TRENDING LOCALITIES] Starting trending localities analysis for user ID: ${userId}`);
      const user = await User.findById(userId).select("city homeBase preferredLocalities budgetMin budgetMax propertyTypePreferences commentAnalytics").lean();
      if (!user) return [];

      const userCity = user.city || user.homeBase;
      const preferredLocalities = user.preferredLocalities || [];
      const userBudget = { min: user.budgetMin || 0, max: user.budgetMax || Infinity };
      const userPropertyTypes = user.propertyTypePreferences || [];
      
      logger.info(`📍 [TRENDING LOCALITIES] User context - City: ${userCity}, PreferredLocalities: [${preferredLocalities.join(', ')}], Budget: ₹${userBudget.min.toLocaleString()} - ₹${userBudget.max === Infinity ? '∞' : userBudget.max.toLocaleString()}, PropertyTypes: [${userPropertyTypes.join(', ')}]`);
      
      // Extract comment analytics for enhanced personalization
      const commentKeywords = new Set(user.commentAnalytics?.commonKeywords || []);
      const commentPropertyInterests = (user.commentAnalytics?.propertyTypeInterests || []).map(pi => pi.type);
      const dominantIntent = user.commentAnalytics?.detectedIntents?.[0] || null;

      logger.info(`💬 [TRENDING LOCALITIES] Comment analytics - Keywords: [${[...commentKeywords].slice(0, 5).join(', ')}], PropertyInterests: [${commentPropertyInterests.join(', ')}], DominantIntent: ${dominantIntent}`);

      // Get all published properties with locality data
      const properties = await PropertyPost.find({
        status: "PUBLISHED",
        visibility: "PUBLIC",
      })
        .select("city locality location price propertyType createdAt postMeta")
        .limit(1000)
        .lean();

      logger.info(`📊 [TRENDING LOCALITIES] Analyzing ${properties.length} published properties for locality data`);

      // Extract granular localities (neighborhoods, areas)
      const localityData = {};
      const now = new Date();
      const RECENT_DAYS = 7;

      properties.forEach((property) => {
        // Use locality field if available, otherwise extract from location
        const locality = property.locality || this.extractLocality(property.location, property.city) || property.city;
        
        if (!localityData[locality]) {
          localityData[locality] = {
            count: 0,
            recentCount: 0,
            totalPrice: 0,
            priceCount: 0,
            propertyTypes: new Set(),
            amenities: new Set(),
            totalEngagement: 0,
            city: property.city,
          };
        }

        localityData[locality].count++;
        
        const daysSincePost = (now - new Date(property.createdAt)) / (1000 * 60 * 60 * 24);
        if (daysSincePost <= RECENT_DAYS) {
          localityData[locality].recentCount++;
        }

        if (property.price) {
          localityData[locality].totalPrice += property.price;
          localityData[locality].priceCount++;
        }

        if (property.propertyType) {
          localityData[locality].propertyTypes.add(property.propertyType);
        }

        if (property.postMeta?.amenities) {
          property.postMeta.amenities.forEach(amenity => {
            localityData[locality].amenities.add(amenity.toLowerCase());
          });
        }

        localityData[locality].totalEngagement += (property.engagementScore || 0) + (property.viewCount || 0) + (property.commentCount || 0);
      });

      logger.info(`🗺️ [TRENDING LOCALITIES] Found ${Object.keys(localityData).length} unique localities`);

      // Calculate trending score for localities
      const trendingLocalities = Object.entries(localityData).map(([locality, data]) => {
        let score = 0;
        let scoreBreakdown = [];

        // Base score from property count
        const countScore = data.count * 15;
        score += countScore;
        scoreBreakdown.push(`count:${countScore}`);

        // Recent activity boost
        const recentScore = data.recentCount * 30;
        score += recentScore;
        scoreBreakdown.push(`recent:${recentScore}`);

        // Engagement boost
        const engagementScore = Math.min(60, data.totalEngagement / 8);
        score += engagementScore;
        scoreBreakdown.push(`engagement:${engagementScore.toFixed(1)}`);

        // User's preferred localities (exact match gets highest boost)
        let prefScore = 0;
        if (preferredLocalities.some((pref) => locality.toLowerCase() === pref.toLowerCase())) {
          prefScore = 50;
        } else if (preferredLocalities.some((pref) => locality.toLowerCase().includes(pref.toLowerCase()))) {
          prefScore = 25;
        }
        score += prefScore;
        if (prefScore > 0) scoreBreakdown.push(`preferred:${prefScore}`);

        // Same city as user
        const cityScore = userCity && data.city && data.city.toLowerCase() === userCity.toLowerCase() ? 40 : 0;
        score += cityScore;
        if (cityScore > 0) scoreBreakdown.push(`city:${cityScore}`);

        // Price range match
        let priceScore = 0;
        if (data.priceCount > 0) {
          const avgPrice = data.totalPrice / data.priceCount;
          if (avgPrice >= userBudget.min && avgPrice <= userBudget.max) {
            priceScore = 25;
          } else if (avgPrice >= userBudget.min * 0.8 && avgPrice <= userBudget.max * 1.2) {
            priceScore = 12;
          }
        }
        score += priceScore;
        if (priceScore > 0) scoreBreakdown.push(`price:${priceScore}`);

        // Property type matching
        let typeScore = 0;
        if (userPropertyTypes.length > 0) {
          const matchingTypes = [...data.propertyTypes].filter(type => 
            userPropertyTypes.some(pref => pref.toLowerCase() === type.toLowerCase())
          );
          if (matchingTypes.length > 0) {
            typeScore = matchingTypes.length * 18;
          }
        }
        score += typeScore;
        if (typeScore > 0) scoreBreakdown.push(`types:${typeScore}`);

        // Comment keyword matching with amenities
        let keywordScore = 0;
        if (commentKeywords.size > 0) {
          const amenityMatches = [...data.amenities].filter(amenity => 
            commentKeywords.has(amenity) || [...commentKeywords].some(keyword => amenity.includes(keyword))
          );
          if (amenityMatches.length > 0) {
            keywordScore = amenityMatches.length * 10;
          }
        }
        score += keywordScore;
        if (keywordScore > 0) scoreBreakdown.push(`keywords:${keywordScore}`);

        // Comment property interests
        let interestScore = 0;
        if (commentPropertyInterests.length > 0) {
          const matchingInterests = [...data.propertyTypes].filter(type =>
            commentPropertyInterests.some(interest => type.toLowerCase().includes(interest.toLowerCase()))
          );
          if (matchingInterests.length > 0) {
            interestScore = matchingInterests.length * 15;
          }
        }
        score += interestScore;
        if (interestScore > 0) scoreBreakdown.push(`interests:${interestScore}`);

        // Intent-based scoring for localities
        let intentScore = 0;
        if (dominantIntent === 'buying' && data.priceCount > 0) {
          const avgPrice = data.totalPrice / data.priceCount;
          if (avgPrice >= userBudget.min && avgPrice <= userBudget.max) {
            intentScore = 20;
          }
        } else if (dominantIntent === 'renting') {
          if (data.propertyTypes.size >= 2) {
            intentScore = 15;
          }
        } else if (dominantIntent === 'investing') {
          if (data.totalEngagement > 50) {
            intentScore = 20;
          }
        }
        score += intentScore;
        if (intentScore > 0) scoreBreakdown.push(`intent:${intentScore}`);

        return {
          locality,
          city: data.city,
          count: data.count,
          recentCount: data.recentCount,
          avgPrice: data.priceCount > 0 ? data.totalPrice / data.priceCount : null,
          propertyTypes: [...data.propertyTypes],
          score,
          scoreBreakdown,
          matchReasons: []
        };
      });

      // Sort and filter
      const sortedLocalities = trendingLocalities
        .sort((a, b) => b.score - a.score)
        .slice(0, limit);

      logger.info(`🏆 [TRENDING LOCALITIES] Top ${limit} localities:`);
      sortedLocalities.forEach((loc, idx) => {
        logger.info(`   ${idx + 1}. ${loc.locality}, ${loc.city} - Score: ${loc.score.toFixed(1)} (${loc.scoreBreakdown.join(', ')}) - Properties: ${loc.count}, Recent: ${loc.recentCount}`);
      });

      // Add match reasons
      sortedLocalities.forEach(locality => {
        if (preferredLocalities.some((pref) => locality.locality.toLowerCase() === pref.toLowerCase())) {
          locality.matchReasons.push('Your preferred area');
        }
        if (userCity && locality.city && locality.city.toLowerCase() === userCity.toLowerCase()) {
          locality.matchReasons.push('In your city');
        }
        if (locality.recentCount > 1) {
          locality.matchReasons.push('Hot area');
        }
        if (locality.avgPrice && locality.avgPrice >= userBudget.min && locality.avgPrice <= userBudget.max) {
          locality.matchReasons.push('Within budget');
        }
      });

      logger.info(`✅ [TRENDING LOCALITIES] Analysis complete for user ID: ${userId}`);
      return sortedLocalities.map((item) => ({
        name: item.locality,
        city: item.city,
        propertyCount: item.count,
        isNearUser: userCity && item.city && item.city.toLowerCase() === userCity.toLowerCase(),
        matchReasons: item.matchReasons.slice(0, 2),
      }));
    } catch (error) {
      logger.error("Error fetching trending localities:", error);
      return [];
    }
  }

  /**
   * Extract locality from location string
   * Helper function to parse granular location data
   */
  static extractLocality(location, city) {
    if (!location) return null;
    
    // Remove city name from location to get locality
    const locationLower = location.toLowerCase();
    const cityLower = city ? city.toLowerCase() : '';
    
    if (cityLower && locationLower.includes(cityLower)) {
      const locality = locationLower.replace(cityLower, '').trim();
      return locality || location;
    }
    
    // If no city match, return the location as is
    return location;
  }

  /**
   * Get personalized property recommendations for a user
   */
  static async getPersonalizedRecommendations(userId, limit = 20) {
    try {
      logger.info(`🎯 [PERSONALIZED RECOMMENDATIONS] Starting personalized recommendations for user ID: ${userId}, limit: ${limit}`);
      const user = await User.findById(userId).lean();
      if (!user) return [];

      logger.info(`👤 [PERSONALIZED RECOMMENDATIONS] User found - City: ${user.city}, Verified: ${user.isVerified}`);
      const userBehavior = await this.getUserBehavior(userId);

      // Get all published properties (excluding user's own posts)
      const properties = await PropertyPost.find({
        author: { $ne: userId },
        status: "PUBLISHED",
        visibility: "PUBLIC"
      })
        .populate("author", "fullName profilePic activeRole primaryRole city isVerified")
        .lean();

      logger.info(`📊 [PERSONALIZED RECOMMENDATIONS] Found ${properties.length} properties to analyze`);

      // Score each property with enhanced comment-based scoring
      const scoredProperties = properties.map(property => {
        const personalizationScore = this.calculatePropertyScore(property, user, userBehavior);
        const commentScore = this.calculateCommentBasedScore(property, userBehavior);
        const finalScore = (personalizationScore * 0.7) + (commentScore * 0.3);
        
        return {
          ...property,
          personalizationScore,
          commentScore,
          finalScore
        };
      });

      // Sort by final score
      scoredProperties.sort((a, b) => b.finalScore - a.finalScore);

      logger.info(`📈 [PERSONALIZED RECOMMENDATIONS] Top 5 properties before diversity filtering:`);
      scoredProperties.slice(0, 5).forEach((prop, idx) => {
        logger.info(`   ${idx + 1}. ${prop.title || prop.propertyType} - FinalScore: ${prop.finalScore.toFixed(1)} (Property: ${prop.personalizationScore.toFixed(1)}, Comment: ${prop.commentScore.toFixed(1)})`);
      });

      // Add diversity: ensure we don't show too many similar properties
      const diverseRecommendations = [];
      const seenPropertyTypes = new Set();
      const seenLocations = new Set();
      const seenAuthors = new Set();

      for (const property of scoredProperties) {
        if (diverseRecommendations.length >= limit) break;

        const propertyType = property.propertyType;
        const location = property.city || property.location;
        const authorId = String(property.author?._id);

        // Skip if we've already shown too many of this type/location/author
        const typeCount = Array.from(seenPropertyTypes).filter(t => t === propertyType).length;
        const locationCount = Array.from(seenLocations).filter(l => l === location).length;
        const authorCount = Array.from(seenAuthors).filter(a => a === authorId).length;

        if (typeCount < 3 && locationCount < 3 && authorCount < 2) {
          diverseRecommendations.push(property);
          seenPropertyTypes.add(propertyType);
          seenLocations.add(location);
          seenAuthors.add(authorId);
        }
      }

      logger.info(`✅ [PERSONALIZED RECOMMENDATIONS] Returning ${diverseRecommendations.length} diverse recommendations for user ID: ${userId}`);
      logger.info(`🎭 [PERSONALIZED RECOMMENDATIONS] Diversity breakdown - PropertyTypes: ${seenPropertyTypes.size}, Locations: ${seenLocations.size}, Authors: ${seenAuthors.size}`);
      
      return diverseRecommendations;
    } catch (error) {
      logger.error('Error getting personalized recommendations:', error);
      return [];
    }
  }

  /**
   * Calculate comment-based score for a property
   * Uses user's comment analytics to score properties
   */
  static calculateCommentBasedScore(property, userBehavior) {
    let score = 0;
    let scoreBreakdown = [];
    
    if (!userBehavior.commentKeywords && !userBehavior.commentPropertyInterests) {
      logger.info(`💬 [COMMENT SCORING] No comment data available for user, returning neutral score (50)`);
      return 50; // Neutral score if no comment data
    }

    const commentKeywords = new Set(userBehavior.commentKeywords || []);
    const commentPropertyInterests = userBehavior.commentPropertyInterests || [];
    const dominantIntent = userBehavior.dominantIntent;
    const positiveSentimentRatio = userBehavior.positiveSentimentRatio || 0;

    logger.info(`💬 [COMMENT SCORING] Property: ${property.title || property.propertyType} - Keywords: [${[...commentKeywords].slice(0, 5).join(', ')}], Interests: [${commentPropertyInterests.join(', ')}], Intent: ${dominantIntent}`);

    // Score 1: Property type matching comment interests
    let typeScore = 0;
    if (commentPropertyInterests.length > 0) {
      const propertyTypeMatch = commentPropertyInterests.some(interest => 
        property.propertyType && property.propertyType.toLowerCase().includes(interest.toLowerCase())
      );
      if (propertyTypeMatch) {
        typeScore = 25;
        score += typeScore;
        scoreBreakdown.push(`typeMatch:${typeScore}`);
        logger.info(`   ✅ Property type match: ${property.propertyType} matches comment interests`);
      }
    }

    // Score 2: Amenities matching comment keywords
    let amenityScore = 0;
    if (property.postMeta?.amenities && commentKeywords.size > 0) {
      const amenityMatches = property.postMeta.amenities.filter(amenity => {
        const amenityLower = amenity.toLowerCase();
        return commentKeywords.has(amenityLower) || 
               [...commentKeywords].some(keyword => amenityLower.includes(keyword) || keyword.includes(amenityLower));
      });
      
      if (amenityMatches.length > 0) {
        amenityScore = Math.min(20, amenityMatches.length * 8);
        score += amenityScore;
        scoreBreakdown.push(`amenities:${amenityScore} (${amenityMatches.length} matches)`);
        logger.info(`   ✅ Amenity matches: [${amenityMatches.join(', ')}]`);
      }
    }

    // Score 3: Intent-based property matching
    let intentScore = 0;
    if (dominantIntent === 'buying') {
      // Buyers prefer properties with clear pricing and good amenities
      if (property.price && property.postMeta?.amenities?.length >= 3) {
        intentScore = 15;
        score += intentScore;
        scoreBreakdown.push(`buyerIntent:${intentScore}`);
        logger.info(`   ✅ Buyer intent match: has price and ${property.postMeta.amenities.length} amenities`);
      }
    } else if (dominantIntent === 'renting') {
      // Renters prefer properties with good amenities and reasonable prices
      if (property.postMeta?.amenities?.length >= 2) {
        intentScore = 12;
        score += intentScore;
        scoreBreakdown.push(`renterIntent:${intentScore}`);
        logger.info(`   ✅ Renter intent match: has ${property.postMeta.amenities.length} amenities`);
      }
    } else if (dominantIntent === 'investing') {
      // Investors prefer properties with high engagement and good location
      if (property.engagementScore > 50) {
        intentScore = 15;
        score += intentScore;
        scoreBreakdown.push(`investorIntent:${intentScore}`);
        logger.info(`   ✅ Investor intent match: high engagement (${property.engagementScore})`);
      }
    }

    // Score 4: Sentiment-based boost
    // Users with positive sentiment get higher scores on popular properties
    let sentimentScore = 0;
    if (positiveSentimentRatio > 0.6 && property.engagementScore > 30) {
      sentimentScore = 10;
      score += sentimentScore;
      scoreBreakdown.push(`positiveSentiment:${sentimentScore}`);
      logger.info(`   ✅ Positive sentiment boost: ratio ${(positiveSentimentRatio * 100).toFixed(1)}%`);
    }

    // Score 5: Comment activity level boost
    // Highly active commenters get more diverse recommendations
    let activityScore = 0;
    if (userBehavior.commentActivityLevel === 'high') {
      activityScore = 5; // Small boost to encourage exploration
      score += activityScore;
      scoreBreakdown.push(`activity:${activityScore}`);
      logger.info(`   ✅ High comment activity level boost`);
    }

    const finalScore = Math.min(100, Math.max(0, score));
    logger.info(`💬 [COMMENT SCORING] Final score: ${finalScore.toFixed(1)} (${scoreBreakdown.join(', ')})`);

    return finalScore;
  }

  /**
   * Get suggested connections for a user based on location and interests
   */
  static async getSuggestedConnections(userId, limit = 10) {
    try {
      const user = await User.findById(userId).lean();
      if (!user) return [];

      const userBehavior = await this.getUserBehavior(userId);

      // Get users who are not already friends and not the current user
      const potentialConnections = await User.find({
        _id: { $ne: userId, $nin: user.friends || [] },
        city: user.city // Same city
      })
        .select('fullName profilePic activeRole primaryRole city')
        .limit(limit * 3)
        .lean();

      // Score each potential connection
      const scoredConnections = potentialConnections.map(potential => {
        let score = 0;

        // Location match (already filtered by city)
        score += 40;

        // Similar property interests (if we had more data)
        if (userBehavior.preferredPropertyTypes && userBehavior.preferredPropertyTypes.length > 0) {
          score += 30;
        }

        // Role compatibility
        const compatibleRoles = {
          'Tenant': ['Landlord', 'Broker'],
          'Buyer': ['Seller', 'Broker'],
          'Landlord': ['Tenant', 'Broker'],
          'Seller': ['Buyer', 'Broker'],
          'Broker': ['Tenant', 'Buyer', 'Landlord', 'Seller']
        };

        const userRole = user.activeRole || user.primaryRole;
        const potentialRole = potential.activeRole || potential.primaryRole;

        if (compatibleRoles[userRole]?.includes(potentialRole)) {
          score += 30;
        }

        return {
          ...potential,
          connectionScore: score
        };
      });

      // Sort by connection score and return top results
      return scoredConnections
        .sort((a, b) => b.connectionScore - a.connectionScore)
        .slice(0, limit);
    } catch (error) {
      logger.error('Error getting suggested connections:', error);
      return [];
    }
  }

  /**
   * Get similar properties based on a reference property
   */
  static async getSimilarProperties(propertyId, userId, limit = 6) {
    try {
      const referenceProperty = await PropertyPost.findById(propertyId).lean();
      if (!referenceProperty) return [];

      const userBehavior = await this.getUserBehavior(userId);

      // Find similar properties based on:
      // - Same property type
      // - Similar price range (±30%)
      // - Same city
      // - Same listing type
      const priceRange = {
        min: referenceProperty.price * 0.7,
        max: referenceProperty.price * 1.3
      };

      const similarProperties = await PropertyPost.find({
        _id: { $ne: propertyId },
        author: { $ne: userId },
        status: "PUBLISHED",
        visibility: "PUBLIC",
        $or: [
          { propertyType: referenceProperty.propertyType },
          { city: referenceProperty.city },
          { listingType: referenceProperty.listingType }
        ],
        price: { $gte: priceRange.min, $lte: priceRange.max }
      })
        .populate("author", "fullName profilePic activeRole primaryRole city isVerified")
        .limit(limit * 2)
        .lean();

      // Score and sort by similarity
      const scoredProperties = similarProperties.map(property => {
        let score = 0;

        // Property type match
        if (property.propertyType === referenceProperty.propertyType) score += 30;

        // City match
        if (property.city === referenceProperty.city) score += 25;

        // Listing type match
        if (property.listingType === referenceProperty.listingType) score += 20;

        // Price similarity
        const priceDiff = Math.abs(property.price - referenceProperty.price) / referenceProperty.price;
        score += Math.max(0, 25 - (priceDiff * 50));

        // User preference boost
        score += this.getPropertyTypeScore(property, userBehavior) * 0.1;

        return {
          ...property,
          similarityScore: score
        };
      });

      return scoredProperties
        .sort((a, b) => b.similarityScore - a.similarityScore)
        .slice(0, limit);
    } catch (error) {
      logger.error('Error getting similar properties:', error);
      return [];
    }
  }
}

export default PersonalizationService;
