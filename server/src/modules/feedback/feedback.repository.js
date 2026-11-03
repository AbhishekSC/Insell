import Feedback from "../../models/Feedback.model.js";

/**
 * Create a new feedback document.
 * @param {Object} data - { reporter, message, page, screenshotUrl }
 * @returns {Promise<Object>} The created feedback document.
 */
export async function createFeedback(data) {
  return Feedback.create(data);
}
