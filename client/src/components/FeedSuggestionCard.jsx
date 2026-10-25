import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router";
import { Flame, Sparkles, X, MapPin } from "lucide-react";
import { cardImageUrl, lqipUrl } from "../lib/cloudinaryImage";
import { trackRecoEvent } from "../lib/recoEvents";

function formatMoney(value) {
  const n = Number(value || 0);
  if (n >= 10000000) return `₹${(n / 10000000).toFixed(2)} Cr`;
  if (n >= 100000) return `₹${(n / 100000).toFixed(2)} L`;
  return `₹${n.toLocaleString("en-IN")}`;
}

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
  const [imgLoaded, setImgLoaded] = useState(false);
  const suggestion = normalizeSuggestion(suggestionType, data);

  const isTrending = suggestionType === "trending";
  const Icon = isTrending ? Flame : Sparkles;

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
      className="group relative cursor-pointer overflow-hidden rounded-2xl border border-base-300/60 bg-base-100 shadow-sm transition-all hover:shadow-lg"
    >
      {/* ── MEDIA ── */}
      <div className="relative h-[18rem] w-full overflow-hidden bg-base-200">
        {placeholder && (
          <img
            src={placeholder}
            alt=""
            aria-hidden="true"
            className={`absolute inset-0 h-full w-full scale-110 object-cover blur-xl transition-opacity duration-300 ${imgLoaded ? "opacity-0" : "opacity-100"}`}
          />
        )}
        {suggestion.image && (
          <img
            src={imageSrc}
            alt={suggestion.title}
            loading="lazy"
            decoding="async"
            onLoad={() => setImgLoaded(true)}
            className={`absolute inset-0 h-full w-full object-cover transition-all duration-500 group-hover:scale-[1.03] ${imgLoaded ? "opacity-100" : "opacity-0"}`}
          />
        )}

        {/* Top scrim */}
        <div className="pointer-events-none absolute inset-x-0 top-0 h-20 bg-gradient-to-b from-black/50 to-transparent" />

        {/* Top bar: label + score + dismiss */}
        <div className="absolute inset-x-3 top-3 flex items-center justify-between">
          <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-bold text-white shadow-sm backdrop-blur-sm ${
            isTrending ? "bg-amber-500/80" : "bg-indigo-500/80"
          }`}>
            <Icon className="size-3" />
            {isTrending ? "Trending Near You" : "Recommended for You"}
          </span>
          <div className="flex items-center gap-1.5">
            {suggestion.scoreLabel && (
              <span className={`rounded-full px-2 py-0.5 text-[11px] font-black text-white backdrop-blur-sm ${
                isTrending ? "bg-amber-500/80" : "bg-indigo-500/80"
              }`}>
                {suggestion.scoreLabel}
              </span>
            )}
            <button
              type="button"
              aria-label="Not interested"
              onClick={handleDismiss}
              className="grid size-6 place-items-center rounded-full bg-black/40 text-white/80 backdrop-blur-sm transition hover:bg-black/60 hover:text-white"
            >
              <X className="size-3" />
            </button>
          </div>
        </div>

        {/* Bottom scrim */}
        <div className="pointer-events-none absolute inset-x-0 bottom-0 h-24 bg-gradient-to-t from-black/60 to-transparent" />

        {/* Bottom overlay: price + location */}
        <div className="absolute inset-x-3 bottom-3 flex items-end justify-between gap-3">
          <div className="min-w-0">
            <p className="truncate text-[15px] font-bold leading-tight text-white drop-shadow-sm">
              {suggestion.title}
            </p>
            <p className="mt-0.5 flex items-center gap-1 text-xs text-white/75">
              <MapPin className="size-3 shrink-0" />
              <span className="truncate">{suggestion.subtitle}</span>
            </p>
          </div>
          <span className="shrink-0 rounded-lg bg-black/50 px-2.5 py-1 text-sm font-black text-white backdrop-blur-sm">
            {formatMoney(suggestion.price)}
          </span>
        </div>

        {/* Reason pill */}
        {suggestion.reason && (
          <span className="absolute bottom-14 left-3 rounded-full bg-white/90 px-2.5 py-0.5 text-[10px] font-semibold text-base-content shadow-sm">
            {suggestion.reason}
          </span>
        )}
      </div>
    </div>
  );
}
