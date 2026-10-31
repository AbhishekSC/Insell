const CACHE_NAME = "insell-v1";
const API_CACHE = "insell-api-v1";

const STATIC_ASSETS = ["/", "/index.html"];

const API_CACHE_ROUTES = [
  "/api/posts/map-pins",
  "/api/personalization/trending-locations",
];

const API_CACHE_MAX_AGE = 2 * 60 * 1000;

self.addEventListener("install", () => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((k) => k !== CACHE_NAME && k !== API_CACHE)
            .map((k) => caches.delete(k))
        )
      )
      .then(() => self.clients.claim())
  );
});

function isApiCacheable(url) {
  return API_CACHE_ROUTES.some((route) => url.pathname.includes(route));
}

function isStaticAsset(url) {
  return /\.(js|css|woff2?|ttf|png|jpg|jpeg|webp|avif|svg|ico)(\?.*)?$/.test(
    url.pathname
  );
}

self.addEventListener("fetch", (event) => {
  const url = new URL(event.request.url);

  if (event.request.method !== "GET") return;

  if (isApiCacheable(url)) {
    event.respondWith(
      caches.open(API_CACHE).then(async (cache) => {
        const cached = await cache.match(event.request);
        if (cached) {
          const cachedTime = cached.headers.get("x-sw-cached-at");
          if (cachedTime && Date.now() - Number(cachedTime) < API_CACHE_MAX_AGE) {
            return cached;
          }
        }
        try {
          const response = await fetch(event.request);
          if (response.ok) {
            const cloned = response.clone();
            const headers = new Headers(cloned.headers);
            headers.set("x-sw-cached-at", String(Date.now()));
            const body = await cloned.blob();
            cache.put(
              event.request,
              new Response(body, {
                status: cloned.status,
                statusText: cloned.statusText,
                headers,
              })
            );
          }
          return response;
        } catch (err) {
          if (cached) return cached;
          throw err;
        }
      })
    );
    return;
  }

  if (isStaticAsset(url) && url.origin === self.location.origin) {
    event.respondWith(
      caches.open(CACHE_NAME).then(async (cache) => {
        const cached = await cache.match(event.request);
        if (cached) return cached;
        try {
          const response = await fetch(event.request);
          if (response.ok) {
            cache.put(event.request, response.clone());
          }
          return response;
        } catch (err) {
          if (cached) return cached;
          throw err;
        }
      })
    );
    return;
  }

  if (url.hostname === "res.cloudinary.com") {
    event.respondWith(
      caches.open(CACHE_NAME).then(async (cache) => {
        const cached = await cache.match(event.request);
        if (cached) return cached;
        try {
          const response = await fetch(event.request);
          if (response.ok) {
            cache.put(event.request, response.clone());
          }
          return response;
        } catch (err) {
          if (cached) return cached;
          throw err;
        }
      })
    );
    return;
  }
});
