import { deleteFromCloudinary } from "../../config/cloudinary.js";
import { logger } from "../../utils/logger.js";

const CLOUDINARY_BATCH_SIZE = 10;

async function deleteMediaBatch(publicIds) {
  const batches = [];
  for (let i = 0; i < publicIds.length; i += CLOUDINARY_BATCH_SIZE) {
    batches.push(publicIds.slice(i, i + CLOUDINARY_BATCH_SIZE));
  }

  let deleted = 0;
  for (const batch of batches) {
    const results = await Promise.allSettled(
      batch.map((id) => deleteFromCloudinary(id))
    );
    deleted += results.filter((r) => r.status === "fulfilled").length;
  }
  return deleted;
}

export async function processCleanupJob(job) {
  const { name, data } = job;

  switch (name) {
    case "media-cleanup": {
      const { publicIds } = data;
      const deleted = await deleteMediaBatch(publicIds.filter(Boolean));
      logger.info(`[Cleanup] Deleted ${deleted}/${publicIds.length} media assets from Cloudinary`);
      return { deleted };
    }

    case "story-cleanup": {
      const { stories } = data;
      const { extractPublicIdFromUrl } = await import("../../config/cloudinary.js");
      const publicIds = stories
        .map((s) => extractPublicIdFromUrl(s.mediaUrl))
        .filter(Boolean);

      const deleted = await deleteMediaBatch(publicIds);

      const Story = (await import("../../models/Story.model.js")).default;
      const storyIds = stories.map((s) => s._id);
      await Story.deleteMany({ _id: { $in: storyIds } });

      logger.info(`[Cleanup] Removed ${stories.length} expired stories, deleted ${deleted} media assets`);
      return { cleaned: stories.length, mediaDeleted: deleted };
    }

    case "post-cleanup": {
      const { postId } = data;
      const PropertyPost = (await import("../../models/PropertyPost.model.js")).default;
      const post = await PropertyPost.findById(postId).select("mediaUrls").lean();
      if (!post) return { skipped: true };

      const { extractPublicIdFromUrl } = await import("../../config/cloudinary.js");
      const publicIds = (post.mediaUrls || [])
        .map((url) => extractPublicIdFromUrl(url))
        .filter(Boolean);

      if (publicIds.length) await deleteMediaBatch(publicIds);

      const Comment = (await import("../../models/Comment.model.js")).default;
      await Comment.deleteMany({ post: postId });

      logger.info(`[Cleanup] Cleaned up post ${postId}: ${publicIds.length} media, comments removed`);
      return { postId, mediaDeleted: publicIds.length };
    }

    default:
      logger.warn(`Unknown cleanup job: ${name}`);
  }
}
