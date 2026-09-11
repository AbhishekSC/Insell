import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router";
import { ChevronRight, Flame, MapPin, Navigation } from "lucide-react";
import AppShell from "../components/AppShell";
import axiosInstance from "../lib/axios";
import { useLiveLocation } from "../hooks/useLiveLocation";

function formatMoney(value) {
  const amount = Number(value || 0);
  if (!Number.isFinite(amount) || amount <= 0) return "Price on request";
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(amount);
}

export default function TrendingNearYouPage() {
  const navigate = useNavigate();
  const { location: liveLocation, status: liveLocStatus, refresh: refreshLocation } = useLiveLocation();

  const { data, isLoading } = useQuery({
    queryKey: ["trendingNearYou", "full", liveLocation?.lat, liveLocation?.lon],
    queryFn: async () => {
      const params = { limit: 20 };
      if (liveLocation?.lat && liveLocation?.lon) {
        params.lat = liveLocation.lat;
        params.lon = liveLocation.lon;
      }
      const res = await axiosInstance.get("/personalization/trending-near-you", { params });
      return res.data?.data;
    },
  });

  const properties = data?.properties || [];
  const usingLiveFix = data?.source === "geo:live";

  return (
    <AppShell hideHero title="Trending Near You" subtitle="What's gaining interest close to where you are">
      <div className="mx-auto max-w-3xl px-4 py-6 pb-24">
        <div className="mb-6 flex items-center gap-4 rounded-2xl bg-gradient-to-r from-primary to-secondary p-5 text-white shadow-sm">
          <div className="grid size-12 shrink-0 place-items-center rounded-xl bg-white/15">
            <Flame className="size-6" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-lg font-bold">Hot right now, near you</p>
            <p className="text-sm text-white/80">
              {usingLiveFix
                ? "Ranked from your current location"
                : "Ranked from your saved location — share your live location for pinpoint results"}
            </p>
          </div>
          {!usingLiveFix && liveLocStatus !== "locating" && (
            <button
              type="button"
              onClick={refreshLocation}
              className="btn btn-sm shrink-0 border-none bg-white/15 text-white hover:bg-white/25"
            >
              <Navigation className="size-4" /> Use my location
            </button>
          )}
        </div>

        {isLoading ? (
          <div className="space-y-2.5">
            {[1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="h-[92px] animate-pulse rounded-2xl bg-base-200" />
            ))}
          </div>
        ) : properties.length === 0 ? (
          <div className="rounded-2xl border border-base-300 bg-base-100 p-8 text-center">
            <Flame className="mx-auto mb-3 size-8 text-base-content/50" />
            <p className="text-lg font-semibold text-base-content">Nothing trending near you yet</p>
            <p className="mt-2 text-sm text-base-content/60">
              Try sharing your live location, or check back once more listings go up in your area.
            </p>
            <button
              type="button"
              onClick={() => navigate("/marketplace")}
              className="btn btn-primary btn-sm mt-4 rounded-lg border-none"
            >
              Browse listings
            </button>
          </div>
        ) : (
          <div className="space-y-2.5">
            {properties.map((post) => (
              <button
                key={post.id}
                type="button"
                onClick={() => navigate(`/property/${post.id}`)}
                className="group flex w-full items-center gap-3 rounded-2xl border border-base-300 bg-base-100 p-3 text-left shadow-sm transition hover:border-primary/30 hover:shadow-md"
              >
                <img
                  src={post.coverImage || "https://placehold.co/160x120?text=NearMySpace"}
                  alt={post.title}
                  className="h-16 w-24 shrink-0 rounded-xl object-cover"
                />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <p className="truncate text-sm font-semibold text-base-content">{post.title}</p>
                    <span className="shrink-0 rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-bold text-primary">
                      {post.trendingScore}% trending
                    </span>
                  </div>
                  <p className="mt-0.5 truncate text-sm font-medium text-primary">{formatMoney(post.price)}</p>
                  <div className="mt-1 flex items-center gap-1 text-xs text-base-content/60">
                    <MapPin className="size-3 shrink-0" />
                    <span className="truncate">
                      {post.distanceKm != null ? `${post.distanceKm} km away` : [post.locality, post.city].filter(Boolean).join(", ") || "India"}
                    </span>
                  </div>
                  {post.reasons?.length > 0 && (
                    <div className="mt-1.5 flex flex-wrap gap-1">
                      {post.reasons.map((r) => (
                        <span key={r} className="rounded-full bg-base-200 px-2 py-0.5 text-[10px] font-medium text-base-content/70">
                          {r}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
                <ChevronRight className="size-4 shrink-0 text-base-content/30" />
              </button>
            ))}
          </div>
        )}
      </div>
    </AppShell>
  );
}
