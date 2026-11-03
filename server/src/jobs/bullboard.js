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
      results[key] = { name, ...counts };
    } catch {
      results[key] = { name, status: "error" };
    }
  }

  return results;
}
