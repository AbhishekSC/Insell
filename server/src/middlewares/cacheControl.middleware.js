export function cacheControl(req, res, next) {
  res.on("finish", () => {});

  const original = res.json.bind(res);
  res.json = function (body) {
    if (!res.getHeader("Cache-Control")) {
      if (req.method === "GET") {
        res.setHeader("Cache-Control", "no-cache, private");
      } else {
        res.setHeader("Cache-Control", "no-store");
      }
    }
    return original(body);
  };

  next();
}

export function publicCache(maxAge = 60) {
  return (_req, res, next) => {
    res.setHeader("Cache-Control", `public, max-age=${maxAge}, stale-while-revalidate=${maxAge * 2}`);
    next();
  };
}
