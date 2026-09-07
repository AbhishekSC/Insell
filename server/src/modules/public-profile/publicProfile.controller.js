import { asyncHandler } from "../../core/asyncHandler.js";
import { sendSuccessResponse } from "../../utils/responseHandler.js";
import { getPublicProfile } from "./publicProfile.app.service.js";
import { renderProfilePage, renderNotFoundPage } from "./publicProfile.view.js";
import { isCrawler } from "../../utils/isCrawler.js";

const SITE_ORIGIN = (process.env.CLIENT_URL || "https://insell-fe.vercel.app").replace(/\/$/, "");

// GET /api/public/users/:id  (no auth) — JSON for the logged-out profile page
export const getPublicUserProfile = asyncHandler(async (req, res) => {
  const profile = await getPublicProfile(req.params.id);
  res.set("Cache-Control", "public, max-age=120, s-maxage=300");
  return sendSuccessResponse(res, 200, "Public profile", { profile });
});

// GET /u/:id  (no auth) — link-unfurl bots get the server-rendered Open
// Graph page; real browsers are redirected to the full app profile page.
export const renderProfileSharePage = asyncHandler(async (req, res) => {
  if (!isCrawler(req.get("user-agent"))) {
    return res.redirect(302, `${SITE_ORIGIN}/users/${req.params.id}`);
  }
  try {
    const profile = await getPublicProfile(req.params.id);
    res.set("Content-Type", "text/html; charset=utf-8");
    res.set("Cache-Control", "public, max-age=300, s-maxage=600, stale-while-revalidate=86400");
    return res.status(200).send(renderProfilePage(profile, { siteOrigin: SITE_ORIGIN }));
  } catch {
    res.set("Content-Type", "text/html; charset=utf-8");
    res.set("Cache-Control", "public, max-age=60");
    return res.status(404).send(renderNotFoundPage(SITE_ORIGIN));
  }
});
