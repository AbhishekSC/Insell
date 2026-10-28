import { getQueue, QUEUE_NAMES } from "./queues.js";
import { logger } from "../utils/logger.js";

export async function moveToDeadLetter(job, error, sourceQueue) {
  try {
    const dlq = getQueue(QUEUE_NAMES.DLQ);
    if (!dlq) return;

    await dlq.add("dead-letter", {
      originalJobId: job.id,
      originalJobName: job.name,
      sourceQueue,
      data: job.data,
      failedReason: error?.message,
      attemptsMade: job.attemptsMade,
      failedAt: new Date().toISOString(),
    });

    logger.error(`Job ${job.id} [${job.name}] moved to DLQ from [${sourceQueue}] after ${job.attemptsMade} attempts`);
  } catch (dlqErr) {
    logger.error(`Failed to move job ${job.id} to DLQ: ${dlqErr?.message}`);
  }
}

export function createFailedHandler(queueName) {
  return async (job, err) => {
    logger.warn(`Job ${job?.id} [${job?.name}] failed in [${queueName}] on attempt ${job?.attemptsMade}: ${err?.message}`);
    if (job && job.attemptsMade >= (job.opts?.attempts || 3)) {
      await moveToDeadLetter(job, err, queueName);
    }
  };
}
