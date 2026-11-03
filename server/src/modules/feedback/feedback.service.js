import { createFeedback as createFeedbackInDb } from "./feedback.repository.js";

/**
 * Validate and create user feedback.
 * @param {Object} params
 * @param {string} params.reporterId - The ID of the reporting user.
 * @param {string} params.message - The feedback message body.
 * @param {string} params.page - The page the feedback was submitted from.
 * @param {string|null} params.screenshotUrl - Optional screenshot URL.
 * @returns {Promise<{error?: {status: number, message: string}, feedbackId?: string}>}
 */
export async function createFeedback({ reporterId, message, page, screenshotUrl }) {
  if (!message) {
    return { error: { status: 400, message: "Please describe the issue" } };
  }

  const feedback = await createFeedbackInDb({
    reporter: reporterId,
    message,
    page,
    screenshotUrl,
  });

  return { feedbackId: feedback._id };
}
