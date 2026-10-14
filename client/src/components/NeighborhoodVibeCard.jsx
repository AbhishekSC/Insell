import { useState, useRef, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { 
  Footprints, 
  Train, 
  Trees, 
  ShieldCheck, 
  Sparkles, 
  Loader2, 
  Info,
  X 
} from "lucide-react";
import axiosInstance from "../lib/axios";

export default function NeighborhoodVibeCard({ latitude, longitude, locality, city }) {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef(null);
  const closeTimerRef = useRef(null);

  const { data: vibe, isLoading, isError } = useQuery({
    queryKey: ["neighborhoodVibe", latitude, longitude, locality],
    queryFn: async () => {
      const res = await axiosInstance.get("/amenities/vibe", {
        params: { lat: latitude, lng: longitude, locality: locality || city || "Locality" },
      });
      return res.data?.data;
    },
    enabled: Boolean(latitude && longitude),
    staleTime: 10 * 60 * 1000,
  });

  // Close on outside click or Escape
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

  if (isLoading) {
    return (
      <div className="inline-flex items-center gap-1.5 rounded-full bg-base-200/50 px-2.5 py-0.5 text-[11px] text-base-content/70 animate-pulse border border-base-300 mb-4">
        <Loader2 className="size-3 animate-spin text-primary" />
        <span>Analyzing vibe & safety…</span>
      </div>
    );
  }

  if (isError || !vibe) {
    return null;
  }

  const { overallScore, label, tagline, metrics, dataSource } = vibe;

  return (
    <div 
      ref={containerRef}
      className="relative inline-block max-w-fit mb-4"
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      {/* Sleek, Non-Breaking Interactive Badge */}
      <div
        role="button"
        tabIndex={0}
        onClick={() => setIsOpen((prev) => !prev)}
        onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") setIsOpen((prev) => !prev); }}
        className="group inline-flex items-center gap-1.5 rounded-full bg-emerald-500/10 hover:bg-emerald-500/15 border border-emerald-500/20 px-2.5 py-1 text-xs text-base-content transition-all cursor-pointer select-none max-w-fit"
        aria-expanded={isOpen}
      >
        <ShieldCheck className="size-3.5 text-emerald-600 dark:text-emerald-400 shrink-0" />
        <span className="font-semibold text-emerald-700 dark:text-emerald-300 text-[11px] sm:text-xs">
          Vibe & Safety:
        </span>
        <span className="font-mono font-bold text-base-content text-[11px] sm:text-xs">
          {overallScore}/100
        </span>
        <span className="text-[10px] text-base-content/60 hidden sm:inline">
          • {label}
        </span>
        <Info className="size-3 text-base-content/40 group-hover:text-emerald-600 transition-colors shrink-0 ml-0.5" />
      </div>

      {/* Floating Modal on Mobile, Popover on Desktop */}
      {isOpen && (
        <>
          {/* Mobile Backdrop */}
          <div 
            className="fixed inset-0 bg-black/50 backdrop-blur-xs z-50 sm:hidden"
            onClick={() => setIsOpen(false)}
          />

          <div 
            className="fixed inset-x-4 top-1/2 -translate-y-1/2 sm:translate-y-0 sm:inset-auto sm:absolute sm:left-0 sm:top-full sm:mt-2 z-50 w-auto sm:w-96 max-w-xs sm:max-w-sm rounded-2xl border border-base-200/90 bg-base-100 dark:bg-base-900 p-4 shadow-2xl backdrop-blur-md transition-all animate-in fade-in zoom-in-95 duration-150 mx-auto"
            onMouseEnter={handleMouseEnter}
            onMouseLeave={handleMouseLeave}
          >
            {/* Header: Title & Overall Score */}
            <div className="flex items-center justify-between gap-2 border-b border-base-200/70 pb-2.5">
              <div className="flex items-center gap-1.5">
                <span className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2 py-0.5 text-[11px] font-bold text-primary border border-primary/20">
                  <Sparkles className="size-3" /> Vibe & Safety
                </span>
                <span className="text-[10px] text-base-content/50 font-medium">Telemetry</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="font-mono font-black text-sm text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-lg border border-emerald-500/20">
                  {overallScore}/100
                </span>
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

            {/* Subtitle / Tagline */}
            <div className="mt-2 text-left">
              <h4 className="text-xs font-bold text-base-content">{label}</h4>
              <p className="text-[11px] text-base-content/60 leading-tight">{tagline}</p>
            </div>

            {/* 4 Core Pillars Grid */}
            <div className="mt-2.5 grid grid-cols-2 gap-2 text-left">
              {/* Walkability */}
              <div className="rounded-xl bg-base-200/50 p-2.5 border border-base-200/60">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5">
                    <Footprints className="size-3.5 text-emerald-600 dark:text-emerald-400 shrink-0" />
                    <span className="text-[11px] font-bold text-base-content">Walk</span>
                  </div>
                  <span className="font-mono text-xs font-bold text-base-content">
                    {metrics?.walkability?.score}
                  </span>
                </div>
                <p className="mt-1 text-[10px] font-medium text-emerald-600 dark:text-emerald-400 truncate">
                  {metrics?.walkability?.label}
                </p>
              </div>

              {/* Transit */}
              <div className="rounded-xl bg-base-200/50 p-2.5 border border-base-200/60">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5">
                    <Train className="size-3.5 text-blue-600 dark:text-blue-400 shrink-0" />
                    <span className="text-[11px] font-bold text-base-content">Transit</span>
                  </div>
                  <span className="font-mono text-xs font-bold text-base-content">
                    {metrics?.transit?.score}
                  </span>
                </div>
                <p className="mt-1 text-[10px] font-medium text-blue-600 dark:text-blue-400 truncate">
                  {metrics?.transit?.label}
                </p>
              </div>

              {/* Green Cover */}
              <div className="rounded-xl bg-base-200/50 p-2.5 border border-base-200/60">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5">
                    <Trees className="size-3.5 text-green-600 dark:text-green-400 shrink-0" />
                    <span className="text-[11px] font-bold text-base-content">Parks</span>
                  </div>
                  <span className="font-mono text-xs font-bold text-base-content">
                    {metrics?.greenCover?.score}
                  </span>
                </div>
                <p className="mt-1 text-[10px] font-medium text-green-600 dark:text-green-400 truncate">
                  {metrics?.greenCover?.label}
                </p>
              </div>

              {/* Night Safety */}
              <div className="rounded-xl bg-base-200/50 p-2.5 border border-base-200/60">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5">
                    <ShieldCheck className="size-3.5 text-purple-600 dark:text-purple-400 shrink-0" />
                    <span className="text-[11px] font-bold text-base-content">Safety</span>
                  </div>
                  <span className="font-mono text-xs font-bold text-base-content">
                    {metrics?.safety?.score}
                  </span>
                </div>
                <p className="mt-1 text-[10px] font-medium text-purple-600 dark:text-purple-400 truncate">
                  {metrics?.safety?.label}
                </p>
              </div>
            </div>

            {/* Footer Data Attribution */}
            <div className="mt-2.5 flex items-center justify-between text-[10px] text-base-content/50 pt-2 border-t border-base-200/50">
              <span className="flex items-center gap-1 truncate max-w-[200px]">
                <Info className="size-3 shrink-0" /> {dataSource || "OSM Verified Infrastructure"}
              </span>
              <span className="text-primary font-medium shrink-0">Live Engine</span>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
