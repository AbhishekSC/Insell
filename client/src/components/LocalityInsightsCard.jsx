import { useQuery } from "@tanstack/react-query";
import { ArrowDown, ArrowUp, BarChart3 } from "lucide-react";
import axiosInstance from "../lib/axios";

function formatMoney(amount) {
  const num = Number(amount) || 0;
  if (num >= 10000000) return `₹${(num / 10000000).toFixed(2)} Cr`;
  if (num >= 100000) return `₹${(num / 100000).toFixed(2)} L`;
  return `₹${num.toLocaleString("en-IN")}`;
}

const CHART_W = 600;
const CHART_H = 140;
const PAD = 24;

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
  }));

  const line = coords
    .map((c, i) => `${i === 0 ? "M" : "L"} ${c.x.toFixed(1)} ${c.y.toFixed(1)}`)
    .join(" ");
  const area = `${line} L ${coords.at(-1).x.toFixed(1)} ${CHART_H - PAD} L ${coords[0].x.toFixed(1)} ${CHART_H - PAD} Z`;

  return (
    <svg viewBox={`0 0 ${CHART_W} ${CHART_H}`} className="w-full" preserveAspectRatio="none">
      <defs>
        <linearGradient id="localityMiniGrad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#2f6fed" stopOpacity="0.15" />
          <stop offset="100%" stopColor="#2f6fed" stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={area} fill="url(#localityMiniGrad)" />
      <path d={line} fill="none" stroke="#2f6fed" strokeWidth="2" strokeLinejoin="round" />
      {coords.map((c, i) => (
        <circle key={i} cx={c.x} cy={c.y} r="3" fill="#2f6fed" />
      ))}
      {data.length <= 12 &&
        coords.map((c, i) => (
          <text
            key={`l${i}`}
            x={c.x}
            y={CHART_H - 6}
            textAnchor="middle"
            fill="currentColor"
            fillOpacity="0.35"
            fontSize="9"
          >
            {data[i].month.split(" ")[0]}
          </text>
        ))}
    </svg>
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
  const comparison = propertyPsf && currentAvgPsf
    ? (((propertyPsf - currentAvgPsf) / currentAvgPsf) * 100).toFixed(1)
    : null;

  return (
    <div>
      {/* Summary stats row */}
      <div className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-3">
        <div className="rounded-xl bg-base-200/60 p-3">
          <p className="text-[11px] font-medium text-base-content/50">Locality Avg</p>
          <p className="text-lg font-bold text-base-content">
            ₹{currentAvgPsf?.toLocaleString("en-IN")}
            <span className="text-xs font-normal text-base-content/40">/sqft</span>
          </p>
        </div>

        {data.changePercent !== null && (
          <div className="rounded-xl bg-base-200/60 p-3">
            <p className="text-[11px] font-medium text-base-content/50">Yearly Trend</p>
            <p
              className={`flex items-center gap-1 text-lg font-bold ${
                data.changePercent > 0
                  ? "text-success"
                  : data.changePercent < 0
                    ? "text-error"
                    : "text-base-content"
              }`}
            >
              {data.changePercent > 0 ? (
                <ArrowUp className="size-4" />
              ) : data.changePercent < 0 ? (
                <ArrowDown className="size-4" />
              ) : null}
              {data.changePercent > 0 ? "+" : ""}
              {data.changePercent}%
            </p>
          </div>
        )}

        {comparison !== null && (
          <div className="rounded-xl bg-base-200/60 p-3">
            <p className="text-[11px] font-medium text-base-content/50">This Property</p>
            <p
              className={`flex items-center gap-1 text-lg font-bold ${
                comparison > 0
                  ? "text-error"
                  : comparison < 0
                    ? "text-success"
                    : "text-base-content"
              }`}
            >
              {comparison > 0 ? (
                <ArrowUp className="size-4" />
              ) : comparison < 0 ? (
                <ArrowDown className="size-4" />
              ) : null}
              {comparison > 0 ? "+" : ""}
              {comparison}%
              <span className="text-xs font-normal text-base-content/40">vs avg</span>
            </p>
          </div>
        )}
      </div>

      {/* Trend chart */}
      <MiniTrendChart data={data.monthlyData} />

      {/* Footer context */}
      <p className="mt-2 text-center text-[11px] text-base-content/40">
        Based on {data.totalListings} listings in {locality}, {city} over 12 months
      </p>
    </div>
  );
}
