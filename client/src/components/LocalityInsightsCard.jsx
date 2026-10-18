import { useQuery } from "@tanstack/react-query";
import { ArrowDown, ArrowUp, Building2, Home, IndianRupee, TrendingUp } from "lucide-react";
import axiosInstance from "../lib/axios";

function formatMoney(amount) {
  const num = Number(amount) || 0;
  if (num >= 10000000) return `₹${(num / 10000000).toFixed(2)} Cr`;
  if (num >= 100000) return `₹${(num / 100000).toFixed(2)} L`;
  return `₹${num.toLocaleString("en-IN")}`;
}

const CHART_W = 600;
const CHART_H = 140;
const PAD = 28;

function MiniTrendChart({ data }) {
  if (!data || data.length < 2) {
    return data?.length === 1 ? (
      <div className="flex items-center justify-center rounded-lg border border-base-200 bg-base-200/30 px-3 py-4 text-center">
        <div>
          <p className="text-sm font-semibold text-base-content">₹{data[0].avgPsf.toLocaleString("en-IN")}/sqft</p>
          <p className="mt-1 text-xs text-base-content/50">{data[0].month} · {data[0].listings} listing{data[0].listings > 1 ? "s" : ""}</p>
        </div>
      </div>
    ) : null;
  }

  const values = data.map((d) => d.avgPsf);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;

  const stepX = (CHART_W - PAD * 2) / (data.length - 1);
  const coords = data.map((d, i) => ({
    x: PAD + i * stepX,
    y: CHART_H - PAD - ((d.avgPsf - min) / range) * (CHART_H - PAD * 2),
    value: d.avgPsf,
    label: d.month,
    listings: d.listings,
  }));

  const line = coords
    .map((c, i) => `${i === 0 ? "M" : "L"} ${c.x.toFixed(1)} ${c.y.toFixed(1)}`)
    .join(" ");
  const area = `${line} L ${coords.at(-1).x.toFixed(1)} ${CHART_H - PAD} L ${coords[0].x.toFixed(1)} ${CHART_H - PAD} Z`;

  return (
    <div className="rounded-lg border border-base-200 bg-base-200/20 p-2.5">
      <p className="mb-1.5 text-[11px] font-medium text-base-content/50">
        Avg ₹/sqft — {data.length} months
      </p>
      <svg viewBox={`0 0 ${CHART_W} ${CHART_H}`} className="w-full" preserveAspectRatio="none">
        <defs>
          <linearGradient id="localityMiniGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#2f6fed" stopOpacity="0.18" />
            <stop offset="100%" stopColor="#2f6fed" stopOpacity="0" />
          </linearGradient>
        </defs>

        {[0, 0.5, 1].map((pct) => {
          const y = CHART_H - PAD - pct * (CHART_H - PAD * 2);
          const val = Math.round(min + pct * range);
          return (
            <g key={pct}>
              <line x1={PAD} y1={y} x2={CHART_W - PAD} y2={y} stroke="currentColor" strokeOpacity="0.07" strokeWidth="1" />
              <text x={PAD - 4} y={y + 3} textAnchor="end" fill="currentColor" fillOpacity="0.3" fontSize="9">
                ₹{val.toLocaleString("en-IN")}
              </text>
            </g>
          );
        })}

        <path d={area} fill="url(#localityMiniGrad)" />
        <path d={line} fill="none" stroke="#2f6fed" strokeWidth="2.5" strokeLinejoin="round" />
        {coords.map((c, i) => (
          <circle key={i} cx={c.x} cy={c.y} r="4" fill="#2f6fed" />
        ))}
        {coords.map((c, i) => (
          <g key={`t${i}`}>
            <text x={c.x} y={CHART_H - 6} textAnchor="middle" fill="currentColor" fillOpacity="0.4" fontSize="10">
              {c.label.split(" ")[0]}
            </text>
            <text x={c.x} y={c.y - 10} textAnchor="middle" fill="#2f6fed" fontSize="9" fontWeight="600">
              ₹{c.value.toLocaleString("en-IN")}
            </text>
          </g>
        ))}
      </svg>
    </div>
  );
}

function StatCard({ icon: Icon, label, value, subtext, tone }) {
  const toneClasses = {
    success: "border-success/20 bg-success/5",
    error: "border-error/20 bg-error/5",
    primary: "border-primary/20 bg-primary/5",
    neutral: "border-base-200 bg-base-200/30",
  };

  return (
    <div className={`rounded-lg border p-2.5 ${toneClasses[tone] || toneClasses.neutral}`}>
      <div className="mb-0.5 flex items-center gap-1">
        {Icon && <Icon className="size-3 text-base-content/40" />}
        <p className="text-[10px] font-semibold uppercase tracking-wide text-base-content/50">{label}</p>
      </div>
      <p className="text-lg font-bold leading-tight text-base-content">{value}</p>
      {subtext && <p className="mt-0.5 text-[11px] text-base-content/50">{subtext}</p>}
    </div>
  );
}

