const WINDOW_SIZE = 60; // 60 one-minute buckets = 1 hour of data
const buckets = [];
let currentMinute = -1;

function getCurrentBucket() {
  const now = Math.floor(Date.now() / 60000);
  if (now !== currentMinute) {
    currentMinute = now;
    buckets.push({ minute: now, total: 0, errors4xx: 0, errors5xx: 0, latencySum: 0, latencyCount: 0, paths: {} });
    if (buckets.length > WINDOW_SIZE) buckets.shift();
  }
  return buckets[buckets.length - 1];
}

export function recordRequest(statusCode, durationMs, path) {
  const b = getCurrentBucket();
  b.total++;
  if (statusCode >= 400 && statusCode < 500) b.errors4xx++;
  if (statusCode >= 500) b.errors5xx++;
  b.latencySum += durationMs;
  b.latencyCount++;
  // Track top slow endpoints
  const key = path.replace(/\/[a-f0-9]{24}/g, '/:id').replace(/\?.*/, '');
  if (!b.paths[key]) b.paths[key] = { count: 0, errors: 0, latencySum: 0 };
  b.paths[key].count++;
  if (statusCode >= 500) b.paths[key].errors++;
  b.paths[key].latencySum += durationMs;
}

export function getMetrics() {
  const now = Math.floor(Date.now() / 60000);

  // Last 5 minutes
  const recent = buckets.filter(b => now - b.minute < 5);
  const totalRequests = recent.reduce((s, b) => s + b.total, 0);
  const total4xx = recent.reduce((s, b) => s + b.errors4xx, 0);
  const total5xx = recent.reduce((s, b) => s + b.errors5xx, 0);
  const totalLatencySum = recent.reduce((s, b) => s + b.latencySum, 0);
  const totalLatencyCount = recent.reduce((s, b) => s + b.latencyCount, 0);
  const avgLatency = totalLatencyCount > 0 ? Math.round(totalLatencySum / totalLatencyCount) : 0;

  // RPM (requests per minute, averaged over last 5 min)
  const rpm = recent.length > 0 ? Math.round(totalRequests / Math.max(recent.length, 1)) : 0;

  // Last hour for trend
  const hourly = buckets.map(b => ({
    minute: b.minute,
    total: b.total,
    errors5xx: b.errors5xx,
    errors4xx: b.errors4xx,
  }));

  // Top 5 slowest endpoints from last 5 min
  const pathMap = {};
  for (const b of recent) {
    for (const [path, data] of Object.entries(b.paths)) {
      if (!pathMap[path]) pathMap[path] = { count: 0, errors: 0, latencySum: 0 };
      pathMap[path].count += data.count;
      pathMap[path].errors += data.errors;
      pathMap[path].latencySum += data.latencySum;
    }
  }
  const slowEndpoints = Object.entries(pathMap)
    .map(([path, d]) => ({ path, avgMs: Math.round(d.latencySum / d.count), count: d.count, errors: d.errors }))
    .sort((a, b) => b.avgMs - a.avgMs)
    .slice(0, 5);

  // Top 5 most errored endpoints
  const errorEndpoints = Object.entries(pathMap)
    .filter(([, d]) => d.errors > 0)
    .map(([path, d]) => ({ path, errors: d.errors, count: d.count, errorRate: Math.round((d.errors / d.count) * 100) }))
    .sort((a, b) => b.errors - a.errors)
    .slice(0, 5);

  return {
    rpm,
    totalRequests,
    errors4xx: total4xx,
    errors5xx: total5xx,
    errorRate: totalRequests > 0 ? Math.round(((total4xx + total5xx) / totalRequests) * 1000) / 10 : 0,
    avgLatencyMs: avgLatency,
    slowEndpoints,
    errorEndpoints,
    trend: hourly,
  };
}
