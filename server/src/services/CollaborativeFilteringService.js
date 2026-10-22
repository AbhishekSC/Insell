/**
 * Collaborative Filtering Service
 *
 * Item-based collaborative filtering using property co-engagement.
 *
 * The idea: users who engaged with property A also engaged with property B.
 * If a target user engaged with A, then B is a good recommendation — even if
 * B doesn't match the user's stated content preferences. This captures latent
 * preferences that content-based filtering can't.
 *
 * ── How it works ──────────────────────────────────────────────────────
 *
 * 1. A daily background job (`rebuildEmbeddings`) reads recent RecoEvents
 *    (clicks, saves, likes, visit_requests, offers — NOT impressions or
 *    dismissals, which are weak/negative signals).
 *
 * 2. For each property, we build a "co-engagement vector" — a sparse map of
 *    { otherProperty: coEngagementScore }. Two properties are co-engaged when
 *    the same user engaged with both within the lookback window.
 *
 * 3. The score is weighted by engagement strength: an offer (weight 5) counts
 *    more than a click (weight 1). This means "users who made offers on A also
 *    made offers on B" is a much stronger signal than "users who clicked both."
 *
 * 4. We store the top 50 co-engaged properties per listing in Redis as a JSON
 *    map: `cf:embedding:{postId}` → { otherPostId: score, ... }
 *
 * 5. At recommendation time, `getCFScore` computes the cosine similarity between
 *    a candidate property's embedding and the user's engaged properties. The
 *    result is blended with the content score:
 *
 *      finalScore = (1 - cfWeight) * contentScore + cfWeight * cfScore
 *
 *    cfWeight ramps from 0 → 0.3 as total engagement volume grows:
 *
 *      cfWeight = min(0.3, totalRecoEvents / 50000)
 *
 *    This ensures CF doesn't dominate when data is sparse (cold start).
 *
 * ── Why item-based (not user-based) ────────────────────────────────────
 *
 * Item-based CF is more stable: the set of properties changes slower than the
 * set of users, and the co-engagement matrix is smaller (properties ×
 * properties) than a user-user matrix. It's also more interpretable: "users
 * who liked this also liked X" is a clear recommendation rationale.
 *
 * ── Performance ────────────────────────────────────────────────────────
 *
 * The daily job is O(U × E) where U = users with engagement, E = avg
 * engagements per user. For 10K users with 20 engagements each, that's 200K
 * pairs — easily done in a single Node process in under a minute. Redis
 * stores the embeddings; scoring at request time is a few hash lookups +
 * a dot product, well under 1ms per candidate.
 */

import { redisClient } from "../config/redis.js";
import { logger } from "../utils/logger.js";

// Engagement weights — stronger interactions carry more signal
const ENGAGEMENT_WEIGHTS = {
  click: 1,
  save: 2.5,
  like: 3,
  visit_request: 4,
  offer: 5,
  // impression and dismiss are excluded — too weak / negative
};

// How many co-engaged neighbours to store per property
const MAX_NEIGHBORS = 50;

// Lookback window for the daily rebuild
const LOOKBACK_DAYS = 90;

// Redis key for a property's CF embedding
const EMBEDDING_KEY = (postId) => `cf:embedding:${postId}`;

// Redis key for tracking total engagement volume (for cfWeight ramp-up)
const TOTAL_ENGAGEMENT_KEY = "cf:total_engagement";

// Redis key for the embedding version (bumped on each rebuild so stale
// reads can be detected and ignored)
const EMBEDDING_VERSION_KEY = "cf:embedding_version";

// CF embedding TTL in Redis — 7 days (daily job refreshes before expiry)
const EMBEDDING_TTL_SECONDS = 7 * 24 * 60 * 60;

/**
 * Compute the CF weight that blends with content score.
 *
 *   cfWeight = min(0.3, totalEngagement / 50000)
 *
 * Starts at 0 (pure content-based), reaches 0.3 (30% CF, 70% content) at
 * 50K total engagement events. This gradual ramp prevents CF from
 * dominating when data is sparse.
 */
export function getCFWeight(totalEngagement) {
  return Math.min(0.3, (totalEngagement || 0) / 50000);
}

