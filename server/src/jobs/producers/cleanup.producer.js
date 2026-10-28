import { getQueue, QUEUE_NAMES } from "../queues.js";
import { logger } from "../../utils/logger.js";

export async function enqueueMediaCleanup(publicIds) {
  try {
    const q = getQueue(QUEUE_NAMES.CLEANUP);
    if (!q) return null;

    const ids = Array.isArray(publicIds) ? publicIds : [publicIds];
    return await q.add("media-cleanup", { publicIds: ids });
  } catch (err) {
    logger.warn(`Failed to enqueue media cleanup: ${err?.message}`);
    return null;
  }
}

export async function enqueuePostCleanup(postId) {
  try {
    const q = getQueue(QUEUE_NAMES.CLEANUP);
    if (!q) return null;
    return await q.add("post-cleanup", { postId: String(postId) }, {
      jobId: `post-cleanup:${postId}`,
    });
  } catch (err) {
    logger.warn(`Failed to enqueue post cleanup for ${postId}: ${err?.message}`);
    return null;
  }
}

export async function enqueueStoryCleanup(stories) {
  try {
    const q = getQueue(QUEUE_NAMES.CLEANUP);
    if (!q) return null;
    return await q.add("story-cleanup", {
      stories: stories.map((s) => ({ _id: String(s._id), mediaUrl: s.mediaUrl })),
    });
  } catch (err) {
    logger.warn(`Failed to enqueue story cleanup: ${err?.message}`);
    return null;
  }
}
