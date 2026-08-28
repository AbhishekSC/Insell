import Feedback from "../models/Feedback.model.js";
import { logger } from "../utils/logger.js";
import { sendSuccessResponse, sendErrorResponse } from "../utils/responseHandler.js";

// User-facing "Report Issue" submission — optional screenshot goes through
// uploadFeedbackScreenshot (multer/Cloudinary) ahead of this handler, so
// req.file is already uploaded by the time we get here.
export const createFeedback = async (req, res) => {
  try {
    const message = String(req.body?.message || "").trim();
    const page = String(req.body?.page || "").trim();

    if (!message) {
      return sendErrorResponse(res, 400, "Please describe the issue");
    }

    const feedback = await Feedback.create({
      reporter: req.user._id,
      message,
      page,
      screenshotUrl: req.file?.path || null,
    });

    return sendSuccessResponse(res, 201, "Thanks — we've received your feedback", { feedbackId: feedback._id });
  } catch (error) {
    logger.error("Error creating feedback:", error);
    return sendErrorResponse(res, 500, "Internal Server Error");
  }
};