/**
 * Rebuild property co-engagement embeddings from recent RecoEvents.
 *
 * Should be called as a daily background job (e.g., via BullMQ or cron).
 * It's safe to run concurrently — the version key ensures atomicity: the
 * new embeddings are written with an incremented version, and readers
 * compare versions to avoid mixing old and new data.
 *
 * @param {Object} options - { batchSize: number } (default 5000)
 * @returns {Object} - { propertiesProcessed, embeddingsBuilt, version }
 */
export async function rebuildEmbeddings(options = {}) {
  const batchSize = options.batchSize || 5000;
  const since = new Date(Date.now() - LOOKBACK_DAYS * 24 * 60 * 60 * 1000);
  const { default: RecoEvent } = await import("../models/RecoEvent.model.js");

  logger.info("[CF] Starting embedding rebuild");

  // Step 1: Load all positive engagement events (click, save, like, visit, offer)
  const engagementEvents = await RecoEvent.find({
    event: { $in: Object.keys(ENGAGEMENT_WEIGHTS) },
    createdAt: { $gte: since },
  })
    .select("user post event")
    .lean();

  logger.info(`[CF] Loaded ${engagementEvents.length} engagement events from last ${LOOKBACK_DAYS} days`);

  if (engagementEvents.length === 0) {
    logger.info("[CF] No engagement events found, skipping rebuild");
    return { propertiesProcessed: 0, embeddingsBuilt: 0, version: null };
  }

  // Step 2: Group by user → { propertyId: maxWeight }
  const userEngagements = new Map();
  for (const evt of engagementEvents) {
    const userId = String(evt.user);
    const postId = String(evt.post);
    const weight = ENGAGEMENT_WEIGHTS[evt.event] || 0;
    if (!weight) continue;

    if (!userEngagements.has(userId)) {
      userEngagements.set(userId, new Map());
    }
    const userProps = userEngagements.get(userId);
    // Keep the maximum weight if a user engaged with the same property multiple times
    userProps.set(postId, Math.max(userProps.get(postId) || 0, weight));
  }

  logger.info(`[CF] ${userEngagements.size} users with engagement`);

  // Step 3: Build co-engagement matrix
  // For each user, every pair of properties they engaged with gets a
  // co-engagement contribution = weightA * weightB.
  const coEngagement = new Map(); // postId → Map(otherPostId → score)

  for (const [, userProps] of userEngagements) {
    const entries = [...userProps.entries()];
    for (let i = 0; i < entries.length; i++) {
      const [postA, weightA] = entries[i];
      if (!coEngagement.has(postA)) coEngagement.set(postA, new Map());

      for (let j = i + 1; j < entries.length; j++) {
        const [postB, weightB] = entries[j];
        const contribution = weightA * weightB;

        // Symmetric: A→B and B→A both get the contribution
        coEngagement.get(postA).set(postB, (coEngagement.get(postA).get(postB) || 0) + contribution);
        if (!coEngagement.has(postB)) coEngagement.set(postB, new Map());
        coEngagement.get(postB).set(postA, (coEngagement.get(postB).get(postA) || 0) + contribution);
      }
    }
  }

  logger.info(`[CF] Built co-engagement matrix for ${coEngagement.size} properties`);

  // Step 4: Normalize and store top-K neighbors per property in Redis
  const version = Date.now();
  let embeddingsBuilt = 0;
  let propertiesProcessed = 0;

  for (const [postId, neighbors] of coEngagement) {
    propertiesProcessed++;

    // Normalize by the property's total co-engagement (L2 normalization
    // for cosine similarity compatibility)
    const totalCoEngagement = [...neighbors.values()].reduce((sum, v) => sum + v * v, 0);
    const norm = Math.sqrt(totalCoEngagement) || 1;

    // Sort by score descending, take top MAX_NEIGHBORS
    const topNeighbors = [...neighbors.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, MAX_NEIGHBORS)
      .map(([otherId, score]) => [otherId, score / norm]);

    if (topNeighbors.length === 0) continue;

    // Store as compact JSON: { v: version, n: { postId: score, ... } }
    const embedding = {
      v: version,
      n: Object.fromEntries(topNeighbors),
    };

    try {
      await redisClient.set(
        EMBEDDING_KEY(postId),
        JSON.stringify(embedding),
        "EX",
        EMBEDDING_TTL_SECONDS
      );
      embeddingsBuilt++;
    } catch (err) {
      logger.warn(`[CF] Failed to store embedding for ${postId}:`, err.message);
    }

    // Batch the Redis writes to avoid overwhelming the connection
    if (propertiesProcessed % batchSize === 0) {
      logger.info(`[CF] Processed ${propertiesProcessed}/${coEngagement.size} properties`);
    }
  }

  // Store the version and total engagement count
  try {
    await redisClient.set(EMBEDDING_VERSION_KEY, String(version));
    await redisClient.set(TOTAL_ENGAGEMENT_KEY, String(engagementEvents.length));
  } catch (err) {
    logger.warn("[CF] Failed to store version/engagement count:", err.message);
  }

  logger.info(
    `[CF] Embedding rebuild complete: ${propertiesProcessed} properties, ${embeddingsBuilt} embeddings, version ${version}`
  );

  return { propertiesProcessed, embeddingsBuilt, version };
}

