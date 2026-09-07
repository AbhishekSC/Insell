// Link-unfurl bots that need server-rendered Open Graph tags. Real browsers
// get redirected to the full app page instead.
const CRAWLER_RE =
  /bot|crawler|spider|facebookexternalhit|facebot|whatsapp|telegram|slackbot|twitterbot|discordbot|linkedinbot|embedly|quora|pinterest|redditbot|applebot|googlebot|bingbot|yandex|baiduspider|duckduckbot|skypeuripreview|vkshare|w3c_validator|preview|scrap/i;

export function isCrawler(userAgent) {
  const ua = String(userAgent || "").trim();
  // No UA at all (curl, some fetchers) — err on the side of showing OG.
  if (!ua) return true;
  return CRAWLER_RE.test(ua);
}
