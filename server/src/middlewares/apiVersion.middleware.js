const DEFAULT_VERSION = 1;
const SUPPORTED_VERSIONS = [1];

export function apiVersion(req, res, next) {
  let version = DEFAULT_VERSION;

  const pathMatch = req.baseUrl.match(/\/api\/v(\d+)/);
  if (pathMatch) {
    version = parseInt(pathMatch[1], 10);
  }

  const headerVersion = req.headers["x-api-version"];
  if (headerVersion) {
    const parsed = parseInt(headerVersion, 10);
    if (!isNaN(parsed) && parsed > 0) {
      version = parsed;
    }
  }

  if (!SUPPORTED_VERSIONS.includes(version)) {
    return res.status(400).json({
      status: "error",
      message: `API version ${version} is not supported. Supported versions: ${SUPPORTED_VERSIONS.join(", ")}`,
    });
  }

  req.apiVersion = version;
  res.setHeader("X-API-Version", version);
  next();
}

export function versionedHandler(handlers) {
  return (req, res, next) => {
    const version = req.apiVersion || DEFAULT_VERSION;
    const handler = handlers[`v${version}`] || handlers.default;
    if (!handler) {
      return res.status(400).json({
        status: "error",
        message: `This endpoint is not available in API version ${version}`,
      });
    }
    return handler(req, res, next);
  };
}

export { SUPPORTED_VERSIONS, DEFAULT_VERSION };
