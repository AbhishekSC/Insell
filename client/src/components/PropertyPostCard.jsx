import { useEffect, useRef, useState } from "react";
import { Heart, Eye, MessageCircle, Bookmark, Phone, Volume2, VolumeX, Building2, Share2 } from "lucide-react";
import PostAuthorLink from "./PostAuthorLink";
import { useStoryOverlay } from "../context/StoryOverlayContext";
import { lqipUrl, cardImageUrl } from "../lib/cloudinaryImage";

function isVideoUrl(url) {
  if (!url) return false;
  return /\.(mp4|webm|mov|avi|mkv)(\?.*)?$/i.test(url);
}

function relativeDate(dateString) {
  if (!dateString) return "";
  const time = new Date(dateString).getTime();
  const delta = Date.now() - time;
  const hours = Math.floor(delta / (1000 * 60 * 60));
  if (hours < 1) return "Just now";
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
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
// media (with Instagram-style autoplay for video), author overlay, badge,
// and the like/view/comment/save/contact footer.
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
  mediaHeightClass = "h-[22rem]",
  mediaOverlay,
}) {
  const [isMuted, setIsMuted] = useState(true);
  const { isActive: isStoryOverlayActive } = useStoryOverlay();

  // Instagram-style swipeable gallery: every media item is a snap slide in a
  // horizontally-scrolling strip. `activeIdx` follows the swipe; the arrows
  // (desktop hover only) just scroll it by one.
  const slides = Array.isArray(media) ? media.filter(Boolean) : [];
  const hasMultiple = slides.length > 1;
  const [activeIdx, setActiveIdx] = useState(0);
  const [cardInView, setCardInView] = useState(false);
  const scrollerRef = useRef(null);
  const videoRefs = useRef([]);

  const activeMedia = slides[activeIdx] || slides[0];
  const activeIsVideo = isVideoUrl(activeMedia);

  const handleScroll = () => {
    const el = scrollerRef.current;
    if (!el || !el.clientWidth) return;
    const idx = Math.max(0, Math.min(slides.length - 1, Math.round(el.scrollLeft / el.clientWidth)));
    setActiveIdx((prev) => (prev === idx ? prev : idx));
  };

  // Only the centred slide's video plays, and only while the card is on
  // screen and no story/highlight viewer is covering it.
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

  return (
    <article
      className={`group overflow-hidden rounded-2xl border bg-base-100 shadow-sm transition hover:shadow-md ${className}`}
      onClick={onOpenPost}
    >
      <div className="relative overflow-hidden">
        {requirementBlock ? (
          requirementBlock
        ) : slides.length ? (
          <>
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

            {hasMultiple && (
              <div className="pointer-events-none absolute bottom-2 left-1/2 flex -translate-x-1/2 gap-1">
                {slides.map((_, idx) => (
                  <div
                    key={idx}
                    className={`h-1.5 rounded-full transition-all ${idx === activeIdx ? "w-4 bg-white" : "w-1.5 bg-white/60"}`}
                  />
                ))}
              </div>
            )}
          </>
        ) : (
          <div className={`flex ${mediaHeightClass} w-full items-center justify-center bg-base-200 text-base-content/40`}>
            <Building2 className="size-10" />
          </div>
        )}

        {mediaOverlay}

        <div className="absolute left-3 top-3">
          <PostAuthorLink
            author={post.author}
            sizeClass="size-6"
            textColor="white"
            meta={<p className="truncate text-[10px] text-white/90">{relativeDate(post.createdAt)}</p>}
          />
        </div>

        <div className="absolute right-3 top-3 flex items-center gap-1.5">
          {badge && (
            <span
              className={`rounded-full px-2.5 py-1 text-[10px] font-semibold ${
                badgeClassName || "bg-black/55 backdrop-blur-sm text-white"
              }`}
            >
              {badge}
            </span>
          )}
          {extraTopRight}
          {menu}
        </div>

        <div className="absolute right-3 bottom-3 flex items-center gap-2">
          {activeIsVideo && (
            <button
              type="button"
              className="size-8 rounded-full flex items-center justify-center text-white drop-shadow-[0_1px_3px_rgba(0,0,0,0.6)] hover:opacity-75 transition-opacity"
              onClick={(event) => {
                event.stopPropagation();
                setIsMuted((m) => !m);
              }}
              title={isMuted ? "Unmute" : "Mute"}
            >
              {isMuted ? <VolumeX className="size-4" /> : <Volume2 className="size-4" />}
            </button>
          )}
          {compareControl}
          {onShare && (
            <button
              type="button"
              className="size-8 rounded-full flex items-center justify-center text-white drop-shadow-[0_1px_3px_rgba(0,0,0,0.6)] hover:opacity-75 transition-opacity"
              onClick={(event) => {
                event.stopPropagation();
                onShare();
              }}
            >
              <Share2 className="size-4" />
            </button>
          )}
        </div>

        {activeMedia && onFullscreen && (
          <button
            type="button"
            className="btn btn-xs absolute bottom-2 left-2 border-none bg-black/55 text-white hover:bg-black/65"
            onClick={(event) => {
              event.stopPropagation();
              onFullscreen(activeMedia);
            }}
          >
            Full screen
          </button>
        )}
      </div>

      <div className="space-y-2 p-3">
        {priceBlock}
        {description}

        <div className="flex items-center justify-between border-t border-base-200 pt-2">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-1">
              <button
                type="button"
                className="btn btn-ghost btn-xs btn-circle text-base-content/60 hover:bg-base-200"
                onClick={(event) => {
                  event.stopPropagation();
                  onLike?.();
                }}
              >
                <Heart className={`size-4 ${isLiked ? "fill-error text-error" : ""}`} />
              </button>
              <span className="text-[11px] text-base-content/60">{likesCount}</span>
            </div>
            <div className="flex items-center gap-1">
              <Eye className="size-4 text-base-content/50" />
              <span className="text-[11px] text-base-content/60">{viewsCount}</span>
            </div>
            <div className="flex items-center gap-1">
              <button
                type="button"
                className="btn btn-ghost btn-xs btn-circle text-base-content/60 hover:bg-base-200"
                onClick={(event) => {
                  event.stopPropagation();
                  onComment?.();
                }}
              >
                <MessageCircle className="size-4" />
              </button>
              <span className="text-[11px] text-base-content/60">{commentsCount}</span>
            </div>
            {onSave && (
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  className="btn btn-ghost btn-xs btn-circle text-base-content/60 hover:bg-base-200"
                  onClick={(event) => {
                    event.stopPropagation();
                    onSave();
                  }}
                >
                  <Bookmark className={`size-4 ${isSaved ? "fill-primary text-primary" : ""}`} />
                </button>
                <span className="text-[11px] text-base-content/60">{savesCount}</span>
              </div>
            )}
          </div>
          {onContact && (
            <button
              type="button"
              className="btn btn-ghost btn-xs btn-circle text-base-content/70 hover:bg-base-200"
              onClick={(event) => {
                event.stopPropagation();
                onContact();
              }}
              title={`Contact ${(post.author?.fullName || "Owner").split(" ")[0]}`}
            >
              <Phone className="size-3.5" />
            </button>
          )}
        </div>
      </div>
    </article>
  );
}
