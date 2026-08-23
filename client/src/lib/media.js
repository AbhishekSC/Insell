// Story/post media is stored as a relative upload path on the server, so it
// needs the API origin prefixed — absolute URLs (already-hosted media) pass through.
export function resolveMediaUrl(url) {
  if (!url) return url;
  return url.startsWith("http") ? url : `${import.meta.env.VITE_API_URL || "http://localhost:5001"}${url}`;
}
