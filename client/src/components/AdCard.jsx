import { useEffect, useRef, useState } from "react";
import { ExternalLink, X } from "lucide-react";
import toast from "react-hot-toast";
import axiosInstance from "../lib/axios";
import { cardImageUrl } from "../lib/cloudinaryImage";

export default function AdCard({ ad, onDismiss }) {
  const cardRef = useRef(null);
  const [firedImpression, setFiredImpression] = useState(false);
  const [imageError, setImageError] = useState(false);

  useEffect(() => {
    if (firedImpression || !cardRef.current || !ad?._id) return;

    let dwellTimer = null;

    const observer = new IntersectionObserver(
      (entries) => {
        const entry = entries[0];
        if (entry?.isIntersecting) {
          dwellTimer = setTimeout(() => {
            axiosInstance.post(`/advertisements/${ad._id}/impression`).catch(() => {});
            setFiredImpression(true);
            observer.disconnect();
          }, 1500);
        } else {
          if (dwellTimer) {
            clearTimeout(dwellTimer);
            dwellTimer = null;
          }
        }
      },
      { threshold: 0.5 }
    );

    observer.observe(cardRef.current);
    return () => {
      if (dwellTimer) clearTimeout(dwellTimer);
      observer.disconnect();
    };
  }, [firedImpression, ad?._id]);

  const handleCtaClick = (e) => {
    e.stopPropagation();
    if (!ad?._id) return;

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
  const logoSrc = ad?.companyLogo ? cardImageUrl(ad.companyLogo, 80) : "";

  return (
    <div
      ref={cardRef}
      onClick={handleCtaClick}
      className="group relative cursor-pointer overflow-hidden rounded-2xl border border-base-300/60 bg-base-100 shadow-sm transition-all hover:shadow-lg"
    >
      {/* ── MEDIA ── */}
      <div className="relative overflow-hidden">
        {bannerSrc && !imageError ? (
          <div className="relative aspect-[2/1] w-full bg-base-200">
            <img
              src={bannerSrc}
              alt={ad.title}
              onError={() => setImageError(true)}
              className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.03]"
              loading="lazy"
            />
          </div>
        ) : (
          <div className="flex aspect-[2.5/1] w-full items-center justify-center bg-gradient-to-br from-primary/10 via-base-200 to-secondary/10" />
        )}

        {/* Top scrim */}
        <div className="pointer-events-none absolute inset-x-0 top-0 h-16 bg-gradient-to-b from-black/40 to-transparent" />

        {/* Sponsored label + dismiss */}
        <div className="absolute inset-x-3 top-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            {logoSrc && (
              <img
                src={logoSrc}
                alt=""
                className="size-6 rounded-full bg-white object-cover ring-1 ring-white/30"
              />
            )}
            <span className="rounded-full bg-black/50 px-2.5 py-0.5 text-[10px] font-semibold text-white backdrop-blur-sm">
              {ad.badgeText || "Sponsored"}
            </span>
          </div>
          <button
            type="button"
            onClick={handleHide}
            className="grid size-6 place-items-center rounded-full bg-black/40 text-white/80 backdrop-blur-sm transition hover:bg-black/60 hover:text-white"
            aria-label="Hide ad"
          >
            <X className="size-3" />
          </button>
        </div>

        {/* Bottom scrim with CTA overlay on media */}
        {bannerSrc && !imageError && (
          <div className="pointer-events-none absolute inset-x-0 bottom-0 h-20 bg-gradient-to-t from-black/50 to-transparent" />
        )}
      </div>

      {/* ── CONTENT ── */}
      <div className="px-4 pb-4 pt-3">
        <div className="flex items-start gap-3">
          <div className="min-w-0 flex-1">
            {ad.companyName && (
              <p className="text-[11px] font-semibold uppercase tracking-wide text-primary/80">
                {ad.companyName}
              </p>
            )}
            <h3 className="mt-0.5 text-[15px] font-bold leading-snug text-base-content line-clamp-2 group-hover:text-primary transition-colors">
              {ad.title}
            </h3>
            {ad.description && (
              <p className="mt-1.5 text-xs leading-relaxed text-base-content/55 line-clamp-2">
                {ad.description}
              </p>
            )}
          </div>
        </div>

        {/* CTA + meta */}
        <div className="mt-3 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2 text-[11px] text-base-content/40">
            {ad.adCategory && (
              <span className="rounded-full bg-base-200 px-2 py-0.5 font-medium text-base-content/50">
                {ad.adCategory}
              </span>
            )}
            {ad.targetCity && (
              <span className="rounded-full bg-base-200 px-2 py-0.5 font-medium text-base-content/50">
                {ad.targetCity}
              </span>
            )}
          </div>

          <button
            type="button"
            onClick={handleCtaClick}
            className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-primary px-4 py-2 text-xs font-bold text-white shadow-sm transition hover:opacity-85 active:scale-[0.97]"
          >
            {ad.ctaText || "Learn More"}
            <ExternalLink className="size-3" />
          </button>
        </div>
      </div>
    </div>
  );
}
