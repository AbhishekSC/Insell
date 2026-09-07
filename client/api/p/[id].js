// Server-rendered share page for a single listing: /p/:id
//
// Real browsers get a lightweight, no-login preview with a CTA into the app.
// Link crawlers (WhatsApp, iMessage, Slack, Facebook, Google) get the Open
// Graph tags they need to render a rich card. A pure client-side React route
// can't do this — crawlers don't run JS, so they'd only ever see the SPA's
// static site-wide tags.

const API_ORIGIN = (
  process.env.PUBLIC_API_ORIGIN ||
  process.env.VITE_API_URL ||
  "https://insell-be.onrender.com"
).replace(/\/$/, "");

const esc = (s = "") =>
  String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");

function notFound(res) {
  res.setHeader("Content-Type", "text/html; charset=utf-8");
  res.setHeader("Cache-Control", "public, max-age=60");
  res.status(404).send(`<!doctype html><meta charset="utf-8"><title>Listing not found</title>
<meta name="viewport" content="width=device-width,initial-scale=1">
<body style="font-family:system-ui;text-align:center;padding:15vh 1rem;color:#334155">
<h1 style="font-size:1.25rem">This listing isn't available</h1>
<p>It may have been removed or is no longer public.</p>
<a href="/" style="color:#2563eb">Browse other properties →</a>`);
}

export default async function handler(req, res) {
  const { id } = req.query;
  const origin = `https://${req.headers["x-forwarded-host"] || req.headers.host}`;

  if (!id || !/^[a-f0-9]{24}$/i.test(String(id))) return notFound(res);

  let listing;
  try {
    const r = await fetch(`${API_ORIGIN}/api/public/listings/${id}/preview`, {
      headers: { accept: "application/json" },
    });
    if (!r.ok) return notFound(res);
    listing = (await r.json())?.data?.listing;
  } catch {
    return notFound(res);
  }
  if (!listing) return notFound(res);

  const appUrl = `${origin}/property/${listing.id}`;
  const canonical = `${origin}/p/${listing.id}`;
  const ogImage = listing.coverImage || `${origin}/logo-email.png`;
  const title = esc(listing.ogTitle || listing.title);
  const desc = esc(listing.description || "View this property on NearMySpace");

  res.setHeader("Content-Type", "text/html; charset=utf-8");
  res.setHeader("Cache-Control", "public, max-age=300, s-maxage=600, stale-while-revalidate=86400");
  res.status(200).send(`<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${title} · NearMySpace</title>
<meta name="description" content="${desc}">
<link rel="canonical" href="${canonical}">
<meta property="og:type" content="website">
<meta property="og:site_name" content="NearMySpace">
<meta property="og:title" content="${title}">
<meta property="og:description" content="${desc}">
<meta property="og:url" content="${canonical}">
<meta property="og:image" content="${esc(ogImage)}">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="${title}">
<meta name="twitter:description" content="${desc}">
<meta name="twitter:image" content="${esc(ogImage)}">
<style>
  *{box-sizing:border-box;margin:0}
  body{font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif;color:#0f172a;background:#f8fafc}
  .wrap{max-width:560px;margin:0 auto;padding:1rem}
  .card{background:#fff;border:1px solid #e2e8f0;border-radius:16px;overflow:hidden}
  .hero{aspect-ratio:16/10;width:100%;object-fit:cover;background:#e2e8f0;display:block}
  .body{padding:1rem 1.15rem 1.25rem}
  .price{font-size:1.5rem;font-weight:700}
  .badge{display:inline-block;font-size:.7rem;font-weight:700;text-transform:uppercase;letter-spacing:.04em;color:#2563eb;background:#eff6ff;padding:.2rem .5rem;border-radius:6px;margin-bottom:.5rem}
  h1{font-size:1.05rem;font-weight:600;margin:.35rem 0 .15rem}
  .muted{color:#64748b;font-size:.9rem}
  .specs{margin:.65rem 0 0;font-size:.9rem;color:#334155}
  .cta{display:block;text-align:center;margin-top:1.1rem;background:#2563eb;color:#fff;text-decoration:none;font-weight:600;padding:.8rem;border-radius:10px}
  .thumbs{display:flex;gap:.4rem;padding:0 1.15rem 1.15rem;overflow-x:auto}
  .thumbs img{height:64px;width:88px;object-fit:cover;border-radius:8px;flex:0 0 auto}
  .foot{text-align:center;color:#94a3b8;font-size:.8rem;margin:1rem 0}
</style>
</head>
<body>
<div class="wrap">
  <div class="card">
    ${listing.coverImage ? `<img class="hero" src="${esc(listing.coverImage)}" alt="${esc(listing.title)}">` : ""}
    <div class="body">
      ${listing.badge ? `<span class="badge">${esc(listing.badge)}</span>` : ""}
      <div class="price">${esc(listing.priceLabel || "")}</div>
      <h1>${esc(listing.title)}</h1>
      ${listing.locationLabel ? `<div class="muted">${esc(listing.locationLabel)}</div>` : ""}
      ${listing.specsLabel ? `<div class="specs">${esc(listing.specsLabel)}</div>` : ""}
      <a class="cta" href="${appUrl}">View full details &amp; contact owner</a>
    </div>
    ${
      (listing.images || []).length > 1
        ? `<div class="thumbs">${listing.images.map((u) => `<img src="${esc(u)}" alt="">`).join("")}</div>`
        : ""
    }
  </div>
  <p class="foot">Listed on NearMySpace — verified owners, no brokers</p>
</div>
</body>
</html>`);
}
