/**
 * Enrich an admin ad listing with computed CTR.
 */
export const toAdminAdDto = (ad) => {
  const impressions = ad.impressionsCount || 0;
  const clicks = ad.clicksCount || 0;
  const ctr = impressions > 0 ? Number(((clicks / impressions) * 100).toFixed(2)) : 0;
  return { ...ad, ctr };
};

/**
 * Format a user-owned campaign with computed fields.
 */
export const toCampaignDto = (ad, now) => {
  const endMs = ad.endDate ? new Date(ad.endDate).getTime() : 0;
  const isExpired = endMs > 0 && endMs <= now;
  const daysRemaining = endMs > now ? Math.ceil((endMs - now) / (24 * 60 * 60 * 1000)) : 0;
  const ctr = ad.impressionsCount > 0 ? ((ad.clicksCount / ad.impressionsCount) * 100).toFixed(1) : "0.0";

  return {
    ...ad,
    isExpired,
    daysRemaining,
    ctr: `${ctr}%`,
  };
};
