import FriendRequest from "../models/FriendRequest.model.js";
import User from "../models/User.model.js";
import { logger } from "../utils/logger.js";
import {
  sendErrorResponse,
  sendSuccessResponse,
} from "../utils/responseHandler.js";

export async function getRecommendedUsers(req, res) {
  try {
    const currentUserId = req.user._id;
    const currentUser = req.user;
    logger.info(`Fetching recommended users for user ID: ${currentUserId}`);

    // Fetch users who are not the current user and are onboarded
    const recommendedUsers = await User.find({
      $and: [
        { _id: { $ne: currentUserId } }, // exclude current user
        { $id: { $nin: currentUser.friends } }, // exclude current user's friends
        { isOnboarded: true }, // only onboarded users
      ],
    });

    return sendSuccessResponse(
      res,
      200,
      "Recommended users fetched successfully",
      {
        users: recommendedUsers,
      }
    );
  } catch (error) {
    logger.error("Error fetching recommended users:", error);
    return sendErrorResponse(res, 500, "Internal Server Error");
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
        "fullName profilePic nativeLanguage learningLanguage location"
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
      "fullName profilePic nativeLanguage learningLanguage location"
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
      "fullName profilePic nativeLanguage learningLanguage location"
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
