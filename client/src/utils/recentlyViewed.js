// Client-side only (localStorage) — no server round trip needed for a
// "pick up where you left off" rail. Per-browser rather than per-account,
// which is the right tradeoff for something this low-stakes: a lost history
// on a new device isn't worth a backend model + endpoint.
const STORAGE_KEY = "insell_recently_viewed";
const MAX_ITEMS = 20;

export function addRecentlyViewed(post) {
  if (!post?._id) return;
  try {
    const existing = getRecentlyViewed().filter((item) => item.id !== post._id);
    const entry = {
      id: post._id,
      title: post.title || "",
      image: Array.isArray(post.mediaUrls) ? post.mediaUrls[0] : "",
      price: post.price || 0,
      city: post.city || "",
      viewedAt: Date.now(),
    };
    const updated = [entry, ...existing].slice(0, MAX_ITEMS);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
  } catch {
    // localStorage can fail (private browsing, quota) — non-critical, skip.
  }
}

export function getRecentlyViewed() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function removeRecentlyViewed(postId) {
  try {
    const updated = getRecentlyViewed().filter((item) => item.id !== postId);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
  } catch {
    // non-critical
  }
}
