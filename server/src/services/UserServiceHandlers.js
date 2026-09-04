import FriendRequest from "../models/FriendRequest.model.js";
import PropertyPost from "../models/PropertyPost.model.js";
import User from "../models/User.model.js";
import Comment from "../models/Comment.model.js";
import { getDiscoverRecommendations, invalidateDiscoverCache } from "./DiscoverRecommendationService.js";
import { redisClient } from "../config/redis.js";
import { logger } from "../utils/logger.js";
import { sanitizeUserData } from "../utils/sanitizeUser.js";
import {
  sendErrorResponse,
  sendSuccessResponse,
} from "../utils/responseHandler.js";

const ACTIVITY_CACHE_TTL = 5 * 60; // 5 minutes
const ACTIVITY_CACHE_KEY = (userId) => `activity:${userId}`;

export async function updateMyProfile(req, res) {
  try {
    const currentUserId = req.user._id;
    const body = req.body || {};

    const fullName = body.fullName !== undefined ? String(body.fullName || "").trim() : undefined;
    const bio = body.bio !== undefined ? String(body.bio || "").trim() : undefined;
    const city = body.city !== undefined ? String(body.city || "").trim() : undefined;
    const primaryRole = body.primaryRole !== undefined ? String(body.primaryRole || "").trim() : undefined;
    const activeRole = body.activeRole !== undefined ? String(body.activeRole || "").trim() : undefined;
    const homeBase = body.homeBase !== undefined ? String(body.homeBase || "").trim() : undefined;
    const travelStyle = body.travelStyle !== undefined ? String(body.travelStyle || "").trim() : undefined;
    const profilePicUrl = body.profilePic !== undefined ? String(body.profilePic || "").trim() : undefined;
    const mobileNumber = body.mobileNumber !== undefined ? String(body.mobileNumber || "").trim() : undefined;

    const updatePayload = {};
    if (fullName !== undefined) updatePayload.fullName = fullName;
    if (bio !== undefined) updatePayload.bio = bio;
    if (mobileNumber !== undefined) updatePayload.mobileNumber = mobileNumber;
    if (city !== undefined) {
      updatePayload.city = city;
      updatePayload.homeBase = city;
      updatePayload.location = city;
    }
    if (homeBase !== undefined) {
      updatePayload.city = homeBase;
      updatePayload.homeBase = homeBase;
      updatePayload.location = homeBase;
    }
    if (primaryRole !== undefined) {
      updatePayload.primaryRole = primaryRole;
      updatePayload.travelStyle = primaryRole;
      updatePayload.activeRole = primaryRole;
      if (primaryRole) updatePayload.userRoles = [primaryRole];
    }
    if (activeRole !== undefined) {
      updatePayload.activeRole = activeRole;
      if (activeRole) updatePayload.userRoles = [activeRole];
    }
    if (travelStyle !== undefined) {
      updatePayload.primaryRole = travelStyle;
      updatePayload.travelStyle = travelStyle;
      updatePayload.activeRole = travelStyle;
      if (travelStyle) updatePayload.userRoles = [travelStyle];
    }

    if (req.file) {
      updatePayload.profilePic = req.file.path;
    } else if (profilePicUrl !== undefined) {
      updatePayload.profilePic = profilePicUrl;
    }

    if (Object.keys(updatePayload).length === 0) {
      return sendErrorResponse(res, 400, "No profile fields provided");
    }

    const updatedUser = await User.findByIdAndUpdate(currentUserId, updatePayload, { new: true });
    if (!updatedUser) {
      return sendErrorResponse(res, 404, "User not found");
    }

    await invalidateDiscoverCache(currentUserId);
    await invalidateActivityCache(currentUserId);

    return sendSuccessResponse(res, 200, "Profile updated successfully", {
      user: sanitizeUserData(updatedUser),
    });
  } catch (error) {
    logger.error("Error updating profile:", error);
    return sendErrorResponse(res, 500, "Internal Server Error");
  }
}

