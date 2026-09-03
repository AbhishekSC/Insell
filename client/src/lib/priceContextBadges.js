// Small "signal" pills shown on a property card next to the price — they tell
// a fast-scrolling user whether a listing is worth stopping for, computed
// entirely from data already on the post (priceHistory, createdAt,
// offerStatus). Rendered the same way as the detail chips; only returns a
// badge when its condition is actually true.
//
// Returns at most `max` badges, most useful first.

function compactINR(amount) {
  const n = Math.abs(Number(amount) || 0);
  if (n >= 10000000) return `₹${(n / 10000000).toFixed(n % 10000000 === 0 ? 0 : 1)}Cr`;
  if (n >= 100000) return `₹${(n / 100000).toFixed(n % 100000 === 0 ? 0 : 1)}L`;
  if (n >= 1000) return `₹${Math.round(n / 1000)}K`;
  return `₹${n}`;
}

const TONES = {
  drop: { color: "bg-emerald-100", textColor: "text-emerald-700" },
  rise: { color: "bg-amber-100", textColor: "text-amber-700" },
  fresh: { color: "bg-blue-100", textColor: "text-blue-700" },
  reopened: { color: "bg-purple-100", textColor: "text-purple-700" },
  stale: { color: "bg-slate-100", textColor: "text-slate-600" },
};

export function getPriceContextBadges(post, { max = 2, now = Date.now() } = {}) {
  const badges = [];
  if (!post) return badges;

  const history = Array.isArray(post.priceHistory) ? post.priceHistory : [];
  const created = new Date(post.publishedAt || post.createdAt).getTime();
  const ageDays = Number.isFinite(created) ? (now - created) / 86400000 : Infinity;

  // Price change — compare the latest recorded price to the one before it.
  if (history.length >= 2) {
    const latest = Number(history[history.length - 1]?.price);
    const previous = Number(history[history.length - 2]?.price);
    if (Number.isFinite(latest) && Number.isFinite(previous) && previous > 0) {
      const delta = previous - latest;
      const pct = Math.round((Math.abs(delta) / previous) * 100);
      const changedAt = new Date(history[history.length - 1]?.changedAt).getTime();
      const changeIsRecent = Number.isFinite(changedAt) ? now - changedAt < 45 * 86400000 : false;
      if (delta > 0 && changeIsRecent) {
        badges.push({ key: "drop", label: `${compactINR(delta)} price drop`, ...TONES.drop });
      } else if (delta < 0 && changeIsRecent) {
        badges.push({ key: "rise", label: `Price up ${pct}%`, ...TONES.rise });
      }
    }
  }

  // Brand new listing.
  if (ageDays <= 3) {
    badges.push({ key: "fresh", label: "New", ...TONES.fresh });
  }

  // Deal fell through and it's open again. Requires the backend to expose
  // `reopenedAt` (set when an accepted offer is withdrawn / expires); until
  // then this simply never fires.
  if (post.reopenedAt) {
    const reopenedDays = (now - new Date(post.reopenedAt).getTime()) / 86400000;
    if (reopenedDays <= 14) {
      badges.push({ key: "reopened", label: "Back on market", ...TONES.reopened });
    }
  }

  // Sitting a long time with no price movement — likely room to negotiate.
  if (badges.length === 0 && ageDays >= 90 && history.length <= 1) {
    badges.push({ key: "stale", label: `Listed ${Math.round(ageDays / 30)}mo ago`, ...TONES.stale });
  }

  return badges.slice(0, max);
}
