import { ArrowDown, ArrowUp } from "lucide-react";

function formatMoney(amount) {
  const num = Number(amount) || 0;
  if (num >= 10000000) return `₹${(num / 10000000).toFixed(2)} Cr`;
  if (num >= 100000) return `₹${(num / 100000).toFixed(2)} L`;
  return `₹${num.toLocaleString("en-IN")}`;
}

function formatShortDate(dateString) {
  const date = new Date(dateString);
  if (Number.isNaN(date.getTime())) return "";
  return new Intl.DateTimeFormat("en-IN", { day: "numeric", month: "short", year: "numeric" }).format(date);
}

const WIDTH = 600;
const HEIGHT = 160;
const PADDING = 24;

// No charting library in this project — this is a handful of data points,
// so a plain SVG line is simpler than pulling in a dependency for it.
export default function PriceHistoryChart({ history }) {
  const points = Array.isArray(history) ? history.filter((h) => Number.isFinite(h?.price)) : [];
  if (points.length < 2) return null;

  const prices = points.map((p) => p.price);
  const minPrice = Math.min(...prices);
  const maxPrice = Math.max(...prices);
  const priceRange = maxPrice - minPrice || 1;

  const stepX = (WIDTH - PADDING * 2) / (points.length - 1);
  const coords = points.map((p, i) => {
    const x = PADDING + i * stepX;
    const y = HEIGHT - PADDING - ((p.price - minPrice) / priceRange) * (HEIGHT - PADDING * 2);
    return { x, y, price: p.price, changedAt: p.changedAt };
  });

  const linePath = coords.map((c, i) => `${i === 0 ? "M" : "L"} ${c.x.toFixed(1)} ${c.y.toFixed(1)}`).join(" ");
  const areaPath = `${linePath} L ${coords[coords.length - 1].x.toFixed(1)} ${HEIGHT - PADDING} L ${coords[0].x.toFixed(1)} ${HEIGHT - PADDING} Z`;

  const firstPrice = points[0].price;
  const lastPrice = points[points.length - 1].price;
  const netChange = lastPrice - firstPrice;
  const netChangePct = firstPrice > 0 ? (netChange / firstPrice) * 100 : 0;

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <div>
          <p className="text-sm text-base-content/60">Since {formatShortDate(points[0].changedAt)}</p>
          <p className={`mt-0.5 flex items-center gap-1 text-lg font-bold ${netChange < 0 ? "text-success" : netChange > 0 ? "text-error" : "text-base-content"}`}>
            {netChange !== 0 ? (netChange < 0 ? <ArrowDown className="size-4" /> : <ArrowUp className="size-4" />) : null}
            {netChange === 0 ? "No change" : `${formatMoney(Math.abs(netChange))} (${Math.abs(netChangePct).toFixed(1)}%)`}
          </p>
        </div>
        <div className="text-right">
          <p className="text-xs text-base-content/60">Current price</p>
          <p className="text-lg font-bold text-primary">{formatMoney(lastPrice)}</p>
        </div>
      </div>

      <svg viewBox={`0 0 ${WIDTH} ${HEIGHT}`} className="w-full" preserveAspectRatio="none">
        <path d={areaPath} fill="url(#priceHistoryGradient)" stroke="none" />
        <path d={linePath} fill="none" stroke="#4f46e5" strokeWidth="2" />
        {coords.map((c, i) => (
          <circle key={i} cx={c.x} cy={c.y} r="3.5" fill="#4f46e5" />
        ))}
        <defs>
          <linearGradient id="priceHistoryGradient" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#4f46e5" stopOpacity="0.18" />
            <stop offset="100%" stopColor="#4f46e5" stopOpacity="0" />
          </linearGradient>
        </defs>
      </svg>

      <div className="mt-4 space-y-2">
        {[...points].reverse().map((p, i, arr) => {
          const prevPrice = arr[i + 1]?.price;
          const delta = prevPrice !== undefined ? p.price - prevPrice : 0;
          return (
            <div key={i} className="flex items-center justify-between rounded-lg bg-base-200 px-3 py-2 text-sm">
              <span className="text-base-content/60">{formatShortDate(p.changedAt)}</span>
              <div className="flex items-center gap-2">
                {delta !== 0 && (
                  <span className={`flex items-center gap-0.5 text-xs font-medium ${delta < 0 ? "text-success" : "text-error"}`}>
                    {delta < 0 ? <ArrowDown className="size-3" /> : <ArrowUp className="size-3" />}
                    {formatMoney(Math.abs(delta))}
                  </span>
                )}
                <span className="font-semibold text-base-content">{formatMoney(p.price)}</span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