export async function getRecommendedUsers(req, res) {
  try {
    const currentUserId = req.user._id;
    const query = typeof req.query.q === "string" ? req.query.q.trim() : "";
    const random = req.query.random === "true";
    const onboardedOnly = req.query.onboardedOnly === "true";
    const rawLimit = Number.parseInt(req.query.limit, 10);
    const limit = Number.isFinite(rawLimit)
      ? Math.min(Math.max(rawLimit, 1), 50)
      : 20;

    logger.info(
      `Fetching discoverable users for user ID: ${currentUserId} with query="${query}", random=${random}, limit=${limit}, onboardedOnly=${onboardedOnly}`
    );

    const currentUser = await User.findById(currentUserId).select("friends").lean();
    if (!currentUser) {
      logger.warn(`User not found for ID: ${currentUserId}`);
      return sendErrorResponse(res, 404, "User not found");
    }

    const excludedUserIds = new Set([
      currentUserId.toString(),
      ...(currentUser.friends || []).map((friendId) => friendId.toString()),
    ]);

    const pendingRequests = await FriendRequest.find({
      status: "pending",
      $or: [{ sender: currentUserId }, { receiver: currentUserId }],
    })
      .select("sender receiver")
      .lean();

    for (const request of pendingRequests) {
      const senderId = request.sender?.toString();
      const receiverId = request.receiver?.toString();

      if (senderId && senderId !== currentUserId.toString()) {
        excludedUserIds.add(senderId);
      }

      if (receiverId && receiverId !== currentUserId.toString()) {
        excludedUserIds.add(receiverId);
      }
    }

    const baseMatch = {
      _id: { $nin: [...excludedUserIds] },
    };

    if (onboardedOnly) {
      baseMatch.isOnboarded = true;
    }

    if (query) {
      const escapedQuery = query.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      const regex = new RegExp(escapedQuery, "i");

      baseMatch.$or = [
        { fullName: regex },
        { city: regex },
        { preferredLocalities: regex },
        { propertyTypePreferences: regex },
        { primaryRole: regex },
        { homeBase: regex },
        { location: regex },
        { travelStyle: regex },
        { travelInterests: regex },
        { favoriteDestinations: regex },
        // Legacy fields retained for old profiles during migration period.
        { nativeLanguage: regex },
        { learningLanguage: regex },
      ];
    }

    let recommendedUsers = [];

    if (random && !query) {
      recommendedUsers = await User.aggregate([
        { $match: baseMatch },
        { $sample: { size: limit } },
      ]);
    } else {
      recommendedUsers = await User.find(baseMatch)
        .sort({ createdAt: -1 })
        .limit(limit);
    }

    return sendSuccessResponse(
      res,
      200,
      "Users fetched successfully",
      {
        users: recommendedUsers,
      }
    );
  } catch (error) {
    logger.error("Error fetching recommended users:", error);
    return sendErrorResponse(res, 500, "Internal Server Error");
  }
}

export async function getDiscoverUsers(req, res) {
  try {
    const recommendations = await getDiscoverRecommendations(req.user._id, req.query);
    return sendSuccessResponse(res, 200, "Discover recommendations fetched successfully", recommendations);
  } catch (error) {
    if (error?.message === "USER_NOT_FOUND") return sendErrorResponse(res, 404, "User not found");
    logger.error("Error fetching discover recommendations:", error);
    return sendErrorResponse(res, 500, "Could not generate discover recommendations");
  }
}

export async function getMyFriends(req, res) {
  try {
    const currentUserId = req.user._id;
    logger.info(`Fetching friends for user ID: ${currentUserId}`);

    // Fetch the current user with populated friends
    const userWithFriends = await User.findById(currentUserId)
      .select("friends")
      .populate(
        "friends",
        "fullName profilePic city primaryRole preferredLocalities propertyTypePreferences budgetMin budgetMax listingIntent homeBase travelStyle travelInterests favoriteDestinations location"
      );

    if (!userWithFriends) {
      logger.warn(`User not found for ID: ${currentUserId}`);
      return sendErrorResponse(res, 404, "User not found");
    }

    return sendSuccessResponse(res, 200, "Friends fetched successfully", {
      friends: userWithFriends.friends,
    });
  } catch (error) {
    logger.error("Error fetching friends:", error);
    return sendErrorResponse(res, 500, "Internal Server Error");
  }
}

