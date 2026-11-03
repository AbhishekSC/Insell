import { STORY_EXPIRY_MS } from "./story.constants.js";
import { deleteFromCloudinary, extractPublicIdFromUrl } from "../../config/cloudinary.js";
import { logger } from "../../utils/logger.js";

export function calculateExpiry() {
  return new Date(Date.now() + STORY_EXPIRY_MS);
}

export function separateActiveAndExpired(stories) {
  const now = new Date();
  const activeStories = stories.filter((s) => (!s.feedExpiresAt || s.feedExpiresAt > now) && s.isActive);
  const expiredStories = stories.filter((s) => (s.feedExpiresAt && s.feedExpiresAt <= now) || !s.isActive);
  return { activeStories, expiredStories };
}

export function buildViewersWithLikeStatus(story) {
  const likedIds = new Set(story.likedBy.map((id) => String(id)));
  return [...story.viewedBy].reverse().map((viewer) => ({
    ...viewer.toObject(),
    liked: likedIds.has(String(viewer._id)),
  }));
}

export function enqueueMediaCleanup(publicId) {
  import("../../jobs/producers/cleanup.producer.js")
    .then(({ enqueueMediaCleanup }) => enqueueMediaCleanup([publicId]))
    .catch(() => deleteFromCloudinary(publicId).catch(() => {}));
}

export async function cleanupExpiredStoriesBatch(expired) {
  try {
    const { enqueueStoryCleanup } = await import("../../jobs/producers/cleanup.producer.js");
    await enqueueStoryCleanup(expired.map((s) => ({ _id: s._id, mediaUrl: s.mediaUrl })));
  } catch {
    const { default: Story } = await import("../../models/Story.model.js");
    const cleanedIds = [];
    for (const story of expired) {
      const publicId = extractPublicIdFromUrl(story.mediaUrl);
      if (publicId) await deleteFromCloudinary(publicId);
      cleanedIds.push(story._id);
    }
    if (cleanedIds.length) await Story.deleteMany({ _id: { $in: cleanedIds } });
  }
}

export function buildActiveStoriesQuery(userId, followingIds) {
  return {
    isActive: true,
    feedExpiresAt: { $gt: new Date() },
    $or: [
      { visibility: "public" },
      { visibility: "private", author: { $in: followingIds } },
      { visibility: "private", author: userId },
    ],
  };
}
