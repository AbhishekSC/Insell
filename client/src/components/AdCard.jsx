import { useEffect, useRef, useState } from "react";
import { ExternalLink, Megaphone, Pause, Play, Volume2, VolumeX, X } from "lucide-react";
import toast from "react-hot-toast";
import axiosInstance from "../lib/axios";
import { cardImageUrl } from "../lib/cloudinaryImage";

export default function AdCard({ ad, onDismiss }) {
  const cardRef = useRef(null);
  const videoRef = useRef(null);
  const dwellTimer = useRef(null);

  const [firedImpression, setFiredImpression] = useState(false);
  const [imageError, setImageError] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isMuted, setIsMuted] = useState(true);
  const [tapFeedback, setTapFeedback] = useState(null); // 'play' | 'pause' | null

  // Auto-detect whether ad media is a video
  const isVideo =
    ad?.mediaType === "video" ||
    /\.(mp4|webm|mov)(\?|$)/i.test(ad?.mediaUrl || "") ||
    (ad?.mediaUrl || "").includes("/video/upload/");

  const isPreview =
    !ad?._id ||
    ad._id === "admin-preview" ||
    ad._id === "preview" ||
    Boolean(ad?.isPreview);

  // ── Scroll Autoplay & Pause (Instagram-like feed behavior) ──
  useEffect(() => {
    if (!cardRef.current || !ad?._id) return;

    const observer = new IntersectionObserver(
      (entries) => {
        const entry = entries[0];
        const isVisible = entry?.isIntersecting && entry.intersectionRatio >= 0.45;

        if (isVisible) {
          // Autoplay video when scrolled into view
          if (isVideo && videoRef.current) {
            videoRef.current
              .play()
              .then(() => setIsPlaying(true))
              .catch(() => {
                // Browsers may block if unmuted, ensure muted retry
                if (videoRef.current) {
                  videoRef.current.muted = true;
                  videoRef.current.play().then(() => setIsPlaying(true)).catch(() => {});
                }
              });
          }

          // Dwell timer for recording impression (suppressed for admin / mock previews)
          if (!isPreview && !firedImpression && !dwellTimer.current) {
            dwellTimer.current = setTimeout(() => {
              axiosInstance.post(`/advertisements/${ad._id}/impression`).catch(() => {});
              setFiredImpression(true);
              dwellTimer.current = null;
            }, 1500);
          }
        } else {
          // User scrolled down/away: pause video immediately
          if (isVideo && videoRef.current) {
            videoRef.current.pause();
            setIsPlaying(false);
          }
          if (dwellTimer.current) {
            clearTimeout(dwellTimer.current);
            dwellTimer.current = null;
          }
        }
      },
      { threshold: [0, 0.45, 0.75] }
    );

    observer.observe(cardRef.current);

    // Pause when user switches tab or minimizes browser
    const handleVisibilityChange = () => {
      if (document.hidden) {
        if (isVideo && videoRef.current) {
          videoRef.current.pause();
          setIsPlaying(false);
        }
      }
    };
    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      observer.disconnect();
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      if (dwellTimer.current) {
        clearTimeout(dwellTimer.current);
        dwellTimer.current = null;
      }
    };
  }, [isVideo, firedImpression, ad?._id, isPreview]);

  // Toggle video play/pause on tapping card media
  const handleMediaTap = () => {
    if (!isVideo || !videoRef.current) {
      handleCtaClick();
      return;
    }

    if (videoRef.current.paused) {
      videoRef.current.play().then(() => {
        setIsPlaying(true);
        triggerTapAnim("play");
      }).catch(() => {});
    } else {
      videoRef.current.pause();
      setIsPlaying(false);
      triggerTapAnim("pause");
    }
  };

  const triggerTapAnim = (type) => {
    setTapFeedback(type);
    setTimeout(() => {
      setTapFeedback((curr) => (curr === type ? null : curr));
    }, 600);
  };

  const toggleSound = (e) => {
    e.stopPropagation();
    if (!videoRef.current) return;
    const nextMuted = !isMuted;
    videoRef.current.muted = nextMuted;
    setIsMuted(nextMuted);
  };

  const handleCtaClick = (e) => {
    e?.stopPropagation?.();
    if (!ad?._id) return;

    if (!isPreview) {
      axiosInstance.post(`/advertisements/${ad._id}/click`).catch(() => {});
    }

    if (ad.targetUrl && ad.targetUrl !== "#") {
      if (ad.targetUrl.startsWith("http://") || ad.targetUrl.startsWith("https://")) {
        window.open(ad.targetUrl, "_blank", "noopener,noreferrer");
      } else {
        window.location.href = ad.targetUrl;
      }
    }
  };

  const handleHide = (e) => {
    e.stopPropagation();
    if (ad?._id && !isPreview) {
      axiosInstance.post(`/advertisements/${ad._id}/dismiss`).catch(() => {});
    }
    toast.success("Ad hidden", { duration: 2000 });
    onDismiss?.(ad._id);
  };

  const bannerSrc = ad?.mediaUrl ? cardImageUrl(ad.mediaUrl, 1080) : "";
  const logoSrc = ad?.companyLogo ? cardImageUrl(ad.companyLogo, 80) : "";

  return (
    <div
      ref={cardRef}
      className="group relative mb-4 aspect-[4/5] min-h-[460px] sm:min-h-[520px] max-h-[620px] w-full overflow-hidden rounded-2xl sm:rounded-3xl border border-base-300/60 bg-neutral-950 shadow-md transition-all duration-300 hover:shadow-xl select-none"
    >
      {/* ── FULL-BLEED BACKGROUND MEDIA CANVAS ── */}
      <div
        onClick={handleMediaTap}
        className="absolute inset-0 h-full w-full cursor-pointer bg-neutral-900 overflow-hidden"
      >
        {isVideo ? (
          <video
            ref={videoRef}
            src={ad.mediaUrl}
            muted={isMuted}
            loop
            playsInline
            preload="metadata"
            className="h-full w-full object-cover transition-transform duration-700 group-hover:scale-[1.02]"
          />
        ) : bannerSrc && !imageError ? (
          <img
            src={bannerSrc}
            alt={ad.title}
            onError={() => setImageError(true)}
            loading="lazy"
            className="h-full w-full object-cover transition-transform duration-700 group-hover:scale-[1.02]"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-neutral-800 via-neutral-900 to-black">
            <Megaphone className="size-16 text-neutral-600" />
          </div>
        )}

        {/* Play/Pause indicator overlay when video is paused */}
        {isVideo && !isPlaying && !tapFeedback && (
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
            <div className="grid size-14 place-items-center rounded-full bg-black/40 text-white backdrop-blur-md ring-1 ring-white/20">
              <Play className="size-6 fill-white translate-x-0.5" />
            </div>
          </div>
        )}

        {/* Instagram-style Tap Ripple / Icon Feedback */}
        {tapFeedback && (
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
            <div className="grid size-16 place-items-center rounded-full bg-black/60 text-white backdrop-blur-md animate-ping">
              {tapFeedback === "play" ? (
                <Play className="size-7 fill-white translate-x-0.5" />
              ) : (
                <Pause className="size-7 fill-white" />
              )}
            </div>
          </div>
        )}
      </div>

      {/* ── TOP SCRIM & CONTROLS OVERLAY ── */}
      <div className="pointer-events-none absolute inset-x-0 top-0 bg-gradient-to-b from-black/80 via-black/40 to-transparent p-4 pb-14">
        <div className="flex items-center justify-between gap-3">
          {/* Brand & Sponsored Pill */}
          <div className="pointer-events-auto flex items-center gap-2.5">
            {logoSrc ? (
              <img
                src={logoSrc}
                alt=""
                className="size-8 sm:size-9 rounded-full bg-white object-cover ring-2 ring-white/30 shadow-sm"
              />
            ) : (
              <div className="grid size-8 sm:size-9 place-items-center rounded-full bg-primary/90 text-white font-extrabold text-xs ring-2 ring-white/30 shadow-sm">
                {(ad.companyName || "AD").slice(0, 2).toUpperCase()}
              </div>
            )}
            <div className="flex flex-col">
              {ad.companyName && (
                <span className="text-xs sm:text-sm font-bold text-white drop-shadow leading-tight">
                  {ad.companyName}
                </span>
              )}
              <div className="flex items-center gap-1.5">
                <span className="rounded-full bg-black/50 px-2 py-0.5 text-[10px] font-bold text-white backdrop-blur-md ring-1 ring-white/20">
                  {ad.badgeText || "Sponsored"}
                </span>
                {ad.targetCity && (
                  <span className="hidden sm:inline-block rounded-full bg-black/35 px-2 py-0.5 text-[10px] font-medium text-white/80 backdrop-blur-sm">
                    {ad.targetCity}
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Right Action Icons (Sound toggle + Hide ad) */}
          <div className="pointer-events-auto flex items-center gap-2">
            {isVideo && (
              <button
                type="button"
                onClick={toggleSound}
                className="grid size-8 place-items-center rounded-full bg-black/50 text-white backdrop-blur-md transition-all hover:bg-black/75 hover:scale-105 active:scale-95 ring-1 ring-white/20"
                aria-label={isMuted ? "Unmute video" : "Mute video"}
                title={isMuted ? "Unmute" : "Mute"}
              >
                {isMuted ? <VolumeX className="size-4" /> : <Volume2 className="size-4" />}
              </button>
            )}

            <button
              type="button"
              onClick={handleHide}
              className="grid size-8 place-items-center rounded-full bg-black/50 text-white/80 backdrop-blur-md transition-all hover:bg-black/75 hover:text-white hover:scale-105 active:scale-95 ring-1 ring-white/20"
              aria-label="Hide ad"
              title="Hide this ad"
            >
              <X className="size-4" />
            </button>
          </div>
        </div>
      </div>

      {/* ── BOTTOM SCRIM & CALL-TO-ACTION OVERLAY ── */}
      <div className="pointer-events-none absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/95 via-black/65 to-transparent p-4 sm:p-5 pt-20">
        <div className="pointer-events-auto space-y-2">
          {/* Category Tag (if provided) */}
          {ad.adCategory && (
            <div className="flex items-center gap-2">
              <span className="rounded-full bg-white/20 px-2.5 py-0.5 text-[10px] font-semibold text-white/90 backdrop-blur-md ring-1 ring-white/20">
                {ad.adCategory}
              </span>
            </div>
          )}

          {/* Ad Title */}
          <h3
            onClick={handleCtaClick}
            className="cursor-pointer text-base sm:text-lg font-black leading-snug text-white drop-shadow-md line-clamp-2 transition-colors hover:text-primary-content"
          >
            {ad.title}
          </h3>

          {/* Ad Description */}
          {ad.description && (
            <p className="text-xs sm:text-[13px] leading-relaxed text-white/85 line-clamp-2 drop-shadow">
              {ad.description}
            </p>
          )}

          {/* Full-Width Prominent CTA Button */}
          <button
            type="button"
            onClick={handleCtaClick}
            className="mt-3 flex w-full items-center justify-center gap-2 rounded-xl bg-primary px-5 py-3 text-sm font-bold text-white shadow-lg shadow-primary/25 transition-all duration-200 hover:brightness-110 active:scale-[0.98]"
          >
            <span>{ad.ctaText || "Learn More"}</span>
            <ExternalLink className="size-4 stroke-[2.5]" />
          </button>
        </div>
      </div>
    </div>
  );
}
