import { asyncHandler } from "../../core/asyncHandler.js";
import { findActivePostIds } from "./sitemap.repository.js";
import { getSiteOrigin, buildSitemapXml } from "./sitemap.service.js";

/**
 * GET handler — generate and return the sitemap XML.
 */
export const generateSitemapXml = asyncHandler(async (req, res) => {
  const origin = getSiteOrigin(req.headers);
  const activePosts = await findActivePostIds();
  const xml = buildSitemapXml({ origin, posts: activePosts });

  res.setHeader("Content-Type", "application/xml; charset=utf-8");
  res.setHeader("Cache-Control", "public, max-age=3600, s-maxage=14400");
  return res.status(200).send(xml);
});