export async function sendFriendRequest(req, res) {
  try {
    const currentUserId = req.user._id;
    const { id: recipientId } = req.params;

    logger.info(
      `User ID(current user): ${currentUserId} is sending a friend request to User ID(recipient user): ${recipientId}`
    );

    // Prevent users (currentUserId) from sending friend requests to themselves
    if (currentUserId === recipientId) {
      logger.warn(
        `User ID: ${currentUserId} attempted to send a friend request to themselves.`
      );
      return sendErrorResponse(
        res,
        400,
        "You cannot send a friend request to yourself."
      );
    }

    const recipientUser = await User.findById(recipientId).lean();
    if (!recipientUser) {
      logger.warn(`Recipient user not found for ID: ${recipientId}`);
      return sendErrorResponse(res, 404, "Recipient user not found");
    }

    // Check if they are already friends
    if (recipientUser.friends.includes(currentUserId)) {
      logger.warn(
        `User ID: ${currentUserId} and User ID: ${recipientId} are already friends.`
      );
      return sendErrorResponse(
        res,
        400,
        "You are already friends with this user."
      );
    }

    // Check if a friend request has already been sent
    const existingRequest = await FriendRequest.findOne({
      $or: [
        { sender: currentUserId, receiver: recipientId },
        { sender: recipientId, receiver: currentUserId },
      ],
    }).lean();

    if (existingRequest) {
      logger.warn(
        `A friend request already exists between User ID: ${currentUserId} and User ID: ${recipientId}.`
      );
      return sendErrorResponse(
        res,
        400,
        "A friend request already exists between you and this user.",
        { friendRequest: existingRequest }
      );
    }

    const newFriendRequest = await FriendRequest.create({
      sender: currentUserId,
      receiver: recipientId,
    });

    logger.info(
      `Friend request sent from User ID: ${currentUserId} to User ID: ${recipientId}`
    );

    return sendSuccessResponse(res, 200, "Friend request sent successfully", {
      friendRequest: newFriendRequest,
    });
  } catch (error) {
    logger.error("Error sending friend request:", error);
    return sendErrorResponse(res, 500, "Internal Server Error");
  }
}

export async function acceptFriendRequest(req, res) {
  try {
    const { id: requestId } = req.params;
    const currentUserId = req.user._id;

    const friendRequest = await FriendRequest.findById(requestId);

    if (!friendRequest) {
      logger.warn(`Friend request not found for ID: ${requestId}`);
      return sendErrorResponse(res, 404, "Friend request not found");
    }

    // If already rejected, do not allow acceptance
    if (friendRequest.status === "rejected") {
      logger.warn(
        `Friend request ID: ${requestId} has already been rejected and cannot be accepted.`
      );
      return sendErrorResponse(
        res,
        400,
        "Friend request has already been rejected and cannot be accepted."
      );
    }

    if (friendRequest.status === "accepted") {
      logger.warn(`Friend request ID: ${requestId} has already been accepted.`);
      return sendErrorResponse(
        res,
        400,
        "Friend request has already been accepted.",
        { friendRequest }
      );
    }

    // Verify the current user is the recipient
    if (friendRequest.receiver.toString() !== currentUserId.toString()) {
      logger.warn(
        `User ID: ${currentUserId} is not authorized to accept this friend request.`
      );
      return sendErrorResponse(
        res,
        403,
        "You are not authorized to accept this friend request."
      );
    }

    friendRequest.status = "accepted";
    await friendRequest.save();

    // Add each user to the other's friends list
    // $addToSet is used to add elements to an array only if they do not already exist in the array
    await User.findByIdAndUpdate(friendRequest.sender, {
      $addToSet: { friends: friendRequest.receiver },
    });
    await User.findByIdAndUpdate(friendRequest.receiver, {
      $addToSet: { friends: friendRequest.sender },
    });
    await Promise.all([invalidateDiscoverCache(friendRequest.sender), invalidateDiscoverCache(friendRequest.receiver)]);

    logger.info(
      `Friend request ID: ${requestId} accepted by User ID: ${currentUserId}`
    );

    return sendSuccessResponse(
      res,
      200,
      "Friend request accepted successfully",
      {
        friendRequest,
      }
    );
  } catch (error) {
    logger.error("Error accepting friend request:", error);
    return sendErrorResponse(res, 500, "Internal Server Error");
  }
}

