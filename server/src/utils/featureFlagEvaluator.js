import crypto from "crypto";

/**
 * Deterministically computes a 0-99 bucket for a given flag key and entity ID.
 * Consistent across all runs: the same user always gets the exact same bucket.
 *
 * @param {string} flagKey
 * @param {string} entityId
 * @returns {number} Integer between 0 and 99 inclusive
 */
export function computeBucket(flagKey, entityId) {
  if (!flagKey || !entityId) return 0;
  const hash = crypto
    .createHash("md5")
    .update(`${flagKey}:${entityId}`)
    .digest("hex");
  // Take 4 hexadecimal characters (16-bit integer, 0-65535) and modulo 100
  const numeric = parseInt(hash.substring(0, 4), 16);
  return numeric % 100;
}

/**
 * Evaluates whether a feature flag is enabled for a given user.
 *
 * Evaluation Order:
 * 1. Master Killswitch: If !flag.isActive => false
 * 2. Explicit User Blacklist: If disabledUserIds includes user._id => false
 * 3. Explicit User Whitelist: If enabledUserIds includes user._id => true (regardless of rollout %)
 * 4. Role Filtering: If enabledRoles is non-empty and user's role is not included => false
 * 5. Rollout Percentage:
 *    - If rolloutPercentage === 0 => false
 *    - If rolloutPercentage === 100 => true
 *    - Otherwise: computeBucket(flag.key, user._id) < rolloutPercentage
 *
 * @param {Object} flag - FeatureFlag document or plain object
 * @param {Object} [user] - User document or plain object (optional, for anonymous/public visitors)
 * @returns {{ enabled: boolean, reason: string, bucket: number | null }}
 */
export function evaluateFeatureFlag(flag, user = null) {
  if (!flag || !flag.isActive) {
    return { enabled: false, reason: "FLAG_INACTIVE", bucket: null };
  }

  const userIdStr = user?._id ? String(user._id) : user?.id ? String(user.id) : null;

  // 1. Check blacklist
  if (userIdStr && Array.isArray(flag.disabledUserIds) && flag.disabledUserIds.length > 0) {
    const isBlacklisted = flag.disabledUserIds.some((id) => String(id?._id || id) === userIdStr);
    if (isBlacklisted) {
      return { enabled: false, reason: "USER_BLACKLISTED", bucket: null };
    }
  }

  // 2. Check whitelist (Allows admins to force-enable specific users regardless of %)
  if (userIdStr && Array.isArray(flag.enabledUserIds) && flag.enabledUserIds.length > 0) {
    const isWhitelisted = flag.enabledUserIds.some((id) => String(id?._id || id) === userIdStr);
    if (isWhitelisted) {
      return { enabled: true, reason: "USER_WHITELISTED", bucket: null };
    }
  }

  // 3. Role filtering (if specified)
  if (Array.isArray(flag.enabledRoles) && flag.enabledRoles.length > 0) {
    const userRole = user?.activeRole || user?.primaryRole || "";
    if (!userRole || !flag.enabledRoles.includes(userRole)) {
      return { enabled: false, reason: "ROLE_MISMATCH", bucket: null };
    }
  }

  // 4. Percentage Rollout
  const rollout = typeof flag.rolloutPercentage === "number" ? flag.rolloutPercentage : 0;
  if (rollout <= 0) {
    return { enabled: false, reason: "PERCENTAGE_ZERO", bucket: null };
  }
  if (rollout >= 100) {
    return { enabled: true, reason: "PERCENTAGE_HUNDRED", bucket: 0 };
  }

  if (!userIdStr) {
    // Unauthenticated user with partial rollout: default to false unless whitelisted
    return { enabled: false, reason: "ANONYMOUS_USER", bucket: null };
  }

  const bucket = computeBucket(flag.key, userIdStr);
  const isRolloutMatch = bucket < rollout;

  return {
    enabled: isRolloutMatch,
    reason: isRolloutMatch ? "PERCENTAGE_ROLLOUT_MATCH" : "PERCENTAGE_ROLLOUT_EXCLUDED",
    bucket,
  };
}
