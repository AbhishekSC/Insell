import { Queue } from "bullmq";
import { getBullRedisConnection } from "../config/bullmq.config.js";
import { logger } from "../utils/logger.js";

export const QUEUE_NAMES = {
  EMAIL: "insell-email",
  NOTIFICATION: "insell-notification",
  CLEANUP: "insell-cleanup",
  FANOUT: "insell-fanout",
  INGESTION: "insell-ingestion",
  DLQ: "insell-dlq",
};

const DEFAULT_JOB_OPTIONS = {
  [QUEUE_NAMES.EMAIL]: {
    attempts: 3,
    backoff: { type: "exponential", delay: 2000 },
    removeOnComplete: 500,
    removeOnFail: 100,
  },
  [QUEUE_NAMES.NOTIFICATION]: {
    attempts: 3,
    backoff: { type: "exponential", delay: 2000 },
    removeOnComplete: 1000,
    removeOnFail: 100,
  },
  [QUEUE_NAMES.CLEANUP]: {
    attempts: 3,
    backoff: { type: "exponential", delay: 3000 },
    removeOnComplete: 50,
    removeOnFail: 50,
  },
  [QUEUE_NAMES.FANOUT]: {
    attempts: 3,
    backoff: { type: "exponential", delay: 2000 },
    removeOnComplete: 200,
    removeOnFail: 100,
  },
  [QUEUE_NAMES.INGESTION]: {
    attempts: 2,
    backoff: { type: "fixed", delay: 3000 },
    removeOnComplete: 50,
    removeOnFail: 50,
  },
};

const _queues = {};

export function getQueue(name) {
  if (_queues[name]) return _queues[name];

  const connection = getBullRedisConnection();
  if (!connection) return null;

  const queue = new Queue(name, {
    connection,
    defaultJobOptions: DEFAULT_JOB_OPTIONS[name] || {},
  });

  queue.on("error", (err) => {
    logger.warn(`Queue [${name}] error (non-fatal): ${err?.message || err}`);
  });

  _queues[name] = queue;
  return queue;
}

export async function closeAllQueues() {
  const entries = Object.entries(_queues);
  for (const [name, queue] of entries) {
    try {
      await queue.close();
    } catch (err) {
      logger.warn(`Error closing queue [${name}]: ${err?.message}`);
    }
    delete _queues[name];
  }
}
