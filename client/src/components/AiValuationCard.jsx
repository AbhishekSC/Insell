import { useState, useRef, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Sparkles,
  Loader2,
  Info,
  X,
  ChevronDown,
  Check,
  Equal,
  TrendingUp,
  HelpCircle,
} from "lucide-react";
import axiosInstance from "../lib/axios";

function formatRange(min, max, isRent = false, compact = false) {
  const minNum = Number(min || 0);
  const maxNum = Number(max || 0);

  function fmt(num) {
    if (isRent) {
      if (compact) {
        if (num >= 100000) return (num / 100000).toFixed(1) + "L";
        if (num >= 1000) return Math.round(num / 1000) + "K";
        return String(num);
      }
      if (num >= 100000) return (num / 100000).toFixed(2) + "L";
      return num.toLocaleString("en-IN");
    }
    if (num >= 10000000) return (num / 10000000).toFixed(2) + " Cr";
    if (num >= 100000) return (num / 100000).toFixed(2) + " L";
    if (num >= 1000) return Math.round(num / 1000) + "K";
    return num.toLocaleString("en-IN");
  }

  if (compact) {
    return `₹${fmt(minNum)} – ${fmt(maxNum)}${isRent ? "/mo" : ""}`;
  }
  return { price: `₹${fmt(minNum)} – ${fmt(maxNum)}`, suffix: isRent ? "/month" : "" };
}

const VERDICT = {
  good: {
    chipBg: "#DCFCE7", chipText: "#166534",
    boxBg: "#F0FDF4", circleBg: "#DCFCE7",
    iconColor: "#15803D", titleColor: "#14532D", subtitleColor: "#166534",
    Icon: Check,
    title: "Great value",
    subtitle: "Listed well below the area average",
  },
  fair: {
    chipBg: "#E0E7FF", chipText: "#3730A3",
    boxBg: "#EEF2FF", circleBg: "#E0E7FF",
    iconColor: "#4F46E5", titleColor: "#312E81", subtitleColor: "#3730A3",
    Icon: Equal,
    title: "Fair price",
    subtitle: "In line with the area average",
  },
  premium: {
    chipBg: "#FFEDD5", chipText: "#9A3412",
    boxBg: "#FFF7ED", circleBg: "#FFEDD5",
    iconColor: "#EA580C", titleColor: "#7C2D12", subtitleColor: "#9A3412",
    Icon: TrendingUp,
    title: "Above market",
    subtitle: "Listed above the area average",
  },
  unknown: {
    chipBg: "#F3F4F6", chipText: "#4B5563",
    boxBg: "#F9FAFB", circleBg: "#F3F4F6",
    iconColor: "#6B7280", titleColor: "#374151", subtitleColor: "#4B5563",
    Icon: HelpCircle,
    title: "Estimating",
    subtitle: "We need more nearby listings to estimate",
  },
};

