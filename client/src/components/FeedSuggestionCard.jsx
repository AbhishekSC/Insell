import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router";
import { Flame, Sparkles, X } from "lucide-react";
import { cardImageUrl, lqipUrl } from "../lib/cloudinaryImage";
import { trackRecoEvent } from "../lib/recoEvents";

function formatMoney(value) {
  const n = Number(value || 0);
  if (n >= 10000000) return `₹${(n / 10000000).toFixed(2)} Cr`;
  if (n >= 100000) return `₹${(n / 100000).toFixed(2)} L`;
  return `₹${n.toLocaleString("en-IN")}`;
}

// Normalizes the two different shapes this card can receive: a full
// PropertyPost doc (from /personalization/recommendations) or the slim
// trending DTO (from /personalization/trending-near-you).
function normalizeSuggestion(suggestionType, data) {
  if (suggestionType === "trending") {
    return {
      id: String(data.id),
      title: data.title || "Property",
      price: data.price,
      subtitle: data.distanceKm != null ? `${data.distanceKm} km away` : data.city || "Nearby",
      image: data.coverImage,
      reason: Array.isArray(data.reasons) && data.reasons.length > 0 ? data.reasons[0] : null,
      scoreLabel: Number.isFinite(data.trendingScore) ? `${Math.round(data.trendingScore)}%` : null,
      scores: { final: data.trendingScore },
    };
  }
  return {
    id: String(data._id),
    title: data.title || "Property",
    price: data.price,
    subtitle: data.city || "India",
    image: data.mediaUrls?.[0] || data.media?.[0],
    reason: null,
    scoreLabel: Number.isFinite(data.personalizationScore) ? `${Math.round(data.personalizationScore)}%` : null,
    scores: {
      personalization: data.personalizationScore,
      comment: data.commentScore,
      recency: data.recencyScore,
      popularity: data.popularityScore,
      final: data.finalScore,
    },
  };
}

export default function FeedSuggestionCard({ suggestionType, data, position, onDismiss }) {
  const navigate = useNavigate();
  const cardRef = useRef(null);
  const [firedImpression, setFiredImpression] = useState(false);
  const suggestion = normalizeSuggestion(suggestionType, data);

  const isTrending = suggestionType === "trending";
  const accent = isTrending
    ? { bar: "bg-amber-500/10 text-amber-600", icon: Flame, pill: "Trending", ring: "ring-amber-500/20" }
    : { bar: "bg-indigo-500/10 text-indigo-600", icon: Sparkles, pill: "Suggested", ring: "ring-indigo-500/20" };
  const Icon = accent.icon;

  useEffect(() => {
    if (firedImpression || !cardRef.current) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) {
          trackRecoEvent({
            post: suggestion.id,
            event: "impression",
            position,
            context: "feed",
            strategy: suggestionType,
            scores: suggestion.scores,
          });
          setFiredImpression(true);
          observer.disconnect();
        }
      },
      { threshold: 0.5 }
    );
    observer.observe(cardRef.current);
    return () => observer.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [firedImpression, suggestion.id]);

  const handleOpen = () => {
    trackRecoEvent({
      post: suggestion.id,
      event: "click",
      position,
      context: "feed",
      strategy: suggestionType,
      scores: suggestion.scores,
    });
    navigate(`/property/${suggestion.id}`);
  };

  const handleDismiss = (event) => {
    event.stopPropagation();
    trackRecoEvent({
      post: suggestion.id,
      event: "dismiss",
      reason: "not_interested",
      context: "feed",
      strategy: suggestionType,
    });
    onDismiss?.(suggestion.id);
  };

  const placeholder = lqipUrl(suggestion.image);
  const imageSrc = cardImageUrl(suggestion.image, 900);

  return (
    <div
      ref={cardRef}
      role="button"
      tabIndex={0}
      onClick={handleOpen}
      onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && handleOpen()}
      className={`group relative overflow-hidden rounded-2xl border border-base-200 bg-base-100 shadow-sm ring-1 ${accent.ring} cursor-pointer transition hover:shadow-md`}
    >
      <div className={`flex items-center justify-between px-3 py-2 ${accent.bar}`}>
        <span className="flex items-center gap-1.5 text-xs font-bold">
          <Icon className="size-3.5" /> {isTrending ? "Trending Near You" : "Recommended for You"}
        </span>
        <div className="flex items-center gap-1.5">
          {suggestion.scoreLabel && (
            <span className="rounded-full bg-base-100/80 px-1.5 py-0.5 text-[10px] font-bold">
              {suggestion.scoreLabel}
            </span>
          )}
          <button
            type="button"
            aria-label="Not interested"
            onClick={handleDismiss}
            className="btn btn-ghost btn-circle btn-xs opacity-60 hover:opacity-100 hover:bg-base-100/60"
          >
            <X className="size-3.5" />
          </button>
        </div>
      </div>

      <div className="relative h-[16rem] w-full bg-base-200">
        {placeholder && (
          <img src={placeholder} alt="" aria-hidden="true" className="absolute inset-0 h-full w-full object-cover" />
        )}
        {suggestion.image && (
          <img
            src={imageSrc}
            alt={suggestion.title}
            loading="lazy"
            decoding="async"
            className="absolute inset-0 h-full w-full object-cover"
          />
        )}
        {suggestion.reason && (
          <span className="absolute bottom-2 left-2 rounded-full bg-black/60 px-2 py-0.5 text-[10px] font-medium text-white">
            {suggestion.reason}
          </span>
        )}
      </div>

      <div className="p-3">
        <p className="truncate text-sm font-semibold text-base-content">{suggestion.title}</p>
        <p className="truncate text-xs text-base-content/60">
          {formatMoney(suggestion.price)} · {suggestion.subtitle}
        </p>
      </div>
    </div>
  );
}
