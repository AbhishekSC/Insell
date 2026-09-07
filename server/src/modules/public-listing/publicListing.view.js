// Renders the server-side share page for /p/:id — a lightweight no-login
// preview for humans plus the Open Graph / Twitter Card tags link crawlers
// (WhatsApp, iMessage, Slack, Facebook) need to unfurl a rich card.

const esc = (s = "") =>
  String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");

export function renderNotFoundPage(siteOrigin) {
  return `<!doctype html><html lang="en"><head>
<meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Listing not available</title></head>
<body style="font-family:system-ui;text-align:center;padding:15vh 1rem;color:#334155">
<h1 style="font-size:1.25rem">This listing isn't available</h1>
<p>It may have been removed or is no longer public.</p>
<a href="${esc(siteOrigin)}" style="color:#2563eb">Browse other properties &rarr;</a>
</body></html>`;
}

export function renderSharePage(listing, { siteOrigin }) {
  const appUrl = `${siteOrigin}/property/${listing.id}`;
  const canonical = `${siteOrigin}/p/${listing.id}`;
  const ogImage = listing.coverImage || `${siteOrigin}/logo-email.png`;
  const title = esc(listing.ogTitle || listing.title);
  const desc = esc(listing.description || "View this property on NearMySpace");
  const thumbs =
    (listing.images || []).length > 1
      ? `<div class="thumbs">${listing.images.map((u) => `<img src="${esc(u)}" alt="" loading="lazy">`).join("")}</div>`
      : "";

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${title} &middot; NearMySpace</title>
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
    ${thumbs}
  </div>
  <p class="foot">Listed on NearMySpace &mdash; verified owners, no brokers</p>
</div>
</body>
</html>`;
}
