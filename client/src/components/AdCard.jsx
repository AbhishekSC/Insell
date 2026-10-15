import { useEffect, useRef, useState } from "react";
import { ExternalLink, Megaphone, Sparkles, X } from "lucide-react";
import toast from "react-hot-toast";
import axiosInstance from "../lib/axios";
import { cardImageUrl } from "../lib/cloudinaryImage";

export default function AdCard({ ad, onDismiss }) {
  const cardRef = useRef(null);
  const [firedImpression, setFiredImpression] = useState(false);
  const [imageError, setImageError] = useState(false);

  useEffect(() => {
    if (firedImpression || !cardRef.current || !ad?._id) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) {
          // Record impression asynchronously without blocking UI
          axiosInstance.post(`/advertisements/${ad._id}/impression`).catch(() => {});
          setFiredImpression(true);
          observer.disconnect();
        }
      },
      { threshold: 0.5 }
    );

    observer.observe(cardRef.current);
    return () => observer.disconnect();
  }, [firedImpression, ad?._id]);

  const handleCtaClick = (e) => {
    e.stopPropagation();
    if (!ad?._id) return;

    // Fire click telemetry
    axiosInstance.post(`/advertisements/${ad._id}/click`).catch(() => {});

    if (ad.targetUrl) {
      if (ad.targetUrl.startsWith("http://") || ad.targetUrl.startsWith("https://")) {
        window.open(ad.targetUrl, "_blank", "noopener,noreferrer");
      } else {
        window.location.href = ad.targetUrl;
      }
    }
  };

  const handleHide = (e) => {
    e.stopPropagation();
    if (ad?._id) {
      axiosInstance.post(`/advertisements/${ad._id}/dismiss`).catch(() => {});
    }
    toast.success("Ad hidden", { duration: 2000 });
    onDismiss?.(ad._id);
  };

  const bannerSrc = ad?.mediaUrl ? cardImageUrl(ad.mediaUrl, 900) : "";

  return (
    <div
      ref={cardRef}
      className="group relative flex flex-col overflow-hidden rounded-2xl border border-primary/20 bg-base-100 shadow-sm transition-all hover:border-primary/40 hover:shadow-md"
    >
      {/* Top Meta Bar */}
      <div className="flex items-center justify-between border-b border-base-200 bg-gradient-to-r from-primary/10 via-base-100 to-primary/5 px-4 py-2.5">
        <div className="flex items-center gap-2">
          <span className="rounded bg-primary/15 px-1.5 py-0.5 text-[10px] font-black tracking-wider text-primary uppercase">
            Ad
          </span>
          <div className="flex items-center gap-1.5">
            {ad.companyName ? (
              <span className="text-xs font-semibold text-base-content/80 truncate max-w-[160px] sm:max-w-[220px]">
                {ad.companyName}
              </span>
            ) : (
              <span className="text-xs font-semibold text-base-content/70">
                Sponsored Listing
              </span>
            )}
          </div>
        </div>

        <button
          type="button"
          onClick={handleHide}
          className="btn btn-ghost btn-xs btn-circle text-base-content/40 hover:text-base-content"
          aria-label="Hide advertisement"
          title="Hide ad"
        >
          <X className="size-3.5" />
        </button>
      </div>

      {/* Banner / Media */}
      {bannerSrc && !imageError ? (
        <div
          role="button"
          tabIndex={0}
          onClick={handleCtaClick}
          onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && handleCtaClick(e)}
          className="relative aspect-[16/9] w-full overflow-hidden bg-base-200 cursor-pointer"
        >
          <img
            src={bannerSrc}
            alt={ad.title}
            onError={() => setImageError(true)}
            className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
            loading="lazy"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/40 via-transparent to-transparent opacity-0 transition-opacity group-hover:opacity-100" />
        </div>
      ) : (
        <div
          role="button"
          tabIndex={0}
          onClick={handleCtaClick}
          className="flex aspect-[21/9] w-full items-center justify-center bg-gradient-to-br from-primary/15 via-primary/5 to-base-200 p-6 cursor-pointer"
        >
          <Megaphone className="size-10 text-primary/40" />
        </div>
      )}

      {/* Ad Content */}
      <div className="flex flex-1 flex-col justify-between p-4 sm:p-5">
        <div>
          <div className="flex items-start justify-between gap-2">
            <h3
              onClick={handleCtaClick}
              className="text-base sm:text-lg font-bold text-base-content line-clamp-2 cursor-pointer hover:text-primary transition-colors"
            >
              {ad.title}
            </h3>
            {ad.targetCity && (
              <span className="shrink-0 rounded-full bg-base-200 px-2.5 py-0.5 text-[11px] font-medium text-base-content/70">
                {ad.targetCity}
              </span>
            )}
          </div>

          <p className="mt-2 text-xs sm:text-sm text-base-content/70 line-clamp-3 leading-relaxed">
            {ad.description}
          </p>
        </div>

        {/* CTA Bar */}
        <div className="mt-4 flex items-center justify-between gap-3 pt-3 border-t border-base-200">
          <div className="flex items-center gap-1.5 text-xs text-base-content/50">
            <span>Verified partner</span>
            {(ad.impressionsCount ?? 0) > 0 && (
              <>
                <span>•</span>
                <span className="text-base-content/60 font-medium">
                  {ad.impressionsCount} view{ad.impressionsCount === 1 ? "" : "s"}
                </span>
              </>
            )}
          </div>

          <button
            type="button"
            onClick={handleCtaClick}
            className="btn btn-sm btn-primary gap-1.5 shadow-sm hover:shadow"
          >
            <span>{ad.ctaText || "Learn More"}</span>
            <ExternalLink className="size-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
}
