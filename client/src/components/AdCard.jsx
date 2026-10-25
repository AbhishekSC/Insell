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

  // ── Scroll Autoplay & Pause ──
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

          // Dwell timer for recording impression
          if (!firedImpression && !dwellTimer.current) {
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
  }, [isVideo, firedImpression, ad?._id]);

  // Toggle video play/pause on tapping card media
  const handleMediaTap = () => {
    if (!isVideo || !videoRef.current) {
      handleCtaClick();
      return;
    }

    if (videoRef.current.paused) {
      videoRef.current
        .play()
        .then(() => {
          setIsPlaying(true);
          triggerTapAnim("play");
        })
        .catch(() => {});
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

  const bannerSrc = ad?.mediaUrl ? cardImageUrl(ad.mediaUrl, 1080) : "";
  const logoSrc = ad?.companyLogo ? cardImageUrl(ad.companyLogo, 80) : "";

  return (
    <div
      ref={cardRef}
      className="group relative mb-4 w-full overflow-hidden rounded-2xl border border-base-300/60 bg-base-100 shadow-sm transition-all duration-300 hover:shadow-lg select-none"
    >
      {/* ── MEDIA SECTION (Fixed aspect ratio, fills area without stretching) ── */}
      <div
        onClick={handleMediaTap}
        className="relative aspect-[16/9] sm:aspect-[2/1] w-full cursor-pointer overflow-hidden bg-base-200"
      >
        {isVideo ? (
          <video
            ref={videoRef}
            src={ad.mediaUrl}
            muted={isMuted}
            loop
            playsInline
            preload="metadata"
            className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.02]"
          />
        ) : bannerSrc && !imageError ? (
          <img
            src={bannerSrc}
            alt={ad.title}
            onError={() => setImageError(true)}
            loading="lazy"
            className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.02]"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center bg-base-200">
            <Megaphone className="size-12 text-base-content/40" />
          </div>
        )}

        {/* Subtle top scrim */}
        <div className="pointer-events-none absolute inset-x-0 top-0 h-14 bg-gradient-to-b from-black/55 to-transparent" />

        {/* Top Controls Overlay */}
        <div className="pointer-events-none absolute inset-x-3 top-3 flex items-center justify-between gap-3">
          {/* Brand & Sponsored Pill */}
          <div className="pointer-events-auto flex items-center gap-2">
            {logoSrc ? (
              <img
                src={logoSrc}
                alt=""
                className="size-6 rounded-full bg-white object-cover ring-1 ring-white/30"
              />
            ) : (
              <div className="grid size-6 place-items-center rounded-full bg-primary text-white font-extrabold text-[10px] ring-1 ring-white/30">
                {(ad.companyName || "AD").slice(0, 2).toUpperCase()}
              </div>
            )}
            <span className="rounded-full bg-black/60 px-2 py-0.5 text-[10px] font-bold text-white backdrop-blur-sm">
              {ad.badgeText || "Sponsored"}
            </span>
          </div>

          {/* Right Action Icons (Sound toggle + Hide ad) */}
          <div className="pointer-events-auto flex items-center gap-1.5">
            {isVideo && (
              <button
                type="button"
                onClick={toggleSound}
                className="grid size-7 place-items-center rounded-full bg-black/55 text-white backdrop-blur-sm transition-all hover:bg-black/75 hover:scale-105 active:scale-95 ring-1 ring-white/20"
                aria-label={isMuted ? "Unmute video" : "Mute video"}
                title={isMuted ? "Unmute" : "Mute"}
              >
                {isMuted ? <VolumeX className="size-3.5" /> : <Volume2 className="size-3.5" />}
              </button>
            )}

            <button
              type="button"
              onClick={handleHide}
              className="grid size-7 place-items-center rounded-full bg-black/55 text-white/90 backdrop-blur-sm transition-all hover:bg-black/75 hover:text-white hover:scale-105 active:scale-95 ring-1 ring-white/20"
              aria-label="Hide ad"
              title="Hide this ad"
            >
              <X className="size-3.5" />
            </button>
          </div>
        </div>

        {/* Play/Pause indicator overlay when video is paused */}
        {isVideo && !isPlaying && !tapFeedback && (
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
            <div className="grid size-12 place-items-center rounded-full bg-black/40 text-white backdrop-blur-md ring-1 ring-white/20">
              <Play className="size-5 fill-white translate-x-0.5" />
            </div>
          </div>
        )}

        {/* Tap Ripple / Feedback */}
        {tapFeedback && (
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
            <div className="grid size-14 place-items-center rounded-full bg-black/60 text-white backdrop-blur-md animate-ping">
              {tapFeedback === "play" ? (
                <Play className="size-6 fill-white translate-x-0.5" />
              ) : (
                <Pause className="size-6 fill-white" />
              )}
            </div>
          </div>
        )}
      </div>

      {/* ── CONTENT SECTION (Natural flow, does not overlay the image) ── */}
      <div className="px-4 pb-4 pt-3 bg-base-100">
        <div onClick={handleCtaClick} className="cursor-pointer">
          {ad.companyName && (
            <p className="text-[11px] font-bold uppercase tracking-wider text-primary">
              {ad.companyName}
            </p>
          )}

          <h3 className="mt-0.5 text-[15px] font-bold leading-snug text-base-content line-clamp-2 group-hover:text-primary transition-colors">
            {ad.title}
          </h3>

          {ad.description && (
            <p className="mt-1 text-xs leading-relaxed text-base-content/70 line-clamp-2">
              {ad.description}
            </p>
          )}
        </div>

        {/* Bottom Row: Metadata Badges + CTA Button */}
        <div className="mt-3 flex items-center justify-between gap-2">
          {/* Metadata chips */}
          <div className="flex items-center gap-1.5 flex-wrap min-w-0">
            {ad.adCategory && (
              <span className="rounded-full bg-base-200 px-2.5 py-0.5 text-[10px] font-semibold text-base-content/70">
                {ad.adCategory}
              </span>
            )}
            {ad.targetCity && (
              <span className="rounded-full bg-base-200 px-2.5 py-0.5 text-[10px] font-medium text-base-content/60">
                {ad.targetCity}
              </span>
            )}
          </div>

          {/* CTA Button */}
          <button
            type="button"
            onClick={handleCtaClick}
            className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-primary px-4 py-2 text-xs font-bold text-white shadow-sm transition-all duration-200 hover:brightness-110 active:scale-[0.98]"
          >
            <span>{ad.ctaText || "Learn More"}</span>
            <ExternalLink className="size-3" />
          </button>
        </div>
      </div>
    </div>
  );
}
