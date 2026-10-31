import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useSearchParams } from "react-router";
import {
  ArrowDown,
  ArrowUp,
  BarChart3,
  Building2,
  ChevronRight,
  MapPin,
  TrendingUp,
} from "lucide-react";
import AppShell from "../components/AppShell";
import axiosInstance from "../lib/axios";

function formatMoney(amount) {
  const num = Number(amount) || 0;
  if (num >= 10000000) return `₹${(num / 10000000).toFixed(2)} Cr`;
  if (num >= 100000) return `₹${(num / 100000).toFixed(2)} L`;
  return `₹${num.toLocaleString("en-IN")}`;
}

// ─── Inline SVG area chart ────────────────────────────────────────────────
const CHART_W = 720;
const CHART_H = 200;
const PAD = 32;

function TrendChart({ data, valueKey = "avgPsf", label = "Avg ₹/sqft" }) {
  if (!data || data.length < 2) {
    return (
      <div className="flex h-48 items-center justify-center rounded-xl bg-base-200/50 text-sm text-base-content/50">
        Not enough data to show a trend chart
      </div>
    );
  }

  const values = data.map((d) => d[valueKey]);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;

  const stepX = (CHART_W - PAD * 2) / (data.length - 1);
  const coords = data.map((d, i) => ({
    x: PAD + i * stepX,
    y: CHART_H - PAD - ((d[valueKey] - min) / range) * (CHART_H - PAD * 2),
    label: d.month,
    value: d[valueKey],
    listings: d.listings,
  }));

  const line = coords
    .map((c, i) => `${i === 0 ? "M" : "L"} ${c.x.toFixed(1)} ${c.y.toFixed(1)}`)
    .join(" ");
  const area = `${line} L ${coords.at(-1).x.toFixed(1)} ${CHART_H - PAD} L ${coords[0].x.toFixed(1)} ${CHART_H - PAD} Z`;

  const first = values[0];
  const last = values.at(-1);
  const change = first > 0 ? (((last - first) / first) * 100).toFixed(1) : 0;

  return (
    <div>
      <div className="mb-3 flex flex-wrap items-end justify-between gap-2">
        <div>
          <p className="text-xs text-base-content/50">{label}</p>
          <p className="text-2xl font-bold text-base-content">
            ₹{last.toLocaleString("en-IN")}
            <span className="text-sm font-normal text-base-content/50">/sqft</span>
          </p>
        </div>
        <div
          className={`flex items-center gap-1 rounded-full px-3 py-1 text-sm font-semibold ${
            change > 0
              ? "bg-success/10 text-success"
              : change < 0
                ? "bg-error/10 text-error"
                : "bg-base-200 text-base-content/60"
          }`}
        >
          {change > 0 ? <ArrowUp className="size-4" /> : change < 0 ? <ArrowDown className="size-4" /> : null}
          {change > 0 ? "+" : ""}
          {change}%
        </div>
      </div>

      <svg viewBox={`0 0 ${CHART_W} ${CHART_H}`} className="w-full" preserveAspectRatio="none">
        <defs>
          <linearGradient id="localityGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#2f6fed" stopOpacity="0.18" />
            <stop offset="100%" stopColor="#2f6fed" stopOpacity="0" />
          </linearGradient>
        </defs>

        {/* grid lines */}
        {[0, 0.25, 0.5, 0.75, 1].map((pct) => {
          const y = CHART_H - PAD - pct * (CHART_H - PAD * 2);
          return (
            <line
              key={pct}
              x1={PAD}
              y1={y}
              x2={CHART_W - PAD}
              y2={y}
              stroke="currentColor"
              strokeOpacity="0.08"
              strokeWidth="1"
            />
          );
        })}

        <path d={area} fill="url(#localityGrad)" />
        <path d={line} fill="none" stroke="#2f6fed" strokeWidth="2.5" strokeLinejoin="round" />

        {coords.map((c, i) => (
          <g key={i}>
            <circle cx={c.x} cy={c.y} r="4" fill="#2f6fed" />
            {data.length <= 12 && (
              <text x={c.x} y={CHART_H - 8} textAnchor="middle" fill="currentColor" fillOpacity="0.4" fontSize="10">
                {c.label.split(" ")[0]}
              </text>
            )}
          </g>
        ))}
      </svg>
    </div>
  );
}

