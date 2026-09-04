// Plan entitlements. Limits are read from here, never hard-coded at call
// sites, so adding PRO / BUSINESS later doesn't mean touching feature logic.
// There is no subscription system yet — planFor() returns FREE for everyone
// until user.isPremium is set (e.g. by a payment webhook).

export const PLANS = {
  FREE: {
    key: "FREE",
    dailyVisitRequests: 2, // new requests you can send per calendar day (IST)
    activeVisitRequests: 5, // PENDING + RESCHEDULE_PROPOSED you can hold at once
  },
  PREMIUM: {
    key: "PREMIUM",
    dailyVisitRequests: 20,
    activeVisitRequests: 20,
  },
};

export function planFor(user) {
  return user?.isPremium ? PLANS.PREMIUM : PLANS.FREE;
}

// "YYYY-MM-DD" for the given instant in India time — the daily-usage bucket
// key. Calendar-day semantics (resets at IST midnight), not a rolling 24h.
export function istDayBucket(date = new Date()) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Kolkata",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

// The next IST midnight — when a hit daily limit resets. Returned to the
// client so the modal can say "resets in 3h".
export function nextIstMidnight() {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Kolkata",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  }).formatToParts(new Date());
  const get = (t) => Number(parts.find((p) => p.type === t)?.value || 0);
  const msUntilMidnight = ((24 - get("hour")) * 3600 - get("minute") * 60 - get("second")) * 1000;
  return new Date(Date.now() + msUntilMidnight);
}
