import { getQueue, QUEUE_NAMES } from "../queues.js";
import { logger } from "../../utils/logger.js";

export async function enqueueEmail(type, payload, options = {}) {
  try {
    const q = getQueue(QUEUE_NAMES.EMAIL);
    if (!q) {
      logger.warn(`Email queue unavailable, dropping ${type} email to ${payload?.email}`);
      return null;
    }
    return await q.add(type, { type, ...payload }, options);
  } catch (err) {
    logger.warn(`Failed to enqueue ${type} email: ${err?.message}`);
    return null;
  }
}

export async function enqueueWelcomeEmail(email, name) {
  return enqueueEmail("welcome", { email, name });
}

export async function enqueueOTPEmail(email, otp, variant = "login") {
  return enqueueEmail(`otp-${variant}`, { email, otp, variant }, {
    jobId: `otp:${variant}:${email}`,
  });
}

export async function enqueueGenericEmail(email, subject, htmlContent) {
  return enqueueEmail("generic", { email, subject, htmlContent });
}

export async function enqueueVisitConfirmationEmail(emails) {
  return enqueueEmail("visit-confirmation", { emails });
}