export default function LocalityInsightsCard({ city, locality, price, areaSqft, listingType }) {
  const intent = listingType === "Rent" ? "rent" : "buy";

  const { data, isLoading } = useQuery({
    queryKey: ["localityInsight", city, locality, intent],
    queryFn: async () => {
      const res = await axiosInstance.get("/locality-trends/detail", {
        params: { city, locality, intent },
      });
      return res.data?.data;
    },
    enabled: !!city && !!locality,
    staleTime: 1000 * 60 * 30,
  });

  if (!city || !locality) return null;
  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-6">
        <span className="loading loading-spinner loading-sm text-primary" />
      </div>
    );
  }
  if (!data || !data.monthlyData?.length) return null;

  const currentAvgPsf = data.currentAvgPsf;
  const propertyPsf = areaSqft > 0 && price > 0 ? Math.round(price / areaSqft) : null;
  const comparisonPct = propertyPsf && currentAvgPsf
    ? Number((((propertyPsf - currentAvgPsf) / currentAvgPsf) * 100).toFixed(1))
    : null;

  const latestAvgPrice = data.monthlyData[data.monthlyData.length - 1]?.avgPrice;
  const pricePct = !comparisonPct && price > 0 && latestAvgPrice > 0
    ? Number((((price - latestAvgPrice) / latestAvgPrice) * 100).toFixed(1))
    : null;

  const latestMonth = data.monthlyData[data.monthlyData.length - 1];

  const cmp = comparisonPct ?? pricePct;
  let insightTag = null;
  if (cmp !== null) {
    if (cmp < -5) {
      insightTag = { text: `${Math.abs(cmp)}% below avg`, tone: "success" };
    } else if (cmp > 10) {
      insightTag = { text: `${cmp}% above avg`, tone: "error" };
    } else {
      insightTag = { text: "Near avg price", tone: "neutral" };
    }
  }

  return (
    <div className="space-y-3">
      {/* Compact insight badge */}
      {insightTag && (
        <div className="flex items-center gap-2">
          <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold ${
            insightTag.tone === "success"
              ? "bg-success/10 text-success"
              : insightTag.tone === "error"
                ? "bg-error/10 text-error"
                : "bg-base-200 text-base-content/60"
          }`}>
            {cmp < 0 ? <ArrowDown className="size-3" /> : cmp > 0 ? <ArrowUp className="size-3" /> : null}
            {insightTag.text}
          </span>
          <span className="text-xs text-base-content/40">
            based on {data.totalListings} listings
          </span>
        </div>
      )}

      {/* Stats grid — 2x2 on mobile, 4 columns on sm+ */}
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 sm:gap-3">
        <StatCard
          icon={IndianRupee}
          label="Avg Price"
          value={
            <>
              ₹{currentAvgPsf?.toLocaleString("en-IN")}
              <span className="text-xs font-normal text-base-content/40">/sqft</span>
            </>
          }
          subtext={formatMoney(latestMonth?.avgPrice || 0)}
          tone="primary"
        />

        <StatCard
          icon={TrendingUp}
          label="Trend"
          value={
            data.changePercent !== null ? (
              <span
                className={`flex items-center gap-0.5 ${
                  data.changePercent > 0 ? "text-success" : data.changePercent < 0 ? "text-error" : ""
                }`}
              >
                {data.changePercent > 0 ? <ArrowUp className="size-4" /> : data.changePercent < 0 ? <ArrowDown className="size-4" /> : null}
                {data.changePercent > 0 ? "+" : ""}{data.changePercent}%
              </span>
            ) : "—"
          }
          subtext={`${data.monthlyData.length}mo`}
          tone={data.changePercent > 0 ? "success" : data.changePercent < 0 ? "error" : "neutral"}
        />

        {(() => {
          const cmpVal = comparisonPct ?? pricePct;
          const sub = comparisonPct !== null
            ? `vs ₹${currentAvgPsf?.toLocaleString("en-IN")}/sqft`
            : pricePct !== null
              ? `vs ${formatMoney(latestAvgPrice)}`
              : "";
          return (
            <StatCard
              icon={Home}
              label="This Listing"
              value={
                cmpVal !== null ? (
                  <span
                    className={`flex items-center gap-0.5 ${
                      cmpVal > 5 ? "text-error" : cmpVal < -5 ? "text-success" : ""
                    }`}
                  >
                    {cmpVal > 0 ? <ArrowUp className="size-4" /> : cmpVal < 0 ? <ArrowDown className="size-4" /> : null}
                    {cmpVal > 0 ? "+" : ""}{cmpVal}%
                  </span>
                ) : "—"
              }
              subtext={sub}
              tone={cmpVal > 5 ? "error" : cmpVal < -5 ? "success" : "neutral"}
            />
          );
        })()}

        <StatCard
          icon={Building2}
          label="Listings"
          value={data.totalListings}
          subtext={locality}
          tone="neutral"
        />
      </div>

      {/* Trend chart */}
      <MiniTrendChart data={data.monthlyData} />

      {/* Half-year comparison — compact single row */}
      {data.summary?.halfYearChange !== null && data.summary?.recentAvgPsf && data.summary?.olderAvgPsf && (
        <div className="flex items-center justify-between rounded-lg border border-base-200 bg-base-200/20 px-3 py-2">
          <div>
            <p className="text-[10px] text-base-content/40">6mo ago</p>
            <p className="text-xs font-bold text-base-content">₹{data.summary.olderAvgPsf.toLocaleString("en-IN")}</p>
          </div>
          <span
            className={`inline-flex items-center gap-0.5 rounded-full px-2 py-0.5 text-xs font-bold ${
              data.summary.halfYearChange > 0
                ? "bg-success/10 text-success"
                : data.summary.halfYearChange < 0
                  ? "bg-error/10 text-error"
                  : "bg-base-200 text-base-content/60"
            }`}
          >
            {data.summary.halfYearChange > 0 ? <ArrowUp className="size-3" /> : <ArrowDown className="size-3" />}
            {data.summary.halfYearChange > 0 ? "+" : ""}{data.summary.halfYearChange}%
          </span>
          <div className="text-right">
            <p className="text-[10px] text-base-content/40">Now</p>
            <p className="text-xs font-bold text-base-content">₹{data.summary.recentAvgPsf.toLocaleString("en-IN")}</p>
          </div>
        </div>
      )}

      {/* Footer */}
      <p className="text-center text-[10px] text-base-content/30">
        Based on NearMySpace listings in {locality}, {city}
      </p>
    </div>
  );
}
