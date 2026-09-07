// Server-rendered share page for /u/:id — a logged-out preview of a member's
// profile plus the Open Graph tags link crawlers need.

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
<title>Profile not available</title></head>
<body style="font-family:system-ui;text-align:center;padding:15vh 1rem;color:#334155">
<h1 style="font-size:1.25rem">This profile isn't available</h1>
<a href="${esc(siteOrigin)}" style="color:#2563eb">Browse NearMySpace &rarr;</a>
</body></html>`;
}

export function renderProfilePage(profile, { siteOrigin }) {
  const appUrl = `${siteOrigin}/users/${profile.id}`;
  const canonical = `${siteOrigin}/users/${profile.id}`;
  const ogImage = profile.avatar || `${siteOrigin}/logo-email.png`;
  const title = `${esc(profile.name)}${profile.isVerified ? " ✓" : ""} on NearMySpace`;
  const descBits = [];
  if (profile.postsCount) descBits.push(`${profile.postsCount} listing${profile.postsCount === 1 ? "" : "s"}`);
  if (profile.city) descBits.push(profile.city);
  if (profile.bio) descBits.push(profile.bio);
  const desc = esc(descBits.join(" · ") || "View this member on NearMySpace");

  const posts = (profile.previewPosts || [])
    .map(
      (p) => `<a class="tile" href="${appUrl}">
        ${p.coverImage ? `<img src="${esc(p.coverImage)}" alt="${esc(p.title)}" loading="lazy">` : `<span class="ph"></span>`}
        <span class="cap">${esc(p.priceLabel)} · ${esc(p.title)}</span>
      </a>`
    )
    .join("");

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${title}</title>
<meta name="description" content="${desc}">
<link rel="canonical" href="${canonical}">
<meta property="og:type" content="profile">
<meta property="og:site_name" content="NearMySpace">
<meta property="og:title" content="${title}">
<meta property="og:description" content="${desc}">
<meta property="og:url" content="${canonical}">
<meta property="og:image" content="${esc(ogImage)}">
<meta name="twitter:card" content="summary">
<meta name="twitter:title" content="${title}">
<meta name="twitter:description" content="${desc}">
<meta name="twitter:image" content="${esc(ogImage)}">
<style>
  *{box-sizing:border-box;margin:0}
  body{font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif;color:#0f172a;background:#f8fafc}
  .wrap{max-width:600px;margin:0 auto;padding:1.25rem}
  .head{display:flex;gap:1rem;align-items:center}
  .avatar{width:76px;height:76px;border-radius:50%;object-fit:cover;background:#e2e8f0;flex:0 0 auto}
  h1{font-size:1.15rem;font-weight:700;display:flex;align-items:center;gap:.35rem}
  .v{color:#2563eb}
  .muted{color:#64748b;font-size:.9rem;margin-top:.15rem}
  .stats{display:flex;gap:1.25rem;margin-top:.5rem;font-size:.9rem}
  .stats b{font-weight:700}
  .bio{margin-top:.9rem;font-size:.92rem;line-height:1.5}
  .grid{display:grid;grid-template-columns:repeat(3,1fr);gap:.35rem;margin-top:1.25rem}
  .tile{position:relative;aspect-ratio:1;display:block;border-radius:8px;overflow:hidden;background:#e2e8f0;text-decoration:none}
  .tile img,.tile .ph{width:100%;height:100%;object-fit:cover;display:block}
  .tile .cap{position:absolute;left:0;right:0;bottom:0;padding:.4rem .5rem;font-size:.68rem;color:#fff;background:linear-gradient(transparent,rgba(0,0,0,.7));white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
  .cta{display:block;text-align:center;margin-top:1.25rem;background:#2563eb;color:#fff;text-decoration:none;font-weight:600;padding:.8rem;border-radius:10px}
  .foot{text-align:center;color:#94a3b8;font-size:.8rem;margin:1.25rem 0}
</style>
</head>
<body>
<div class="wrap">
  <div class="head">
    <img class="avatar" src="${esc(ogImage)}" alt="${esc(profile.name)}">
    <div>
      <h1>${esc(profile.name)}${profile.isVerified ? ' <span class="v">✓</span>' : ""}</h1>
      ${profile.city ? `<div class="muted">${esc(profile.city)}</div>` : ""}
      <div class="stats">
        <span><b>${profile.postsCount}</b> listings</span>
        <span><b>${profile.connectionsCount}</b> connections</span>
        ${profile.rating ? `<span><b>${profile.rating.avg}★</b> (${profile.rating.count})</span>` : ""}
      </div>
    </div>
  </div>
  ${profile.bio ? `<p class="bio">${esc(profile.bio)}</p>` : ""}
  ${posts ? `<div class="grid">${posts}</div>` : ""}
  <a class="cta" href="${appUrl}">${profile.hasMorePosts ? `See all ${profile.postsCount} listings & contact` : "Open on NearMySpace"}</a>
  <p class="foot">NearMySpace — verified owners, no brokers</p>
</div>
</body>
</html>`;
}
