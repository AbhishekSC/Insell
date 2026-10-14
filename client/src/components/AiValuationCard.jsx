import { useState, useRef, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { 
  Sparkles, 
  CheckCircle2, 
  BarChart3, 
  Loader2, 
  Scale,
  Info,
  X
} from "lucide-react";
import axiosInstance from "../lib/axios";

function formatRange(min, max, isRent = false, compact = false) {
  const minNum = Number(min || 0);
  const maxNum = Number(max || 0);

  function fmt(num) {
    if (isRent) {
      if (compact) {
        if (num >= 100000) return `₹${(num / 100000).toFixed(1)}L`;
        if (num >= 1000) return `₹${Math.round(num / 1000)}K`;
        return `₹${num}`;
      }
      if (num >= 100000) return `₹${(num / 100000).toFixed(2)} Lakh`;
      return `₹${num.toLocaleString("en-IN")}`;
    }
    // Sale
    if (num >= 10000000) return `₹${(num / 10000000).toFixed(2)} Cr`;
    if (num >= 100000) return `₹${(num / 100000).toFixed(2)} L`;
    if (num >= 1000) return `₹${Math.round(num / 1000)}K`;
    return `₹${num.toLocaleString("en-IN")}`;
  }

  const suffix = isRent ? "/mo" : "";
  return `${fmt(minNum)} – ${fmt(maxNum)}${suffix}`;
}

export default function AiValuationCard({ 
  postId, 
  price, 
  propertyType = "Property", 
  locality, 
  city,
  listingType,
  postType
}) {
  const listedPrice = Number(price || 0);
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef(null);
  const closeTimerRef = useRef(null);

  const { data: valData, isLoading } = useQuery({
    queryKey: ["property-valuation", postId],
    queryFn: async () => {
      const res = await axiosInstance.get(`/posts/${postId}/valuation`);
      return res.data?.data;
    },
    enabled: Boolean(postId && listedPrice > 0),
    staleTime: 5 * 60 * 1000,
  });

  // Close on outside click / escape
  useEffect(() => {
    function handleClickOutside(e) {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setIsOpen(false);
      }
    }
    function handleKeyDown(e) {
      if (e.key === "Escape") setIsOpen(false);
    }
    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("touchstart", handleClickOutside);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("touchstart", handleClickOutside);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, []);

  const handleMouseEnter = () => {
    if (typeof window !== "undefined" && window.innerWidth < 640) return;
    if (closeTimerRef.current) clearTimeout(closeTimerRef.current);
    setIsOpen(true);
  };

  const handleMouseLeave = () => {
    if (typeof window !== "undefined" && window.innerWidth < 640) return;
    closeTimerRef.current = setTimeout(() => {
      setIsOpen(false);
    }, 180);
  };

  if (!listedPrice) return null;

  if (isLoading) {
    return (
      <div className="inline-flex items-center gap-1.5 rounded-full bg-primary/5 px-2.5 py-0.5 text-[11px] text-base-content/70 animate-pulse border border-primary/10">
        <Loader2 className="size-3 animate-spin text-primary" />
        <span>Est. rent…</span>
      </div>
    );
  }

  // Determine intent (rental vs buy/sale)
  const isRent = 
    valData?.intent === "rent" ||
    String(listingType || "").toLowerCase() === "rent" ||
    String(listingType || "").toLowerCase() === "lease" ||
    postType === "PROPERTY_RENT" ||
    postType === "REQUIREMENT_RENT";

  const expectedTitle = isRent ? "Expected Rent" : "Expected Price";
  const fairMin = valData?.fairMin || Math.round(listedPrice * 0.94);
  const fairMax = valData?.fairMax || Math.round(listedPrice * 1.05);
  const confidenceScore = valData?.confidenceScore || 88;
  const confidenceLabel = valData?.confidenceLabel || "High Confidence";
  const dealIndex = valData?.dealIndex || "Fair Market Price";
  const dealTone = valData?.dealTone || "fair";
  const compCount = valData?.compCount ?? 0;
  const marketAverageSqft = valData?.marketAverageSqft;
  const subjectPricePerSqft = valData?.subjectPricePerSqft;
  const deltaPct = valData?.deltaPct ?? 0;
  const locationLabel = valData?.locationLabel || locality || city || "this area";

  // Visual tones
  const toneConfig = {
    good: {
      badgeBg: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-500/30",
      accentDot: "bg-emerald-500",
      label: "Great Value",
      subtitle: `${Math.abs(deltaPct)}% below estimated market average`,
    },
    premium: {
      badgeBg: "bg-amber-500/10 text-amber-700 dark:text-amber-300 border-amber-500/30",
      accentDot: "bg-amber-500",
      label: "Premium Price",
      subtitle: `${Math.abs(deltaPct)}% above estimated market average`,
    },
    fair: {
      badgeBg: "bg-sky-500/10 text-sky-700 dark:text-sky-300 border-sky-500/30",
      accentDot: "bg-sky-500",
      label: "Fair Market",
      subtitle: "Aligned with market comps",
    },
  }[dealTone] || {
    badgeBg: "bg-base-200 text-base-content/80 border-base-300",
    accentDot: "bg-primary",
    label: "Market Price",
    subtitle: "Standard market price",
  };

  const compactRange = formatRange(fairMin, fairMax, isRent, true);
  const fullRange = formatRange(fairMin, fairMax, isRent, false);

  return (
    <div 
      ref={containerRef} 
      className="relative inline-block max-w-fit"
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      {/* Clean, Non-Breaking Badge with Breathing Room */}
      <div
        role="button"
        tabIndex={0}
        onClick={() => setIsOpen((prev) => !prev)}
        onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") setIsOpen((prev) => !prev); }}
        className="group inline-flex items-center gap-1.5 rounded-full bg-primary/10 hover:bg-primary/15 border border-primary/20 px-2.5 py-1 text-xs text-base-content transition-all cursor-pointer select-none max-w-fit"
        aria-expanded={isOpen}
      >
        <Sparkles className="size-3 text-primary shrink-0" />
        
        <span className="font-semibold text-primary text-[11px] sm:text-xs">
          {expectedTitle}:
        </span>

        <span className="font-mono font-bold text-base-content text-[11px] sm:text-xs">
          {compactRange}
        </span>

        {/* Desktop deal pill */}
        <span className={`hidden md:inline-flex items-center gap-1 rounded-full px-1.5 py-0.2 text-[10px] font-semibold border ${toneConfig.badgeBg} ml-0.5`}>
          <span className={`size-1.5 rounded-full ${toneConfig.accentDot}`} />
          {toneConfig.label}
        </span>

        <Info className="size-3 text-base-content/40 group-hover:text-primary transition-colors shrink-0 ml-0.5" />
      </div>

      {/* Popover: Centered Modal on Mobile, Dropdown on Desktop */}
      {isOpen && (
        <>
          {/* Mobile Backdrop */}
          <div 
            className="fixed inset-0 bg-black/50 backdrop-blur-xs z-50 sm:hidden"
            onClick={() => setIsOpen(false)}
          />

          <div 
            className="fixed inset-x-4 top-1/2 -translate-y-1/2 sm:translate-y-0 sm:inset-auto sm:absolute sm:right-0 sm:top-full sm:mt-2 z-50 w-auto sm:w-96 max-w-xs sm:max-w-sm rounded-2xl border border-base-200/90 bg-base-100 dark:bg-base-900 p-4 shadow-2xl backdrop-blur-md transition-all animate-in fade-in zoom-in-95 duration-150 mx-auto"
            onMouseEnter={handleMouseEnter}
            onMouseLeave={handleMouseLeave}
          >
            {/* Header pill & Engine tag */}
            <div className="flex items-center justify-between gap-2 border-b border-base-200/70 pb-2">
              <span className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2 py-0.5 text-[11px] font-bold text-primary border border-primary/20">
                <Sparkles className="size-3" /> AI Valuation Model
              </span>
              <div className="flex items-center gap-2">
                <div className="flex items-center gap-1 text-[10px] text-base-content/50">
                  <Scale className="size-3" />
                  <span>Real-time Comps</span>
                </div>
                <button 
                  type="button" 
                  onClick={(e) => { e.stopPropagation(); setIsOpen(false); }}
                  className="sm:hidden p-1 rounded-full text-base-content/50 hover:text-base-content hover:bg-base-200"
                  aria-label="Close"
                >
                  <X className="size-4" />
                </button>
              </div>
            </div>

            {/* Confidence & Comp Count */}
            <div className="mt-2.5 flex items-center gap-2 flex-wrap text-[11px]">
              <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-2 py-0.5 font-semibold text-emerald-700 dark:text-emerald-300 border border-emerald-500/20">
                <CheckCircle2 className="size-3" /> {confidenceLabel} ({confidenceScore}%)
              </span>
              {compCount > 0 && (
                <span className="inline-flex items-center gap-1 rounded-full bg-base-200 px-2 py-0.5 font-medium text-base-content/70 border border-base-300">
                  <BarChart3 className="size-3 text-primary" /> {compCount} live {compCount === 1 ? "comp" : "comps"}
                </span>
              )}
            </div>

            {/* Expected Range Body */}
            <div className="mt-2.5 rounded-xl bg-base-200/40 p-3 border border-base-200/60">
              <p className="text-[10px] font-bold uppercase tracking-wider text-base-content/55">
                Estimated Fair Market {isRent ? "Rent" : "Value"}
              </p>
              <div className="mt-0.5 flex items-baseline gap-2">
                <span className="font-mono text-lg sm:text-xl font-black text-primary tracking-tight">
                  {fullRange}
                </span>
              </div>

              {/* PSF Rates comparison */}
              <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-base-content/70 border-t border-base-200/60 pt-1.5 font-mono">
                {subjectPricePerSqft > 0 && (
                  <span>
                    <span className="text-base-content/50 font-sans">Listed: </span>
                    ₹{subjectPricePerSqft.toLocaleString("en-IN")}/sq.ft
                  </span>
                )}
                {marketAverageSqft > 0 && (
                  <span>
                    <span className="text-base-content/50 font-sans">Market Avg: </span>
                    ₹{marketAverageSqft.toLocaleString("en-IN")}/sq.ft
                  </span>
                )}
              </div>
            </div>

            {/* Deal Index Box */}
            <div className={`mt-2 rounded-xl border p-2.5 ${toneConfig.badgeBg}`}>
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-bold uppercase tracking-wider opacity-75">
                  Deal Rating
                </span>
                <span className="flex items-center gap-1 text-[11px] font-bold">
                  <span className={`size-1.5 rounded-full ${toneConfig.accentDot}`} />
                  {dealIndex}
                </span>
              </div>
              <p className="mt-0.5 text-[10px] opacity-75">
                {toneConfig.subtitle}
              </p>
            </div>

            {/* Summary / Location context */}
            <div className="mt-2 flex items-start gap-1.5 text-[10px] text-base-content/65 border-t border-base-200/50 pt-2">
              <Info className="size-3 mt-0.5 text-primary/70 shrink-0" />
              <p className="leading-tight">
                {valData?.summary || (
                  <>
                    Trained on verified {propertyType.toLowerCase()} comps in{" "}
                    <span className="font-medium text-base-content/80">{locationLabel}</span>.
                  </>
                )}
              </p>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