export default function AiValuationCard({
  postId,
  price,
  locality,
  city,
  listingType,
  postType,
}) {
  const listedPrice = Number(price || 0);
  const [isOpen, setIsOpen] = useState(false);
  const [showHow, setShowHow] = useState(false);
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

  useEffect(() => {
    function handleClickOutside(e) {
      if (containerRef.current && !containerRef.current.contains(e.target)) setIsOpen(false);
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
    closeTimerRef.current = setTimeout(() => setIsOpen(false), 180);
  };

  if (!listedPrice) return null;

  if (isLoading) {
    return (
      <button
        type="button"
        disabled
        className="inline-flex items-center gap-2.5 rounded-full bg-white dark:bg-base-200 border border-[#E5E7EB] h-11 px-3.5 text-sm animate-pulse"
      >
        <Loader2 className="size-4 animate-spin" style={{ color: "#4F46E5" }} />
        <span style={{ color: "#6B7280" }}>Estimating…</span>
      </button>
    );
  }

  const compCount = valData?.compCount ?? 0;
  const compScope = valData?.compScope || "";
  const tooThin = compCount < 3 && compScope !== "serper_market_benchmark";
  if (!valData?.available || tooThin) return null;

  const isRent =
    valData?.intent === "rent" ||
    String(listingType || "").toLowerCase() === "rent" ||
    String(listingType || "").toLowerCase() === "lease" ||
    postType === "PROPERTY_RENT" ||
    postType === "REQUIREMENT_RENT";

  const fairMin = valData?.fairMin || Math.round(listedPrice * 0.94);
  const fairMax = valData?.fairMax || Math.round(listedPrice * 1.05);
  const dealTone = valData?.dealTone || "fair";
  const marketAverageSqft = valData?.marketAverageSqft;
  const subjectPricePerSqft = valData?.subjectPricePerSqft;
  const deltaPct = valData?.deltaPct ?? 0;
  const LocationLabel = valData?.locationLabel || locality || city || "this area";

  const v = VERDICT[dealTone] || VERDICT.fair;
  const VIcon = v.Icon;
  const compactRange = formatRange(fairMin, fairMax, isRent, true);
  const full = formatRange(fairMin, fairMax, isRent, false);
  const popoverTitle = isRent ? "AI rent estimate" : "AI price estimate";
  const popoverSubtitle = isRent
    ? "Fair rent for similar homes nearby"
    : "Fair price for similar properties nearby";

  return (
    <div
      ref={containerRef}
      className="relative inline-block max-w-fit"
      style={{ textAlign: "left" }}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      {/* Trigger chip */}
      <button
        type="button"
        onClick={() => setIsOpen((prev) => !prev)}
        className="inline-flex items-center h-11 rounded-full bg-white dark:bg-base-200 border hover:shadow-sm transition-all cursor-pointer select-none"
        style={{
          gap: 10,
          paddingLeft: 14,
          paddingRight: 12,
          borderColor: isOpen ? "#4F46E5" : "#E5E7EB",
          boxShadow: isOpen ? "0 0 0 3px rgba(79,70,229,.12)" : undefined,
        }}
        aria-expanded={isOpen}
      >
        <Sparkles className="size-4 shrink-0" style={{ color: "#4F46E5" }} />
        <span
          className="whitespace-nowrap"
          style={{ fontSize: 14, fontWeight: 600, color: "#111827", fontVariantNumeric: "tabular-nums" }}
        >
          {compactRange}
        </span>
        <span
          className="inline-flex items-center rounded-full whitespace-nowrap"
          style={{
            fontSize: 12,
            fontWeight: 600,
            padding: "3px 8px",
            backgroundColor: v.chipBg,
            color: v.chipText,
          }}
        >
          <span
            className="size-1.5 rounded-full mr-1.5 shrink-0"
            style={{ backgroundColor: v.iconColor }}
          />
          {v.title}
        </span>
        <ChevronDown
          className="size-4 transition-transform"
          style={{ color: "#6B7280", transform: isOpen ? "rotate(180deg)" : undefined }}
        />
      </button>

      {/* Popover */}
      {isOpen && (
        <>
          <div
            className="fixed inset-0 bg-black/30 z-50 sm:hidden"
            onClick={() => setIsOpen(false)}
          />

          <div
            className="fixed inset-x-4 top-1/2 -translate-y-1/2 sm:translate-y-0 sm:inset-auto sm:absolute sm:left-0 sm:top-full sm:mt-2 z-50 sm:w-[26rem] bg-white dark:bg-base-100 mx-auto overflow-hidden"
            style={{
              textAlign: "left",
              borderRadius: 20,
              padding: 24,
              boxShadow: "0 16px 40px rgba(17,24,39,.08), 0 1px 3px rgba(17,24,39,.06)",
              fontVariantNumeric: "tabular-nums",
              display: "flex",
              flexDirection: "column",
              gap: 24,
            }}
            onMouseEnter={handleMouseEnter}
            onMouseLeave={handleMouseLeave}
          >
            {/* Header */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <Sparkles className="size-[18px]" style={{ color: "#4F46E5" }} />
                <span style={{ fontSize: 15, fontWeight: 600, color: "#111827" }}>{popoverTitle}</span>
              </div>
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); setIsOpen(false); }}
                className="grid place-items-center rounded-full hover:bg-gray-100 dark:hover:bg-base-200 transition-colors"
                style={{ width: 44, height: 44 }}
                aria-label="Close"
              >
                <X className="size-4" style={{ color: "#6B7280" }} />
              </button>
            </div>

            {/* Price block */}
            <div>
              <p style={{ fontSize: 14, color: "#4B5563", marginBottom: 6 }}>{popoverSubtitle}</p>
              <p className="whitespace-nowrap" style={{ letterSpacing: "-0.02em" }}>
                <span style={{ fontSize: 34, fontWeight: 700, color: "#111827" }}>
                  {full.price}
                </span>
                {full.suffix && (
                  <span style={{ fontSize: 15, color: "#6B7280", marginLeft: 6, fontWeight: 400 }}>
                    {full.suffix}
                  </span>
                )}
              </p>
            </div>

            {/* Verdict box */}
            <div
              className="flex items-center"
              style={{ padding: "14px 16px", borderRadius: 14, gap: 12, backgroundColor: v.boxBg }}
            >
              <div
                className="grid place-items-center shrink-0 rounded-full"
                style={{ width: 36, height: 36, backgroundColor: v.circleBg }}
              >
                <VIcon className="size-[18px]" style={{ color: v.iconColor }} />
              </div>
              <div>
                <p style={{ fontSize: 15, fontWeight: 600, color: v.titleColor }}>{v.title}</p>
                <p style={{ fontSize: 13, color: v.subtitleColor }}>
                  {deltaPct !== 0
                    ? `Listed ${Math.abs(deltaPct)}% ${deltaPct < 0 ? "below" : "above"} the area average`
                    : v.subtitle}
                </p>
              </div>
            </div>

            {/* Detail rows */}
            <dl style={{ display: "flex", flexDirection: "column", gap: 12, fontSize: 14, margin: 0 }}>
              {subjectPricePerSqft > 0 && (
                <div className="flex items-center justify-between">
                  <dt style={{ color: "#4B5563" }}>This listing</dt>
                  <dd style={{ fontWeight: 600, color: "#111827", margin: 0 }}>
                    ₹{subjectPricePerSqft.toLocaleString("en-IN")} / sq ft
                  </dd>
                </div>
              )}
              {marketAverageSqft > 0 && (
                <div className="flex items-center justify-between">
                  <dt style={{ color: "#4B5563" }}>Area average</dt>
                  <dd style={{ fontWeight: 600, color: "#111827", margin: 0 }}>
                    ₹{marketAverageSqft.toLocaleString("en-IN")} / sq ft
                  </dd>
                </div>
              )}
              {compCount > 0 && (
                <div className="flex items-center justify-between">
                  <dt style={{ color: "#4B5563" }}>Compared with</dt>
                  <dd style={{ fontWeight: 600, color: "#111827", margin: 0 }}>
                    {compCount} home{compCount !== 1 ? "s" : ""} within 25 km
                  </dd>
                </div>
              )}
            </dl>

            {/* Divider + Note */}
            <div>
              <div style={{ height: 1, backgroundColor: "#F3F4F6", marginBottom: 16 }} />
              <div className="flex items-start" style={{ gap: 10 }}>
                <Info className="size-4 shrink-0 mt-0.5" style={{ color: "#6B7280" }} />
                <p style={{ fontSize: 13, lineHeight: 1.55, color: "#4B5563", margin: 0 }}>
                  {valData?.summary || (
                    compCount < 3
                      ? "We found only one similar home nearby, so use this as a rough guide. "
                      : `Based on ${compCount} similar homes within 25 km. `
                  )}
                  <button
                    type="button"
                    onClick={(e) => { e.stopPropagation(); setShowHow((v) => !v); }}
                    style={{ color: "#4338CA", fontWeight: 600, textDecoration: "none", background: "none", border: "none", cursor: "pointer", padding: 0, fontSize: 13 }}
                  >
                    {showHow ? "Hide details" : "See how it's calculated"}
                  </button>
                </p>

                {showHow && (
                  <div
                    className="mt-3 space-y-2.5"
                    style={{ fontSize: 12, lineHeight: 1.6, color: "#4B5563" }}
                  >
                    <div className="flex gap-2.5">
                      <span className="shrink-0 grid place-items-center size-5 rounded-full" style={{ backgroundColor: "#E0E7FF", fontSize: 11, fontWeight: 700, color: "#4F46E5" }}>1</span>
                      <p style={{ margin: 0 }}><span style={{ fontWeight: 600, color: "#111827" }}>Find comparables</span> — We search verified listings within 25 km that match your property type, size, and configuration.</p>
                    </div>
                    <div className="flex gap-2.5">
                      <span className="shrink-0 grid place-items-center size-5 rounded-full" style={{ backgroundColor: "#E0E7FF", fontSize: 11, fontWeight: 700, color: "#4F46E5" }}>2</span>
                      <p style={{ margin: 0 }}><span style={{ fontWeight: 600, color: "#111827" }}>Adjust for differences</span> — Floor, facing, age, amenities, and micro-location factors are weighted to normalize prices.</p>
                    </div>
                    <div className="flex gap-2.5">
                      <span className="shrink-0 grid place-items-center size-5 rounded-full" style={{ backgroundColor: "#E0E7FF", fontSize: 11, fontWeight: 700, color: "#4F46E5" }}>3</span>
                      <p style={{ margin: 0 }}><span style={{ fontWeight: 600, color: "#111827" }}>Generate range</span> — The fair market range is the adjusted 25th–75th percentile of comparable prices per sq ft, applied to this property's area.</p>
                    </div>
                    <p style={{ margin: 0, fontSize: 11, color: "#6B7280" }}>
                      Sources include Magicbricks, 99acres, and Housing.com. This is an automated estimate — not a professional appraisal.
                    </p>
                  </div>
                )}
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
