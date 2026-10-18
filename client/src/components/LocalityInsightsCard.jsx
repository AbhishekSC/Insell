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
const CHART_H = 160;
const PAD = 28;

function MiniTrendChart({ data }) {
  if (!data || data.length < 2) return null;

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
    <div className="rounded-xl border border-base-200 bg-base-200/30 p-3">
      <p className="mb-2 text-xs font-semibold text-base-content/60">
        Avg Price per Sqft — Last {data.length} Months
      </p>
      <svg viewBox={`0 0 ${CHART_W} ${CHART_H}`} className="w-full" preserveAspectRatio="none">
        <defs>
          <linearGradient id="localityMiniGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#2f6fed" stopOpacity="0.18" />
            <stop offset="100%" stopColor="#2f6fed" stopOpacity="0" />
          </linearGradient>
        </defs>

        {/* grid lines */}
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
    neutral: "border-base-200 bg-base-200/40",
  };

  return (
    <div className={`rounded-xl border p-3.5 ${toneClasses[tone] || toneClasses.neutral}`}>
      <div className="mb-1 flex items-center gap-1.5">
        {Icon && <Icon className="size-3.5 text-base-content/40" />}
        <p className="text-[11px] font-semibold uppercase tracking-wide text-base-content/50">{label}</p>
      </div>
      <p className="text-xl font-bold text-base-content">{value}</p>
      {subtext && <p className="mt-0.5 text-xs text-base-content/50">{subtext}</p>}
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
      <div className="flex items-center justify-center py-8">
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

  // Latest monthly data for avg price
  const latestMonth = data.monthlyData[data.monthlyData.length - 1];

  // Human-readable insight sentence
  let insightText = "";
  if (data.changePercent !== null) {
    const direction = data.changePercent > 0 ? "increased" : data.changePercent < 0 ? "decreased" : "remained stable";
    const pctText = data.changePercent !== 0 ? ` by ${Math.abs(data.changePercent)}%` : "";
    insightText = `Property prices in ${locality} have ${direction}${pctText} over the past ${data.monthlyData.length} months.`;
    if (comparisonPct !== null) {
      if (comparisonPct < -5) {
        insightText += ` This property is priced ${Math.abs(comparisonPct)}% below the locality average — a potential deal.`;
      } else if (comparisonPct > 10) {
        insightText += ` This property is priced ${comparisonPct}% above the locality average.`;
      } else {
        insightText += ` This property is priced close to the locality average.`;
      }
    }
  }

  return (
    <div>
      {/* Insight sentence */}
      {insightText && (
        <div className="mb-4 rounded-xl border border-primary/15 bg-primary/5 px-4 py-3">
          <p className="text-sm leading-relaxed text-base-content/80">
            <span className="font-semibold text-primary">Insight:</span> {insightText}
          </p>
        </div>
      )}

      {/* Stats grid */}
      <div className="mb-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatCard
          icon={IndianRupee}
          label="Locality Avg"
          value={
            <>
              ₹{currentAvgPsf?.toLocaleString("en-IN")}
              <span className="text-sm font-normal text-base-content/40">/sqft</span>
            </>
          }
          subtext={`Avg price ${formatMoney(latestMonth?.avgPrice || 0)}`}
          tone="primary"
        />

        <StatCard
          icon={TrendingUp}
          label="Price Trend"
          value={
            data.changePercent !== null ? (
              <span
                className={`flex items-center gap-1 ${
                  data.changePercent > 0 ? "text-success" : data.changePercent < 0 ? "text-error" : ""
                }`}
              >
                {data.changePercent > 0 ? <ArrowUp className="size-5" /> : data.changePercent < 0 ? <ArrowDown className="size-5" /> : null}
                {data.changePercent > 0 ? "+" : ""}{data.changePercent}%
              </span>
            ) : "—"
          }
          subtext={`Over ${data.monthlyData.length} months`}
          tone={data.changePercent > 0 ? "success" : data.changePercent < 0 ? "error" : "neutral"}
        />

        {comparisonPct !== null && (
          <StatCard
            icon={Home}
            label="This Property"
            value={
              <span
                className={`flex items-center gap-1 ${
                  comparisonPct > 5 ? "text-error" : comparisonPct < -5 ? "text-success" : ""
                }`}
              >
                {comparisonPct > 0 ? <ArrowUp className="size-5" /> : comparisonPct < 0 ? <ArrowDown className="size-5" /> : null}
                {comparisonPct > 0 ? "+" : ""}{comparisonPct}%
              </span>
            }
            subtext={`₹${propertyPsf.toLocaleString("en-IN")}/sqft vs avg`}
            tone={comparisonPct > 5 ? "error" : comparisonPct < -5 ? "success" : "neutral"}
          />
        )}

        <StatCard
          icon={Building2}
          label="Market Activity"
          value={`${data.totalListings} listings`}
          subtext={`In ${locality}, ${city}`}
          tone="neutral"
        />
      </div>

      {/* Trend chart */}
      <MiniTrendChart data={data.monthlyData} />

      {/* Half-year comparison */}
      {data.summary?.halfYearChange !== null && data.summary?.recentAvgPsf && data.summary?.olderAvgPsf && (
        <div className="mt-4 flex items-center gap-3 rounded-xl border border-base-200 bg-base-200/30 px-4 py-3">
          <div className="flex-1">
            <p className="text-xs font-medium text-base-content/50">Previous 6 months</p>
            <p className="text-sm font-bold text-base-content">₹{data.summary.olderAvgPsf.toLocaleString("en-IN")}/sqft</p>
            <p className="text-[11px] text-base-content/40">{data.summary.olderListings} listings</p>
          </div>
          <div className="text-center">
            <span
              className={`inline-flex items-center gap-1 rounded-full px-3 py-1 text-sm font-bold ${
                data.summary.halfYearChange > 0
                  ? "bg-success/10 text-success"
                  : data.summary.halfYearChange < 0
                    ? "bg-error/10 text-error"
                    : "bg-base-200 text-base-content/60"
              }`}
            >
              {data.summary.halfYearChange > 0 ? <ArrowUp className="size-4" /> : <ArrowDown className="size-4" />}
              {data.summary.halfYearChange > 0 ? "+" : ""}{data.summary.halfYearChange}%
            </span>
          </div>
          <div className="flex-1 text-right">
            <p className="text-xs font-medium text-base-content/50">Recent 6 months</p>
            <p className="text-sm font-bold text-base-content">₹{data.summary.recentAvgPsf.toLocaleString("en-IN")}/sqft</p>
            <p className="text-[11px] text-base-content/40">{data.summary.recentListings} listings</p>
          </div>
        </div>
      )}

      {/* Footer */}
      <p className="mt-3 text-center text-[11px] text-base-content/35">
        Market data based on {data.totalListings} NearMySpace listings in {locality}, {city} · Updated in real-time
      </p>
    </div>
  );
}
