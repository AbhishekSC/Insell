import AppError from "../../exceptions/AppError.js";

const MAX_PRICE = 10_00_00_00_000; // ₹1,000 Cr sanity ceiling

export function parseTargetPrice(raw) {
  const n = Math.round(Number(raw));
  if (!Number.isFinite(n) || n < 1 || n > MAX_PRICE) {
    throw new AppError("Enter a valid target price", 400);
  }
  return n;
}

export function toAlertDTO(alert) {
  if (!alert) return null;
  return {
    id: String(alert._id),
    postId: String(alert.post?._id || alert.post),
    targetPrice: alert.targetPrice,
    active: alert.active !== false,
    lastNotifiedAt: alert.lastNotifiedAt || null,
    createdAt: alert.createdAt || null,
  };
}

export function toMyAlertDTO(alert) {
  const base = toAlertDTO(alert);
  if (!base) return null;
  const post = alert.post && typeof alert.post === "object" ? alert.post : null;
  return {
    ...base,
    post: post
      ? {
          id: String(post._id),
          title: post.title,
          price: post.price,
          city: post.city,
          locality: post.locality,
          coverImage: Array.isArray(post.mediaUrls) ? post.mediaUrls[0] || null : null,
          status: post.status,
          met: typeof post.price === "number" && post.price <= base.targetPrice,
        }
      : null,
  };
}
