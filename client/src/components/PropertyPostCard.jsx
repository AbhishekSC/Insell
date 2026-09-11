import { useEffect, useRef, useState } from "react";
import { Heart, MessageCircle, Bookmark, Send, Volume2, VolumeX, Building2, Maximize2, Phone, ShieldCheck } from "lucide-react";
import PostAuthorLink from "./PostAuthorLink";
import { useStoryOverlay } from "../context/StoryOverlayContext";
import { lqipUrl, cardImageUrl } from "../lib/cloudinaryImage";

function isVideoUrl(url) {
  if (!url) return false;
  return /\.(mp4|webm|mov|avi|mkv)(\?.*)?$/i.test(url);
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

  const handleScroll = () => {
    const el = scrollerRef.current;
    if (!el || !el.clientWidth) return;
    const idx = Math.max(0, Math.min(slides.length - 1, Math.round(el.scrollLeft / el.clientWidth)));
    setActiveIdx((prev) => (prev === idx ? prev : idx));
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
      onClick={onOpenPost}
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

        {/* Instagram-style like context — only when a connection liked it */}
        {post.socialProof?.fullName && (
          <button
            type="button"
            className="flex items-center gap-1.5 text-left text-xs text-base-content/70"
            onClick={onOpenLikes ? stop(onOpenLikes) : undefined}
          >
            {post.socialProof.avatar && (
              <img src={post.socialProof.avatar} alt="" className="size-4 rounded-full object-cover" />
            )}
            <span className="truncate">
              Liked by <span className="font-semibold text-base-content">{post.socialProof.fullName}</span>
              {post.socialProof.isOwnerVerified && (
                <ShieldCheck className="inline size-3 shrink-0 align-text-bottom text-primary" aria-label="Verified Owner" />
              )}
              {post.socialProof.othersCount > 0 && (
                <> and <span className="font-semibold text-base-content hover:underline">{post.socialProof.othersCount.toLocaleString("en-IN")} others</span></>
              )}
            </span>
          </button>
        )}

        {priceBlock}
        {description}

        {/* meta + contact on one row */}
        {(viewsCount > 0 || metaLine || onContact) && (
          <div className="flex items-center justify-between gap-3">
            <p className="flex min-w-0 items-center gap-1.5 truncate text-xs text-base-content/45">
              {viewsCount > 0 && <span>{viewsCount} view{viewsCount === 1 ? "" : "s"}</span>}
              {viewsCount > 0 && metaLine && <span>·</span>}
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
