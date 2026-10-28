import { Worker } from "bullmq";
import { getBullRedisConnection } from "../config/bullmq.config.js";
import { getQueue, closeAllQueues, QUEUE_NAMES } from "./queues.js";
import { createFailedHandler } from "./dlq.js";
import { processEmailJob } from "./workers/email.worker.js";
import { processNotificationJob } from "./workers/notification.worker.js";
import { processCleanupJob } from "./workers/cleanup.worker.js";
import { processFanoutJob } from "./workers/fanout.worker.js";
import { processIngestionJob, flushEngagementToMongo } from "./workers/ingestion.worker.js";
import { logger } from "../utils/logger.js";

const _workers = [];

function createWorker(queueName, processor, concurrency = 3) {
  const connection = getBullRedisConnection();
  if (!connection) {
    logger.warn(`[Jobs] No Redis connection — skipping worker for ${queueName}`);
    return null;
  }

  const worker = new Worker(queueName, processor, { connection, concurrency });

  worker.on("failed", createFailedHandler(queueName));
  worker.on("error", (err) => {
    logger.warn(`[Jobs] Worker [${queueName}] error (non-fatal): ${err?.message || err}`);
  });

  _workers.push(worker);
  return worker;
}

async function scheduleRepeatableJobs() {
  const ingestionQueue = getQueue(QUEUE_NAMES.INGESTION);
  if (!ingestionQueue) return;

  try {
    await ingestionQueue.add("flush-dirty-engagement", {}, {
      repeat: { every: 30_000 },
      jobId: "engagement_flush_repeatable",
    });

    await ingestionQueue.add("rebuild-hot-feed", {}, {
      repeat: { every: 2 * 60_000 },
      jobId: "hot_feed_rebuild_repeatable",
    });

    await ingestionQueue.add("sweep-active-users", {}, {
      repeat: { every: 2 * 60 * 60_000 },
      jobId: "recommendation_sweep_repeatable",
    });

    logger.info("[Jobs] Repeatable jobs scheduled (flush 30s, hot-feed 2m, recommendation 2h)");
  } catch (err) {
    logger.warn(`[Jobs] Failed to schedule repeatable jobs: ${err?.message}`);
  }
}

export async function initAllWorkers() {
  const connection = getBullRedisConnection();
  if (!connection) {
    logger.warn("[Jobs] Redis unavailable — workers not started");
    return;
  }

  createWorker(QUEUE_NAMES.EMAIL, processEmailJob, 5);
  createWorker(QUEUE_NAMES.NOTIFICATION, processNotificationJob, 5);
  createWorker(QUEUE_NAMES.CLEANUP, processCleanupJob, 3);
  createWorker(QUEUE_NAMES.FANOUT, processFanoutJob, 3);
  createWorker(QUEUE_NAMES.INGESTION, processIngestionJob, 1);

  await scheduleRepeatableJobs();

  logger.info(`[Jobs] ${_workers.length} workers initialized across ${Object.keys(QUEUE_NAMES).length - 1} queues`);
}

export async function shutdownAllWorkers() {
  if (_workers.length > 0) {
    try {
      await flushEngagementToMongo();
    } catch (err) {
      logger.warn(`[Jobs] Final engagement flush failed: ${err?.message}`);
    }
  }

  await Promise.allSettled(_workers.map((w) => w.close()));
  _workers.length = 0;

  await closeAllQueues();
  logger.info("[Jobs] All workers and queues shut down");
}
