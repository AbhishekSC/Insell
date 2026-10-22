import { useEffect, useRef, useState } from "react";
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
  Camera,
  Flame,
  Eye,
  Sparkles,
  MapPin,
  Users,
} from "lucide-react";
import PostAuthorLink from "./PostAuthorLink";
import { useStoryOverlay } from "../context/StoryOverlayContext";
import { lqipUrl, cardImageUrl } from "../lib/cloudinaryImage";
import axiosInstance from "../lib/axios";

function isVideoUrl(url) {
  if (!url) return false;
  return /\.(mp4|webm|mov|avi|mkv)(\?.*)?$/i.test(url);
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
export default function PropertyPostCard({
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
}) {
  const [isMuted, setIsMuted] = useState(true);
  const { isActive: isStoryOverlayActive } = useStoryOverlay();

  const slides = Array.isArray(media) ? media.filter(Boolean) : [];
  const hasMultiple = slides.length > 1;
  const [activeIdx, setActiveIdx] = useState(0);
  const [cardInView, setCardInView] = useState(false);
  const scrollerRef = useRef(null);
  const videoRefs = useRef([]);

  const activeMedia = slides[activeIdx] || slides[0];
  const activeIsVideo = isVideoUrl(activeMedia);
  const locationLabel = [post.locality, post.city].filter(Boolean).join(", ");

  // Micro-engagement & in-feed dwell-time tracking (>2.5s or carousel swipe)
  const dwellTimerRef = useRef(null);
  const microEngagedRef = useRef(false);

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
        })
        .catch(() => {});
    }
  };

  useEffect(() => {
    if (cardInView && !microEngagedRef.current && post._id) {
      dwellTimerRef.current = setTimeout(() => {
        microEngagedRef.current = true;
        axiosInstance
          .post("/posts/micro-engagement", {
            postId: post._id,
            dwellTimeMs: 2600,
            swipedPhotosCount: activeIdx,
          })
          .catch(() => {});
      }, 2500);
    } else {
      if (dwellTimerRef.current) clearTimeout(dwellTimerRef.current);
    }
    return () => {
      if (dwellTimerRef.current) clearTimeout(dwellTimerRef.current);
    };
  }, [cardInView, post._id, activeIdx]);

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
    const el = scrollerRef.current;
    if (!el) return undefined;
    const obs = new IntersectionObserver(([entry]) => setCardInView(entry.isIntersecting), { threshold: 0.5 });
    obs.observe(el);
    return () => obs.disconnect();
  }, []);

  const glassBtn =
    "grid size-8 place-items-center rounded-full text-white drop-shadow-[0_1px_3px_rgba(0,0,0,0.7)] transition hover:opacity-75";
  const actionBtn =
    "flex items-center gap-1 text-base-content/70 transition hover:text-base-content";

  const stop = (fn) => (e) => {
    e.stopPropagation();
    fn?.();
  };

  return (
    <article
      className={`group cursor-pointer overflow-hidden rounded-2xl border bg-base-100 shadow-sm transition hover:shadow-lg ${className}`}
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
      <div className="space-y-2.5 px-4 pb-3 pt-2">
        {/* action bar — compact */}
        <div className="flex items-center justify-between text-base-content/70">
          <div className="flex items-center gap-3.5">
            <button type="button" className={actionBtn} onClick={stop(onLike)}>
              <Heart className={`size-[18px] ${isLiked ? "fill-error text-error" : ""}`} />
              {likesCount > 0 && <span className="text-xs font-medium tabular-nums">{likesCount}</span>}
            </button>
            <button type="button" className={actionBtn} onClick={stop(onComment)}>
              <MessageCircle className="size-[18px]" />
              {commentsCount > 0 && <span className="text-xs font-medium tabular-nums">{commentsCount}</span>}
            </button>
            {onShare && (
              <button type="button" className={actionBtn} onClick={stop(onShare)} title="Share">
                <Send className="size-[17px]" />
              </button>
            )}
          </div>
          {onSave && (
            <button type="button" className={actionBtn} onClick={stop(onSave)}>
              <Bookmark className={`size-[18px] ${isSaved ? "fill-primary text-primary" : ""}`} />
              {savesCount > 0 && <span className="text-xs font-medium tabular-nums">{savesCount}</span>}
            </button>
          )}
        </div>

        {/* Instagram-style Liked By Line — exact Instagram format */}
        {post.socialProof?.fullName ? (
          <button
            type="button"
            className="flex items-center gap-1.5 text-left text-xs text-base-content/75 hover:opacity-85"
            onClick={onOpenLikes ? stop(onOpenLikes) : undefined}
          >
            {post.socialProof.avatar && (
              <img src={post.socialProof.avatar} alt="" className="size-4 rounded-full object-cover" />
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

        {/* meta + contact on one row */}
        {(viewsCount !== undefined || metaLine || onContact) && (
          <div className="flex items-center justify-between gap-3">
            <p className="flex min-w-0 items-center gap-1.5 truncate text-xs text-base-content/45">
              <span>{(viewsCount || 0)} view{(viewsCount || 0) === 1 ? "" : "s"}</span>
              {metaLine && <span>·</span>}
              {metaLine}
            </p>
            {onContact && (
              <button
                type="button"
                className="shrink-0 text-base-content/50 transition hover:text-primary"
                onClick={stop(onContact)}
                title={contactLabel}
                aria-label={contactLabel}
              >
                <Phone className="size-4" />
              </button>
            )}
          </div>
        )}
      </div>
    </article>
  );
}
