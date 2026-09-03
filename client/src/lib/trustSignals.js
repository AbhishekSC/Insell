// Small trust pills for a seller/owner — "Active today", "Usually responds
// fast", rating — derived from fields already on the user document
// (lastActiveAt, responseRate, ratingAvg/ratingCount). Only returns a pill
// when the underlying value is actually meaningful, so a brand-new account
// with no history shows nothing rather than misleading zeros.

const TONES = {
  active: { color: "bg-emerald-100", textColor: "text-emerald-700" },
  responsive: { color: "bg-blue-100", textColor: "text-blue-700" },
  rating: { color: "bg-amber-100", textColor: "text-amber-700" },
};

export function getSellerTrustSignals(author, { now = Date.now() } = {}) {
  const signals = [];
  if (!author) return signals;

  const lastActive = author.lastActiveAt ? new Date(author.lastActiveAt).getTime() : NaN;
  if (Number.isFinite(lastActive)) {
    const hours = (now - lastActive) / 3600000;
    if (hours <= 24) signals.push({ key: "active", label: "Active today", ...TONES.active });
    else if (hours <= 24 * 7) signals.push({ key: "active", label: "Active this week", ...TONES.active });
  }

  const rate = Number(author.responseRate) || 0;
  if (rate >= 75) signals.push({ key: "responsive", label: "Responds fast", ...TONES.responsive });
  else if (rate >= 45) signals.push({ key: "responsive", label: "Usually responds", ...TONES.responsive });

  const avg = Number(author.ratingAvg) || 0;
  const count = Number(author.ratingCount) || 0;
  if (avg > 0 && count > 0) {
    signals.push({ key: "rating", label: `★ ${avg.toFixed(1)} (${count})`, ...TONES.rating });
  }

  return signals;
}
