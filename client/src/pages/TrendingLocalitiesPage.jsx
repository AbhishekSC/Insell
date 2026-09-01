import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router";
import { ChevronRight, MapPin, TrendingUp } from "lucide-react";
import AppShell from "../components/AppShell";
import axiosInstance from "../lib/axios";

const RANK_STYLES = [
  "bg-gradient-to-br from-warning to-warning text-white",
  "bg-gradient-to-br from-base-300 to-base-300 text-white",
  "bg-gradient-to-br from-warning to-warning text-white",
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
        <div className="mb-6 flex items-center gap-4 rounded-2xl bg-gradient-to-r from-primary to-secondary p-5 text-white shadow-sm">
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
              <div key={i} className="h-[68px] animate-pulse rounded-2xl bg-base-200" />
            ))}
          </div>
        ) : trendingLocations.length === 0 ? (
          <div className="rounded-2xl border border-base-300 bg-base-100 p-8 text-center">
            <TrendingUp className="mx-auto mb-3 size-8 text-base-content/50" />
            <p className="text-lg font-semibold text-base-content">No trending localities yet</p>
            <p className="mt-2 text-sm text-base-content/60">Check back once more activity comes in.</p>
          </div>
        ) : (
          <div className="space-y-2.5">
            {trendingLocations.map((location, index) => (
              <button
                key={location.name}
                type="button"
                onClick={() => goToLocation(location.name)}
                className="group flex w-full items-center gap-3 rounded-2xl border border-base-300 bg-base-100 p-3.5 text-left shadow-sm transition hover:border-primary/30 hover:shadow-md"
              >
                <div
                  className={`grid size-9 shrink-0 place-items-center rounded-full text-xs font-bold ${
                    RANK_STYLES[index] || "bg-base-200 text-base-content/60"
                  }`}
                >
                  {index + 1}
                </div>

                <div className="grid size-10 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary">
                  <MapPin className="size-4" />
                </div>

                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <p className="truncate text-sm font-semibold text-base-content">{location.name}</p>
                    {location.isNearUser && (
                      <span className="shrink-0 rounded-full bg-success/15 px-2 py-0.5 text-[10px] font-semibold text-success">
                        Near You
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-base-content/60">{location.propertyCount} propert{location.propertyCount === 1 ? "y" : "ies"} listed</p>
                </div>

                <ChevronRight className="size-4 shrink-0 text-base-content/40 transition group-hover:text-primary" />
              </button>
            ))}
          </div>
        )}
      </div>
    </AppShell>
  );
}
