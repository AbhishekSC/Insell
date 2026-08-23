import Highlight from "../models/Highlight.model.js";
import Story from "../models/Story.model.js";
import { logger } from "../utils/logger.js";
import { sendSuccessResponse, sendErrorResponse } from "../utils/responseHandler.js";

// Only your own story can become a highlight, and only while the document
// still exists — once Mongo's TTL sweep actually deletes it there's nothing
// left to highlight (no general "archive" of every past story in this app).
// Deliberately NOT rejecting a story whose expiresAt has technically passed
// but hasn't been swept yet (the TTL background task runs periodically, not
// instantly, so there's normally up to ~60s of slack after expiry) — this is
// what actually fixes the race where a story goes stale mid highlight-creation.
async function claimStoryForHighlight(storyId, userId) {
  const story = await Story.findOne({ _id: storyId, author: userId });
  if (!story) return null;

  // Unset rather than null/far-future date — MongoDB's TTL monitor skips
  // documents that don't have the indexed field at all, so this is what
  // makes the story permanent. Also acts as a defensive fallback in case
  // the client's earlier pin call somehow didn't land.
  if (story.expiresAt) {
    await Story.updateOne({ _id: story._id }, { $unset: { expiresAt: 1 } });
  }
  return story;
}

// POST /api/highlights — create a new highlight from one of your own active stories
export const createHighlight = async (req, res) => {
  try {
    const userId = req.user._id;
    const title = String(req.body?.title || "").trim();
    const storyId = req.body?.storyId;

    if (!title) {
      return sendErrorResponse(res, 400, "Highlight title is required");
    }
    if (!storyId) {
      return sendErrorResponse(res, 400, "storyId is required");
    }

    const story = await claimStoryForHighlight(storyId, userId);
    if (!story) {
      return sendErrorResponse(res, 400, "That story is unavailable or has already expired");
    }

    const highlight = await Highlight.create({
      owner: userId,
      title: title.slice(0, 30),
      coverImage: story.mediaUrl,
      stories: [story._id],
    });

    return sendSuccessResponse(res, 201, "Highlight created successfully", { highlight });
  } catch (error) {
    logger.error("Error creating highlight:", error);
    return sendErrorResponse(res, 500, "Internal Server Error");
  }
};

// POST /api/highlights/:id/stories — add another of your own active stories to an existing highlight
export const addStoryToHighlight = async (req, res) => {
  try {
    const userId = req.user._id;
    const { id } = req.params;
    const storyId = req.body?.storyId;

    if (!storyId) {
      return sendErrorResponse(res, 400, "storyId is required");
    }

    const highlight = await Highlight.findOne({ _id: id, owner: userId });
    if (!highlight) {
      return sendErrorResponse(res, 404, "Highlight not found");
    }

    const story = await claimStoryForHighlight(storyId, userId);
    if (!story) {
      return sendErrorResponse(res, 400, "That story is unavailable or has already expired");
    }

    if (!highlight.stories.some((existingId) => String(existingId) === String(story._id))) {
      highlight.stories.push(story._id);
      await highlight.save();
    }

    return sendSuccessResponse(res, 200, "Story added to highlight", { highlight });
  } catch (error) {
    logger.error("Error adding story to highlight:", error);
    return sendErrorResponse(res, 500, "Internal Server Error");
  }
};

// DELETE /api/highlights/:id/stories/:storyId — remove one story from a highlight
// (the story itself stays permanent — it doesn't get deleted or re-expired,
// same mental model as Instagram pulling highlights from a permanent archive)
export const removeStoryFromHighlight = async (req, res) => {
  try {
    const userId = req.user._id;
    const { id, storyId } = req.params;

    const highlight = await Highlight.findOne({ _id: id, owner: userId });
    if (!highlight) {
      return sendErrorResponse(res, 404, "Highlight not found");
    }

    highlight.stories = highlight.stories.filter((existingId) => String(existingId) !== String(storyId));
    await highlight.save();

    return sendSuccessResponse(res, 200, "Story removed from highlight", { highlight });
  } catch (error) {
    logger.error("Error removing story from highlight:", error);
    return sendErrorResponse(res, 500, "Internal Server Error");
  }
};

// GET /api/highlights/user/:userId — summary list for a profile's highlight row
export const getUserHighlights = async (req, res) => {
  try {
    const { userId } = req.params;

    const highlights = await Highlight.find({ owner: userId, stories: { $ne: [] } })
      .select("title coverImage stories createdAt")
      .sort({ createdAt: -1 })
      .lean();

    const summarized = highlights.map((h) => ({
      _id: h._id,
      title: h.title,
      coverImage: h.coverImage,
      storyCount: h.stories.length,
      createdAt: h.createdAt,
    }));

    return sendSuccessResponse(res, 200, "Highlights fetched successfully", { highlights: summarized });
  } catch (error) {
    logger.error("Error fetching user highlights:", error);
    return sendErrorResponse(res, 500, "Internal Server Error");
  }
};

// GET /api/highlights/:id — full detail with populated stories, for the viewer
export const getHighlightById = async (req, res) => {
  try {
    const { id } = req.params;

    const highlight = await Highlight.findById(id).populate({
      path: "stories",
      populate: [
        { path: "author", select: "fullName profilePic isVerified activeRole primaryRole" },
        { path: "propertyId", select: "title price city listingType" },
      ],
    });

    if (!highlight) {
      return sendErrorResponse(res, 404, "Highlight not found");
    }

    return sendSuccessResponse(res, 200, "Highlight fetched successfully", { highlight });
  } catch (error) {
    logger.error("Error fetching highlight:", error);
    return sendErrorResponse(res, 500, "Internal Server Error");
  }
};

// PATCH /api/highlights/:id — rename and/or change cover
export const updateHighlight = async (req, res) => {
  try {
    const userId = req.user._id;
    const { id } = req.params;

    const highlight = await Highlight.findOne({ _id: id, owner: userId });
    if (!highlight) {
      return sendErrorResponse(res, 404, "Highlight not found");
    }

    if (req.body?.title !== undefined) {
      const title = String(req.body.title).trim();
      if (!title) {
        return sendErrorResponse(res, 400, "Highlight title cannot be empty");
      }
      highlight.title = title.slice(0, 30);
    }
    if (req.body?.coverImage !== undefined) {
      highlight.coverImage = String(req.body.coverImage).trim();
    }

    await highlight.save();
    return sendSuccessResponse(res, 200, "Highlight updated successfully", { highlight });
  } catch (error) {
    logger.error("Error updating highlight:", error);
    return sendErrorResponse(res, 500, "Internal Server Error");
  }
};

// DELETE /api/highlights/:id — deletes the grouping only; underlying stories stay permanent
export const deleteHighlight = async (req, res) => {
  try {
    const userId = req.user._id;
    const { id } = req.params;

    const result = await Highlight.deleteOne({ _id: id, owner: userId });
    if (result.deletedCount === 0) {
      return sendErrorResponse(res, 404, "Highlight not found");
    }

    return sendSuccessResponse(res, 200, "Highlight deleted successfully");
  } catch (error) {
    logger.error("Error deleting highlight:", error);
    return sendErrorResponse(res, 500, "Internal Server Error");
  }
};
