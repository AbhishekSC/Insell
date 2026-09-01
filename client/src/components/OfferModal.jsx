import { useEffect, useState } from "react";
import { IndianRupee, Loader2, TrendingUp } from "lucide-react";

const OVERLAY_CLASSES = "fixed inset-0 z-50 flex items-end justify-center bg-black/50 sm:items-center sm:p-4";
const CARD_CLASSES =
  "max-h-[90vh] w-full overflow-y-auto rounded-t-2xl bg-base-100 p-6 shadow-xl sm:max-w-md sm:rounded-2xl";

// Reused for both a fresh offer and a counter-offer — `mode` just changes
// the copy and the button label; the price/message payload shape is identical.
export default function OfferModal({ isOpen, mode = "offer", listedPrice, currentPrice, isPending, onCancel, onSubmit }) {
  const [price, setPrice] = useState("");
  const [message, setMessage] = useState("");

  useEffect(() => {
    if (isOpen) {
      setPrice(currentPrice ? String(currentPrice) : "");
      setMessage("");
    }
  }, [isOpen, currentPrice]);

  if (!isOpen) return null;

  const isCounter = mode === "counter";
  const numericPrice = Number(price);
  const isValid = Number.isFinite(numericPrice) && numericPrice > 0;

  return (
    <div className={OVERLAY_CLASSES} onClick={onCancel}>
      <div className={CARD_CLASSES} onClick={(e) => e.stopPropagation()}>
        <div className="mx-auto grid size-12 place-items-center rounded-full bg-primary/10 text-primary">
          <TrendingUp className="size-6" />
        </div>
        <h3 className="mt-4 text-center text-lg font-semibold text-base-content">
          {isCounter ? "Send a counter-offer" : "Make an offer"}
        </h3>
        {listedPrice ? (
          <p className="mt-1.5 text-center text-sm text-base-content/60">
            Listed at ₹{Number(listedPrice).toLocaleString("en-IN")}
          </p>
        ) : null}

        <div className="mt-4">
          <label className="mb-1.5 block text-sm font-medium text-base-content">Your price</label>
          <div className="relative">
            <IndianRupee className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-base-content/50" />
            <input
              type="number"
              min="1"
              value={price}
              onChange={(e) => setPrice(e.target.value)}
              placeholder="Enter your price"
              className="w-full rounded-lg border border-base-300 py-2 pl-9 pr-3 text-sm outline-none focus:border-primary/30 focus:ring-2 focus:ring-primary/20"
            />
          </div>
        </div>

        <div className="mt-4">
          <label className="mb-1.5 block text-sm font-medium text-base-content">Message (optional)</label>
          <textarea
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder="Add a note for the owner..."
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
            onClick={() => onSubmit({ price: numericPrice, message: message.trim() })}
            disabled={isPending || !isValid}
            className="flex-1 rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-primary disabled:opacity-60"
          >
            {isPending ? <Loader2 className="mx-auto size-4 animate-spin" /> : isCounter ? "Send Counter" : "Send Offer"}
          </button>
        </div>
      </div>
    </div>
  );
}
