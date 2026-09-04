// "Signal" pills for a property card — quick, scannable facts that help a
// user decide whether to stop on a listing. Every one is computed from data
// already on the post payload (+ the logged-in user for the "match" signals);
// each fn returns a badge object or null so the card only ever renders true
// signals, never "0 Beds" filler.
//
// Rendering contract: { key, label, tone } where tone maps to a colour pair
// via TONE_CLASSES below. Keep labels short — they sit in a wrapping row.

const TONE_CLASSES = {
  good: "bg-emerald-100 text-emerald-700",
  info: "bg-blue-100 text-blue-700",
  warn: "bg-amber-100 text-amber-700",
  hot: "bg-rose-100 text-rose-700",
  neutral: "bg-slate-100 text-slate-600",
  trust: "bg-violet-100 text-violet-700",
};

export function toneClass(tone) {
  return TONE_CLASSES[tone] || TONE_CLASSES.neutral;
}

function compactINR(amount) {
  const n = Math.round(Math.abs(Number(amount) || 0));
  if (n >= 10000000) return `₹${(n / 10000000).toFixed(n % 10000000 === 0 ? 0 : 2)}Cr`;
  if (n >= 100000) return `₹${(n / 100000).toFixed(n % 100000 === 0 ? 0 : 1)}L`;
  if (n >= 1000) return `₹${Math.round(n / 1000)}K`;
  return `₹${n}`;
}

// carpet area for commercial, else the plain areaSqft
function areaOf(post) {
  const a =
    Number(post?.areaSqft) ||
    Number(post?.postMeta?.commercial?.carpetArea) ||
    Number(post?.postMeta?.builtUpArea) ||
    0;
  return a > 0 ? a : null;
}

export function pricePerSqft(post) {
  const price = Number(post?.price) || 0;
  const area = areaOf(post);
  if (!price || !area) return null;
  const psf = price / area;
  if (psf < 100 || psf > 500000) return null; // junk data guard
  return { key: "psf", label: `${compactINR(psf)}/sqft`, tone: "neutral" };
}


// NOTE: the three "match" helpers below (budget / area / type) are NOT wired
// into getPropertySignals — they depend on budgetMin/Max, preferredLocalities
// and propertyTypePreferences, which are only set by the optional /onboarding
// wizard. Until onboarding is mandatory (or there's an Edit Preferences
// screen), they'd render for almost nobody. Re-add them to getPropertySignals
// once that preference data is reliably collected.
export function budgetMatch(post, authUser) {
  const price = Number(post?.price) || 0;
  const min = Number(authUser?.budgetMin) || 0;
  const max = Number(authUser?.budgetMax) || 0;
  if (!price || (!min && !max)) return null;
  const withinMin = !min || price >= min * 0.9;
  const withinMax = !max || price <= max * 1.1;
  if (withinMin && withinMax) return { key: "budget", label: "In your budget", tone: "good" };
  return null;
}

export function preferredAreaMatch(post, authUser) {
  const wanted = (authUser?.preferredLocalities || []).map((s) => String(s).toLowerCase().trim()).filter(Boolean);
  if (!wanted.length) return null;
  const hay = `${post?.city || ""} ${post?.locality || ""}`.toLowerCase();
  const hit = wanted.some((w) => hay.includes(w));
  return hit ? { key: "area", label: "In your preferred area", tone: "good" } : null;
}

export function preferredTypeMatch(post, authUser) {
  const wanted = (authUser?.propertyTypePreferences || []).map((s) => String(s).toLowerCase().trim());
  if (!wanted.length || !post?.propertyType) return null;
  return wanted.includes(String(post.propertyType).toLowerCase())
    ? { key: "type", label: "Your kind of property", tone: "good" }
    : null;
}

export function possession(post) {
  const p = post?.postMeta?.possessionStatus || post?.postMeta?.projectStatus;
  if (p === "Ready to Move" || p === "Ready To Move") return { key: "possession", label: "Ready to move", tone: "good" };
  const moveIn = post?.postMeta?.moveInDate;
  if (moveIn) {
    const d = new Date(moveIn);
    if (!Number.isNaN(d.getTime()) && d.getTime() > Date.now()) {
      return { key: "possession", label: `Available ${d.toLocaleDateString("en-IN", { day: "numeric", month: "short" })}`, tone: "info" };
    }
  }
  return null;
}

// --- demand / social proof -------------------------------------------------

export function offerCompetition(post) {
  const n = Number(post?.activeOfferCount ?? post?.activeOffers) || 0;
  if (n < 1) return null;
  return { key: "offers", label: `${n} offer${n > 1 ? "s" : ""} in`, tone: "hot" };
}

// Recent saves + likes vs the listing's age. Uses the *Timestamps arrays
// already on the post payload, so it's a real velocity read, not just a
// total. Only fires when there's a genuine recent spike.
export function trendingBadge(post, { now = Date.now(), windowH = 72 } = {}) {
  const cutoff = now - windowH * 3600000;
  const recent = (arr) =>
    (Array.isArray(arr) ? arr : []).filter((e) => {
      const t = new Date(e?.timestamp || e?.at || e).getTime();
      return Number.isFinite(t) && t >= cutoff;
    }).length;
  const hits = recent(post?.savedByTimestamps) + recent(post?.likedByTimestamps);
  const ageDays = (now - new Date(post?.publishedAt || post?.createdAt).getTime()) / 86400000;
  // 4+ recent signals, and not simply because the listing is brand new
  if (hits >= 4 && ageDays >= 2) {
    return { key: "trending", label: post?.locality ? `Trending in ${post.locality}` : "Trending", tone: "hot" };
  }
  return null;
}

