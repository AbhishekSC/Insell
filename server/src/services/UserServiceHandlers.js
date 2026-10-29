import FriendRequest from "../models/FriendRequest.model.js";
import PropertyPost from "../models/PropertyPost.model.js";
import User from "../models/User.model.js";
import Comment from "../models/Comment.model.js";
import MobileDetail from "../models/MobileDetail.model.js";
import { getDiscoverRecommendations, invalidateDiscoverCache } from "./DiscoverRecommendationService.js";
import { invalidateUserProfileCache } from "./likeCache.service.js";
import { redisClient } from "../config/redis.js";
import { logger } from "../utils/logger.js";
import { sanitizeUserData } from "../utils/sanitizeUser.js";
import {
  sendErrorResponse,
  sendSuccessResponse,
} from "../utils/responseHandler.js";

const ACTIVITY_CACHE_TTL = 5 * 60; // 5 minutes
const ACTIVITY_CACHE_KEY = (userId) => `activity:${userId}`;

// --- Progressive onboarding -------------------------------------------------
// One preference question at a time, surfaced in the feed. Order = cheapest
// signal first. We stop asking a question after MAX_SKIPS dismissals and wait
// PROMPT_COOLDOWN_MS between any two prompts so it never nags.
const PREFERENCE_PROMPTS = {
  intent: {
    key: "intent",
    kind: "choice",
    question: "What are you looking for today?",
    hint: "Pick an option to personalize your feed instantly.",
    options: [
      { value: "Buy", label: "Buy Home", icon: "home" },
      { value: "Rent", label: "Rent Home", icon: "key" },
      { value: "Sell", label: "Sell Property", icon: "tag" },
    ],
  },
  budget: {
    key: "budget",
    kind: "range",
    question: "What's your budget?",
    hint: "Roughly — it just helps us filter.",
  },
  areas: {
    key: "areas",
    kind: "chips-free",
    question: "Which areas are you interested in?",
    hint: "Add a few localities.",
  },
  types: {
    key: "types",
    kind: "chips",
    question: "What kind of property?",
    options: ["Apartment", "Independent House", "Villa", "Plot", "Agricultural Land", "Commercial"].map((v) => ({ value: v, label: v })),
  },
};
const PREFERENCE_PROMPT_ORDER = ["intent", "budget", "areas", "types"];
const PREFERENCE_PROMPT_COOLDOWN_MS = 20 * 60 * 60 * 1000; // ~once a day
const PREFERENCE_MAX_SKIPS = 3;
const PREFERENCE_DONE_THRESHOLD = 3; // answered this many → mark onboarded

function preferenceAnsweredState(user) {
  return {
    intent: Boolean(String(user.listingIntent || "").trim()),
    budget: Number(user.budgetMax) > 0 || Number(user.budgetMin) > 0,
    areas: Array.isArray(user.preferredLocalities) && user.preferredLocalities.length > 0,
    types: Array.isArray(user.propertyTypePreferences) && user.propertyTypePreferences.length > 0,
  };
}

// GET /users/preference-prompt — the next question to ask, or { prompt: null }
export async function getPreferencePrompt(req, res) {
  try {
    const user = await User.findById(req.user._id)
      .select("isOnboarded listingIntent budgetMin budgetMax preferredLocalities propertyTypePreferences preferenceHints")
      .lean();
    if (!user) return sendErrorResponse(res, 404, "User not found");

    const hints = user.preferenceHints || {};
    const answeredNow = preferenceAnsweredState(user);
    // If the user already answered intent AND is onboarded, do not prompt.
    // However, if an existing/old user never answered intent (!user.listingIntent), allow them to pick intent in 1 click!
    if (user.isOnboarded && answeredNow.intent) return sendSuccessResponse(res, 200, "No prompt", { prompt: null });

    const lastAt = hints.lastPromptAt ? new Date(hints.lastPromptAt).getTime() : 0;
    if (lastAt && Date.now() - lastAt < PREFERENCE_PROMPT_COOLDOWN_MS) {
      return sendSuccessResponse(res, 200, "Cooling down", { prompt: null });
    }

    const answeredKeys = new Set(hints.answered || []);
    const skipped = hints.skipped || {};

    for (const key of PREFERENCE_PROMPT_ORDER) {
      if (answeredNow[key] || answeredKeys.has(key)) continue;
      if ((Number(skipped[key]) || 0) >= PREFERENCE_MAX_SKIPS) continue;
      return sendSuccessResponse(res, 200, "Prompt ready", { prompt: PREFERENCE_PROMPTS[key] });
    }
    return sendSuccessResponse(res, 200, "No prompt", { prompt: null });
  } catch (error) {
    logger.error("Error in getPreferencePrompt:", error);
    return sendErrorResponse(res, 500, "Internal Server Error");
  }
}

