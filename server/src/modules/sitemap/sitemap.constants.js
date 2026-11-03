/**
 * Static pages included in every sitemap generation.
 * Each entry's `loc` is a path suffix — the origin is prepended at build time.
 */
export const STATIC_URLS = [
  { loc: "/", priority: "1.0", changefreq: "daily" },
  { loc: "/marketplace", priority: "0.9", changefreq: "daily" },
  { loc: "/login", priority: "0.3", changefreq: "monthly" },
  { loc: "/signup", priority: "0.5", changefreq: "monthly" },
];

/** Maximum number of property posts to include in the sitemap. */
export const DEFAULT_LIMIT = 5000;