export async function getFriendRequests(req, res) {
  try {
    const incomingRequests = await FriendRequest.find({
      receiver: req.user._id,
      status: "pending",
    }).populate(
      "sender",
      "fullName profilePic city primaryRole preferredLocalities propertyTypePreferences budgetMin budgetMax listingIntent nativeLanguage learningLanguage location"
    );

    const acceptedRequests = await FriendRequest.find({
      receiver: req.user._id,
      status: "accepted",
    }).populate("receiver", "fullName profilePic");

    return sendSuccessResponse(
      res,
      200,
      "Friend requests fetched successfully",
      {
        incomingRequests,
        acceptedRequests,
      }
    );
  } catch (error) {
    logger.error("Error fetching friend requests:", error);
    return sendErrorResponse(res, 500, "Internal Server Error");
  }
}

export async function getOutgoingFriendRequests(req, res) {
  try {
    const outgoingRequests = await FriendRequest.find({
      sender: req.user._id,
      status: "pending",
    }).populate(
      "receiver",
      "fullName profilePic city primaryRole preferredLocalities propertyTypePreferences budgetMin budgetMax listingIntent nativeLanguage learningLanguage location"
    );

    return sendSuccessResponse(
      res,
      200,
      "Outgoing friend requests fetched successfully",
      {
        outgoingRequests,
      }
    );
  } catch (error) {
    logger.error("Error fetching outgoing friend requests:", error);
    return sendErrorResponse(res, 500, "Internal Server Error");
  }
}

export async function rejectFriendRequest(req, res) {
  try {
    const { id: requestId } = req.params;
    const currentUserId = req.user._id;

    const friendRequest = await FriendRequest.findById(requestId);

    if (!friendRequest) {
      logger.warn(`Friend request not found for ID: ${requestId}`);
      return sendErrorResponse(res, 404, "Friend request not found");
    }

    // If already accepted, do not allow rejection
    if (friendRequest.status === "accepted") {
      logger.warn(
        `Friend request ID: ${requestId} has already been accepted and cannot be rejected.`
      );
      return sendErrorResponse(
        res,
        400,
        "Friend request has already been accepted and cannot be rejected."
      );
    }

    // Verify the current user is the recipient
    if (friendRequest.receiver.toString() !== currentUserId) {
      logger.warn(
        `User ID: ${currentUserId} is not authorized to reject this friend request.`
      );
      return sendErrorResponse(
        res,
        403,
        "You are not authorized to reject this friend request."
      );
    }

    friendRequest.status = "rejected";
    await friendRequest.save();

    logger.info(
      `Friend request ID: ${requestId} rejected by User ID: ${currentUserId}`
    );

    return sendSuccessResponse(
      res,
      200,
      "Friend request rejected successfully",
      {
        friendRequest,
      }
    );
  } catch (error) {
    logger.error("Error rejecting friend request:", error);
    return sendErrorResponse(res, 500, "Internal Server Error");
  }
}

const publishedPostFilter = {
  $and: [
    {
      $or: [{ status: "PUBLISHED" }, { status: { $exists: false } }, { status: null }],
    },
    {
      $or: [{ visibility: "PUBLIC" }, { visibility: { $exists: false } }, { visibility: null }],
    },
  ],
};

