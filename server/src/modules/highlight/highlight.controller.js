import { logger } from "../../utils/logger.js";
import { sendSuccessResponse, sendErrorResponse } from "../../utils/responseHandler.js";
import * as highlightService from "./highlight.service.js";

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

    const result = await highlightService.createHighlight(userId, title, storyId);
    if (result.error) {
      return sendErrorResponse(res, result.error.status, result.error.message);
    }

    return sendSuccessResponse(res, 201, "Highlight created successfully", { highlight: result.highlight });
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

    const result = await highlightService.addStoryToHighlight(userId, id, storyId);
    if (result.error) {
      return sendErrorResponse(res, result.error.status, result.error.message);
    }

    return sendSuccessResponse(res, 200, "Story added to highlight", { highlight: result.highlight });
  } catch (error) {
    logger.error("Error adding story to highlight:", error);
    return sendErrorResponse(res, 500, "Internal Server Error");
  }
};

// DELETE /api/highlights/:id/stories/:storyId — remove one story from a highlight
export const removeStoryFromHighlight = async (req, res) => {
  try {
    const userId = req.user._id;
    const { id, storyId } = req.params;

    const result = await highlightService.removeStoryFromHighlight(userId, id, storyId);
    if (result.error) {
      return sendErrorResponse(res, result.error.status, result.error.message);
    }

    return sendSuccessResponse(res, 200, "Story removed from highlight", { highlight: result.highlight });
  } catch (error) {
    logger.error("Error removing story from highlight:", error);
    return sendErrorResponse(res, 500, "Internal Server Error");
  }
};

// GET /api/highlights/user/:userId — summary list for a profile's highlight row
export const getUserHighlights = async (req, res) => {
  try {
    const { userId } = req.params;

    const result = await highlightService.getUserHighlights(userId, req.user._id);
    if (result.error) {
      return sendErrorResponse(res, result.error.status, result.error.message);
    }

    return sendSuccessResponse(res, 200, "Highlights fetched successfully", { highlights: result.highlights });
  } catch (error) {
    logger.error("Error fetching user highlights:", error);
    return sendErrorResponse(res, 500, "Internal Server Error");
  }
};

// GET /api/highlights/:id — full detail with populated stories, for the viewer
export const getHighlightById = async (req, res) => {
  try {
    const { id } = req.params;

    const result = await highlightService.getHighlightById(id, req.user._id);
    if (result.error) {
      return sendErrorResponse(res, result.error.status, result.error.message);
    }

    return sendSuccessResponse(res, 200, "Highlight fetched successfully", { highlight: result.highlight });
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

    const result = await highlightService.updateHighlight(userId, id, req.body);
    if (result.error) {
      return sendErrorResponse(res, result.error.status, result.error.message);
    }

    return sendSuccessResponse(res, 200, "Highlight updated successfully", { highlight: result.highlight });
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

    const result = await highlightService.deleteHighlight(userId, id);
    if (result.error) {
      return sendErrorResponse(res, result.error.status, result.error.message);
    }

    return sendSuccessResponse(res, 200, "Highlight deleted successfully");
  } catch (error) {
    logger.error("Error deleting highlight:", error);
    return sendErrorResponse(res, 500, "Internal Server Error");
  }
};
