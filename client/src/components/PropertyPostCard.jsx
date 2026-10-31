import React, { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router";
import {
  Heart,
  MessageCircle,
  Bookmark,
  Send,
  Volume2,
  VolumeX,
  Building2,
  Maximize2,
  Phone,
  BadgeCheck,
  Zap,
  CheckCircle2,
  ShieldCheck,
  TrendingDown,
  Gem,
  FileText,
  Play,
  Pause,
  Camera,
  Flame,
  Eye,
  Sparkles,
  MapPin,
  Users,
  ExternalLink,
  ThumbsDown,
  Info,
} from "lucide-react";
import PostAuthorLink from "./PostAuthorLink";
import { useStoryOverlay } from "../context/StoryOverlayContext";
import { useLiveLocation } from "../hooks/useLiveLocation";
import { lqipUrl, cardImageUrl } from "../lib/cloudinaryImage";
import axiosInstance from "../lib/axios";

function isVideoUrl(url) {
  if (!url) return false;
  return /\.(mp4|webm|mov|avi|mkv)(\?.*)?$/i.test(url) || url.includes("/video/upload/");
}

function Tip({ label }) {
  return (
    <span className="pointer-events-none absolute -top-8 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-md bg-neutral-800 px-2 py-1 text-[10px] font-medium text-white opacity-0 shadow-lg transition-opacity duration-150 group-hover/tip:opacity-100 z-50">
      {label}
    </span>
  );
}

function stripEmoji(str) {
  if (!str) return "";
  return String(str)
    .replace(/[\p{Emoji_Presentation}\p{Extended_Pictographic}]/gu, "")
    .trim();
}

// Compact, Instagram-style: "now", "3h", "10d", "5w".
function relativeDate(dateString) {
  if (!dateString) return "";
  const mins = Math.floor((Date.now() - new Date(dateString).getTime()) / 60000);
  if (mins < 1) return "now";
  if (mins < 60) return `${mins}m`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d`;
  const weeks = Math.floor(days / 7);
  if (weeks < 5) return `${weeks}w`;
  return `${Math.floor(days / 30)}mo`;
}

function formatMoney(value) {
  const amount = Number(value || 0);
  if (!Number.isFinite(amount) || amount <= 0) return "Price on request";
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(amount);
}

function haversineKm(a, b) {
  if (!a || !b) return null;
  const R = 6371;
  const dLat = ((b[0] - a[0]) * Math.PI) / 180;
  const dLon = ((b[1] - a[1]) * Math.PI) / 180;
  const s =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((a[0] * Math.PI) / 180) * Math.cos((b[0] * Math.PI) / 180) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(s), Math.sqrt(1 - s));
}

// One image inside the swipeable gallery — blur-up placeholder that fades to
// the right-sized Cloudinary variant on load.
function GalleryImage({ src, alt, onDoubleClick }) {
  const [loaded, setLoaded] = useState(false);
  const lqip = lqipUrl(src);
  useEffect(() => {
    setLoaded(false);
  }, [src]);
  return (
    <>
      {lqip && !loaded && (
        <img src={lqip} alt="" aria-hidden="true" className="absolute inset-0 h-full w-full scale-110 object-cover blur-xl" />
      )}
      <img
        src={cardImageUrl(src)}
        alt={alt || "Property"}
        loading="lazy"
        onLoad={() => setLoaded(true)}
        onError={() => setLoaded(true)}
        onDoubleClick={onDoubleClick}
        className={`relative h-full w-full object-cover transition-opacity duration-300 ${loaded ? "opacity-100" : "opacity-0"}`}
      />
    </>
  );
}

// Shared property card used by the marketplace feed and the profile page's
// Posts/Saved grids. Page-specific behavior (role-based detail badges,
// requirement-post layout, friend-gated contact, report vs. edit/delete
// menus, "Read more" captions) stays owned by the caller and is passed in
// as slots/callbacks — this component only owns the structural shell:
// media (author + location overlay, slide counter), the like/comment/share/
// save action bar, and a full-width contact CTA.
export default React.memo(function PropertyPostCard({
  post,
  media = [],
  onDoubleClickMedia,
  badge,
  badgeClassName,
  extraTopRight,
  menu,
  requirementBlock,
  compareControl,
  onShare,
  onFullscreen,
  priceBlock,
  description,
  metaLine,
  onOpenLikes,
  contactLabel = "Contact seller",
  onLike,
  isLiked,
  likesCount = 0,
  viewsCount = 0,
  onComment,
  commentsCount = 0,
  onSave,
  isSaved,
  savesCount = 0,
  onContact,
  onOpenPost,
  className = "",
  mediaHeightClass = "h-[24rem]",
  mediaOverlay,
  onBoost,
  isOwnPost,
  feedReasons,
  matchScore,
  onNotInterested,
  isNewForYou,
}) {
  const navigate = useNavigate();
  const [isMuted, setIsMuted] = useState(true);
  const { isActive: isStoryOverlayActive } = useStoryOverlay();

  const slides = (Array.isArray(media) && media.length > 0)
    ? media.filter(Boolean)
    : (Array.isArray(post?.mediaUrls) && post.mediaUrls.length > 0)
      ? post.mediaUrls.filter(Boolean)
      : [];
  const hasMultiple = slides.length > 1;
  const [activeIdx, setActiveIdx] = useState(0);
  const [cardInView, setCardInView] = useState(false);
  const [tapFeedback, setTapFeedback] = useState(null);
  const [likeAnim, setLikeAnim] = useState(false);
  const [saveAnim, setSaveAnim] = useState(false);
  const [showReasons, setShowReasons] = useState(false);
  const cardRef = useRef(null);
  const scrollerRef = useRef(null);
  const videoRefs = useRef([]);

  const activeMedia = slides[activeIdx] || slides[0];
  const activeIsVideo = post?.mediaType === "video" || isVideoUrl(activeMedia);
  const locationLabel = [post.locality, post.city].filter(Boolean).join(", ");

  const { location: userLoc } = useLiveLocation();

  // Compute live proximity distance
  const propCoords = useMemo(() => {
    if (Number.isFinite(post.latitude) && Number.isFinite(post.longitude)) {
      return [post.latitude, post.longitude];
    }
    if (Array.isArray(post.location?.coordinates) && post.location.coordinates.length === 2) {
      return [post.location.coordinates[1], post.location.coordinates[0]];
    }
    return null;
  }, [post.latitude, post.longitude, post.location]);

  const liveDistanceKm = useMemo(() => {
    if (typeof post.distanceKm === "number") return post.distanceKm;
    if (userLoc?.lat && userLoc?.lon && propCoords) {
      return haversineKm([userLoc.lat, userLoc.lon], propCoords);
    }
    return null;
  }, [post.distanceKm, userLoc, propCoords]);

  const liveLocationText = useMemo(() => {
    const loc = [post.locality, post.city].filter(Boolean).join(", ") || "Location";
    if (liveDistanceKm != null && Number.isFinite(liveDistanceKm)) {
      const dist = liveDistanceKm < 1 ? `${Math.round(liveDistanceKm * 1000)} m` : `${liveDistanceKm.toFixed(1)} km`;
      return `${loc} • ${dist} away`;
    }
    return loc;
  }, [post.locality, post.city, liveDistanceKm]);

  const handleOpenLiveLocation = (e) => {
    e.stopPropagation();
    if (post?._id) {
      navigate(`/map-view?propertyId=${post._id}`);
    } else {
      navigate("/map-view");
    }
  };

  const triggerTapAnim = (type) => {
    setTapFeedback(type);
    setTimeout(() => setTapFeedback((curr) => (curr === type ? null : curr)), 600);
  };

  const handleVideoTap = (e) => {
    e.stopPropagation();
    const v = videoRefs.current[activeIdx];
    if (!v) {
      handleCardClick(e);
      return;
    }
    if (v.paused) {
      v.play().then(() => triggerTapAnim("play")).catch(() => {});
    } else {
      v.pause();
      triggerTapAnim("pause");
    }
  };

  // Micro-engagement & in-feed dwell-time tracking (>2.5s or carousel swipe)
  const dwellTimerRef = useRef(null);
  const microEngagedRef = useRef(false);
  const enteredViewRef = useRef(0);
  const skipFiredRef = useRef(false);

  const postMeta = useMemo(() => ({
    locality: post.locality || post.location?.locality || "",
    postType: post.postType || "",
    bhk: post.bedrooms || post.postMeta?.residential?.bedrooms || 0,
    price: post.price || 0,
    listingType: post.listingType || "",
  }), [post.locality, post.location?.locality, post.postType, post.bedrooms, post.postMeta?.residential?.bedrooms, post.price, post.listingType]);

  const handleScroll = () => {
    const el = scrollerRef.current;
    if (!el || !el.clientWidth) return;
    const idx = Math.max(0, Math.min(slides.length - 1, Math.round(el.scrollLeft / el.clientWidth)));
    setActiveIdx((prev) => (prev === idx ? prev : idx));

    if (idx >= 1 && !microEngagedRef.current && post._id) {
      microEngagedRef.current = true;
      axiosInstance
        .post("/posts/micro-engagement", {
          postId: post._id,
          dwellTimeMs: 1500,
          swipedPhotosCount: idx,
          ...postMeta,
        })
        .catch(() => {});
    }
  };

  useEffect(() => {
    if (cardInView && !microEngagedRef.current && post._id) {
      enteredViewRef.current = Date.now();
      skipFiredRef.current = false;
      dwellTimerRef.current = setTimeout(() => {
        microEngagedRef.current = true;
        axiosInstance
          .post("/posts/micro-engagement", {
            postId: post._id,
            dwellTimeMs: 2600,
            swipedPhotosCount: activeIdx,
            ...postMeta,
          })
          .catch(() => {});
      }, 2500);
    } else if (!cardInView && enteredViewRef.current > 0 && !microEngagedRef.current && !skipFiredRef.current && post._id) {
      const viewDuration = Date.now() - enteredViewRef.current;
      if (viewDuration < 1000) {
        skipFiredRef.current = true;
        axiosInstance
          .post("/posts/micro-engagement", {
            postId: post._id,
            dwellTimeMs: viewDuration,
            swipedPhotosCount: 0,
            engagementType: "skip",
            ...postMeta,
          })
          .catch(() => {});
      }
      if (dwellTimerRef.current) clearTimeout(dwellTimerRef.current);
    } else {
      if (dwellTimerRef.current) clearTimeout(dwellTimerRef.current);
    }
    return () => {
      if (dwellTimerRef.current) clearTimeout(dwellTimerRef.current);
    };
  }, [cardInView, post._id, activeIdx, postMeta]);

  const handleCardClick = (e) => {
    if (post._id) {
      axiosInstance
        .post(`/posts/${post._id}/cover-click`, { coverIndex: activeIdx })
        .catch(() => {});
    }
    onOpenPost?.(e);
  };

  useEffect(() => {
    videoRefs.current.forEach((v, i) => {
      if (!v) return;
      if (i === activeIdx && cardInView && !isStoryOverlayActive) v.play().catch(() => {});
      else v.pause();
    });
  }, [activeIdx, cardInView, isStoryOverlayActive]);

  useEffect(() => {
    const el = activeIsVideo ? cardRef.current : scrollerRef.current;
    if (!el) return undefined;
    const obs = new IntersectionObserver(
      ([entry]) => setCardInView(entry.isIntersecting && entry.intersectionRatio >= 0.45),
      { threshold: [0, 0.45, 0.75] }
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, [activeIsVideo]);

  useEffect(() => {
    const handleVis = () => {
      if (document.hidden) {
        videoRefs.current.forEach((v) => v?.pause?.());
      }
    };
    document.addEventListener("visibilitychange", handleVis);
    return () => document.removeEventListener("visibilitychange", handleVis);
  }, []);

  const glassBtn =
    "grid size-8 place-items-center rounded-full text-white drop-shadow-[0_1px_3px_rgba(0,0,0,0.7)] transition hover:opacity-75";
  const actionBtn =
    "relative flex items-center gap-1 text-base-content/70 transition hover:text-base-content group/tip";

  const stop = (fn) => (e) => {
    e.stopPropagation();
    fn?.();
  };

  const handleLikeWithAnim = (e) => {
    e.stopPropagation();
    if (!isLiked) {
      setLikeAnim(true);
      setTimeout(() => setLikeAnim(false), 500);
    }
    onLike?.();
  };

  const handleSaveWithAnim = (e) => {
    e.stopPropagation();
    if (!isSaved) {
      setSaveAnim(true);
      setTimeout(() => setSaveAnim(false), 500);
    }
    onSave?.();
  };

  // ── IMMERSIVE FULL-BLEED REELS LAYOUT (When media is a Video) ──
  if (activeIsVideo) {
    return (
      <article
        ref={cardRef}
        className={`group relative flex w-full cursor-pointer flex-col overflow-hidden rounded-2xl sm:rounded-3xl border border-base-300/60 bg-black shadow-md transition-all duration-300 hover:shadow-xl aspect-[9/16] min-h-[500px] sm:min-h-[580px] max-h-[720px] select-none ${className}`}
        onClick={handleCardClick}
      >
        {/* Full-bleed video canvas */}
        <div
          onClick={handleVideoTap}
          onDoubleClick={onDoubleClickMedia}
          className="absolute inset-0 h-full w-full bg-neutral-950 overflow-hidden"
        >
          <video
            ref={(el) => {
              videoRefs.current[activeIdx] = el;
            }}
            src={activeMedia}
            className="h-full w-full object-cover transition-transform duration-700 group-hover:scale-[1.01]"
            muted={isMuted}
            loop
            playsInline
            preload="metadata"
          />

          {/* Tap-to-play/pause ripple indicator */}
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

          {/* Media overlay slot (e.g. Heart burst animation on double click) */}
          {mediaOverlay}
        </div>

        {/* ── TOP SCRIM & AUTHOR OVERLAY ── */}
        <div className="pointer-events-none absolute inset-x-0 top-0 bg-gradient-to-b from-black/85 via-black/40 to-transparent p-3.5 pb-16">
          <div className="flex items-start justify-between gap-2">
            <div className="pointer-events-auto min-w-0">
              <PostAuthorLink
                author={post.author}
                sizeClass="size-8"
                textColor="white"
                inlineMeta={relativeDate(post.createdAt)}
                meta={
                  locationLabel ? (
                    <p className="-mt-0.5 truncate text-[11px] leading-tight text-white/80">{locationLabel}</p>
                  ) : undefined
                }
              />
            </div>

            <div className="pointer-events-auto flex items-center gap-1.5" onClick={(e) => e.stopPropagation()}>
              {/* Sound Toggle Button */}
              <button
                type="button"
                className="grid size-8 place-items-center rounded-full bg-black/50 text-white backdrop-blur-md transition-all hover:bg-black/75 hover:scale-105 active:scale-95 ring-1 ring-white/20"
                onClick={() => setIsMuted((m) => !m)}
                title={isMuted ? "Unmute video" : "Mute video"}
              >
                {isMuted ? <VolumeX className="size-4" /> : <Volume2 className="size-4" />}
              </button>

              {/* Fullscreen Button */}
              {onFullscreen && (
                <button
                  type="button"
                  className="grid size-8 place-items-center rounded-full bg-black/50 text-white backdrop-blur-md transition-all hover:bg-black/75 hover:scale-105 active:scale-95 ring-1 ring-white/20"
                  onClick={() => onFullscreen(activeMedia)}
                  title="View full screen"
                >
                  <Maximize2 className="size-4" />
                </button>
              )}

              {compareControl}
              {menu}
            </div>
          </div>

          {/* Opportunity Badges */}
          {(post.dealHighlight?.priceDropFormatted ||
            post.dealHighlight?.underMarketPct ||
            post.dealHighlight?.isDirectOwner ||
            post.isBoosted) && (
            <div className="pointer-events-none mt-2 flex flex-wrap items-center gap-1.5 max-w-[85%]">
              {post.isBoosted && !post.isBlocked && (
                <span className="inline-flex items-center gap-1 rounded-full bg-gradient-to-r from-amber-500 to-amber-600 px-2.5 py-0.5 text-[10px] font-extrabold text-white shadow-md ring-1 ring-amber-300/50">
                  <Zap className="size-3 fill-current" />
                  Boosted
                </span>
              )}
              {post.dealHighlight?.priceDropFormatted && (
                <span className="inline-flex items-center gap-1 rounded-full bg-emerald-600/95 px-2.5 py-0.5 text-[10px] font-black text-white shadow-md backdrop-blur-xs ring-1 ring-emerald-300/40">
                  <TrendingDown className="size-3" />
                  <span>{post.dealHighlight.priceDropFormatted} Drop</span>
                </span>
              )}
              {post.dealHighlight?.underMarketPct && (
                <span className="inline-flex items-center gap-1 rounded-full bg-gradient-to-r from-cyan-600 to-blue-600 px-2.5 py-0.5 text-[10px] font-extrabold text-white shadow-md ring-1 ring-cyan-300/40">
                  <Gem className="size-3" />
                  <span>{post.dealHighlight.underMarketPct}% Under Market</span>
                </span>
              )}
              {post.dealHighlight?.isDirectOwner && (
                <span className="inline-flex items-center gap-1 rounded-full bg-amber-600/90 px-2 py-0.5 text-[10px] font-bold text-white shadow-md ring-1 ring-amber-300/40">
                  <ShieldCheck className="size-3" />
                  <span>0 Brokerage</span>
                </span>
              )}
            </div>
          )}
        </div>

        {/* ── BOTTOM SCRIM & DETAILS OVERLAY ── */}
        <div className="pointer-events-none absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/95 via-black/70 to-transparent p-4 sm:p-5 pt-28">
          <div className="pointer-events-auto space-y-2">
            {/* Price & Listing Badge */}
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-baseline gap-1.5">
                <span className="text-xl sm:text-2xl font-black text-white drop-shadow-md">
                  {formatMoney(post.price)}
                </span>
                {post.listingType === "Rent" && (
                  <span className="text-xs text-white/70 font-medium">/ mo</span>
                )}
              </div>
              {badge && (
                <span className={`rounded-full px-2.5 py-0.5 text-[10px] font-bold shadow-sm ${badgeClassName || "bg-white/90 text-neutral-900"}`}>
                  {badge}
                </span>
              )}
            </div>

            {/* Live Location & Proximity Pill with Radar Beacon */}
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleOpenLiveLocation}
                className="inline-flex items-center gap-1.5 rounded-full bg-black/60 hover:bg-black/80 backdrop-blur-md px-2.5 py-1 text-[11px] font-semibold text-white shadow-md ring-1 ring-white/25 transition-all active:scale-95"
                title="View on Interactive Map"
              >
                <span className="relative flex size-2 shrink-0">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
                  <span className="relative inline-flex size-2 rounded-full bg-emerald-500" />
                </span>
                <MapPin className="size-3 text-emerald-400 shrink-0" />
                <span className="truncate max-w-[240px]">{liveLocationText}</span>
                <ExternalLink className="size-2.5 text-white/70 ml-0.5 shrink-0" />
              </button>
            </div>

            {/* Title & Key Specs */}
            <div>
              <h3 className="text-sm sm:text-base font-bold text-white line-clamp-1 drop-shadow-sm leading-snug">
                {post.title}
              </h3>
              <p className="mt-0.5 text-xs text-white/80 drop-shadow-sm line-clamp-1">
                {[
                  post.bedrooms ? `${post.bedrooms} BHK` : null,
                  post.areaSqft ? `${post.areaSqft} sqft` : null,
                  post.furnishing,
                  post.locality || post.city,
                ].filter(Boolean).join(" · ")}
              </p>
            </div>

            {/* Social Proof Line (Liked by...) with clickable modal */}
            {post.socialProof?.fullName ? (
              <button
                type="button"
                className="flex items-center gap-1.5 text-left text-xs text-white/85 hover:text-white transition-opacity group/likes cursor-pointer"
                onClick={onOpenLikes ? stop(onOpenLikes) : undefined}
                title="View who liked this post"
              >
                {post.socialProof.avatar ? (
                  <img src={post.socialProof.avatar} alt="" className="size-4 rounded-full object-cover ring-1 ring-white/30" />
                ) : (
                  <div className="size-4 rounded-full bg-primary/60 ring-1 ring-white/30 grid place-items-center text-[8px] font-bold text-white">
                    {post.socialProof.fullName?.[0] || "U"}
                  </div>
                )}
                <span className="truncate text-[11px]">
                  Liked by <span className="font-semibold text-white">{post.socialProof.fullName}</span>
                  {post.socialProof.isOwnerVerified && (
                    <BadgeCheck className="ml-0.5 inline-block size-3 shrink-0 align-middle text-primary" aria-label="Verified Owner" />
                  )}
                  {post.socialProof.othersCount > 0 && (
                    <> and <span className="font-semibold text-white group-hover/likes:underline">{post.socialProof.othersCount.toLocaleString("en-IN")} others</span></>
                  )}
                </span>
              </button>
            ) : post.socialProof?.friendsViewed?.length > 0 ? (
              <div className="flex items-center gap-1.5 text-xs text-white/80">
                <div className="flex -space-x-1.5 overflow-hidden">
                  {post.socialProof.friendsViewed.map((f, i) => (
                    f.avatar ? (
                      <img key={i} src={f.avatar} alt="" className="inline-block size-4 rounded-full ring-1 ring-black/40 object-cover" />
                    ) : (
                      <div key={i} className="inline-grid size-4 place-items-center rounded-full bg-primary/40 text-[9px] font-bold text-white ring-1 ring-black/40">
                        {f.name?.[0] || "F"}
                      </div>
                    )
                  ))}
                </div>
                <span className="truncate text-[11px]">
                  Viewed by <span className="font-semibold text-white">{post.socialProof.friendsViewed[0].name}</span>
                  {post.socialProof.friendsViewedCount > 1 && ` and ${post.socialProof.friendsViewedCount - 1} others`}
                </span>
              </div>
            ) : null}

            {/* Action Bar (Like, Comment, Share, Save) & Contact Button */}
            <div className="mt-2.5 flex items-center justify-between gap-2 pt-1 border-t border-white/10" onClick={(e) => e.stopPropagation()}>
              <div className="flex items-center gap-3 text-white">
                <button
                  type="button"
                  className="relative flex items-center gap-1 text-white/90 hover:text-white transition-colors group/tip"
                  onClick={handleLikeWithAnim}
                  aria-label={isLiked ? "Unlike" : "Like"}
                >
                  <Tip label={isLiked ? "Unlike" : "Like"} />
                  <Heart className={`size-[18px] transition-transform duration-300 ${isLiked ? "fill-error text-error" : ""} ${likeAnim ? "scale-125" : ""}`} />
                  {likesCount > 0 && <span className="text-xs font-semibold tabular-nums">{likesCount}</span>}
                </button>

                <button
                  type="button"
                  className="relative flex items-center gap-1 text-white/90 hover:text-white transition-colors group/tip"
                  onClick={stop(onComment)}
                  aria-label="Comment"
                >
                  <Tip label="Comment" />
                  <MessageCircle className="size-[18px]" />
                  {commentsCount > 0 && <span className="text-xs font-semibold tabular-nums">{commentsCount}</span>}
                </button>

                {onShare && (
                  <button
                    type="button"
                    className="relative text-white/90 hover:text-white transition-colors group/tip"
                    onClick={stop(onShare)}
                    aria-label="Share"
                  >
                    <Tip label="Share" />
                    <Send className="size-[17px]" />
                  </button>
                )}

                {onSave && (
                  <button
                    type="button"
                    className="relative flex items-center gap-1 text-white/90 hover:text-white transition-colors group/tip"
                    onClick={handleSaveWithAnim}
                    aria-label={isSaved ? "Unsave" : "Save"}
                  >
                    <Tip label={isSaved ? "Unsave" : "Save"} />
                    <Bookmark className={`size-[18px] transition-transform duration-300 ${isSaved ? "fill-primary text-primary" : ""} ${saveAnim ? "scale-125" : ""}`} />
                    {savesCount > 0 && <span className="text-xs font-semibold tabular-nums">{savesCount}</span>}
                  </button>
                )}
              </div>

              {/* Contact Button */}
              {onContact && (
                <button
                  type="button"
                  onClick={stop(onContact)}
                  className="inline-flex items-center gap-1.5 rounded-xl bg-primary px-3.5 py-1.5 text-xs font-bold text-white shadow-md shadow-primary/30 transition-all hover:brightness-110 active:scale-95"
                >
                  <Phone className="size-3.5" />
                  <span>{contactLabel}</span>
                </button>
              )}
            </div>
          </div>
        </div>
      </article>
    );
  }

  return (
    <article
      className={`group flex h-full cursor-pointer flex-col overflow-hidden rounded-2xl border bg-base-100 shadow-sm transition hover:shadow-lg ${className}`}
      onClick={handleCardClick}
    >
      {/* ---------- MEDIA ---------- */}
      <div className="relative overflow-hidden">
        {requirementBlock ? (
          requirementBlock
        ) : slides.length ? (
          <div
            ref={scrollerRef}
            onScroll={handleScroll}
            className={`flex ${mediaHeightClass} w-full snap-x snap-mandatory overflow-x-auto overflow-y-hidden overscroll-x-contain [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden`}
          >
            {slides.map((m, i) => (
              <div key={i} className="relative h-full w-full shrink-0 snap-center bg-base-200">
                {isVideoUrl(m) ? (
                  <video
                    ref={(el) => { videoRefs.current[i] = el; }}
                    src={m}
                    className="h-full w-full object-cover"
                    muted={isMuted}
                    loop
                    playsInline
                    preload="metadata"
                    onDoubleClick={onDoubleClickMedia}
                  />
                ) : (
                  <GalleryImage src={m} alt={post.title} onDoubleClick={onDoubleClickMedia} />
                )}
              </div>
            ))}
          </div>
        ) : (
          <div className={`flex ${mediaHeightClass} w-full items-center justify-center bg-base-200 text-base-content/40`}>
            <Building2 className="size-10" />
          </div>
        )}

        {/* top legibility scrim */}
        <div className="pointer-events-none absolute inset-x-0 top-0 h-24 bg-gradient-to-b from-black/55 via-black/25 to-transparent" />

        {mediaOverlay}

        {/* author + location (left) · badge + menu + counter (right) */}
        <div className="absolute inset-x-3 top-3 flex items-start justify-between gap-2">
          <div className="min-w-0">
            <PostAuthorLink
              author={post.author}
              sizeClass="size-8"
              textColor="white"
              inlineMeta={relativeDate(post.createdAt)}
              meta={
                locationLabel ? (
                  <p className="-mt-0.5 truncate text-[11px] leading-tight text-white/75">{locationLabel}</p>
                ) : undefined
              }
            />
          </div>
          <div className="flex shrink-0 flex-col items-end gap-1.5">
            <div className="flex items-center gap-1.5">
              {isNewForYou && (
                <span className="inline-flex items-center gap-1 rounded-full bg-gradient-to-r from-violet-500 to-fuchsia-500 px-2 py-0.5 text-[10px] font-extrabold text-white shadow-sm ring-1 ring-violet-300/40 animate-pulse">
                  <Sparkles className="size-3" />
                  New for you
                </span>
              )}
              {matchScore != null && matchScore >= 70 && (
                <span className="rounded-full bg-emerald-500/90 px-2 py-0.5 text-[10px] font-bold text-white shadow-sm backdrop-blur-sm">
                  {matchScore}% match
                </span>
              )}
              {post.isBoosted && !post.isBlocked && (
                <span className="inline-flex items-center gap-1 rounded-full bg-gradient-to-r from-amber-500 to-amber-600 px-2 py-0.5 text-[10px] font-extrabold text-white shadow-sm ring-1 ring-amber-300/50">
                  <Zap className="size-3 fill-current" />
                  Boosted
                </span>
              )}
              {badge && (
                <span
                  className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${
                    badgeClassName || "bg-white/90 text-base-content"
                  }`}
                >
                  {badge}
                </span>
              )}
              {extraTopRight}
              {menu}
            </div>
            {hasMultiple && (
              <span className="rounded-full bg-black/45 px-2 py-0.5 text-[10px] font-semibold text-white backdrop-blur-sm">
                {activeIdx + 1}/{slides.length}
              </span>
            )}
          </div>
        </div>

        {/* Dynamic Opportunity Overlays: Price Drop · Under Market · 0 Brokerage (Up to 2 Badges) */}
        {(post.dealHighlight?.priceDropFormatted ||
          post.dealHighlight?.underMarketPct ||
          post.dealHighlight?.isDirectOwner) && (
          <div className="pointer-events-none absolute left-3 top-14 z-10 flex flex-wrap items-center gap-1.5 max-w-[85%]">
            {post.dealHighlight?.priceDropFormatted && (
              <span className="inline-flex items-center gap-1 rounded-full bg-emerald-600/95 px-2.5 py-0.5 text-[10px] font-black text-white shadow-md backdrop-blur-xs ring-1 ring-emerald-300/40 animate-pulse">
                <TrendingDown className="size-3" />
                <span>
                  {post.dealHighlight.priceDropFormatted} Drop
                  {post.dealHighlight.priceDropWhen ? ` (${post.dealHighlight.priceDropWhen})` : ""}
                </span>
              </span>
            )}
            {post.dealHighlight?.underMarketPct && (
              <span className="inline-flex items-center gap-1 rounded-full bg-gradient-to-r from-cyan-600 to-blue-600 px-2.5 py-0.5 text-[10px] font-extrabold text-white shadow-md backdrop-blur-xs ring-1 ring-cyan-300/40">
                <Gem className="size-3" />
                <span>{post.dealHighlight.underMarketPct}% Under Market</span>
              </span>
            )}
            {post.dealHighlight?.isDirectOwner && (
              <span className="inline-flex items-center gap-1 rounded-full bg-amber-600/90 px-2 py-0.5 text-[10px] font-bold text-white shadow-md backdrop-blur-xs ring-1 ring-amber-300/40">
                <ShieldCheck className="size-3" />
                <span>0 Brokerage (Owner)</span>
              </span>
            )}
          </div>
        )}

        {/* Media Feature Teasers: Floor Plan, Video Tour, Photos Count (3 Separate Badges) */}
        {(!isOwnPost || post.isBlocked) && (
          <div className="pointer-events-none absolute bottom-3 left-3 z-10 flex items-center gap-1.5">
            {post.mediaFeatures?.hasFloorPlan && (
              <span className="inline-flex items-center gap-1 rounded-full bg-black/60 px-2 py-0.5 text-[10px] font-medium text-white shadow-sm backdrop-blur-sm">
                <FileText className="size-2.5 text-primary-content" />
                <span>Floor Plan</span>
              </span>
            )}
            {post.mediaFeatures?.hasVideo && (
              <span className="inline-flex items-center gap-1 rounded-full bg-black/60 px-2 py-0.5 text-[10px] font-medium text-white shadow-sm backdrop-blur-sm">
                <Play className="size-2.5 fill-white text-white" />
                <span>Video Tour</span>
              </span>
            )}
            {slides.length > 1 && (
              <span className="inline-flex items-center gap-1 rounded-full bg-black/60 px-2 py-0.5 text-[10px] font-medium text-white shadow-sm backdrop-blur-sm">
                <Camera className="size-2.5" />
                <span>{slides.length} Photos</span>
              </span>
            )}
          </div>
        )}

        {/* bottom-left: clickable boost and promote badges for owner if not blocked */}
        {isOwnPost && !post.isBlocked && (
          <div className="absolute bottom-3 left-3 z-10 flex items-center gap-1.5" onClick={(e) => e.stopPropagation()}>
            {onBoost && (
              <button
                type="button"
                onClick={() => onBoost(post)}
                className={`flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-bold text-white shadow-md backdrop-blur-xs transition-all hover:scale-105 active:scale-95 ${
                  post.isBoosted
                    ? "bg-emerald-600/90 hover:bg-emerald-600 ring-1 ring-emerald-400/60"
                    : "bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 ring-1 ring-amber-300/60"
                }`}
              >
                <Zap className="size-3.5 fill-white" />
                <span>{post.isBoosted ? "Boost Active" : "Boost"}</span>
              </button>
            )}
          </div>
        )}

        {/* bottom-right: mute · expand · compare */}
        <div className="absolute bottom-3 right-3 flex items-center gap-1.5" onClick={(e) => e.stopPropagation()}>
          {activeIsVideo && (
            <button type="button" className={glassBtn} onClick={() => setIsMuted((m) => !m)} title={isMuted ? "Unmute" : "Mute"}>
              {isMuted ? <VolumeX className="size-4" /> : <Volume2 className="size-4" />}
            </button>
          )}
          {activeMedia && onFullscreen && (
            <button type="button" className={glassBtn} onClick={() => onFullscreen(activeMedia)} title="View full screen">
              <Maximize2 className="size-4" />
            </button>
          )}
          {compareControl}
        </div>

        {/* bottom-center dots */}
        {hasMultiple && (
          <div className="pointer-events-none absolute bottom-3 left-1/2 flex -translate-x-1/2 gap-1">
            {slides.map((_, idx) => (
              <div
                key={idx}
                className={`h-1.5 rounded-full transition-all ${idx === activeIdx ? "w-4 bg-white" : "w-1.5 bg-white/50"}`}
              />
            ))}
          </div>
        )}
      </div>

      {/* ---------- CONTENT ---------- */}
      <div className="flex flex-1 flex-col gap-2.5 px-4 pb-3 pt-2">
        {/* action bar — compact */}
        <div className="flex items-center justify-between text-base-content/70">
          <div className="flex items-center gap-3.5">
            <button type="button" className={actionBtn} onClick={handleLikeWithAnim} aria-label={isLiked ? "Unlike" : "Like"}>
              <Tip label={isLiked ? "Unlike" : "Like"} />
              <Heart className={`size-[18px] transition-transform duration-300 ${isLiked ? "fill-error text-error" : ""} ${likeAnim ? "scale-125" : ""}`} />
              {likesCount > 0 && <span className="text-xs font-medium tabular-nums">{likesCount}</span>}
            </button>
            <button type="button" className={actionBtn} onClick={stop(onComment)} aria-label="Comment">
              <Tip label="Comment" />
              <MessageCircle className="size-[18px]" />
              {commentsCount > 0 && <span className="text-xs font-medium tabular-nums">{commentsCount}</span>}
            </button>
            {onShare && (
              <button type="button" className={actionBtn} onClick={stop(onShare)} aria-label="Share">
                <Tip label="Share" />
                <Send className="size-[17px]" />
              </button>
            )}
          </div>
          <div className="flex items-center gap-2">
            {onNotInterested && (
              <button
                type="button"
                className="relative text-base-content/30 transition hover:text-error/70 group/tip"
                onClick={(e) => { e.stopPropagation(); onNotInterested(); }}
                aria-label="Not interested"
              >
                <Tip label="Not interested" />
                <ThumbsDown className="size-[15px]" />
              </button>
            )}
            {onSave && (
              <button type="button" className={actionBtn} onClick={handleSaveWithAnim} aria-label={isSaved ? "Unsave" : "Save"}>
                <Tip label={isSaved ? "Unsave" : "Save"} />
                <Bookmark className={`size-[18px] transition-transform duration-300 ${isSaved ? "fill-primary text-primary" : ""} ${saveAnim ? "scale-125" : ""}`} />
                {savesCount > 0 && <span className="text-xs font-medium tabular-nums">{savesCount}</span>}
              </button>
            )}
          </div>
        </div>

        {/* Instagram-style Liked By Line — exact Instagram format */}
        {post.socialProof?.fullName ? (
          <button
            type="button"
            className="flex items-center gap-1.5 text-left text-xs text-base-content/75 hover:opacity-85"
            onClick={onOpenLikes ? stop(onOpenLikes) : undefined}
          >
            {post.socialProof.avatar ? (
              <img src={post.socialProof.avatar} alt="" className="size-4 rounded-full object-cover" />
            ) : (
              <div className="size-4 rounded-full bg-primary/60 grid place-items-center text-[8px] font-bold text-white">
                {post.socialProof.fullName?.[0] || "U"}
              </div>
            )}
            <span className="truncate">
              Liked by <span className="font-semibold text-base-content">{post.socialProof.fullName}</span>
              {post.socialProof.isOwnerVerified && (
                <BadgeCheck className="ml-0.5 inline-block size-3 shrink-0 align-middle text-primary" aria-label="Verified Owner" />
              )}
              {post.socialProof.othersCount > 0 && (
                <> and <span className="font-semibold text-base-content hover:underline">{post.socialProof.othersCount.toLocaleString("en-IN")} others</span></>
              )}
            </span>
          </button>
        ) : post.socialProof?.friendsViewed?.length > 0 ? (
          <div className="flex items-center gap-1.5 text-xs text-base-content/75">
            <div className="flex -space-x-1.5 overflow-hidden">
              {post.socialProof.friendsViewed.map((f, i) => (
                f.avatar ? (
                  <img key={i} src={f.avatar} alt="" className="inline-block size-4 rounded-full ring-1 ring-base-100 object-cover" />
                ) : (
                  <div key={i} className="inline-grid size-4 place-items-center rounded-full bg-primary/20 text-[9px] font-bold text-primary ring-1 ring-base-100">
                    {f.name?.[0] || "F"}
                  </div>
                )
              ))}
            </div>
            <span className="truncate text-[11px]">
              Viewed by <span className="font-semibold text-base-content">{post.socialProof.friendsViewed[0].name}</span>
              {post.socialProof.friendsViewedCount > 1 && ` and ${post.socialProof.friendsViewedCount - 1} others`}
            </span>
          </div>
        ) : null}

        {/* Activity & Urgency Line — Plain clean text, real icons, zero emojis */}
        {(post.urgencySignals?.primaryBadge || post.urgencySignals?.responseTimeText) && (
          <div className="flex items-center gap-1.5 text-xs text-base-content/70">
            {post.urgencySignals?.primaryBadge && (
              <span className="inline-flex items-center gap-1 font-medium">
                {post.urgencySignals.primaryBadge.icon === "flame" && <Flame className="size-3 text-error" />}
                {post.urgencySignals.primaryBadge.icon === "zap" && <Zap className="size-3 text-amber-500" />}
                {post.urgencySignals.primaryBadge.icon === "bookmark" && <Bookmark className="size-3 text-base-content/60" />}
                {post.urgencySignals.primaryBadge.icon === "trending" && <TrendingDown className="size-3 rotate-180 text-base-content/60" />}
                <span>{stripEmoji(post.urgencySignals.primaryBadge.text)}</span>
              </span>
            )}
            {post.urgencySignals?.primaryBadge && post.urgencySignals?.responseTimeText && (
              <span className="text-base-content/30">·</span>
            )}
            {post.urgencySignals?.responseTimeText && (
              <span className="inline-flex items-center gap-1 font-medium">
                <Zap className="size-3 text-amber-500 shrink-0" />
                <span>Responds {stripEmoji(post.urgencySignals.responseTimeText)}</span>
              </span>
            )}
          </div>
        )}

        {priceBlock}

        {description}

        {/* "Why you see this" feed reasons */}
        {Array.isArray(feedReasons) && feedReasons.length > 0 && (
          <button
            type="button"
            className="flex items-center gap-1 text-[10.5px] text-base-content/40 hover:text-base-content/60 transition-colors"
            onClick={(e) => { e.stopPropagation(); setShowReasons((v) => !v); }}
          >
            <Info className="size-3 shrink-0" />
            <span>{feedReasons[0]}</span>
            {feedReasons.length > 1 && !showReasons && <span className="ml-0.5">+{feedReasons.length - 1}</span>}
          </button>
        )}
        {showReasons && Array.isArray(feedReasons) && feedReasons.length > 1 && (
          <div className="flex flex-wrap gap-1.5">
            {feedReasons.map((r) => (
              <span key={r} className="inline-flex items-center rounded-md bg-primary/5 px-2 py-0.5 text-[10px] font-medium text-primary/70">
                {r}
              </span>
            ))}
          </div>
        )}

        {/* meta + contact on one row */}
        {(viewsCount !== undefined || metaLine || onContact) && (
          <div className="mt-auto flex items-center justify-between gap-3">
            <p className="flex min-w-0 items-center gap-1.5 truncate text-xs text-base-content/45">
              <span>{(viewsCount || 0)} view{(viewsCount || 0) === 1 ? "" : "s"}</span>
              {metaLine && <span>·</span>}
              {metaLine}
            </p>
            {onContact && (
              <button
                type="button"
                className="relative shrink-0 text-base-content/50 transition hover:text-primary group/tip"
                onClick={stop(onContact)}
                aria-label={contactLabel}
              >
                <Tip label={contactLabel} />
                <Phone className="size-4" />
              </button>
            )}
          </div>
        )}
      </div>
    </article>
  );
}, (prev, next) => {
  return prev.post?._id === next.post?._id
    && prev.isLiked === next.isLiked
    && prev.likesCount === next.likesCount
    && prev.isSaved === next.isSaved
    && prev.savesCount === next.savesCount
    && prev.commentsCount === next.commentsCount
    && prev.viewsCount === next.viewsCount
    && prev.className === next.className
    && prev.isOwnPost === next.isOwnPost
    && prev.media === next.media
    && prev.matchScore === next.matchScore
    && prev.isNewForYou === next.isNewForYou;
});