export async function updateUserLocation(req, res) {
  try {
    const currentUserId = req.user._id;
    const { latitude, longitude, country, countryCode, city, state, address, formattedAddress } = req.body || {};

    const locationDetails = {};
    // When we get coordinates, stamp when — the "Near Me" feed treats a
    // saved location older than 30 days as stale and falls back to the city.
    if (latitude !== undefined && longitude !== undefined) locationDetails.capturedAt = new Date();
    if (latitude !== undefined) locationDetails.latitude = latitude;
    if (longitude !== undefined) locationDetails.longitude = longitude;
    if (country !== undefined) locationDetails.country = country;
    if (countryCode !== undefined) locationDetails.countryCode = countryCode;
    if (city !== undefined) locationDetails.city = city;
    if (state !== undefined) locationDetails.state = state;
    if (address !== undefined) locationDetails.address = address;
    if (formattedAddress !== undefined) locationDetails.formattedAddress = formattedAddress;

    const updatePayload = {};
    if (Object.keys(locationDetails).length > 0) {
      updatePayload.locationDetails = locationDetails;
    }
    if (city !== undefined) {
      updatePayload.city = city;
      updatePayload.homeBase = city;
      updatePayload.location = city;
    }
    if (country !== undefined) {
      updatePayload.location = country;
    }

    if (Object.keys(updatePayload).length === 0) {
      return sendErrorResponse(res, 400, "No location fields provided");
    }

    const updatedUser = await User.findByIdAndUpdate(currentUserId, updatePayload, { new: true });
    if (!updatedUser) {
      return sendErrorResponse(res, 404, "User not found");
    }

    await invalidateDiscoverCache(currentUserId);

    // Bust this user's own cached feed responses so the next "For You" load
    // recomputes with the new location instead of serving a stale cached
    // response for up to the feed cache's TTL — mirrors how like/save force
    // an immediate re-personalization, scoped to just this user's entries
    // since a location change only affects their own ranking.
    try {
      const keys = await redisClient.keys(`property:feed:*:${currentUserId}`);
      if (keys.length > 0) {
        await redisClient.del(keys);
        logger.info(`Invalidated ${keys.length} property feed cache entries for user ${currentUserId} after location update`);
      }
    } catch (cacheError) {
      logger.warn("Redis cache invalidation error after location update:", cacheError);
    }

    return sendSuccessResponse(res, 200, "Location updated successfully", {
      user: sanitizeUserData(updatedUser),
    });
  } catch (error) {
    logger.error("Error updating location:", error);
    return sendErrorResponse(res, 500, "Internal Server Error");
  }
}

export async function registerFcmToken(req, res) {
  try {
    const currentUserId = req.user._id;
    const { token } = req.body || {};

    if (!token || !String(token).trim()) {
      return sendErrorResponse(res, 400, "A device token is required");
    }

    await User.updateOne({ _id: currentUserId }, { $addToSet: { fcmTokens: String(token).trim() } });

    return sendSuccessResponse(res, 200, "Device registered for push notifications", {});
  } catch (error) {
    logger.error("Error registering FCM token:", error);
    return sendErrorResponse(res, 500, "Internal Server Error");
  }
}

export async function unregisterFcmToken(req, res) {
  try {
    const currentUserId = req.user._id;
    const { token } = req.body || {};

    if (!token || !String(token).trim()) {
      return sendErrorResponse(res, 400, "A device token is required");
    }

    await User.updateOne({ _id: currentUserId }, { $pull: { fcmTokens: String(token).trim() } });

    return sendSuccessResponse(res, 200, "Device unregistered from push notifications", {});
  } catch (error) {
    logger.error("Error unregistering FCM token:", error);
    return sendErrorResponse(res, 500, "Internal Server Error");
  }
}

