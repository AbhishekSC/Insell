import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router";
import { ChevronRight, MapPin, TrendingUp } from "lucide-react";
import AppShell from "../components/AppShell";
import axiosInstance from "../lib/axios";

const RANK_STYLES = [
  "bg-gradient-to-br from-amber-400 to-amber-600 text-white",
  "bg-gradient-to-br from-slate-300 to-slate-500 text-white",
  "bg-gradient-to-br from-orange-400 to-orange-600 text-white",
];

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
        <div className="mb-6 flex items-center gap-4 rounded-2xl bg-gradient-to-r from-indigo-500 to-purple-600 p-5 text-white shadow-sm">
          <div className="grid size-12 shrink-0 place-items-center rounded-xl bg-white/15">
            <TrendingUp className="size-6" />
          </div>
          <div className="min-w-0">
            <p className="text-lg font-bold">What's trending right now</p>
            <p className="text-sm text-white/80">Ranked by recent search and listing activity across NearMySpace</p>
          </div>
        </div>

        {isLoading ? (
          <div className="space-y-2.5">
            {[1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="h-[68px] animate-pulse rounded-2xl bg-slate-100" />
            ))}
          </div>
        ) : trendingLocations.length === 0 ? (
          <div className="rounded-2xl border border-slate-200 bg-white p-8 text-center">
            <TrendingUp className="mx-auto mb-3 size-8 text-slate-400" />
            <p className="text-lg font-semibold text-slate-800">No trending localities yet</p>
            <p className="mt-2 text-sm text-slate-500">Check back once more activity comes in.</p>
          </div>
        ) : (
          <div className="space-y-2.5">
            {trendingLocations.map((location, index) => (
              <button
                key={location.name}
                type="button"
                onClick={() => goToLocation(location.name)}
                className="group flex w-full items-center gap-3 rounded-2xl border border-slate-200 bg-white p-3.5 text-left shadow-sm transition hover:border-indigo-200 hover:shadow-md"
              >
                <div
                  className={`grid size-9 shrink-0 place-items-center rounded-full text-xs font-bold ${
                    RANK_STYLES[index] || "bg-slate-100 text-slate-500"
                  }`}
                >
                  {index + 1}
                </div>

                <div className="grid size-10 shrink-0 place-items-center rounded-xl bg-indigo-50 text-indigo-600">
                  <MapPin className="size-4" />
                </div>

                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <p className="truncate text-sm font-semibold text-slate-800">{location.name}</p>
                    {location.isNearUser && (
                      <span className="shrink-0 rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-semibold text-emerald-700">
                        Near You
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-slate-500">{location.propertyCount} propert{location.propertyCount === 1 ? "y" : "ies"} listed</p>
                </div>

                <ChevronRight className="size-4 shrink-0 text-slate-300 transition group-hover:text-indigo-500" />
              </button>
            ))}
          </div>
        )}
      </div>
    </AppShell>
  );
}
