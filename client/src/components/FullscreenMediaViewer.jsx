import { X } from "lucide-react";

function isVideoUrl(url) {
  return /\.(mp4|webm|mov|avi|mkv)(\?.*)?$/i.test(String(url || ""));
}

// Full-viewport lightbox for a single image/video, triggered by a card's
// "Full screen" button. Shared by the marketplace feed and the profile
// page's grids.
export default function FullscreenMediaViewer({ src, onClose }) {
  if (!src) return null;

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/80 p-6" onClick={onClose}>
      {isVideoUrl(src) ? (
        <video
          src={src}
          controls
          autoPlay
          className="max-h-full max-w-full rounded-2xl object-contain"
          onClick={(event) => event.stopPropagation()}
        />
      ) : (
        <img src={src} alt="Property preview" className="max-h-full max-w-full rounded-2xl object-contain" />
      )}
      <button
        type="button"
        className="btn btn-sm absolute right-6 top-6 border-none bg-base-100 text-base-content hover:bg-base-200"
        onClick={onClose}
      >
        <X className="size-4" />
        Close
      </button>
    </div>
  );
}
