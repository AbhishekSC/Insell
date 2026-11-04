import { createBullBoard } from "@bull-board/api";
import { BullMQAdapter } from "@bull-board/api/bullMQAdapter";
import { ExpressAdapter } from "@bull-board/express";
import { getQueue, QUEUE_NAMES } from "./queues.js";

export function setupBullBoard() {
  const serverAdapter = new ExpressAdapter();
  serverAdapter.setBasePath("/admin/queues");

  const queues = Object.values(QUEUE_NAMES)
    .map((name) => getQueue(name))
    .filter(Boolean)
    .map((q) => new BullMQAdapter(q));

  createBullBoard({ queues, serverAdapter });

  return serverAdapter;
}

export async function getQueuesHealth() {
  const results = {};

  for (const [key, name] of Object.entries(QUEUE_NAMES)) {
    const queue = getQueue(name);
    if (!queue) {
      results[key] = { status: "unavailable" };
      continue;
    }
    try {
      const counts = await queue.getJobCounts("waiting", "active", "completed", "failed", "delayed");
      let recentFailed = [];
      if (counts.failed > 0) {
        const failedJobs = await queue.getFailed(0, 2);
        recentFailed = failedJobs.map(j => ({
          id: j.id,
          name: j.name,
          failedReason: j.failedReason?.slice(0, 200),
          timestamp: j.timestamp,
        }));
      }
      results[key] = { name, ...counts, recentFailed };
    } catch {
      results[key] = { name, status: "error" };
    }
  }

  return results;
}