// ─── Locality card for overview grid ──────────────────────────────────────
function LocalityCard({ locality, avgPsf, avgPrice, listings, onClick }) {
  return (
    <button
      onClick={onClick}
      className="flex items-center gap-3 rounded-xl border border-base-200 bg-base-100 p-4 text-left transition hover:border-primary/30 hover:shadow-md"
    >
      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10">
        <MapPin className="size-5 text-primary" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate font-semibold text-base-content">{locality}</p>
        <p className="text-xs text-base-content/50">
          ₹{avgPsf.toLocaleString("en-IN")}/sqft · {listings} listings
        </p>
      </div>
      <div className="text-right">
        <p className="text-sm font-bold text-primary">{formatMoney(avgPrice)}</p>
        <p className="text-xs text-base-content/40">avg price</p>
      </div>
      <ChevronRight className="size-4 shrink-0 text-base-content/30" />
    </button>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────
export default function LocalityInsightsPage() {
  const [params, setParams] = useSearchParams();
  const city = params.get("city") || "";
  const locality = params.get("locality") || "";
  const intent = params.get("intent") || "buy";

  const [cityInput, setCityInput] = useState(city);

  useEffect(() => {
    if (!city) setCityInput("");
  }, [city]);

  // Overview — top localities for a city
  const {
    data: overview,
    isLoading: overviewLoading,
  } = useQuery({
    queryKey: ["localityOverview", city, intent],
    queryFn: async () => {
      const res = await axiosInstance.get("/locality-trends/overview", {
        params: { city, intent },
      });
      return res.data?.data;
    },
    enabled: !!city && !locality,
  });

  // Detail — trends for a specific locality
  const {
    data: detail,
    isLoading: detailLoading,
  } = useQuery({
    queryKey: ["localityDetail", city, locality, intent],
    queryFn: async () => {
      const res = await axiosInstance.get("/locality-trends/detail", {
        params: { city, locality, intent },
      });
      return res.data?.data;
    },
    enabled: !!city && !!locality,
  });

  const handleCitySearch = (e) => {
    e.preventDefault();
    if (!cityInput.trim()) return;
    setParams({ city: cityInput.trim(), intent });
  };

  const selectLocality = (loc) => {
    setParams({ city, locality: loc, intent });
  };

  const clearLocality = () => {
    setParams({ city, intent });
  };

  const toggleIntent = () => {
    const next = intent === "buy" ? "rent" : "buy";
    setParams({ city, ...(locality ? { locality } : {}), intent: next });
  };

  const isLoading = overviewLoading || detailLoading;

  return (
    <AppShell
      hideHero
      showBackButton
      title="Locality Price Insights"
      subtitle="Explore price trends and market data by locality"
    >
      <div className="mx-auto max-w-4xl px-4 py-6 pb-24">
        {/* Header */}
        <div className="mb-6 flex items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10">
            <BarChart3 className="size-6 text-primary" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-base-content">Locality Price Insights</h1>
            <p className="text-sm text-base-content/60">
              Real-time price trends from NearMySpace listings
            </p>
          </div>
        </div>

        {/* Search & Filters */}
        <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center">
          <form onSubmit={handleCitySearch} className="flex flex-1 gap-2">
            <input
              type="text"
              value={cityInput}
              onChange={(e) => setCityInput(e.target.value)}
              placeholder="Enter city name (e.g. Pune, Mumbai)"
              className="input input-bordered flex-1"
            />
            <button type="submit" className="btn btn-primary">
              Search
            </button>
          </form>
          <button
            onClick={toggleIntent}
            className={`btn btn-sm ${intent === "rent" ? "btn-secondary" : "btn-outline"}`}
          >
            {intent === "buy" ? "Buy" : "Rent"}
          </button>
        </div>

        {/* Breadcrumb when viewing locality detail */}
        {locality && (
          <div className="mb-4 flex items-center gap-2 text-sm">
            <button onClick={clearLocality} className="text-primary hover:underline">
              {city}
            </button>
            <ChevronRight className="size-3 text-base-content/30" />
            <span className="font-semibold text-base-content">{locality}</span>
          </div>
        )}

        {/* Loading */}
        {isLoading && (
          <div className="flex justify-center py-16">
            <span className="loading loading-spinner loading-lg text-primary" />
          </div>
        )}

        {/* Empty state */}
        {!city && !isLoading && (
          <div className="flex flex-col items-center gap-4 py-20 text-center">
            <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/10">
              <TrendingUp className="size-8 text-primary" />
            </div>
            <h2 className="text-lg font-bold text-base-content">Search a city to get started</h2>
            <p className="max-w-sm text-sm text-base-content/60">
              Enter a city name above to see locality-wise price trends,
              average rates, and market activity based on real listings.
            </p>
            <div className="mt-2 flex flex-wrap justify-center gap-2">
              {["Pune", "Mumbai", "Bangalore", "Delhi", "Hyderabad", "Chennai"].map((c) => (
                <button
                  key={c}
                  onClick={() => {
                    setCityInput(c);
                    setParams({ city: c, intent });
                  }}
                  className="btn btn-ghost btn-sm"
                >
                  <MapPin className="size-3" />
                  {c}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* ─── Overview: Top localities grid ────────────────────────── */}
        {city && !locality && !overviewLoading && overview && (
          <>
            {/* City-level trend chart */}
            {overview.cityMonthly?.length >= 2 && (
              <div className="mb-8 rounded-2xl border border-base-200 bg-base-100 p-5 shadow-sm">
                <h2 className="mb-4 flex items-center gap-2 font-bold text-base-content">
                  <TrendingUp className="size-5 text-primary" />
                  {city} — Overall Price Trend ({intent === "rent" ? "Rent" : "Buy"})
                </h2>
                <TrendChart data={overview.cityMonthly} />
              </div>
            )}

            {/* Top localities */}
            <h2 className="mb-3 flex items-center gap-2 font-bold text-base-content">
              <Building2 className="size-5 text-primary" />
              Top Localities in {city}
            </h2>
            {overview.localities?.length === 0 && (
              <p className="py-8 text-center text-sm text-base-content/50">
                Not enough listing data for {city} yet. Try another city.
              </p>
            )}
            <div className="grid gap-3 sm:grid-cols-2">
              {overview.localities?.map((loc) => (
                <LocalityCard
                  key={loc.locality}
                  {...loc}
                  onClick={() => selectLocality(loc.locality)}
                />
              ))}
            </div>
          </>
        )}

        {/* ─── Detail: Single locality deep-dive ───────────────────── */}
        {city && locality && !detailLoading && detail && (
          <>
            {/* Trend chart */}
            <div className="mb-6 rounded-2xl border border-base-200 bg-base-100 p-5 shadow-sm">
              <h2 className="mb-4 flex items-center gap-2 font-bold text-base-content">
                <TrendingUp className="size-5 text-primary" />
                {locality} — Price Trend ({intent === "rent" ? "Rent" : "Buy"})
              </h2>
              <TrendChart data={detail.monthlyData} />
            </div>

            {/* Summary stats */}
            {detail.summary && (
              <div className="mb-6 grid gap-3 sm:grid-cols-3">
                <div className="rounded-xl border border-base-200 bg-base-100 p-4">
                  <p className="text-xs text-base-content/50">Current Avg (6 mo)</p>
                  <p className="text-lg font-bold text-base-content">
                    {detail.summary.recentAvgPsf
                      ? `₹${detail.summary.recentAvgPsf.toLocaleString("en-IN")}/sqft`
                      : "—"}
                  </p>
                  <p className="text-xs text-base-content/40">{detail.summary.recentListings} listings</p>
                </div>
                <div className="rounded-xl border border-base-200 bg-base-100 p-4">
                  <p className="text-xs text-base-content/50">Previous 6 mo</p>
                  <p className="text-lg font-bold text-base-content">
                    {detail.summary.olderAvgPsf
                      ? `₹${detail.summary.olderAvgPsf.toLocaleString("en-IN")}/sqft`
                      : "—"}
                  </p>
                  <p className="text-xs text-base-content/40">{detail.summary.olderListings} listings</p>
                </div>
                <div className="rounded-xl border border-base-200 bg-base-100 p-4">
                  <p className="text-xs text-base-content/50">6-Month Change</p>
                  <p
                    className={`flex items-center gap-1 text-lg font-bold ${
                      detail.summary.halfYearChange > 0
                        ? "text-success"
                        : detail.summary.halfYearChange < 0
                          ? "text-error"
                          : "text-base-content"
                    }`}
                  >
                    {detail.summary.halfYearChange !== null ? (
                      <>
                        {detail.summary.halfYearChange > 0 ? (
                          <ArrowUp className="size-4" />
                        ) : detail.summary.halfYearChange < 0 ? (
                          <ArrowDown className="size-4" />
                        ) : null}
                        {detail.summary.halfYearChange > 0 ? "+" : ""}
                        {detail.summary.halfYearChange}%
                      </>
                    ) : (
                      "—"
                    )}
                  </p>
                  <p className="text-xs text-base-content/40">half-year comparison</p>
                </div>
              </div>
            )}

            {/* Monthly breakdown table */}
            {detail.monthlyData?.length > 0 && (
              <div className="rounded-2xl border border-base-200 bg-base-100 shadow-sm">
                <h3 className="border-b border-base-200 px-5 py-3 font-semibold text-base-content">
                  Monthly Breakdown
                </h3>
                <div className="overflow-x-auto">
                  <table className="table table-sm">
                    <thead>
                      <tr>
                        <th>Month</th>
                        <th className="text-right">Avg ₹/sqft</th>
                        <th className="text-right">Avg Price</th>
                        <th className="text-right">Listings</th>
                        <th className="text-right">Change</th>
                      </tr>
                    </thead>
                    <tbody>
                      {[...detail.monthlyData].reverse().map((m, i, arr) => {
                        const prev = arr[i + 1];
                        const change = prev ? (((m.avgPsf - prev.avgPsf) / prev.avgPsf) * 100).toFixed(1) : null;
                        return (
                          <tr key={m.month} className="hover">
                            <td className="font-medium">{m.month}</td>
                            <td className="text-right">₹{m.avgPsf.toLocaleString("en-IN")}</td>
                            <td className="text-right">{formatMoney(m.avgPrice)}</td>
                            <td className="text-right">{m.listings}</td>
                            <td className="text-right">
                              {change !== null ? (
                                <span
                                  className={`inline-flex items-center gap-0.5 text-xs font-semibold ${
                                    change > 0 ? "text-success" : change < 0 ? "text-error" : "text-base-content/50"
                                  }`}
                                >
                                  {change > 0 ? <ArrowUp className="size-3" /> : change < 0 ? <ArrowDown className="size-3" /> : null}
                                  {change > 0 ? "+" : ""}
                                  {change}%
                                </span>
                              ) : (
                                <span className="text-xs text-base-content/30">—</span>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Total listings */}
            <p className="mt-4 text-center text-xs text-base-content/40">
              Based on {detail.totalListings} listings in {locality}, {city} over the last 12 months
            </p>
          </>
        )}
      </div>
    </AppShell>
  );
}
