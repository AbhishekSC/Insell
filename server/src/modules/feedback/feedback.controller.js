import { createFeedback as createFeedbackService } from "./feedback.service.js";
import { sendSuccessResponse, sendErrorResponse } from "../../utils/responseHandler.js";
import { logger } from "../../utils/logger.js";

/**
 * POST handler — create user feedback (optional screenshot via multer/Cloudinary).
 */
export async function createFeedback(req, res) {
  try {
    const message = String(req.body?.message || "").trim();
    const page = String(req.body?.page || "").trim();

    const result = await createFeedbackService({
      reporterId: req.user._id,
      message,
      page,
      screenshotUrl: req.file?.path || null,
    });

    if (result.error) {
      return sendErrorResponse(res, result.error.status, result.error.message);
    }

    return sendSuccessResponse(res, 201, "Thanks — we've received your feedback", {
      feedbackId: result.feedbackId,
    });
  } catch (error) {
    logger.error("Error creating feedback:", error);
    return sendErrorResponse(res, 500, "Internal Server Error");
  }
}
