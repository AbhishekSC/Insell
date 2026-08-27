import { useEffect, useState } from "react";
import { Loader2, Star } from "lucide-react";

const OVERLAY_CLASSES = "fixed inset-0 z-50 flex items-end justify-center bg-black/50 sm:items-center sm:p-4";
const CARD_CLASSES =
  "max-h-[90vh] w-full overflow-y-auto rounded-t-2xl bg-white p-6 shadow-xl sm:max-w-md sm:rounded-2xl";

export default function ReviewModal({ isOpen, revieweeName, isPending, onCancel, onSubmit }) {
  const [rating, setRating] = useState(0);
  const [hoverRating, setHoverRating] = useState(0);
  const [comment, setComment] = useState("");

  useEffect(() => {
    if (isOpen) {
      setRating(0);
      setHoverRating(0);
      setComment("");
    }
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div className={OVERLAY_CLASSES} onClick={onCancel}>
      <div className={CARD_CLASSES} onClick={(e) => e.stopPropagation()}>
        <h3 className="text-center text-lg font-semibold text-slate-800">
          Rate your deal with {revieweeName || "them"}
        </h3>
        <p className="mt-1.5 text-center text-sm text-slate-500">Your review helps build trust in the community.</p>

        <div className="mt-5 flex justify-center gap-1">
          {[1, 2, 3, 4, 5].map((star) => (
            <button
              key={star}
              type="button"
              onClick={() => setRating(star)}
              onMouseEnter={() => setHoverRating(star)}
              onMouseLeave={() => setHoverRating(0)}
              className="p-1"
            >
              <Star
                className={`size-8 transition-colors ${
                  star <= (hoverRating || rating) ? "fill-amber-400 text-amber-400" : "text-slate-300"
                }`}
              />
            </button>
          ))}
        </div>

        <div className="mt-4">
          <textarea
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            placeholder="Share how the deal went (optional)"
            rows={3}
            className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-indigo-300 focus:ring-2 focus:ring-indigo-100"
          />
        </div>

        <div className="mt-6 flex gap-3">
          <button
            type="button"
            onClick={onCancel}
            className="flex-1 rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50"
          >
            Skip
          </button>
          <button
            type="button"
            onClick={() => onSubmit({ rating, comment: comment.trim() })}
            disabled={isPending || rating === 0}
            className="flex-1 rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-indigo-500 disabled:opacity-60"
          >
            {isPending ? <Loader2 className="mx-auto size-4 animate-spin" /> : "Submit Review"}
          </button>
        </div>
      </div>
    </div>
  );
}
