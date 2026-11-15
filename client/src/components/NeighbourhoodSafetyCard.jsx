import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  ShieldCheck,
  Siren,
  Building2,
  Flame,
  MapPin,
  Footprints,
  Train,
  Trees,
  TrendingUp,
  TrendingDown,
  Minus,
  ChevronDown,
  ChevronUp,
  Info,
  ExternalLink,
  Loader2,
  Sparkles,
} from "lucide-react";
import axiosInstance from "../lib/axios";
import { useSafetyOverview } from "../hooks/useNeighbourhoodSafety";

const FACILITY_ICONS = { police: Siren, hospital: Building2, fire_station: Flame };
const FACILITY_COLORS = { police: "text-blue-600 dark:text-blue-400", hospital: "text-red-500 dark:text-red-400", fire_station: "text-orange-500 dark:text-orange-400" };
const FACILITY_BG = { police: "bg-blue-500/10", hospital: "bg-red-500/10", fire_station: "bg-orange-500/10" };
const FACILITY_LABELS = { police: "Police Station", hospital: "Hospital", fire_station: "Fire Station" };

const GRADE_STYLES = {
  A: { bg: "bg-emerald-500/15", text: "text-emerald-700 dark:text-emerald-300", border: "border-emerald-500/30" },
  B: { bg: "bg-green-500/15", text: "text-green-700 dark:text-green-300", border: "border-green-500/30" },
  C: { bg: "bg-yellow-500/15", text: "text-yellow-700 dark:text-yellow-300", border: "border-yellow-500/30" },
  D: { bg: "bg-orange-500/15", text: "text-orange-700 dark:text-orange-300", border: "border-orange-500/30" },
  E: { bg: "bg-red-500/15", text: "text-red-700 dark:text-red-300", border: "border-red-500/30" },
};

const METRIC_ICONS = {
  walkability: { Icon: Footprints, color: "text-emerald-600 dark:text-emerald-400" },
  transit: { Icon: Train, color: "text-blue-600 dark:text-blue-400" },
  greenCover: { Icon: Trees, color: "text-green-600 dark:text-green-400" },
  safety: { Icon: ShieldCheck, color: "text-purple-600 dark:text-purple-400" },
};

