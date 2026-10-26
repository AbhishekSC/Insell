import crypto from "crypto";

const token = process.env.LOGTAIL_SOURCE_TOKEN;
const rawHost = process.env.LOGTAIL_INGESTING_HOST;

const isEnabled = Boolean(token && rawHost);
const endpoint = rawHost
  ? rawHost.startsWith("http")
    ? rawHost
    : `https://${rawHost}`
  : "";

const serviceName = "nearmyspace-backend";
const environment = process.env.NODE_ENV || "development";

// In-memory buffer for batched trace spans
let spanBuffer = [];
let metricIntervalTimer = null;
let spanFlushTimer = null;

/**
 * Sends a batch of OTLP resource spans to Better Stack.
 */
async function flushSpans() {
  if (!isEnabled || spanBuffer.length === 0) return;

  const batch = spanBuffer.splice(0, 100);

  const payload = {
    resourceSpans: [
      {
        resource: {
          attributes: [
            { key: "service.name", value: { stringValue: serviceName } },
            { key: "environment", value: { stringValue: environment } },
          ],
        },
        scopeSpans: [
          {
            scope: { name: "express-http" },
            spans: batch,
          },
        ],
      },
    ],
  };

  try {
    await fetch(`${endpoint}/v1/traces`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(payload),
    });
  } catch {
    // Non-blocking telemetry
  }
}

/**
 * Periodically collects and exports Node.js runtime metrics (RAM, CPU) to Better Stack.
 */
async function sendSystemMetrics() {
  if (!isEnabled) return;

  const mem = process.memoryUsage();
  const nowNano = (BigInt(Date.now()) * 1000000n).toString();

  const payload = {
    resourceMetrics: [
      {
        resource: {
          attributes: [
            { key: "service.name", value: { stringValue: serviceName } },
            { key: "environment", value: { stringValue: environment } },
          ],
        },
        scopeMetrics: [
          {
            scope: { name: "nodejs-runtime" },
            metrics: [
              {
                name: "process.runtime.nodejs.memory.heap.used",
                description: "Process heap memory used",
                unit: "By",
                gauge: {
                  dataPoints: [
                    {
                      timeUnixNano: nowNano,
                      asInt: String(mem.heapUsed),
                    },
                  ],
                },
              },
              {
                name: "process.runtime.nodejs.memory.rss",
                description: "Resident Set Size",
                unit: "By",
                gauge: {
                  dataPoints: [
                    {
                      timeUnixNano: nowNano,
                      asInt: String(mem.rss),
                    },
                  ],
                },
              },
            ],
          },
        ],
      },
    ],
  };

  try {
    await fetch(`${endpoint}/v1/metrics`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(payload),
    });
  } catch {
    // Non-blocking telemetry
  }
}

/**
 * Initializes telemetry timers.
 */
export function initTelemetry() {
  if (!isEnabled) return;

  // Flush metrics every 30 seconds
  if (!metricIntervalTimer) {
    sendSystemMetrics();
    metricIntervalTimer = setInterval(sendSystemMetrics, 30000);
    metricIntervalTimer.unref?.();
  }

  // Flush queued spans every 5 seconds
  if (!spanFlushTimer) {
    spanFlushTimer = setInterval(flushSpans, 5000);
    spanFlushTimer.unref?.();
  }
}

/**
 * Express middleware to capture HTTP request traces.
 */
export function telemetryMiddleware(req, res, next) {
  if (!isEnabled) return next();

  // Don't trace internal health checks
  if (req.path === "/health" || req.path === "/ping") return next();

  const startMs = Date.now();
  const traceId = crypto.randomBytes(16).toString("hex").toUpperCase();
  const spanId = crypto.randomBytes(8).toString("hex").toUpperCase();

  res.on("finish", () => {
    try {
      const durationMs = Date.now() - startMs;
      const startNano = (BigInt(startMs) * 1000000n).toString();
      const endNano = (BigInt(Date.now()) * 1000000n).toString();

      const statusCode = res.statusCode || 200;
      const isError = statusCode >= 500;

      const span = {
        traceId,
        spanId,
        name: `${req.method} ${req.route?.path || req.baseUrl || req.path}`,
        kind: 2, // SPAN_KIND_SERVER
        startTimeUnixNano: startNano,
        endTimeUnixNano: endNano,
        attributes: [
          { key: "http.method", value: { stringValue: req.method } },
          { key: "http.target", value: { stringValue: req.originalUrl || req.url } },
          { key: "http.status_code", value: { intValue: statusCode } },
          { key: "http.route", value: { stringValue: req.baseUrl + (req.route?.path || req.path) } },
          { key: "http.duration_ms", value: { intValue: durationMs } },
        ],
        status: {
          code: isError ? 2 : 1, // 2 = ERROR, 1 = OK
        },
      };

      spanBuffer.push(span);

      // Flush early if buffer has over 20 items
      if (spanBuffer.length >= 20) {
        flushSpans();
      }
    } catch {
      // Non-blocking
    }
  });

  next();
}