export function demandBadges(post, { max = 2 } = {}) {
  const out = [];
  const saves = Array.isArray(post?.savedBy) ? post.savedBy.length : Number(post?.savedCount || post?.savesCount) || 0;
  const visits = Number(post?.visitRequestCount) || 0;
  const views = Number(post?.viewCount) || 0;

  const offers = offerCompetition(post);
  if (offers) out.push(offers);
  if (visits >= 2) out.push({ key: "visits", label: `${visits} visit${visits > 1 ? "s" : ""} requested`, tone: "hot" });
  if (saves >= 3) out.push({ key: "saves", label: `Saved by ${saves}`, tone: "trust" });
  if (out.length < max && views >= 30) out.push({ key: "views", label: `${views} views`, tone: "neutral" });
  return out.slice(0, max);
}

// "Detailed listing" — enough real content that a buyer isn't left guessing.
export function completenessBadge(post) {
  if (!post) return null;
  const photos = (Array.isArray(post.mediaUrls) && post.mediaUrls.length) || (Array.isArray(post.media) && post.media.length) || 0;
  if (photos < 3) return null;
  const filled = [
    post.price > 0,
    Number(post.areaSqft) > 0 || Number(post.postMeta?.commercial?.carpetArea) > 0,
    post.bedrooms > 0 || String(post.postType || "").toUpperCase().includes("LAND") || String(post.postType || "").toUpperCase().includes("COMMERCIAL"),
    Boolean((post.caption || "").trim().length >= 40),
    Boolean(post.locality),
    Boolean(post.postMeta?.furnishing || post.postMeta?.possessionStatus || post.postMeta?.facing || post.postMeta?.amenities?.length),
  ].filter(Boolean).length;
  return filled >= 5 ? { key: "complete", label: "Detailed listing", tone: "info" } : null;
}

// --- seller --------------------------------------------------------------

export function sellerRating(post) {
  const avg = Number(post?.author?.ratingAvg) || 0;
  const count = Number(post?.author?.ratingCount) || 0;
  if (count < 1 || avg <= 0) return null;
  return { key: "rating", label: `Seller ${avg.toFixed(1)}★`, tone: "trust" };
}

// How many other live listings this seller has — from a server-side count,
// not onboarding data. "1 listing" reads as an individual owner; a dozen
// reads as an agent/portfolio. Left to the reader to interpret.
export function sellerListings(post) {
  const n = Number(post?.sellerListingCount) || 0;
  if (n < 1) return null;
  return { key: "seller", label: n === 1 ? "Only listing by this seller" : `${n} listings by this seller`, tone: "neutral" };
}

// NOT wired into getPropertySignals — depends on author.primaryRole/activeRole,
// which is only set by the optional /onboarding wizard (signup collects no
// role). Re-add once role is reliably captured.
export function sellerType(post) {
  const role = String(post?.author?.activeRole || post?.author?.primaryRole || "").toLowerCase();
  if (["owner", "landlord", "seller", "tenant"].includes(role)) return { key: "sellerType", label: "Listed by owner", tone: "good" };
  if (role === "broker" || role === "agent") return { key: "sellerType", label: "Listed by broker", tone: "neutral" };
  if (role === "builder" || role === "developer") return { key: "sellerType", label: "Listed by builder", tone: "info" };
  return null;
}

// --- aggregate ----------------------------------------------------------

// Ordered, de-duplicated set for a card. `context` = "feed" | "detail".
// Detail shows more; both omit the seller *rating* pill on the detail page
// (getSellerTrustSignals covers that there).
export function getPropertySignals(post, { context = "feed" } = {}) {
  if (!post) return [];
  const type = String(post.postType || "").toUpperCase();
  if (type.startsWith("REQUIREMENT_")) return [];

  const money = [pricePerSqft(post)].filter(Boolean);
  const demand = demandBadges(post, { max: context === "detail" ? 3 : 2 });
  const trending = trendingBadge(post);
  const seller = [sellerRating(post), sellerListings(post)].filter(Boolean);
  const status = [possession(post)].filter(Boolean);
  const quality = [completenessBadge(post)].filter(Boolean);

  if (context === "detail") {
    return dedupe([...status, ...(trending ? [trending] : []), ...money, ...demand, ...seller, ...quality]);
  }
  // feed: same signals, capped so the card stays scannable. Most useful first.
  return dedupe([
    ...status.slice(0, 1),
    ...(trending ? [trending] : []),
    ...money,               // ₹/sqft
    ...demand.slice(0, 2),  // offers / visits / saves
    ...seller.slice(0, 2),  // rating + owner/broker
    ...quality,             // detailed listing
  ]).slice(0, 6);
}

function dedupe(badges) {
  const seen = new Set();
  return badges.filter((b) => {
    if (!b || seen.has(b.key)) return false;
    seen.add(b.key);
    return true;
  });
}
