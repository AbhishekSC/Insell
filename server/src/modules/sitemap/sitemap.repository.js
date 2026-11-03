import PropertyPost from "../../models/PropertyPost.model.js";
import { DEFAULT_LIMIT } from "./sitemap.constants.js";

/**
 * Find active (non-deleted, non-blocked, non-draft) post IDs with timestamps.
 * @param {number} [limit=DEFAULT_LIMIT]
 * @returns {Promise<Array<{_id: string, updatedAt: Date, createdAt: Date}>>}
 */
export async function findActivePostIds(limit = DEFAULT_LIMIT) {
  return PropertyPost.find({
    status: { $nin: ["deleted", "blocked"] },
    isDraft: { $ne: true },
  })
    .select("_id updatedAt createdAt")
    .sort({ updatedAt: -1 })
    .limit(limit)
    .lean();
}
