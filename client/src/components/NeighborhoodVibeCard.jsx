import { useQuery } from "@tanstack/react-query";
import { Footprints, Train, Trees, ShieldCheck, Sparkles, Loader2, Info } from "lucide-react";
import axiosInstance from "../lib/axios";

export default function NeighborhoodVibeCard({ latitude, longitude, locality, city }) {
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

  if (isLoading) {
    return (
      <div className="rounded-2xl border border-primary/20 bg-primary/5 p-5 animate-pulse">
        <div className="flex items-center gap-2">
          <Loader2 className="size-5 animate-spin text-primary" />
          <span className="text-sm font-semibold text-base-content">Analyzing Neighborhood Vibe & Safety…</span>
        </div>
      </div>
    );
  }

  if (isError || !vibe) {
    return null;
  }

  const { overallScore, label, tagline, metrics, dataSource } = vibe;

  return (
    <div className="mb-6 overflow-hidden rounded-2xl border border-primary/30 bg-gradient-to-br from-base-100 via-base-100 to-primary/5 p-5 shadow-sm">
      {/* Header Banner */}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between border-b border-base-200 pb-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2.5 py-0.5 text-xs font-bold text-primary">
              <Sparkles className="size-3.5" /> Neighborhood Vibe & Safety
            </span>
            <span className="badge badge-outline badge-xs text-[10px] text-base-content/60">Canary Feature</span>
          </div>
          <h3 className="mt-1 text-lg font-bold text-base-content">{label}</h3>
          <p className="text-xs text-base-content/60">{tagline}</p>
        </div>

        {/* Big Overall Score Badge */}
        <div className="flex items-center gap-2.5 self-start sm:self-center bg-base-200/80 px-4 py-2 rounded-2xl border border-base-300">
          <div className="text-right">
            <div className="text-[11px] font-semibold uppercase tracking-wider text-base-content/60">Livability</div>
            <div className="text-xs font-medium text-primary">Score</div>
          </div>
          <div className="text-2xl font-black text-primary font-mono">{overallScore}<span className="text-xs text-base-content/40 font-normal">/100</span></div>
        </div>
      </div>

      {/* 4 Core Pillars Grid */}
      <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-3">
        {/* Walkability */}
        <div className="rounded-xl bg-base-200/50 p-3.5 transition-all hover:bg-base-200">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="grid size-8 place-items-center rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
                <Footprints className="size-4" />
              </div>
              <div>
                <span className="text-xs font-bold text-base-content">Walkability</span>
                <p className="text-[11px] font-medium text-emerald-600 dark:text-emerald-400">
                  {metrics?.walkability?.label}
                </p>
              </div>
            </div>
            <span className="font-mono text-sm font-bold text-base-content">
              {metrics?.walkability?.score}/100
            </span>
          </div>
          <p className="mt-2 text-[11px] text-base-content/70">
            {metrics?.walkability?.description}
          </p>
        </div>

        {/* Transit */}
        <div className="rounded-xl bg-base-200/50 p-3.5 transition-all hover:bg-base-200">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="grid size-8 place-items-center rounded-lg bg-blue-500/10 text-blue-600 dark:text-blue-400">
                <Train className="size-4" />
              </div>
              <div>
                <span className="text-xs font-bold text-base-content">Transit Proximity</span>
                <p className="text-[11px] font-medium text-blue-600 dark:text-blue-400">
                  {metrics?.transit?.label}
                </p>
              </div>
            </div>
            <span className="font-mono text-sm font-bold text-base-content">
              {metrics?.transit?.score}/100
            </span>
          </div>
          <p className="mt-2 text-[11px] text-base-content/70">
            {metrics?.transit?.description}
          </p>
        </div>

        {/* Green Cover */}
        <div className="rounded-xl bg-base-200/50 p-3.5 transition-all hover:bg-base-200">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="grid size-8 place-items-center rounded-lg bg-green-500/10 text-green-600 dark:text-green-400">
                <Trees className="size-4" />
              </div>
              <div>
                <span className="text-xs font-bold text-base-content">Green Cover & Parks</span>
                <p className="text-[11px] font-medium text-green-600 dark:text-green-400">
                  {metrics?.greenCover?.label}
                </p>
              </div>
            </div>
            <span className="font-mono text-sm font-bold text-base-content">
              {metrics?.greenCover?.score}/100
            </span>
          </div>
          <p className="mt-2 text-[11px] text-base-content/70">
            {metrics?.greenCover?.description}
          </p>
        </div>

        {/* Night Safety */}
        <div className="rounded-xl bg-base-200/50 p-3.5 transition-all hover:bg-base-200">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="grid size-8 place-items-center rounded-lg bg-purple-500/10 text-purple-600 dark:text-purple-400">
                <ShieldCheck className="size-4" />
              </div>
              <div>
                <span className="text-xs font-bold text-base-content">Night Safety & Vitality</span>
                <p className="text-[11px] font-medium text-purple-600 dark:text-purple-400">
                  {metrics?.safety?.label}
                </p>
              </div>
            </div>
            <span className="font-mono text-sm font-bold text-base-content">
              {metrics?.safety?.score}/100
            </span>
          </div>
          <p className="mt-2 text-[11px] text-base-content/70">
            {metrics?.safety?.description}
          </p>
        </div>
      </div>

      {/* Verified Data Attribution */}
      <div className="mt-3 flex items-center justify-between text-[11px] text-base-content/50 pt-2 border-t border-base-200/60">
        <span className="flex items-center gap-1">
          <Info className="size-3" /> Source: {dataSource || "OpenStreetMap Verified Infrastructures"}
        </span>
        <span className="text-primary font-semibold">Deterministic Vibe Engine</span>
      </div>
    </div>
  );
}
