import { logger } from "../../utils/logger.js";

export async function processDlqJob(job) {
  const { originalJobId, originalJobName, sourceQueue, data, failedReason, attemptsMade, failedAt } = job.data;

  logger.error({
    msg: "dead_letter",
    originalJobId,
    originalJobName,
    sourceQueue,
    failedReason,
    attemptsMade,
    failedAt,
    payload: data,
  });

  try {
    const DeadLetter = (await import("../../models/DeadLetter.model.js")).default;
    await DeadLetter.create({
      originalJobId,
      jobName: originalJobName,
      sourceQueue,
      payload: data,
      failedReason,
      attemptsMade,
      failedAt: failedAt ? new Date(failedAt) : new Date(),
    });
  } catch (err) {
    logger.warn(`[DLQ] Failed to persist dead letter to MongoDB: ${err?.message}`);
  }
}
