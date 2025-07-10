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
        { $_id: { $ne: currentUser.friends } }, // exclude current user's friends
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

export async function getMyFriends(req, res) {}