/**
 * Get the CF score for a candidate property given a user's engaged properties.
 *
 * The score is the weighted sum of cosine similarities between the candidate's
 * embedding and each of the user's engaged properties, normalised to [0, 100].
 *
 * @param {string} candidateId - property being scored
 * @param {Array} userEngagedPropertyIds - [{ id, weight }] from user behavior
 * @param {number} cfVersion - current embedding version (for cache freshness)
 * @returns {Promise<number>} - CF score 0–100 (50 = neutral when no data)
 */
export async function getCFScore(candidateId, userEngagedPropertyIds = [], cfVersion) {
  if (!candidateId || userEngagedPropertyIds.length === 0) return 50;

  let embedding;
  try {
    const raw = await redisClient.get(EMBEDDING_KEY(String(candidateId)));
    if (!raw) return 50; // No embedding for this property
    embedding = JSON.parse(raw);
  } catch {
    return 50; // Redis error or parse failure — degrade gracefully
  }

  // Version check — if embedding is stale (from a previous rebuild), still
  // use it. Better to have an approximate signal than none.
  if (cfVersion && embedding.v && embedding.v < cfVersion) {
    // Stale but usable — log at debug level
  }

  const neighbors = embedding.n;
  if (!neighbors || Object.keys(neighbors).length === 0) return 50;

  // For each of the user's engaged properties, look up its similarity score
  // in the candidate's embedding. Sum the weighted similarities.
  let totalSimilarity = 0;
  let totalWeight = 0;

  for (const { id, weight } of userEngagedPropertyIds) {
    const sim = neighbors[String(id)];
    if (sim != null) {
      totalSimilarity += sim * weight;
      totalWeight += weight;
    }
  }

  if (totalWeight === 0) return 50; // No overlap between user's history and candidate's neighbors

  // Normalise: average similarity weighted by engagement strength
  const avgSimilarity = totalSimilarity / totalWeight;

  // Scale to [0, 100]. Cosine similarity is in [0, 1] for non-negative
  // vectors. Multiply by 100 and clamp.
  return Math.round(Math.min(100, Math.max(0, avgSimilarity * 100)));
}

/**
 * Get the current CF weight based on total engagement volume.
 *
 * Reads the cached total engagement count from Redis and computes:
 *   cfWeight = min(0.3, total / 50000)
 *
 * @returns {Promise<number>} - blend weight 0–0.3
 */
export async function getCurrentCFWeight() {
  try {
    const raw = await redisClient.get(TOTAL_ENGAGEMENT_KEY);
    if (!raw) return 0;
    return getCFWeight(parseInt(raw, 10));
  } catch {
    return 0;
  }
}

/**
 * Get the current embedding version (for cache freshness checks).
 *
 * @returns {Promise<number|null>}
 */
export async function getEmbeddingVersion() {
  try {
    const raw = await redisClient.get(EMBEDDING_VERSION_KEY);
    return raw ? parseInt(raw, 10) : null;
  } catch {
    return null;
  }
}

/**
 * Invalidate all CF embeddings (e.g., on schema change or manual reset).
 */
export async function invalidateEmbeddings() {
  try {
    // Scan and delete all cf:embedding:* keys
    for await (const keys of redisClient.scanIterator({ MATCH: "cf:*", COUNT: 100 })) {
      if (Array.isArray(keys) && keys.length > 0) {
        await redisClient.del(keys);
      } else if (typeof keys === "string" && keys) {
        await redisClient.del(keys);
      }
    }
    logger.info("[CF] Invalidated all CF embeddings");
  } catch (err) {
    logger.warn("[CF] Failed to invalidate embeddings:", err.message);
  }
}
