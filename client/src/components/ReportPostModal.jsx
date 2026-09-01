import { useEffect, useState } from "react";
import { CheckCircle2, Flag, Loader2 } from "lucide-react";

const REPORT_REASON_OPTIONS = [
  { code: "SPAM", label: "Spam" },
  { code: "FALSE_INFORMATION", label: "False information" },
  { code: "INAPPROPRIATE_CONTENT", label: "Inappropriate content" },
  { code: "RESTRICTED_ITEM", label: "Restricted item" },
  { code: "HARASSMENT", label: "Harassment" },
  { code: "INTELLECTUAL_PROPERTY", label: "Intellectual property" },
  { code: "DUPLICATE_LISTING", label: "Duplicate / misleading listing" },
  { code: "OTHER", label: "Other" },
];

// Bottom sheet on mobile (matches native app conventions and avoids the
// modal running off-screen on short viewports), centered card on desktop.
const OVERLAY_CLASSES = "fixed inset-0 z-50 flex items-end justify-center bg-black/50 sm:items-center sm:p-4";
const CARD_CLASSES =
  "max-h-[90vh] w-full overflow-y-auto rounded-t-2xl bg-base-100 p-6 shadow-xl sm:max-w-md sm:rounded-2xl";

export default function ReportPostModal({ isOpen, isPending, isSubmitted, onCancel, onConfirm, onDone }) {
  const [reasonCode, setReasonCode] = useState("");
  const [description, setDescription] = useState("");

  useEffect(() => {
    if (isOpen && !isSubmitted) {
      setReasonCode("");
      setDescription("");
    }
  }, [isOpen, isSubmitted]);

  if (!isOpen) return null;

  if (isSubmitted) {
    return (
      <div className={OVERLAY_CLASSES} onClick={onDone}>
        <div className={`${CARD_CLASSES} text-center`} onClick={(e) => e.stopPropagation()}>
          <div className="mx-auto grid size-12 place-items-center rounded-full bg-success/10 text-success">
            <CheckCircle2 className="size-6" />
          </div>
          <h3 className="mt-4 text-lg font-semibold text-base-content">Thanks for reporting this post</h3>
          <p className="mt-1.5 text-sm text-base-content/60">
            Your feedback helps us keep NearMySpace safe. We've hidden this post from your feed while our team reviews it.
          </p>
          <button
            type="button"
            onClick={onDone}
            className="mt-6 w-full rounded-xl bg-neutral px-4 py-2.5 text-sm font-semibold text-white hover:bg-neutral"
          >
            Done
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className={OVERLAY_CLASSES} onClick={onCancel}>
      <div className={CARD_CLASSES} onClick={(e) => e.stopPropagation()}>
        <div className="mx-auto grid size-12 place-items-center rounded-full bg-error/10 text-error">
          <Flag className="size-6" />
        </div>
        <h3 className="mt-4 text-center text-lg font-semibold text-base-content">Why are you reporting this post?</h3>
        <p className="mt-1.5 text-center text-sm text-base-content/60">
          Your report is anonymous to the post owner. Our team will review it.
        </p>

        <div className="mt-4">
          <div className="space-y-1.5">
            {REPORT_REASON_OPTIONS.map((option) => (
              <label
                key={option.code}
                className={`flex cursor-pointer items-center gap-2 rounded-lg border px-3 py-2 text-sm transition-colors ${
                  reasonCode === option.code ? "border-error/30 bg-error/10 text-error" : "border-base-300 text-base-content/70 hover:bg-base-200"
                }`}
              >
                <input
                  type="radio"
                  name="reportReason"
                  value={option.code}
                  checked={reasonCode === option.code}
                  onChange={() => setReasonCode(option.code)}
                  className="radio radio-sm"
                />
                {option.label}
              </label>
            ))}
          </div>
        </div>

        <div className="mt-4">
          <label className="mb-1.5 block text-sm font-medium text-base-content">Additional details (optional)</label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Tell us more..."
            rows={3}
            className="w-full rounded-lg border border-base-300 px-3 py-2 text-sm outline-none focus:border-primary/30 focus:ring-2 focus:ring-primary/20"
          />
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
            onClick={() => onConfirm({ reasonCode, description })}
            disabled={isPending || !reasonCode}
            className="flex-1 rounded-xl bg-error px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-error disabled:opacity-60"
          >
            {isPending ? <Loader2 className="mx-auto size-4 animate-spin" /> : "Submit Report"}
          </button>
        </div>
      </div>
    </div>
  );
}
