import { asyncHandler } from "../../core/asyncHandler.js";
import { sendSuccessResponse } from "../../utils/responseHandler.js";
import { getSharePreview, getPublicListingDetail, recordShare } from "./publicListing.app.service.js";
import { renderSharePage, renderNotFoundPage } from "./publicListing.view.js";

const SITE_ORIGIN = (process.env.CLIENT_URL || "https://insell-fe.vercel.app").replace(/\/$/, "");

// GET /api/public/listings/:id/preview  (no auth)
export const getListingSharePreview = asyncHandler(async (req, res) => {
  const preview = await getSharePreview(req.params.id);
  // Short CDN cache so link crawlers and repeat opens don't hit the DB every time.
  res.set("Cache-Control", "public, max-age=300, s-maxage=600");
  return sendSuccessResponse(res, 200, "Listing preview", { listing: preview });
});

// GET /api/public/listings/:id  (no auth) — full logged-out listing view
export const getPublicListing = asyncHandler(async (req, res) => {
  const listing = await getPublicListingDetail(req.params.id);
  res.set("Cache-Control", "public, max-age=120, s-maxage=300");
  return sendSuccessResponse(res, 200, "Listing", { listing });
});

// POST /api/public/listings/:id/share  (no auth) — fire-and-forget share counter
export const recordListingShare = asyncHandler(async (req, res) => {
  await recordShare(req.params.id);
  return sendSuccessResponse(res, 202, "Recorded");
});

// GET /p/:id  (no auth, HTML) — server-rendered share page with OG tags.
// Mounted OUTSIDE /api so the link is short and lives on the site origin
// (via a Vercel proxy rewrite).
export const renderListingSharePage = asyncHandler(async (req, res) => {
  try {
    const listing = await getSharePreview(req.params.id);
    res.set("Content-Type", "text/html; charset=utf-8");
    res.set("Cache-Control", "public, max-age=300, s-maxage=600, stale-while-revalidate=86400");
    return res.status(200).send(renderSharePage(listing, { siteOrigin: SITE_ORIGIN }));
  } catch {
    res.set("Content-Type", "text/html; charset=utf-8");
    res.set("Cache-Control", "public, max-age=60");
    return res.status(404).send(renderNotFoundPage(SITE_ORIGIN));
  }
});
