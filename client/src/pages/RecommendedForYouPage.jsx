import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router";
import { ChevronRight, MapPin, Sparkles } from "lucide-react";
import AppShell from "../components/AppShell";
import axiosInstance from "../lib/axios";

function formatMoney(value) {
  const amount = Number(value || 0);
  if (!Number.isFinite(amount) || amount <= 0) return "Price on request";
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(amount);
}

export default function RecommendedForYouPage() {
  const navigate = useNavigate();

  const { data: recommendations = [], isLoading } = useQuery({
    queryKey: ["personalizedRecommendations", "full"],
    queryFn: async () => {
      const res = await axiosInstance.get("/personalization/recommendations?limit=20");
      return res.data?.data?.recommendations || [];
    },
  });

  return (
    <AppShell hideHero title="Recommended for You" subtitle="Listings near you, matched to what you've been looking at">
      <div className="mx-auto max-w-3xl px-4 py-6 pb-24">
        <div className="mb-6 flex items-center gap-4 rounded-2xl bg-gradient-to-r from-primary to-secondary p-5 text-white shadow-sm">
          <div className="grid size-12 shrink-0 place-items-center rounded-xl bg-white/15">
            <Sparkles className="size-6" />
          </div>
          <div className="min-w-0">
            <p className="text-lg font-bold">Picked for you</p>
            <p className="text-sm text-white/80">Based on your location, budget, and the properties you've liked, saved, and viewed</p>
          </div>
        </div>

        {isLoading ? (
          <div className="space-y-2.5">
            {[1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="h-[92px] animate-pulse rounded-2xl bg-base-200" />
            ))}
          </div>
        ) : recommendations.length === 0 ? (
          <div className="rounded-2xl border border-base-300 bg-base-100 p-8 text-center">
            <Sparkles className="mx-auto mb-3 size-8 text-base-content/50" />
            <p className="text-lg font-semibold text-base-content">No recommendations yet</p>
            <p className="mt-2 text-sm text-base-content/60">
              Like, save, or open a few listings and we'll start tailoring this to you.
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
            {recommendations.map((post) => (
              <button
                key={post._id}
                type="button"
                onClick={() => navigate(`/property/${post._id}`)}
                className="group flex w-full items-center gap-3 rounded-2xl border border-base-300 bg-base-100 p-3 text-left shadow-sm transition hover:border-primary/30 hover:shadow-md"
              >
                <img
                  src={post.mediaUrls?.[0] || post.media?.[0] || "https://placehold.co/160x120?text=NearMySpace"}
                  alt={post.title || "Recommended listing"}
                  className="h-16 w-24 shrink-0 rounded-xl object-cover"
                />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-base-content">{post.title || "Property"}</p>
                  <p className="mt-0.5 truncate text-sm font-medium text-primary">{formatMoney(post.price)}</p>
                  <div className="mt-1 flex items-center gap-1 text-xs text-base-content/60">
                    <MapPin className="size-3 shrink-0" />
                    <span className="truncate">
                      {[post.city, post.propertyType].filter(Boolean).join(" · ") || "India"}
                    </span>
                  </div>
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
