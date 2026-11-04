import { logger } from "../../utils/logger.js";
import { extractPublicIdFromUrl } from "../../config/cloudinary.js";
import * as repo from "./story.repository.js";
import {
  calculateExpiry,
  separateActiveAndExpired,
  buildViewersWithLikeStatus,
  enqueueMediaCleanup,
  cleanupExpiredStoriesBatch,
  buildActiveStoriesQuery,
} from "./story.service.js";

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

    const expiresAt = calculateExpiry();

    const story = await repo.createStory({
      author: userId,
      authorRole: req.user.activeRole || req.user.primaryRole,
      mediaUrl,
      mediaType: mediaType || "image",
      caption: caption || "",
      visibility: visibility || "public",
      propertyId: propertyId || null,
      linkUrl: linkUrl || "",
      expiresAt,
      feedExpiresAt: expiresAt,
    });

    // Populate author details
    await story.populate("author", "fullName profilePic isVerified isOwnerVerified activeRole primaryRole");

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
    const currentUser = await repo.findUserById(userId);
    const followingIds = currentUser?.friends || [];

    const query = buildActiveStoriesQuery(userId, followingIds);

    const stories = (await repo.findActiveStories(query, limit)) || [];

    // Mark stories as viewed by current user
    const storyIds = stories.map((s) => s._id);
    if (storyIds.length > 0) {
      await repo.markStoriesAsViewed(storyIds, userId);
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

    const stories = (await repo.findUserActiveStories(userId)) || [];

    // Mark as viewed
    const storyIds = stories.map((s) => s._id);
    if (storyIds.length > 0) {
      await repo.markStoriesAsViewed(storyIds, currentUserId);
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

    const stories = (await repo.findAllUserStories(userId)) || [];

    const { activeStories, expiredStories } = separateActiveAndExpired(stories);

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

    const story = await repo.findStoryById(storyId);

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

    const story = await repo.findStoryByIdWithLikes(storyId);

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

// Story viewers, most-recent-first (viewedBy is append-only)
export const getStoryViewers = async (req, res) => {
  try {
    const { storyId } = req.params;
    const userId = req.user._id;

    const story = await repo.findStoryByIdWithViewers(storyId);

    if (!story) {
      return res.status(404).json({
        success: false,
        message: "Story not found",
      });
    }

    if (String(story.author) !== String(userId)) {
      return res.status(403).json({
        success: false,
        message: "Only the story owner can view its viewers",
      });
    }

    const viewers = buildViewersWithLikeStatus(story);

    res.status(200).json({
      success: true,
      data: { viewers },
    });
  } catch (error) {
    logger.error("Error fetching story viewers:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch story viewers",
      error: error.message,
    });
  }
};

// Delete a story
export const deleteStory = async (req, res) => {
  try {
    const { storyId } = req.params;
    const userId = req.user._id;

    const story = await repo.findStoryByAuthor(storyId, userId);

    if (!story) {
      return res.status(404).json({
        success: false,
        message: "Story not found or unauthorized",
      });
    }

    await repo.deleteStoryById(storyId);

    const publicId = extractPublicIdFromUrl(story.mediaUrl);
    if (publicId) {
      enqueueMediaCleanup(publicId);
    }

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

// POST /stories/cron/cleanup-expired   (header: x-cron-secret)
export const cleanupExpiredStories = async (req, res) => {
  try {
    const secret = process.env.CRON_SECRET;
    if (!secret || req.get("x-cron-secret") !== secret) {
      return res.status(401).json({ success: false, message: "Unauthorized" });
    }

    const expired = (await repo.findExpiredStories(500)) || [];

    if (expired.length) {
      await cleanupExpiredStoriesBatch(expired);
    }
    const cleaned = expired.length;

    logger.info(`Story cleanup: removed ${cleaned} expired stories and their Cloudinary media`);
    res.status(200).json({ success: true, data: { cleaned } });
  } catch (error) {
    logger.error("Error cleaning up expired stories:", error);
    res.status(500).json({
      success: false,
      message: "Failed to clean up expired stories",
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
