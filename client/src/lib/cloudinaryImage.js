// Helpers for deriving on-the-fly variants of a Cloudinary image URL.
//
// Property media is uploaded straight to Cloudinary (see cloudinaryUpload.js),
// so URLs look like:
//   https://res.cloudinary.com/<cloud>/image/upload/v123/property-media/abc.jpg
// possibly already carrying a transform segment after /upload/. We inject an
// extra transform right after /upload/ — Cloudinary chains them.

const UPLOAD_MARKER = "/image/upload/";

function isTransformableCloudinaryImage(url) {
  return typeof url === "string" && url.includes("res.cloudinary.com") && url.includes(UPLOAD_MARKER);
}

function withTransform(url, transform) {
  if (!isTransformableCloudinaryImage(url)) return null;
  return url.replace(UPLOAD_MARKER, `${UPLOAD_MARKER}${transform}/`);
}

// Tiny, heavily-blurred placeholder (~1-2 KB) shown instantly while the real
// image downloads, so cards don't pop in from grey.
export function lqipUrl(url) {
  return withTransform(url, "w_32,e_blur:1200,q_10,f_auto");
}

// A right-sized, auto-format/quality version of the card image instead of the
// full-resolution upload. Width is a hint; Cloudinary keeps aspect ratio.
export function cardImageUrl(url, width = 900) {
  return withTransform(url, `w_${width},c_limit,q_auto,f_auto`) || url;
}