function TrendBadge({ trend }) {
  if (!trend || trend.direction === "stable") {
    return (
      <span className="inline-flex items-center gap-1 text-[10px] font-medium text-base-content/60 bg-base-200/60 px-1.5 py-0.5 rounded-full">
        <Minus className="size-2.5" /> Stable
      </span>
    );
  }
  if (trend.direction === "decreasing") {
    return (
      <span className="inline-flex items-center gap-1 text-[10px] font-medium text-emerald-700 dark:text-emerald-400 bg-emerald-500/10 px-1.5 py-0.5 rounded-full">
        <TrendingDown className="size-2.5" /> {trend.changePercent}% down
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 text-[10px] font-medium text-red-600 dark:text-red-400 bg-red-500/10 px-1.5 py-0.5 rounded-full">
      <TrendingUp className="size-2.5" /> {trend.changePercent}% up
    </span>
  );
}

function FacilityRow({ facility }) {
  const Icon = FACILITY_ICONS[facility.type] || MapPin;
  const color = FACILITY_COLORS[facility.type] || "text-base-content/70";
  const bg = FACILITY_BG[facility.type] || "bg-base-200/50";
  const mapsUrl = facility.lat && facility.lng
    ? `https://www.google.com/maps/search/?api=1&query=${facility.lat},${facility.lng}`
    : null;

  return (
    <div className="flex items-center gap-2.5 py-1.5">
      <div className={`shrink-0 grid place-items-center size-7 rounded-lg ${bg}`}>
        <Icon className={`size-3.5 ${color}`} />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-xs font-medium text-base-content truncate">{facility.name}</p>
        <p className="text-[10px] text-base-content/50 truncate">{FACILITY_LABELS[facility.type]}</p>
      </div>
      <div className="shrink-0 flex items-center gap-1.5">
        <span className="text-[11px] font-mono font-semibold text-base-content/70">
          {facility.distance < 1000 ? `${facility.distance}m` : `${(facility.distance / 1000).toFixed(1)}km`}
        </span>
        {mapsUrl && (
          <a
            href={mapsUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="grid place-items-center size-5 rounded-md bg-base-200/60 hover:bg-primary/10 transition-colors"
            title="View on Google Maps"
            onClick={(e) => e.stopPropagation()}
          >
            <ExternalLink className="size-2.5 text-primary" />
          </a>
        )}
      </div>
    </div>
  );
}

function CrimeBar({ label, value, maxValue }) {
  const pct = maxValue ? Math.min(100, (value / maxValue) * 100) : 0;
  return (
    <div className="flex items-center gap-2">
      <span className="w-24 text-[10px] text-base-content/60 truncate">{label}</span>
      <div className="flex-1 h-1.5 bg-base-200/60 rounded-full overflow-hidden">
        <div
          className="h-full bg-gradient-to-r from-yellow-400 to-red-500 rounded-full transition-all"
          style={{ width: `${pct}%` }}
        />
      </div>
      <span className="w-8 text-right text-[10px] font-mono text-base-content/70">{value}</span>
    </div>
  );
}

function VibeMetric({ metricKey, metric }) {
  const config = METRIC_ICONS[metricKey];
  if (!config || !metric) return null;
  const { Icon, color } = config;

  return (
    <div className="rounded-xl bg-base-200/50 p-2.5 border border-base-200/60">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <Icon className={`size-3.5 ${color} shrink-0`} />
          <span className="text-[11px] font-bold text-base-content">
            {metricKey === "walkability" ? "Walk" : metricKey === "transit" ? "Transit" : metricKey === "greenCover" ? "Parks" : "Safety"}
          </span>
        </div>
        <span className="font-mono text-xs font-bold text-base-content">{metric.score}</span>
      </div>
      <p className={`mt-1 text-[10px] font-medium ${color} truncate`}>{metric.label}</p>
    </div>
  );
}

export default function NeighbourhoodSafetyCard({ latitude, longitude, locality, city, district, state }) {
  const [expanded, setExpanded] = useState(false);

  const { data: vibeData, isLoading: vibeLoading } = useQuery({
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

  const { data: safetyData, isLoading: safetyLoading } = useSafetyOverview({
    lat: latitude,
    lng: longitude,
    locality,
    city,
    district: district || city,
    state,
  });

  const isLoading = vibeLoading || safetyLoading;

  if (isLoading) {
    return (
      <div className="flex items-center gap-2 rounded-xl bg-base-200/40 border border-base-200/60 p-3 mb-4 animate-pulse">
        <Loader2 className="size-4 animate-spin text-primary" />
        <span className="text-xs text-base-content/60">Analyzing neighbourhood safety & vibe...</span>
      </div>
    );
  }

  const hasVibe = vibeData?.overallScore != null;
  const crimeData = safetyData?.crimeData;
  const emergencyFacilities = safetyData?.emergencyFacilities;
  const hasCrime = crimeData?.found;
  const hasFacilities = emergencyFacilities?.length > 0;

  if (!hasVibe && !hasCrime && !hasFacilities) return null;

  const gradeStyle = hasCrime ? GRADE_STYLES[crimeData.safetyGrade.grade] || GRADE_STYLES.C : null;
  const closestPolice = emergencyFacilities?.find((f) => f.type === "police");
  const closestHospital = emergencyFacilities?.find((f) => f.type === "hospital");

  const crimeBreakdown = hasCrime
    ? [
        { label: "Kidnapping", value: crimeData.latestCrimes.kidnappingAndAbduction },
        { label: "Assault", value: crimeData.latestCrimes.assaultOnWomen },
        { label: "Cruelty", value: crimeData.latestCrimes.crueltyByHusband },
        { label: "Rape", value: crimeData.latestCrimes.rape },
        { label: "POCSO", value: crimeData.latestCrimes.pocso },
      ].sort((a, b) => b.value - a.value)
    : [];

  const maxCrimeValue = crimeBreakdown[0]?.value || 1;

  return (
    <div className="rounded-2xl border border-base-200/70 bg-base-100 shadow-sm mb-4 overflow-hidden">
      {/* Header */}
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center gap-3 p-3.5 hover:bg-base-200/30 transition-colors text-left"
      >
        <div className="grid place-items-center size-9 rounded-xl bg-gradient-to-br from-emerald-500/10 to-blue-500/10 border border-emerald-500/20">
          <ShieldCheck className="size-4.5 text-emerald-600 dark:text-emerald-400" />
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h3 className="text-sm font-bold text-base-content">Neighbourhood Insights</h3>
            {hasVibe && (
              <span className="inline-flex items-center gap-1 px-1.5 py-0.5 text-[10px] font-bold rounded-md bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border border-emerald-500/20">
                <Sparkles className="size-2.5" /> {vibeData.overallScore}/100
              </span>
            )}
            {hasCrime && (
              <span className={`px-1.5 py-0.5 text-[10px] font-bold rounded-md ${gradeStyle.bg} ${gradeStyle.text} ${gradeStyle.border} border`}>
                Grade {crimeData.safetyGrade.grade}
              </span>
            )}
            {hasCrime && <TrendBadge trend={crimeData.trend} />}
          </div>
          <p className="text-[11px] text-base-content/50 mt-0.5">
            {hasVibe && vibeData.label}
            {hasVibe && (closestPolice || closestHospital) && " · "}
            {closestPolice && `Police ${closestPolice.distance < 1000 ? `${closestPolice.distance}m` : `${(closestPolice.distance / 1000).toFixed(1)}km`}`}
            {closestPolice && closestHospital && " · "}
            {closestHospital && `Hospital ${closestHospital.distance < 1000 ? `${closestHospital.distance}m` : `${(closestHospital.distance / 1000).toFixed(1)}km`}`}
          </p>
        </div>

        <div className="shrink-0">
          {expanded ? <ChevronUp className="size-4 text-base-content/40" /> : <ChevronDown className="size-4 text-base-content/40" />}
        </div>
      </button>

      {/* Expanded Content */}
      {expanded && (
        <div className="px-3.5 pb-3.5 space-y-3 border-t border-base-200/50">

          {/* Vibe Scores Grid */}
          {hasVibe && vibeData.metrics && (
            <div className="pt-3">
              <h4 className="text-[11px] font-bold uppercase tracking-wider text-base-content/50 mb-2">
                Livability Scores
              </h4>
              <div className="grid grid-cols-2 gap-2">
                <VibeMetric metricKey="walkability" metric={vibeData.metrics.walkability} />
                <VibeMetric metricKey="transit" metric={vibeData.metrics.transit} />
                <VibeMetric metricKey="greenCover" metric={vibeData.metrics.greenCover} />
                <VibeMetric metricKey="safety" metric={vibeData.metrics.safety} />
              </div>
            </div>
          )}

          {/* Emergency Facilities */}
          {hasFacilities && (
            <div className="pt-2">
              <h4 className="text-[11px] font-bold uppercase tracking-wider text-base-content/50 mb-2">
                Nearby Emergency Services
              </h4>
              <div className="divide-y divide-base-200/40">
                {emergencyFacilities.slice(0, 6).map((f, i) => (
                  <FacilityRow key={i} facility={f} />
                ))}
              </div>
            </div>
          )}

          {/* Crime Data */}
          {hasCrime && (
            <div className="pt-2">
              <div className="flex items-center justify-between mb-2">
                <h4 className="text-[11px] font-bold uppercase tracking-wider text-base-content/50">
                  Crime Data — {crimeData.district}
                </h4>
                <a
                  href="https://ncrb.gov.in/crime-in-india-table-addtional-table-702702702702702-702702.html"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-[10px] text-primary hover:text-primary/80 font-medium transition-colors"
                  onClick={(e) => e.stopPropagation()}
                >
                  NCRB {crimeData.latestYear}
                  <ExternalLink className="size-2.5" />
                </a>
              </div>

              {/* Safety Grade Banner */}
              <div className={`flex items-center gap-3 rounded-xl p-2.5 mb-2.5 ${gradeStyle.bg} border ${gradeStyle.border}`}>
                <span className={`text-2xl font-black ${gradeStyle.text}`}>
                  {crimeData.safetyGrade.grade}
                </span>
                <div>
                  <p className={`text-xs font-bold ${gradeStyle.text}`}>
                    {crimeData.safetyGrade.label}
                  </p>
                  <p className="text-[10px] text-base-content/50">
                    {crimeData.latestCrimes.total} total incidents ({crimeData.yearRange.from}–{crimeData.yearRange.to} data)
                  </p>
                </div>
              </div>

              {/* Crime Breakdown Bars */}
              <div className="space-y-1.5">
                {crimeBreakdown.map((c) => (
                  <CrimeBar key={c.label} label={c.label} value={c.value} maxValue={maxCrimeValue} />
                ))}
              </div>

              {/* Year-over-Year Mini Chart */}
              {crimeData.yearlyData?.length > 1 && (
                <div className="mt-3">
                  <h5 className="text-[10px] font-bold text-base-content/50 mb-1.5">Yearly Trend</h5>
                  <div className="flex items-end gap-1 h-12">
                    {crimeData.yearlyData
                      .slice()
                      .reverse()
                      .map((yr) => {
                        const maxTotal = Math.max(...crimeData.yearlyData.map((y) => y.total));
                        const height = maxTotal ? (yr.total / maxTotal) * 100 : 0;
                        return (
                          <div key={yr.year} className="flex-1 flex flex-col items-center gap-0.5">
                            <div
                              className="w-full rounded-t bg-gradient-to-t from-blue-500/60 to-purple-500/40 transition-all"
                              style={{ height: `${height}%` }}
                              title={`${yr.year}: ${yr.total} incidents`}
                            />
                            <span className="text-[8px] text-base-content/40">{String(yr.year).slice(2)}</span>
                          </div>
                        );
                      })}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Source Attribution */}
          <div className="pt-2.5 border-t border-base-200/40 space-y-2">
            <h4 className="text-[10px] font-bold uppercase tracking-wider text-base-content/40">Data Sources</h4>
            <div className="flex flex-wrap gap-1.5">
              {hasCrime && (
                <a
                  href="https://ncrb.gov.in/crime-in-india-table-addtional-table-702702702702702-702702.html"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 rounded-full bg-base-200/60 hover:bg-primary/10 border border-base-200/80 px-2 py-0.5 text-[9px] font-medium text-base-content/60 hover:text-primary transition-colors"
                  onClick={(e) => e.stopPropagation()}
                >
                  <ShieldCheck className="size-2.5" />
                  NCRB Crime Records
                  <ExternalLink className="size-2" />
                </a>
              )}
              <a
                href="https://www.openstreetmap.org/"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 rounded-full bg-base-200/60 hover:bg-primary/10 border border-base-200/80 px-2 py-0.5 text-[9px] font-medium text-base-content/60 hover:text-primary transition-colors"
                onClick={(e) => e.stopPropagation()}
              >
                <MapPin className="size-2.5" />
                OpenStreetMap via Geoapify
                <ExternalLink className="size-2" />
              </a>
              <a
                href="https://indiadataportal.com/"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 rounded-full bg-base-200/60 hover:bg-primary/10 border border-base-200/80 px-2 py-0.5 text-[9px] font-medium text-base-content/60 hover:text-primary transition-colors"
                onClick={(e) => e.stopPropagation()}
              >
                <Info className="size-2.5" />
                India Data Portal
                <ExternalLink className="size-2" />
              </a>
            </div>
            <p className="text-[9px] text-base-content/35 leading-tight">
              Livability scores from OpenStreetMap infrastructure data. Crime statistics from NCRB public records. Emergency facility locations via Geoapify. Distances are approximate. Informational only — not a guarantee of safety.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
