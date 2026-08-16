import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router";
import { MapPin, TrendingUp } from "lucide-react";
import AppShell from "../components/AppShell";
import axiosInstance from "../lib/axios";

export default function TrendingLocalitiesPage() {
  const navigate = useNavigate();

  const { data: trendingLocations = [], isLoading } = useQuery({
    queryKey: ["trendingLocations", "full"],
    queryFn: async () => {
      const res = await axiosInstance.get("/personalization/trending-locations?limit=20");
      return res.data?.data?.trendingLocations || [];
    },
  });

  const goToLocation = (name) => {
    navigate(`/marketplace?search=${encodeURIComponent(name)}`);
  };

  return (
    <AppShell hideHero title="Trending Localities" subtitle="Popular areas other buyers and renters are searching">
      <div className="mx-auto max-w-3xl px-4 py-6 pb-24">
        {isLoading ? (
          <div className="space-y-2">
            {[1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="h-16 animate-pulse rounded-xl bg-slate-100" />
            ))}
          </div>
        ) : trendingLocations.length === 0 ? (
          <div className="rounded-2xl border border-slate-200 bg-white p-8 text-center">
            <TrendingUp className="mx-auto mb-3 size-8 text-slate-400" />
            <p className="text-lg font-semibold text-slate-800">No trending localities yet</p>
            <p className="mt-2 text-sm text-slate-500">Check back once more activity comes in.</p>
          </div>
        ) : (
          <div className="space-y-2">
            {trendingLocations.map((location) => (
              <button
                key={location.name}
                type="button"
                onClick={() => goToLocation(location.name)}
                className="flex w-full items-center justify-between rounded-xl border border-slate-200 bg-white p-4 text-left transition hover:border-indigo-200 hover:shadow-sm"
              >
                <div className="flex items-center gap-3">
                  <div className="grid size-10 shrink-0 place-items-center rounded-lg bg-indigo-50 text-indigo-600">
                    <MapPin className="size-4" />
                  </div>
                  <p className="text-sm font-semibold text-slate-800">{location.name}</p>
                </div>
                <div className="flex items-center gap-2">
                  {location.isNearUser && (
                    <span className="rounded-full bg-emerald-100 px-2 py-1 text-[11px] font-medium text-emerald-700">Near You</span>
                  )}
                  <span className="text-xs text-slate-500">{location.propertyCount} properties</span>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>
    </AppShell>
  );
}
