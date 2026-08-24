import { useEffect, useRef, useState } from "react";
import { Heart, Eye, MessageCircle, Bookmark, Phone, ChevronLeft, ChevronRight, Volume2, VolumeX, Building2, Share2 } from "lucide-react";
import PostAuthorLink from "./PostAuthorLink";
import { useStoryOverlay } from "../context/StoryOverlayContext";

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
  imageIndex = 0,
  onPrevImage,
  onNextImage,
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
  const image = media[imageIndex] || media[0];
  const isVideo = isVideoUrl(image);
  const hasMultipleImages = media.length > 1;

  // Autoplay depends on two independent signals — actually scrolled into
  // view, AND no story/highlight viewer currently covering the screen (that
  // overlay sits on top without changing this card's own scroll visibility,
  // so the IntersectionObserver alone never notices it's now hidden).
  const videoElRef = useRef(null);
  const isIntersectingRef = useRef(false);
  const { isActive: isStoryOverlayActive } = useStoryOverlay();

  const applyVideoPlayState = () => {
    const el = videoElRef.current;
    if (!el) return;
    if (isIntersectingRef.current && !isStoryOverlayActive) {
      el.play().catch(() => {});
    } else {
      el.pause();
    }
  };

  useEffect(() => {
    applyVideoPlayState();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isStoryOverlayActive]);

  return (
    <article
      className={`group overflow-hidden rounded-2xl border bg-white shadow-sm transition hover:shadow-md ${className}`}
      onClick={onOpenPost}
    >
      <div className="relative overflow-hidden">
        {requirementBlock ? (
          requirementBlock
        ) : image ? (
          isVideo ? (
            <video
              src={image}
              className={`${mediaHeightClass} w-full object-cover`}
              muted={isMuted}
              loop
              playsInline
              // Instagram-style feed playback: no player chrome, autoplay
              // (muted, browsers require that) while scrolled into view and
              // no story viewer is open, pause otherwise. Full controls
              // still show in the "Full screen" viewer.
              ref={(el) => {
                videoElRef.current = el;
                if (!el) return;
                const observer = new IntersectionObserver(
                  ([entry]) => {
                    isIntersectingRef.current = entry.isIntersecting;
                    applyVideoPlayState();
                  },
                  { threshold: 0.5 }
                );
                observer.observe(el);
                return () => observer.disconnect();
              }}
              onDoubleClick={onDoubleClickMedia}
            />
          ) : (
            <>
              <img
                src={image}
                alt={post.title || "Property"}
                className={`${mediaHeightClass} w-full object-cover`}
                loading="lazy"
                onDoubleClick={onDoubleClickMedia}
              />
              {hasMultipleImages && (
                <>
                  <button
                    type="button"
                    onClick={onPrevImage}
                    className="absolute left-2 top-1/2 -translate-y-1/2 rounded-full bg-black/50 p-1.5 text-white transition-opacity hover:bg-black/70"
                  >
                    <ChevronLeft className="size-4" />
                  </button>
                  <button
                    type="button"
                    onClick={onNextImage}
                    className="absolute right-2 top-1/2 -translate-y-1/2 rounded-full bg-black/50 p-1.5 text-white transition-opacity hover:bg-black/70"
                  >
                    <ChevronRight className="size-4" />
                  </button>
                  <div className="absolute bottom-2 left-1/2 -translate-x-1/2 flex gap-1">
                    {media.map((_, idx) => (
                      <div
                        key={idx}
                        className={`h-1.5 w-1.5 rounded-full transition-colors ${idx === imageIndex ? "bg-white" : "bg-white/50"}`}
                      />
                    ))}
                  </div>
                </>
              )}
            </>
          )
        ) : (
          <div className={`flex ${mediaHeightClass} w-full items-center justify-center bg-slate-100 text-slate-300`}>
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
          {isVideo && (
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

        {image && onFullscreen && (
          <button
            type="button"
            className="btn btn-xs absolute bottom-2 left-2 border-none bg-black/55 text-white hover:bg-black/65"
            onClick={(event) => {
              event.stopPropagation();
              onFullscreen(image);
            }}
          >
            Full screen
          </button>
        )}
      </div>

      <div className="space-y-2 p-3">
        {priceBlock}
        {description}

        <div className="flex items-center justify-between border-t border-slate-100 pt-2">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-1">
              <button
                type="button"
                className="btn btn-ghost btn-xs btn-circle text-slate-500 hover:bg-slate-100"
                onClick={(event) => {
                  event.stopPropagation();
                  onLike?.();
                }}
              >
                <Heart className={`size-4 ${isLiked ? "fill-red-500 text-red-500" : ""}`} />
              </button>
              <span className="text-[11px] text-slate-500">{likesCount}</span>
            </div>
            <div className="flex items-center gap-1">
              <Eye className="size-4 text-slate-400" />
              <span className="text-[11px] text-slate-500">{viewsCount}</span>
            </div>
            <div className="flex items-center gap-1">
              <button
                type="button"
                className="btn btn-ghost btn-xs btn-circle text-slate-500 hover:bg-slate-100"
                onClick={(event) => {
                  event.stopPropagation();
                  onComment?.();
                }}
              >
                <MessageCircle className="size-4" />
              </button>
              <span className="text-[11px] text-slate-500">{commentsCount}</span>
            </div>
            {onSave && (
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  className="btn btn-ghost btn-xs btn-circle text-slate-500 hover:bg-slate-100"
                  onClick={(event) => {
                    event.stopPropagation();
                    onSave();
                  }}
                >
                  <Bookmark className={`size-4 ${isSaved ? "fill-indigo-600 text-indigo-600" : ""}`} />
                </button>
                <span className="text-[11px] text-slate-500">{savesCount}</span>
              </div>
            )}
          </div>
          {onContact && (
            <button
              type="button"
              className="btn btn-ghost btn-xs btn-circle text-slate-600 hover:bg-slate-100"
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
