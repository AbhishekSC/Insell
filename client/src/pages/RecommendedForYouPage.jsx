import { useEffect, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router";
import { ChevronRight, MapPin, Sparkles, ThumbsDown } from "lucide-react";
import AppShell from "../components/AppShell";
import axiosInstance from "../lib/axios";
import { trackRecoEvent } from "../lib/recoEvents";

function formatMoney(value) {
  const amount = Number(value || 0);
  if (!Number.isFinite(amount) || amount <= 0) return "Price on request";
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(amount);
}

const DISMISS_REASONS = [
  { key: "wrong_area", label: "Wrong area" },
  { key: "too_expensive", label: "Too expensive" },
  { key: "wrong_type", label: "Wrong type" },
  { key: "not_interested", label: "Not interested" },
];

function scoresOf(post) {
  return {
    personalization: post.personalizationScore,
    comment: post.commentScore,
    recency: post.recencyScore,
    popularity: post.popularityScore,
    final: post.finalScore,
  };
}

export default function RecommendedForYouPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [hidden, setHidden] = useState(() => new Set());
  const [reasonFor, setReasonFor] = useState(null);
  const seenRef = useRef(new Set());

  const { data: recommendations = [], isLoading } = useQuery({
    queryKey: ["personalizedRecommendations", "full"],
    queryFn: async () => {
      const res = await axiosInstance.get("/personalization/recommendations?limit=20");
      return res.data?.data?.recommendations || [];
    },
  });

  // log an impression once per post per page visit
  useEffect(() => {
    recommendations.forEach((post, i) => {
      const id = String(post._id);
      if (seenRef.current.has(id)) return;
      seenRef.current.add(id);
      trackRecoEvent({ post: id, event: "impression", position: i, context: "reco_page", scores: scoresOf(post) });
    });
  }, [recommendations]);

  const open = (post, i) => {
    trackRecoEvent({ post: String(post._id), event: "click", position: i, context: "reco_page", scores: scoresOf(post) });
    navigate(`/property/${post._id}`);
  };

  const dismiss = (post, reason) => {
    trackRecoEvent({ post: String(post._id), event: "dismiss", reason, context: "reco_page", scores: scoresOf(post) });
    setHidden((prev) => new Set(prev).add(String(post._id)));
    setReasonFor(null);
    // refetch a fresh list (the dismissed post is now server-suppressed)
    setTimeout(() => queryClient.invalidateQueries({ queryKey: ["personalizedRecommendations"] }), 400);
  };

  const visible = recommendations.filter((p) => !hidden.has(String(p._id)));

  return (
    <AppShell hideHero title="Recommended for You" subtitle="Listings near you, matched to what you've been looking at">
      <div className="mx-auto max-w-3xl px-4 py-6 pb-24">
        <div className="mb-6 flex items-center gap-4 rounded-2xl bg-gradient-to-r from-primary to-secondary p-5 text-white shadow-sm">
          <div className="grid size-12 shrink-0 place-items-center rounded-xl bg-white/15">
            <Sparkles className="size-6" />
          </div>
          <div className="min-w-0">
            <p className="text-lg font-bold">Picked for you</p>
            <p className="text-sm text-white/80">Tap 👎 on anything that's off — the list learns from it</p>
          </div>
        </div>

        {isLoading ? (
          <div className="space-y-2.5">
            {[1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="h-[92px] animate-pulse rounded-2xl bg-base-200" />
            ))}
          </div>
        ) : visible.length === 0 ? (
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
            {visible.map((post, i) => (
              <div
                key={post._id}
                className="group rounded-2xl border border-base-300 bg-base-100 shadow-sm transition hover:border-primary/30 hover:shadow-md"
              >
                <div className="flex items-center gap-3 p-3">
                  <button type="button" onClick={() => open(post, i)} className="flex min-w-0 flex-1 items-center gap-3 text-left">
                    <img
                      src={post.mediaUrls?.[0] || post.media?.[0] || "https://placehold.co/160x120?text=NearMySpace"}
                      alt={post.title || "Recommended listing"}
                      className="h-16 w-24 shrink-0 rounded-xl object-cover"
                    />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <p className="truncate text-sm font-semibold text-base-content">{post.title || "Property"}</p>
                        {Math.round(post.personalizationScore) >= 55 && (
                          <span className="shrink-0 rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-bold text-primary">
                            {Math.round(post.personalizationScore)}% match
                          </span>
                        )}
                      </div>
                      <p className="mt-0.5 truncate text-sm font-medium text-primary">{formatMoney(post.price)}</p>
                      <div className="mt-1 flex items-center gap-1 text-xs text-base-content/60">
                        <MapPin className="size-3 shrink-0" />
                        <span className="truncate">{[post.city, post.propertyType].filter(Boolean).join(" · ") || "India"}</span>
                      </div>
                    </div>
                  </button>
                  <button
                    type="button"
                    className="btn btn-ghost btn-xs btn-circle text-base-content/40 hover:text-error"
                    onClick={() => setReasonFor(reasonFor === post._id ? null : post._id)}
                    aria-label="Not interested"
                  >
                    <ThumbsDown className="size-4" />
                  </button>
                  <ChevronRight className="size-4 shrink-0 text-base-content/30" />
                </div>
                {reasonFor === post._id && (
                  <div className="flex flex-wrap gap-1.5 border-t border-base-200 px-3 py-2">
                    {DISMISS_REASONS.map((r) => (
                      <button
                        key={r.key}
                        type="button"
                        className="rounded-full border border-base-300 px-2.5 py-1 text-xs font-medium text-base-content/70 hover:border-error/40 hover:text-error"
                        onClick={() => dismiss(post, r.key)}
                      >
                        {r.label}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </AppShell>
  );
}