export async function getUserFriendsList(req, res) {
  try {
    const { id: userId } = req.params;
    const currentUserId = req.user._id;

    const userWithFriends = await User.findById(userId)
      .select("friends")
      .populate(
        "friends",
        "fullName profilePic city primaryRole preferredLocalities propertyTypePreferences budgetMin budgetMax listingIntent homeBase travelStyle travelInterests favoriteDestinations location"
      );

    if (!userWithFriends) {
      return sendErrorResponse(res, 404, "User not found");
    }

    const isSelf = String(currentUserId) === String(userId);
    const isFriend = userWithFriends.friends.some(
      (friend) => String(friend._id) === String(currentUserId)
    );

    if (!isSelf && !isFriend) {
      return sendErrorResponse(res, 403, "Only friends can view this list");
    }

    return sendSuccessResponse(res, 200, "Friends fetched successfully", {
      friends: userWithFriends.friends,
    });
  } catch (error) {
    logger.error("Error fetching user friends list:", error);
    return sendErrorResponse(res, 500, "Internal Server Error");
  }
}

export async function getUserPublicProfile(req, res) {
  try {
    const { id: targetUserId } = req.params;
    const currentUserId = req.user._id;

    if (!targetUserId) {
      return sendErrorResponse(res, 400, "User ID is required");
    }

    const user = await User.findById(targetUserId)
      .select(
        "fullName bio profilePic city primaryRole activeRole userRoles preferredLocalities propertyTypePreferences listingIntent budgetMin budgetMax createdAt isVerified ratingAvg ratingCount"
      )
      .lean();

    if (!user) {
      return sendErrorResponse(res, 404, "User not found");
    }

    const postsCount = await PropertyPost.countDocuments({
      author: targetUserId,
      ...publishedPostFilter,
    });

    const targetUser = await User.findById(targetUserId).select("friends").lean();
    const followersCount = targetUser?.friends?.length || 0;
    const followingCount = targetUser?.friends?.length || 0;

    const currentUser = await User.findById(currentUserId).select("friends").lean();

    // Get saved posts count (bookmarked by the user)
    const savedPosts = await PropertyPost.find({
      savedBy: targetUserId,
      ...publishedPostFilter,
    }).lean();
    const savedCount = savedPosts.length;

    // Get total likes count for user's posts
    const userPosts = await PropertyPost.find({
      author: targetUserId,
      ...publishedPostFilter,
    }).select("likesCount").lean();
    const likesCount = userPosts.reduce((sum, post) => sum + (post.likesCount || 0), 0);

    const isSelf = String(currentUserId) === String(targetUserId);
    let connectionStatus = "none";

    logger.debug("Profile check", { currentUserId, targetUserId, isSelf });

    if (!isSelf) {
      const isFriend = (currentUser?.friends || []).some(
        (friendId) => String(friendId) === String(targetUserId)
      );

      if (isFriend) {
        connectionStatus = "friends";
      } else {
        const pendingRequest = await FriendRequest.findOne({
          status: "pending",
          $or: [
            { sender: currentUserId, receiver: targetUserId },
            { sender: targetUserId, receiver: currentUserId },
          ],
        })
          .select("sender receiver")
          .lean();

        if (pendingRequest) {
          connectionStatus =
            String(pendingRequest.sender) === String(currentUserId)
              ? "pending_sent"
              : "pending_received";
        }
      }
    }

    return sendSuccessResponse(res, 200, "User profile fetched successfully", {
      user: sanitizeUserData(user),
      stats: {
        postsCount,
        followersCount,
        followingCount,
        savedCount,
        reviewsCount: 0, // TODO: Implement reviews feature
        viewsCount: 0, // TODO: Implement views tracking
        likesCount,
      },
      relationship: {
        isSelf,
        connectionStatus,
      },
    });
  } catch (error) {
    logger.error("Error fetching user public profile:", error);
    return sendErrorResponse(res, 500, "Internal Server Error");
  }
}

