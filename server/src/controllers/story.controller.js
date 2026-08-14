import Story from "../models/Story.model.js";
import PropertyPost from "../models/PropertyPost.model.js";
import User from "../models/User.model.js";
import { logger } from "../utils/logger.js";

// Create a new story
export const createStory = async (req, res) => {
  try {
    const { mediaUrl, mediaType, caption, visibility, propertyId, linkUrl } = req.body;
    const userId = req.user._id;

    // Validate required fields
    if (!mediaUrl) {
      return res.status(400).json({
        success: false,
        message: "Media URL is required",
      });
    }

    // Set expiry to 24 hours from now
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);

    const story = await Story.create({
      author: userId,
      authorRole: req.user.activeRole || req.user.primaryRole,
      mediaUrl,
      mediaType: mediaType || "image",
      caption: caption || "",
      visibility: visibility || "public",
      propertyId: propertyId || null,
      linkUrl: linkUrl || "",
      expiresAt,
    });

    // Populate author details
    await story.populate("author", "fullName profilePic isVerified activeRole primaryRole");

    logger.info(`Story created by user ${userId}`);

    res.status(201).json({
      success: true,
      message: "Story created successfully",
      data: { story },
    });
  } catch (error) {
    logger.error("Error creating story:", error);
    res.status(500).json({
      success: false,
      message: "Failed to create story",
      error: error.message,
    });
  }
};

// Get all active stories (feed)
export const getActiveStories = async (req, res) => {
  try {
    const { limit = 50 } = req.query;
    const userId = req.user._id;

    // Get current user's following list
    const currentUser = await User.findById(userId).select('friends').lean();
    const followingIds = currentUser?.friends || [];

    const query = {
      isActive: true,
      expiresAt: { $gt: new Date() },
      $or: [
        { visibility: "public" },
        { visibility: "private", author: { $in: followingIds } },
        { visibility: "private", author: userId }, // Show own private stories
      ],
    };

    const stories = await Story.find(query)
      .populate("author", "fullName profilePic isVerified activeRole primaryRole")
      .populate("propertyId", "title price city listingType")
      .sort({ createdAt: -1 })
      .limit(Number(limit));

    // Mark stories as viewed by current user
    const storyIds = stories.map((s) => s._id);
    if (storyIds.length > 0) {
      await Story.updateMany(
        { _id: { $in: storyIds }, viewedBy: { $ne: userId } },
        {
          $push: { viewedBy: userId },
          $inc: { viewCount: 1 },
        }
      );
    }

    res.status(200).json({
      success: true,
      data: { stories },
    });
  } catch (error) {
    logger.error("Error fetching stories:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch stories",
      error: error.message,
    });
  }
};

// Get stories by specific author
export const getUserStories = async (req, res) => {
  try {
    const { userId } = req.params;
    const currentUserId = req.user._id;

    const stories = await Story.find({
      author: userId,
      isActive: true,
      expiresAt: { $gt: new Date() },
    })
      .populate("author", "fullName profilePic isVerified activeRole primaryRole")
      .populate("propertyId", "title price city listingType")
      .sort({ createdAt: -1 });

    // Mark as viewed
    const storyIds = stories.map((s) => s._id);
    if (storyIds.length > 0) {
      await Story.updateMany(
        { _id: { $in: storyIds }, viewedBy: { $ne: currentUserId } },
        {
          $push: { viewedBy: currentUserId },
          $inc: { viewCount: 1 },
        }
      );
    }

    res.status(200).json({
      success: true,
      data: { stories },
    });
  } catch (error) {
    logger.error("Error fetching user stories:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch user stories",
      error: error.message,
    });
  }
};

// Get current user's stories
export const getMyStories = async (req, res) => {
  try {
    const userId = req.user._id;

    const stories = await Story.find({
      author: userId,
    })
      .populate("propertyId", "title price city listingType")
      .sort({ createdAt: -1 });

    // Separate active and expired
    const now = new Date();
    const activeStories = stories.filter((s) => s.expiresAt > now && s.isActive);
    const expiredStories = stories.filter((s) => s.expiresAt <= now || !s.isActive);

    res.status(200).json({
      success: true,
      data: {
        activeStories,
        expiredStories,
        total: stories.length,
      },
    });
  } catch (error) {
    logger.error("Error fetching my stories:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch your stories",
      error: error.message,
    });
  }
};

// Toggle like on a story
export const toggleStoryLike = async (req, res) => {
  try {
    const { storyId } = req.params;
    const userId = req.user._id;

    const story = await Story.findById(storyId);

    if (!story) {
      return res.status(404).json({
        success: false,
        message: "Story not found",
      });
    }

    const hasLiked = story.likedBy.some((id) => String(id) === String(userId));

    if (hasLiked) {
      story.likedBy = story.likedBy.filter((id) => String(id) !== String(userId));
    } else {
      story.likedBy.push(userId);
    }

    await story.save();

    res.status(200).json({
      success: true,
      message: "Story like status updated",
      data: {
        liked: !hasLiked,
        likesCount: story.likedBy.length,
      },
    });
  } catch (error) {
    logger.error("Error toggling story like:", error);
    res.status(500).json({
      success: false,
      message: "Failed to update story like",
      error: error.message,
    });
  }
};

// Get the users who liked a story — restricted to the story's own author
export const getStoryLikes = async (req, res) => {
  try {
    const { storyId } = req.params;
    const userId = req.user._id;

    const story = await Story.findById(storyId).populate("likedBy", "fullName profilePic city");

    if (!story) {
      return res.status(404).json({
        success: false,
        message: "Story not found",
      });
    }

    if (String(story.author) !== String(userId)) {
      return res.status(403).json({
        success: false,
        message: "Only the story owner can view its likes",
      });
    }

    res.status(200).json({
      success: true,
      data: { likes: story.likedBy },
    });
  } catch (error) {
    logger.error("Error fetching story likes:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch story likes",
      error: error.message,
    });
  }
};

// Delete a story
export const deleteStory = async (req, res) => {
  try {
    const { storyId } = req.params;
    const userId = req.user._id;

    const story = await Story.findOne({ _id: storyId, author: userId });

    if (!story) {
      return res.status(404).json({
        success: false,
        message: "Story not found or unauthorized",
      });
    }

    await Story.findByIdAndDelete(storyId);

    logger.info(`Story ${storyId} deleted by user ${userId}`);

    res.status(200).json({
      success: true,
      message: "Story deleted successfully",
    });
  } catch (error) {
    logger.error("Error deleting story:", error);
    res.status(500).json({
      success: false,
      message: "Failed to delete story",
      error: error.message,
    });
  }
};

// Upload story media
export const uploadStoryMedia = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: "No file uploaded",
      });
    }

    const mediaUrl = req.file.path;
    const mediaType = req.file.mimetype.startsWith("video") ? "video" : "image";

    res.status(200).json({
      success: true,
      message: "Media uploaded successfully",
      data: {
        mediaUrl,
        mediaType,
      },
    });
  } catch (error) {
    logger.error("Error uploading story media:", error);
    res.status(500).json({
      success: false,
      message: "Failed to upload media",
      error: error.message,
    });
  }
};
