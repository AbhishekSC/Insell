import asyncHandler from "express-async-handler";
import PropertyPost from "../models/PropertyPost.model.js";

const getSiteOrigin = () => {
  return (process.env.CLIENT_URL || process.env.FRONTEND_URL || "https://insell.in").replace(/\/$/, "");
};

export const generateSitemapXml = asyncHandler(async (req, res) => {
  const origin = getSiteOrigin();

  // Fetch up to 5,000 public active listings
  const activePosts = await PropertyPost.find({
    status: { $nin: ["deleted", "blocked"] },
    isDraft: { $ne: true },
  })
    .select("_id updatedAt createdAt")
    .sort({ updatedAt: -1 })
    .limit(5000)
    .lean();

  const staticUrls = [
    { loc: `${origin}/`, priority: "1.0", changefreq: "daily" },
    { loc: `${origin}/marketplace`, priority: "0.9", changefreq: "daily" },
    { loc: `${origin}/login`, priority: "0.3", changefreq: "monthly" },
    { loc: `${origin}/signup`, priority: "0.5", changefreq: "monthly" },
  ];

  let xml = `<?xml version="1.0" encoding="UTF-8"?>\n`;
  xml += `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n`;

  // Static URLs
  for (const item of staticUrls) {
    xml += `  <url>\n`;
    xml += `    <loc>${item.loc}</loc>\n`;
    xml += `    <changefreq>${item.changefreq}</changefreq>\n`;
    xml += `    <priority>${item.priority}</priority>\n`;
    xml += `  </url>\n`;
  }

  // Listing URLs
  for (const post of activePosts) {
    const lastMod = (post.updatedAt || post.createdAt || new Date()).toISOString();
    xml += `  <url>\n`;
    xml += `    <loc>${origin}/property/${post._id}</loc>\n`;
    xml += `    <lastmod>${lastMod}</lastmod>\n`;
    xml += `    <changefreq>weekly</changefreq>\n`;
    xml += `    <priority>0.8</priority>\n`;
    xml += `  </url>\n`;
  }

  xml += `</urlset>`;

  res.setHeader("Content-Type", "application/xml; charset=utf-8");
  res.setHeader("Cache-Control", "public, max-age=3600, s-maxage=14400"); // 1 hr browser, 4 hrs CDN
  return res.status(200).send(xml);
});
