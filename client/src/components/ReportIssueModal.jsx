import { useEffect, useRef, useState } from "react";
import { Loader2, Paperclip, X } from "lucide-react";

const OVERLAY_CLASSES = "fixed inset-0 z-50 flex items-end justify-center bg-black/50 sm:items-center sm:p-4";
const CARD_CLASSES =
  "max-h-[90vh] w-full overflow-y-auto rounded-t-2xl bg-base-100 p-6 shadow-xl sm:max-w-md sm:rounded-2xl";

export default function ReportIssueModal({ isOpen, isPending, onCancel, onSubmit }) {
  const [message, setMessage] = useState("");
  const [screenshot, setScreenshot] = useState(null);
  const fileInputRef = useRef(null);

  useEffect(() => {
    if (isOpen) {
      setMessage("");
      setScreenshot(null);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div className={OVERLAY_CLASSES} onClick={onCancel}>
      <div className={CARD_CLASSES} onClick={(e) => e.stopPropagation()}>
        <div className="flex items-start justify-between">
          <div>
            <h3 className="text-lg font-semibold text-base-content">Report an issue</h3>
            <p className="mt-1 text-sm text-base-content/60">Tell us how we can improve NearMySpace.</p>
          </div>
          <button type="button" onClick={onCancel} className="rounded-full p-1 text-base-content/50 hover:bg-base-200 hover:text-base-content/70">
            <X className="size-5" />
          </button>
        </div>

        <div className="mt-4">
          <textarea
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder="Describe the issue you ran into..."
            rows={4}
            maxLength={2000}
            autoFocus
            className="w-full rounded-lg border border-base-300 px-3 py-2 text-sm outline-none focus:border-primary/30 focus:ring-2 focus:ring-primary/20"
          />
        </div>

        <div className="mt-3">
          <input
            ref={fileInputRef}
            type="file"
            accept="image/png,image/jpeg,image/webp"
            className="hidden"
            onChange={(e) => setScreenshot(e.target.files?.[0] || null)}
          />
          {screenshot ? (
            <div className="flex items-center justify-between rounded-lg border border-base-300 px-3 py-2 text-sm">
              <span className="truncate text-base-content">{screenshot.name}</span>
              <button type="button" onClick={() => setScreenshot(null)} className="shrink-0 text-base-content/50 hover:text-error">
                <X className="size-4" />
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="flex items-center gap-2 text-sm font-medium text-primary hover:text-primary"
            >
              <Paperclip className="size-4" />
              Attach a screenshot (optional)
            </button>
          )}
        </div>

        <div className="mt-6 flex gap-3">
          <button
            type="button"
            onClick={onCancel}
            className="flex-1 rounded-xl border border-base-300 px-4 py-2.5 text-sm font-semibold text-base-content hover:bg-base-200"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={() => onSubmit({ message: message.trim(), screenshot })}
            disabled={isPending || !message.trim()}
            className="flex-1 rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-primary disabled:opacity-60"
          >
            {isPending ? <Loader2 className="mx-auto size-4 animate-spin" /> : "Send feedback"}
          </button>
        </div>
      </div>
    </div>
  );
}
