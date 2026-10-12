/**
 * Utility for managing CDN URL abstraction across the application.
 * Decouples the database from hardcoded storage provider domains and provides
 * intelligent, bandwidth-optimized delivery presets (f_auto, q_auto, smart dimensions).
 */

export const CDN_PRESETS = {
  // Avatars: Square crop centered on face, max 300x300, super lightweight (~10-20KB)
  avatar: "w_300,h_300,c_fill,g_face,q_auto,f_auto",

  // Property Post Media: Crisp 1200px max width, auto format and quality (~150KB)
  property: "w_1200,c_limit,q_auto,f_auto",

  // Mobile Stories: 9:16 vertical view (~100KB)
  story: "w_720,h_1280,c_limit,q_auto,f_auto",

  // Documents & Receipts: High readability, auto compressed
  document: "w_1600,c_limit,q_auto,f_auto",

  // Videos: 720p mobile-optimized codec & bitrate (~90% egress reduction)
  video: "w_720,c_limit,q_auto,vc_auto",

  // General default fallback
  default: "q_auto,f_auto",
};

export function getCdnBaseUrl() {
  if (process.env.CDN_BASE_URL) {
    return process.env.CDN_BASE_URL.replace(/\/+$/, "");
  }
  const cloudName = process.env.CLOUDINARY_CLOUD_NAME || "y8lxq4iw";
  return `https://res.cloudinary.com/${cloudName}`;
}

/**
 * Strips the CDN host and cloud name from a full URL to store only the relative path.
 * E.g. "https://res.cloudinary.com/y8lxq4iw/image/upload/v123/pic.jpg" -> "image/upload/v123/pic.jpg"
 * Non-Cloudinary URLs (e.g. Google auth avatars, external placeholders) remain untouched.
 */
export function stripCdnBase(url) {
  if (!url || typeof url !== "string") return url;
  const trimmed = url.trim();
  if (!trimmed) return trimmed;

  const match = trimmed.match(/^https?:\/\/res\.cloudinary\.com\/[^\/]+\/(.+)$/i);
  if (match) {
    return match[1];
  }
  return trimmed;
}

/**
 * Injects transformation presets into a relative Cloudinary path.
 * E.g. "image/upload/v123/profile.jpg" -> "image/upload/w_300,h_300,c_fill,g_face,q_auto,f_auto/v123/profile.jpg"
 */
function applyPresetToPath(path, presetName = "default") {
  const isVideo = /\.(mp4|webm|mov|avi|mkv)(\?.*)?$/i.test(path) || path.startsWith("video/");
  let preset = CDN_PRESETS[presetName] || CDN_PRESETS.default;
  if (isVideo) {
    preset = CDN_PRESETS.video;
  }

  // If already contains a transformation segment (e.g. w_300, q_auto, etc.), do not double-inject
  if (/\/(image|video)\/upload\/[^/]*[a-z]_[^/]*\//i.test("/" + path)) {
    return path;
  }

  if (path.startsWith("image/upload/")) {
    return path.replace(/^image\/upload\//, `image/upload/${preset}/`);
  }
  if (path.startsWith("video/upload/")) {
    return path.replace(/^video\/upload\//, `video/upload/${preset}/`);
  }
  return path;
}

/**
 * Expands a relative media path back to a fully-qualified, bandwidth-optimized CDN URL.
 * E.g. "image/upload/v123/pic.jpg" -> "https://res.cloudinary.com/y8lxq4iw/image/upload/w_1200,.../v123/pic.jpg"
 * If the path is already an external full URL (starts with http/https), it returns unchanged.
 *
 * @param {string} path - Relative media path
 * @param {keyof typeof CDN_PRESETS | string} [preset='default'] - Optimization preset to apply
 */
export function expandCdnUrl(path, preset = "default") {
  if (!path || typeof path !== "string") return path;
  const trimmed = path.trim();
  if (!trimmed) return trimmed;

  if (/^https?:\/\//i.test(trimmed)) {
    return trimmed;
  }

  const base = getCdnBaseUrl();
  let cleanPath = trimmed.replace(/^\/+/, "");

  // Apply delivery optimization preset if targeting Cloudinary
  if (base.includes("res.cloudinary.com")) {
    cleanPath = applyPresetToPath(cleanPath, preset);
  }

  return `${base}/${cleanPath}`;
}