export async function getUserActivity(req, res) {
  try {
    const currentUserId = req.user._id;
    const cacheKey = ACTIVITY_CACHE_KEY(currentUserId);
    
    // Try to get from cache first
    try {
      const cached = await redisClient.get(cacheKey);
      if (cached) {
        logger.info(`✅ CACHE HIT: Activity data for user ID: ${currentUserId}`);
        return sendSuccessResponse(res, 200, "User activity fetched successfully", JSON.parse(cached));
      }
      logger.info(`❌ CACHE MISS: Activity data for user ID: ${currentUserId} - fetching from database`);
    } catch (error) {
      logger.warn("Redis cache read failed, falling back to database:", error);
    }

    logger.info(`Fetching activity for user ID: ${currentUserId}`);

    // Get posts liked by user with timestamps
    const likedPosts = await PropertyPost.find({
      likedBy: currentUserId,
      ...publishedPostFilter,
    })
      .select("title price city mediaUrls author createdAt likedByTimestamps")
      .populate("author", "fullName profilePic isVerified")
      .limit(20)
      .lean();

    // Get posts saved by user with timestamps
    const savedPosts = await PropertyPost.find({
      savedBy: currentUserId,
      ...publishedPostFilter,
    })
      .select("title price city mediaUrls author createdAt savedByTimestamps")
      .populate("author", "fullName profilePic isVerified")
      .limit(20)
      .lean();

    // Get comments by user
    const userComments = await Comment.find({
      author: currentUserId,
    })
      .select("content post createdAt")
      .populate("post", "title price city mediaUrls author")
      .sort({ createdAt: -1 })
      .limit(20)
      .lean();

    // Get connection requests (both sent and received)
    const sentRequests = await FriendRequest.find({
      sender: currentUserId,
    })
      .select("receiver status createdAt")
      .populate("receiver", "fullName profilePic activeRole")
      .sort({ createdAt: -1 })
      .limit(20)
      .lean();

    const receivedRequests = await FriendRequest.find({
      receiver: currentUserId,
    })
      .select("sender status createdAt")
      .populate("sender", "fullName profilePic activeRole")
      .sort({ createdAt: -1 })
      .limit(20)
      .lean();

    // Format the activity data with actual timestamps
    const formattedLikes = likedPosts.map(post => {
      const likeTimestamp = post.likedByTimestamps?.find(t => String(t.userId) === String(currentUserId))?.timestamp;
      return {
        _id: post._id,
        type: "like",
        post,
        createdAt: likeTimestamp || post.createdAt,
      };
    });

    const formattedSaved = savedPosts.map(post => {
      const saveTimestamp = post.savedByTimestamps?.find(t => String(t.userId) === String(currentUserId))?.timestamp;
      return {
        _id: post._id,
        type: "save",
        post,
        createdAt: saveTimestamp || post.createdAt,
      };
    });

    const formattedComments = userComments.map(comment => ({
      _id: comment._id,
      type: "comment",
      commentText: comment.content,
      post: comment.post,
      createdAt: comment.createdAt,
    }));

    const formattedConnections = [
      ...sentRequests.map(req => ({
        _id: req._id,
        type: "connection_request",
        status: req.status,
        targetUser: req.receiver,
        createdAt: req.createdAt,
      })),
      ...receivedRequests.map(req => ({
        _id: req._id,
        type: req.status === "accepted" ? "connection_accepted" : "connection_request",
        status: req.status,
        targetUser: req.sender,
        createdAt: req.createdAt,
      })),
    ];

    const activityData = {
      likes: formattedLikes,
      comments: formattedComments,
      saved: formattedSaved,
      connections: formattedConnections,
    };

    // Cache the result
    try {
      await redisClient.set(cacheKey, JSON.stringify(activityData), { EX: ACTIVITY_CACHE_TTL });
      logger.info(`💾 CACHE WRITE: Activity data for user ID: ${currentUserId} (TTL: ${ACTIVITY_CACHE_TTL}s)`);
    } catch (error) {
      logger.warn("Redis cache write failed:", error);
    }

    return sendSuccessResponse(res, 200, "User activity fetched successfully", activityData);
  } catch (error) {
    logger.error("Error fetching user activity:", error);
    return sendErrorResponse(res, 500, "Internal Server Error");
  }
}

// Invalidate activity cache for a user
export async function invalidateActivityCache(userId) {
  try {
    const cacheKey = ACTIVITY_CACHE_KEY(userId);
    await redisClient.del(cacheKey);
    logger.info(`Invalidated activity cache for user ID: ${userId}`);
  } catch (error) {
    logger.warn("Failed to invalidate activity cache:", error);
  }
}