// POST /users/preference-prompt  { key, value?, skip? }
export async function answerPreferencePrompt(req, res) {
  try {
    const { key, value, skip } = req.body || {};
    if (!PREFERENCE_PROMPT_ORDER.includes(key)) {
      return sendErrorResponse(res, 400, "Unknown prompt");
    }

    const set = { "preferenceHints.lastPromptAt": new Date() };
    const update = { $set: set };

    if (skip) {
      update.$inc = { [`preferenceHints.skipped.${key}`]: 1 };
    } else {
      switch (key) {
        case "intent": {
          const v = ["Buy", "Rent", "Sell"].includes(String(value)) ? String(value) : null;
          if (!v) return sendErrorResponse(res, 400, "Pick Buy, Rent, or Sell");
          set.listingIntent = v;
          break;
        }
        case "budget": {
          const min = Math.max(0, Math.round(Number(value?.min) || 0));
          const max = Math.max(0, Math.round(Number(value?.max) || 0));
          if (!min && !max) return sendErrorResponse(res, 400, "Enter a budget");
          set.budgetMin = min;
          set.budgetMax = max || min;
          break;
        }
        case "areas": {
          const arr = (Array.isArray(value) ? value : [])
            .map((s) => String(s || "").trim())
            .filter(Boolean)
            .slice(0, 8);
          if (!arr.length) return sendErrorResponse(res, 400, "Add at least one area");
          set.preferredLocalities = arr;
          break;
        }
        case "types": {
          const arr = (Array.isArray(value) ? value : [])
            .map((s) => String(s || "").trim())
            .filter(Boolean)
            .slice(0, 6);
          if (!arr.length) return sendErrorResponse(res, 400, "Pick at least one type");
          set.propertyTypePreferences = arr;
          break;
        }
        default:
          return sendErrorResponse(res, 400, "Unknown prompt");
      }
      update.$addToSet = { "preferenceHints.answered": key };
    }

    const user = await User.findByIdAndUpdate(req.user._id, update, { new: true });
    if (!user) return sendErrorResponse(res, 404, "User not found");

    // Enough answered → stop prompting entirely.
    const answeredCount = (user.preferenceHints?.answered || []).length;
    if (!user.isOnboarded && answeredCount >= PREFERENCE_DONE_THRESHOLD) {
      user.isOnboarded = true;
      await user.save();
    }

    // New stated preferences must reach the recommender on the next request.
    try {
      const { default: PersonalizationService } = await import("./PersonalizationService.js");
      await PersonalizationService.invalidatePersonalizationCache(req.user._id);
    } catch (e) {
      logger.warn("preference prompt: cache bust failed (non-fatal):", e?.message);
    }

    return sendSuccessResponse(res, 200, skip ? "Skipped" : "Saved", { user: sanitizeUserData(user) });
  } catch (error) {
    logger.error("Error in answerPreferencePrompt:", error);
    return sendErrorResponse(res, 500, "Internal Server Error");
  }
}

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

    if (body.flatmateProfile && typeof body.flatmateProfile === "object") {
      const fp = body.flatmateProfile;
      const allowed = ["gender", "ageGroup", "occupation", "foodPreference", "smoking", "drinking", "pets", "workSchedule", "cleanliness", "noisePreference", "budgetMin", "budgetMax", "preferredCity"];
      const cleaned = {};
      for (const key of allowed) {
        if (fp[key] !== undefined) {
          cleaned[key] = typeof fp[key] === "number" ? fp[key] : String(fp[key] || "").trim();
        }
      }
      if (typeof fp.budgetMin === "number") cleaned.budgetMin = Math.max(0, fp.budgetMin);
      if (typeof fp.budgetMax === "number") cleaned.budgetMax = Math.max(0, fp.budgetMax);
      cleaned.updatedAt = new Date();
      updatePayload.flatmateProfile = cleaned;
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
    await invalidateUserProfileCache(currentUserId);

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

    // When searching explicitly with a query, allow universal search (friends, non-friends, self)
    const baseMatch = query ? {} : {
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
        "fullName profilePic city primaryRole preferredLocalities propertyTypePreferences budgetMin budgetMax listingIntent homeBase travelStyle travelInterests favoriteDestinations location isOwnerVerified"
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

    // Prevent users (currentUserId) from sending friend requests to themselves.
    // currentUserId is a Mongoose ObjectId (from req.user._id) and recipientId
    // is always a plain string (an Express route param) — `===` between an
    // ObjectId and a string is ALWAYS false regardless of value, so this
    // guard never actually fired. Stringify both sides to compare by value.
    if (String(currentUserId) === String(recipientId)) {
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

    // Check if they are already friends. Same issue as above but with
    // Array.includes: two ObjectId instances with the same hex value are
    // never reference-equal, so `.includes(currentUserId)` on an array of
    // ObjectIds was also always false — compare by string value instead.
    if (recipientUser.friends.some((friendId) => String(friendId) === String(currentUserId))) {
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
    try {
      const { invalidateUserSocialGraph } = await import("../controllers/propertyPost.controller.js");
      await Promise.all([
        invalidateUserSocialGraph(friendRequest.sender),
        invalidateUserSocialGraph(friendRequest.receiver),
      ]);
    } catch {}

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
      "fullName profilePic city primaryRole preferredLocalities propertyTypePreferences budgetMin budgetMax listingIntent nativeLanguage learningLanguage location isOwnerVerified"
    );

    const acceptedRequests = await FriendRequest.find({
      receiver: req.user._id,
      status: "accepted",
    }).populate("receiver", "fullName profilePic isOwnerVerified");

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
      "fullName profilePic city primaryRole preferredLocalities propertyTypePreferences budgetMin budgetMax listingIntent nativeLanguage learningLanguage location isOwnerVerified"
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
    const { latitude, longitude, country, countryCode, city, state, address, formattedAddress, accuracyMeters, source } = req.body || {};

    const hasCoords = latitude !== undefined && longitude !== undefined
      && Number.isFinite(Number(latitude)) && Number.isFinite(Number(longitude))
      && Math.abs(Number(latitude)) <= 90 && Math.abs(Number(longitude)) <= 180;

    if ((latitude !== undefined || longitude !== undefined) && !hasCoords) {
      return sendErrorResponse(res, 400, "Invalid coordinates");
    }

    const locationDetails = {};
    // When we get coordinates, stamp when + how — the "Near Me" feed treats a
    // saved location older than 30 days as stale and falls back to the city.
    if (hasCoords) {
      locationDetails.capturedAt = new Date();
      locationDetails.source = ["gps", "manual", "ip"].includes(source) ? source : "gps";
      if (Number.isFinite(Number(accuracyMeters)) && Number(accuracyMeters) > 0) {
        locationDetails.accuracyMeters = Math.round(Number(accuracyMeters));
      }
    }
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

// Helper to bust all user-specific and feed-related Redis caches
async function invalidateUserAndFeedCaches(userId) {
  try {
    const keysToDelete = [
      `user:${userId}:profile`,
      `user:profile:${userId}`,
      `feed:personalized:${userId}`,
      `recommendations:for_you:${userId}`,
    ];
    await redisClient.del(keysToDelete);

    // Broadly purge feed and commute caches
    const patterns = [
      `property:feed:*${userId}*`,
      `property:feed:shared:*`,
      `property:feed:for_you:*`,
      `feed:hot:*`,
      `commute:*`,
    ];
    for (const pattern of patterns) {
      try {
        const found = await redisClient.keys(pattern);
        if (Array.isArray(found) && found.length > 0) {
          await redisClient.del(found);
        }
      } catch (err) {
        logger.warn(`Failed to scan/del pattern ${pattern}:`, err?.message);
      }
    }
  } catch (err) {
    logger.warn(`Error invalidating user/feed caches for ${userId}:`, err?.message);
  }
}

// PATCH /users/work-location  { latitude, longitude, label?, address? }
//
// Sets the user's work / office location for commute-time-aware scoring.
// The personalization engine blends this with proximity: a property that's
// farther but faster to commute to can outscore one that's closer as the
// crow flies. Clearing workLocation (passing null coordinates) removes it.
export async function updateWorkLocation(req, res) {
  try {
    const currentUserId = req.user._id;
    // Support both direct fields and wrapped { workLocation: ... }
    const raw = req.body?.workLocation || req.body || {};
    const { latitude, longitude, label, address, city, state, formattedAddress } = raw;

    // Allow clearing: both null/undefined → remove workLocation
    if (latitude == null && longitude == null) {
      await User.updateOne({ _id: currentUserId }, { $unset: { workLocation: 1 } });
      const updated = await User.findById(currentUserId).lean();

      // Bust user profile and feed caches
      await invalidateUserAndFeedCaches(currentUserId);
      try {
        const uStr = String(currentUserId);
        await redisClient.del(`user:${uStr}:profile`);
        if (updated) {
          delete updated.workLocation;
          await redisClient.setEx(`user:${uStr}:profile`, 300, JSON.stringify(updated));
        }
      } catch (_) {}

      const sanitized = sanitizeUserData(updated);
      if (sanitized) sanitized.workLocation = null;

      return sendSuccessResponse(res, 200, "Work location removed", {
        user: sanitized,
      });
    }

    const lat = Number(latitude);
    const lng = Number(longitude);
    if (!Number.isFinite(lat) || !Number.isFinite(lng) || Math.abs(lat) > 90 || Math.abs(lng) > 180) {
      return sendErrorResponse(res, 400, "Invalid coordinates");
    }

    const resolvedLabel = String(label || city || formattedAddress || address || "Workplace").slice(0, 100);
    const resolvedAddress = String(address || formattedAddress || label || "").slice(0, 300);

    const updated = await User.findByIdAndUpdate(
      currentUserId,
      {
        workLocation: {
          latitude: lat,
          longitude: lng,
          label: resolvedLabel,
          address: resolvedAddress,
          city: city ? String(city).slice(0, 100) : undefined,
          state: state ? String(state).slice(0, 100) : undefined,
          formattedAddress: formattedAddress ? String(formattedAddress).slice(0, 300) : undefined,
          updatedAt: new Date(),
        },
      },
      { new: true }
    );

    if (!updated) return sendErrorResponse(res, 404, "User not found");

    // Invalidate user profile and feed cache so /auth/verify and feeds immediately reflect the update
    await invalidateUserAndFeedCaches(currentUserId);
    try {
      const uStr = String(currentUserId);
      await redisClient.del(`user:${uStr}:profile`);
      if (updated) {
        await redisClient.setEx(`user:${uStr}:profile`, 300, JSON.stringify(updated));
      }
    } catch (_) {}

    return sendSuccessResponse(res, 200, "Work location updated successfully", {
      user: sanitizeUserData(updated),
    });
  } catch (error) {
    logger.error("Error updating work location:", error);
    return sendErrorResponse(res, 500, "Internal Server Error");
  }
}

// PATCH /users/digest-preference  { optOut: boolean }
// One-click "turn off this email" target for the weekly digest — see
// modules/weekly-digest. Doesn't touch in-app or push notifications.
export async function updateDigestPreference(req, res) {
  try {
    const currentUserId = req.user._id;
    const optOut = Boolean(req.body?.optOut);
    await User.updateOne({ _id: currentUserId }, { $set: { emailDigestOptOut: optOut } });
    return sendSuccessResponse(res, 200, "Preference updated", { emailDigestOptOut: optOut });
  } catch (error) {
    logger.error("Error updating digest preference:", error);
    return sendErrorResponse(res, 500, "Internal Server Error");
  }
}

const FCM_PLATFORMS = ["web", "ios", "android"];

// `platform` is optional and defaults to "web" — the existing web client
// doesn't send it, so its registrations keep working unchanged; the mobile
// app is the one that passes "ios"/"android" explicitly.
export async function registerFcmToken(req, res) {
  try {
    const currentUserId = req.user._id;
    const { token, platform, deviceId } = req.body || {};

    if (!token || !String(token).trim()) {
      return sendErrorResponse(res, 400, "A device token is required");
    }
    const normalizedToken = String(token).trim();
    const normalizedPlatform = FCM_PLATFORMS.includes(platform) ? platform : "web";

    // Remove any existing entry for this exact token first — otherwise
    // re-registering the same device (which happens on every app foreground)
    // would pile up duplicate entries via $addToSet, since each one carries
    // a fresh `updatedAt` that makes it look like a distinct array element.
    await User.updateOne({ _id: currentUserId }, { $pull: { fcmTokens: { token: normalizedToken } } });
    await User.updateOne(
      { _id: currentUserId },
      { $push: { fcmTokens: { token: normalizedToken, platform: normalizedPlatform, updatedAt: new Date() } } }
    );

    // If deviceId is also provided, sync with MobileDetail model
    if (deviceId && String(deviceId).trim()) {
      const cleanDeviceId = String(deviceId).trim();
      await MobileDetail.findOneAndUpdate(
        { user: currentUserId, deviceId: cleanDeviceId },
        {
          $set: {
            user: currentUserId,
            deviceId: cleanDeviceId,
            pushToken: normalizedToken,
            platform: normalizedPlatform === "web" ? "android" : normalizedPlatform,
            isActive: true,
            lastActiveAt: new Date(),
          },
        },
        { upsert: true, setDefaultsOnInsert: true }
      ).catch((err) => logger.warn("Failed to sync MobileDetail in registerFcmToken:", err));
    }

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

    const cleanToken = String(token).trim();
    await User.updateOne({ _id: currentUserId }, { $pull: { fcmTokens: { token: cleanToken } } });
    await MobileDetail.updateMany(
      { user: currentUserId, pushToken: cleanToken },
      { $set: { pushToken: null, isActive: false } }
    ).catch(() => {});

    return sendSuccessResponse(res, 200, "Device unregistered from push notifications", {});
  } catch (error) {
    logger.error("Error unregistering FCM token:", error);
    return sendErrorResponse(res, 500, "Internal Server Error");
  }
}

// **Mobile Detail & Device Tracking Handlers**
export async function syncMobileDetail(req, res) {
  try {
    const currentUserId = req.user._id;
    const {
      deviceId,
      brand,
      manufacturer,
      modelName,
      deviceType,
      isPhysicalDevice,
      totalMemoryMB,
      platform,
      osName,
      osVersion,
      osBuildId,
      appVersion,
      buildNumber,
      bundleId,
      pushToken,
      pushTokenType,
      pushPermissionStatus,
      locale,
      timezone,
    } = req.body || {};

    if (!deviceId || !String(deviceId).trim()) {
      return sendErrorResponse(res, 400, "A valid deviceId is required");
    }

    const cleanDeviceId = String(deviceId).trim();
    const cleanPlatform = platform === "ios" ? "ios" : "android";
    const clientIp =
      req.headers["x-forwarded-for"]?.split(",")[0]?.trim() ||
      req.socket?.remoteAddress ||
      req.ip ||
      "";

    const updateFields = {
      user: currentUserId,
      deviceId: cleanDeviceId,
      platform: cleanPlatform,
      lastActiveAt: new Date(),
      isActive: true,
      ...(brand !== undefined ? { brand: String(brand).trim() } : {}),
      ...(manufacturer !== undefined ? { manufacturer: String(manufacturer).trim() } : {}),
      ...(modelName !== undefined ? { modelName: String(modelName).trim() } : {}),
      ...(deviceType !== undefined ? { deviceType } : {}),
      ...(isPhysicalDevice !== undefined ? { isPhysicalDevice: Boolean(isPhysicalDevice) } : {}),
      ...(totalMemoryMB !== undefined && !isNaN(Number(totalMemoryMB)) ? { totalMemoryMB: Number(totalMemoryMB) } : {}),
      ...(osName !== undefined ? { osName: String(osName).trim() } : {}),
      ...(osVersion !== undefined ? { osVersion: String(osVersion).trim() } : {}),
      ...(osBuildId !== undefined ? { osBuildId: String(osBuildId).trim() } : {}),
      ...(appVersion !== undefined ? { appVersion: String(appVersion).trim() } : {}),
      ...(buildNumber !== undefined ? { buildNumber: String(buildNumber).trim() } : {}),
      ...(bundleId !== undefined ? { bundleId: String(bundleId).trim() } : {}),
      ...(pushToken !== undefined ? { pushToken: pushToken ? String(pushToken).trim() : null } : {}),
      ...(pushTokenType !== undefined ? { pushTokenType } : {}),
      ...(pushPermissionStatus !== undefined ? { pushPermissionStatus } : {}),
      ...(locale !== undefined ? { locale: String(locale).trim() } : {}),
      ...(timezone !== undefined ? { timezone: String(timezone).trim() } : {}),
      ...(clientIp ? { ipAddress: clientIp } : {}),
    };

    const device = await MobileDetail.findOneAndUpdate(
      { user: currentUserId, deviceId: cleanDeviceId },
      { $set: updateFields },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );

    // If pushToken provided, keep User.fcmTokens synchronized for backwards compatibility
    if (pushToken && String(pushToken).trim()) {
      const cleanToken = String(pushToken).trim();
      await User.updateOne({ _id: currentUserId }, { $pull: { fcmTokens: { token: cleanToken } } });
      await User.updateOne(
        { _id: currentUserId },
        { $push: { fcmTokens: { token: cleanToken, platform: cleanPlatform, updatedAt: new Date() } } }
      );
    }

    logger.info(`Mobile device synchronized for user ${currentUserId}: ${device.modelName || cleanDeviceId} (${cleanPlatform})`);
    return sendSuccessResponse(res, 200, "Mobile device details synchronized successfully", device);
  } catch (error) {
    logger.error("Error syncing mobile detail:", error);
    return sendErrorResponse(res, 500, "Failed to synchronize mobile device details");
  }
}

export async function getUserDevices(req, res) {
  try {
    const currentUserId = req.user._id;
    const devices = await MobileDetail.find({ user: currentUserId, isActive: true })
      .sort({ lastActiveAt: -1 })
      .lean();

    return sendSuccessResponse(res, 200, "User devices retrieved successfully", devices);
  } catch (error) {
    logger.error("Error fetching user devices:", error);
    return sendErrorResponse(res, 500, "Failed to retrieve user devices");
  }
}

export async function deactivateDevice(req, res) {
  try {
    const currentUserId = req.user._id;
    const { deviceId } = req.params;

    if (!deviceId) {
      return sendErrorResponse(res, 400, "Device ID is required");
    }

    const existingDevice = await MobileDetail.findOne({ user: currentUserId, deviceId });
    if (existingDevice) {
      const oldPushToken = existingDevice.pushToken;
      existingDevice.isActive = false;
      existingDevice.pushToken = null;
      await existingDevice.save();

      if (oldPushToken) {
        await User.updateOne(
          { _id: currentUserId },
          { $pull: { fcmTokens: { token: oldPushToken } } }
        );
      }
    }

    return sendSuccessResponse(res, 200, "Device deactivated successfully", {});
  } catch (error) {
    logger.error("Error deactivating device:", error);
    return sendErrorResponse(res, 500, "Failed to deactivate device");
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
        "fullName profilePic city primaryRole preferredLocalities propertyTypePreferences budgetMin budgetMax listingIntent homeBase travelStyle travelInterests favoriteDestinations location isOwnerVerified"
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

export async function getMutualFriendsList(req, res) {
  try {
    const { id: targetUserId } = req.params;
    const currentUserId = req.user._id;

    if (!targetUserId) {
      return sendErrorResponse(res, 400, "User ID is required");
    }

    const [currentUser, targetUser] = await Promise.all([
      User.findById(currentUserId).select("friends").lean(),
      User.findById(targetUserId).select("friends").lean(),
    ]);

    if (!targetUser) {
      return sendErrorResponse(res, 404, "User not found");
    }

    const targetFriendSet = new Set((targetUser.friends || []).map(String));
    const mutualFriendIds = (currentUser?.friends || []).filter((id) =>
      targetFriendSet.has(String(id))
    );

    if (mutualFriendIds.length === 0) {
      return sendSuccessResponse(res, 200, "Mutual friends fetched successfully", {
        mutualFriends: [],
        count: 0,
      });
    }

    const limit = Math.min(Number(req.query.limit) || 50, 100);
    const mutualFriends = await User.find({ _id: { $in: mutualFriendIds } })
      .select("fullName profilePic city primaryRole activeRole isOwnerVerified")
      .limit(limit)
      .lean();

    return sendSuccessResponse(res, 200, "Mutual friends fetched successfully", {
      mutualFriends: mutualFriends.map((u) => ({
        _id: String(u._id),
        fullName: u.fullName || "User",
        profilePic: u.profilePic || "",
        city: u.city || "",
        primaryRole: u.primaryRole || "",
        activeRole: u.activeRole || "",
        isOwnerVerified: Boolean(u.isOwnerVerified),
      })),
      count: mutualFriends.length,
    });
  } catch (error) {
    logger.error("Error fetching mutual friends list:", error);
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
        "fullName bio profilePic city primaryRole activeRole userRoles preferredLocalities propertyTypePreferences listingIntent budgetMin budgetMax createdAt isVerified isOwnerVerified ratingAvg ratingCount friends"
      )
      .lean();

    if (!user) {
      return sendErrorResponse(res, 404, "User not found");
    }

    const targetFriends = Array.isArray(user.friends) ? user.friends : [];
    delete user.friends;

    const followersCount = targetFriends.length;
    const followingCount = targetFriends.length;

    // Run independent database counts & queries concurrently
    const [postsCount, currentUser, savedCount, userPosts] = await Promise.all([
      PropertyPost.countDocuments({
        author: targetUserId,
        ...publishedPostFilter,
      }),
      User.findById(currentUserId).select("friends").lean(),
      PropertyPost.countDocuments({
        savedBy: targetUserId,
        ...publishedPostFilter,
      }),
      PropertyPost.find({
        author: targetUserId,
        ...publishedPostFilter,
      }).select("likesCount").lean(),
    ]);

    const likesCount = userPosts.reduce((sum, post) => sum + (post.likesCount || 0), 0);

    const isSelf = String(currentUserId) === String(targetUserId);
    let connectionStatus = "none";
    let mutualFriends = {
      count: 0,
      preview: [],
    };

    logger.debug("Profile check", { currentUserId, targetUserId, isSelf });

    if (!isSelf) {
      const isFriend = (currentUser?.friends || []).some(
        (friendId) => String(friendId) === String(targetUserId)
      );

      // Compute Instagram-style mutual friends
      const targetFriendIds = new Set(targetFriends.map((id) => String(id)));
      const mutualFriendIds = (currentUser?.friends || [])
        .map((id) => String(id))
        .filter((id) => targetFriendIds.has(id));

      if (mutualFriendIds.length > 0) {
        const previewUsers = await User.find({ _id: { $in: mutualFriendIds.slice(0, 3) } })
          .select("fullName profilePic isOwnerVerified")
          .lean();

        mutualFriends = {
          count: mutualFriendIds.length,
          preview: previewUsers.map((u) => ({
            _id: String(u._id),
            fullName: u.fullName || "User",
            profilePic: u.profilePic || "",
            isOwnerVerified: Boolean(u.isOwnerVerified),
          })),
        };
      }

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
        mutualFriends,
      },
      mutualFriends,
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
      .populate("author", "fullName profilePic isVerified isOwnerVerified")
      .limit(20)
      .lean();

    // Get posts saved by user with timestamps
    const savedPosts = await PropertyPost.find({
      savedBy: currentUserId,
      ...publishedPostFilter,
    })
      .select("title price city mediaUrls author createdAt savedByTimestamps")
      .populate("author", "fullName profilePic isVerified isOwnerVerified")
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
