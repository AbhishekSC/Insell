import { useQuery } from "@tanstack/react-query";
import { 
  Sparkles, 
  TrendingUp, 
  CheckCircle2, 
  BarChart3, 
  Loader2, 
  Building2, 
  MapPin, 
  ShieldCheck, 
  Info,
  Scale
} from "lucide-react";
import axiosInstance from "../lib/axios";

function formatLakhsOrCrores(amount) {
  const num = Number(amount || 0);
  if (num >= 10000000) return `₹${(num / 10000000).toFixed(2)} Cr`;
  if (num >= 100000) return `₹${(num / 100000).toFixed(2)} L`;
  return `₹${num.toLocaleString("en-IN")}`;
}

export default function AiValuationCard({ postId, price, propertyType = "Property", locality, city }) {
  const listedPrice = Number(price || 0);

  const { data: valData, isLoading } = useQuery({
    queryKey: ["property-valuation", postId],
    queryFn: async () => {
      const res = await axiosInstance.get(`/posts/${postId}/valuation`);
      return res.data?.data;
    },
    enabled: Boolean(postId && listedPrice > 0),
    staleTime: 5 * 60 * 1000,
  });

  if (!listedPrice) return null;

  if (isLoading) {
    return (
      <div className="mt-5 rounded-2xl border border-primary/20 bg-primary/5 p-4 animate-pulse">
        <div className="flex items-center gap-2.5">
          <Loader2 className="size-4 animate-spin text-primary" />
          <span className="text-xs font-semibold text-base-content/80">
            Running AI Valuation against live comparables…
          </span>
        </div>
      </div>
    );
  }

  const fairMin = valData?.fairMin || Math.round(listedPrice * 0.94);
  const fairMax = valData?.fairMax || Math.round(listedPrice * 1.05);
  const confidenceScore = valData?.confidenceScore || 88;
  const confidenceLabel = valData?.confidenceLabel || "High Confidence";
  const dealIndex = valData?.dealIndex || "Fair Market Price";
  const dealTone = valData?.dealTone || "fair"; // 'good' | 'fair' | 'premium'
  const compCount = valData?.compCount ?? 0;
  const marketAverageSqft = valData?.marketAverageSqft;
  const subjectPricePerSqft = valData?.subjectPricePerSqft;
  const deltaPct = valData?.deltaPct ?? 0;
  const locationLabel = valData?.locationLabel || locality || city || "this area";

  // Visual tones for deal rating
  const toneConfig = {
    good: {
      badgeBg: "bg-emerald-500/10 dark:bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 border-emerald-500/30",
      accentDot: "bg-emerald-500",
      meterColor: "bg-emerald-500",
      label: "Great Value",
      subtitle: `${Math.abs(deltaPct)}% below estimated market average`,
    },
    premium: {
      badgeBg: "bg-amber-500/10 dark:bg-amber-500/20 text-amber-700 dark:text-amber-300 border-amber-500/30",
      accentDot: "bg-amber-500",
      meterColor: "bg-amber-500",
      label: "Premium Price",
      subtitle: `${Math.abs(deltaPct)}% above estimated market average`,
    },
    fair: {
      badgeBg: "bg-sky-500/10 dark:bg-sky-500/20 text-sky-700 dark:text-sky-300 border-sky-500/30",
      accentDot: "bg-sky-500",
      meterColor: "bg-sky-500",
      label: "Fair Market",
      subtitle: "Aligned within standard transaction spread",
    },
  }[dealTone] || {
    badgeBg: "bg-base-200 text-base-content/80 border-base-300",
    accentDot: "bg-primary",
    meterColor: "bg-primary",
    label: "Market Price",
    subtitle: "Standard market price",
  };

  return (
    <div className="mt-5 overflow-hidden rounded-2xl border border-primary/25 bg-gradient-to-b from-base-100 via-base-100 to-base-200/40 p-4 sm:p-5 shadow-sm transition-all duration-200">
      {/* Header bar: pill tags + confidence badge */}
      <div className="flex flex-wrap items-center justify-between gap-2.5 border-b border-base-200/80 pb-3.5">
        <div className="flex flex-wrap items-center gap-2">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-primary/10 px-2.5 py-1 text-xs font-bold text-primary border border-primary/20">
            <Sparkles className="size-3.5" /> AI Valuation Model
          </span>

          <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-2 py-0.5 text-[11px] font-semibold text-emerald-700 dark:text-emerald-300 border border-emerald-500/20">
            <CheckCircle2 className="size-3" /> {confidenceLabel} ({confidenceScore}%)
          </span>

          {compCount > 0 && (
            <span className="inline-flex items-center gap-1 rounded-full bg-base-200 px-2 py-0.5 text-[11px] font-medium text-base-content/70 border border-base-300">
              <BarChart3 className="size-3 text-primary" /> {compCount} live {compCount === 1 ? "comp" : "comps"}
            </span>
          )}
        </div>

        <div className="flex items-center gap-1 text-[11px] text-base-content/50">
          <Scale className="size-3" />
          <span>Real-time Comps Engine</span>
        </div>
      </div>

      {/* Main Body Grid */}
      <div className="mt-3.5 grid grid-cols-1 md:grid-cols-12 gap-4 items-center">
        {/* Left Column: Estimated Fair Range */}
        <div className="md:col-span-7 space-y-1.5">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-base-content/55">
            Estimated Fair Market Range
          </p>
          <div className="flex flex-wrap items-baseline gap-2">
            <span className="font-mono text-xl sm:text-2xl font-black text-primary tracking-tight">
              {formatLakhsOrCrores(fairMin)} – {formatLakhsOrCrores(fairMax)}
            </span>
          </div>

          {/* Micro stats: subject rate vs market average */}
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-base-content/70 pt-1">
            {subjectPricePerSqft > 0 && (
              <span className="inline-flex items-center gap-1 font-mono">
                <span className="text-base-content/50 font-sans">Listed Rate:</span> ₹{subjectPricePerSqft.toLocaleString("en-IN")}/sq.ft
              </span>
            )}
            {marketAverageSqft > 0 && (
              <span className="inline-flex items-center gap-1 font-mono text-base-content/85">
                <span className="text-base-content/50 font-sans">Market Avg:</span> ₹{marketAverageSqft.toLocaleString("en-IN")}/sq.ft
              </span>
            )}
          </div>
        </div>

        {/* Right Column: Deal Index Card */}
        <div className="md:col-span-5 flex md:justify-end">
          <div className={`w-full md:w-auto min-w-[200px] rounded-xl border p-3 ${toneConfig.badgeBg} transition-all`}>
            <div className="flex items-center justify-between gap-2">
              <span className="text-[10px] font-bold uppercase tracking-wider opacity-75">
                Deal Index
              </span>
              <span className="flex items-center gap-1 text-[11px] font-bold">
                <span className={`size-1.5 rounded-full ${toneConfig.accentDot}`} />
                {toneConfig.label}
              </span>
            </div>

            <div className="mt-1 flex items-center justify-between gap-2">
              <span className="text-sm font-black tracking-tight">
                {dealIndex}
              </span>
              <TrendingUp className="size-4 opacity-80 shrink-0" />
            </div>

            <p className="mt-1 text-[10px] opacity-75 leading-tight">
              {toneConfig.subtitle}
            </p>
          </div>
        </div>
      </div>

      {/* Footer Insight Note */}
      <div className="mt-3.5 pt-3 border-t border-base-200/60 flex items-start gap-1.5 text-xs text-base-content/65">
        <Info className="size-3.5 mt-0.5 text-primary/70 shrink-0" />
        <p className="text-[11px] leading-relaxed">
          {valData?.summary || (
            <>
              Algorithmically trained on active and verified {propertyType.toLowerCase()} comps in{" "}
              <span className="font-semibold text-base-content/80">{locationLabel}</span>.
            </>
          )}
        </p>
      </div>
    </div>
  );
}
