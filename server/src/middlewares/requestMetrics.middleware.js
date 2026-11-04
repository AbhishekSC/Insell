import { recordRequest } from "../services/requestMetrics.service.js";

export function requestMetricsMiddleware(req, res, next) {
  const start = Date.now();
  res.on("finish", () => {
    recordRequest(res.statusCode, Date.now() - start, req.originalUrl || req.url);
  });
  next();
}
