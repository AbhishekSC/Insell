import { STATIC_URLS } from "./sitemap.constants.js";

/**
 * Derive the site origin from request headers or environment variables.
 * @param {Object} headers - The request headers object.
 * @returns {string} The site origin URL (no trailing slash).
 */
export function getSiteOrigin(headers) {
  if (headers?.["x-forwarded-host"]) {
    const proto = headers["x-forwarded-proto"] || "https";
    return `${proto}://${headers["x-forwarded-host"]}`.replace(/\/$/, "");
  }
  return (
    process.env.CLIENT_URL ||
    process.env.FRONTEND_URL ||
    "https://nearmy-space.vercel.app"
  ).replace(/\/$/, "");
}

/**
 * Build a complete sitemap XML string.
 * @param {Object} params
 * @param {string} params.origin - The site origin URL.
 * @param {Array<{_id: string, updatedAt?: Date, createdAt?: Date}>} params.posts
 * @returns {string} The sitemap XML.
 */
export function buildSitemapXml({ origin, posts }) {
  let xml = `<?xml version="1.0" encoding="UTF-8"?>\n`;
  xml += `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n`;

  // Static URLs
  for (const item of STATIC_URLS) {
    xml += `  <url>\n`;
    xml += `    <loc>${origin}${item.loc}</loc>\n`;
    xml += `    <changefreq>${item.changefreq}</changefreq>\n`;
    xml += `    <priority>${item.priority}</priority>\n`;
    xml += `  </url>\n`;
  }

  // Listing URLs
  for (const post of posts) {
    const lastMod = (post.updatedAt || post.createdAt || new Date()).toISOString();
    xml += `  <url>\n`;
    xml += `    <loc>${origin}/property/${post._id}</loc>\n`;
    xml += `    <lastmod>${lastMod}</lastmod>\n`;
    xml += `    <changefreq>weekly</changefreq>\n`;
    xml += `    <priority>0.8</priority>\n`;
    xml += `  </url>\n`;
  }

  xml += `</urlset>`;
  return xml;
}
