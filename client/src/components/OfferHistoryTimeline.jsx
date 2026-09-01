import { Check, IndianRupee, RefreshCw, X } from "lucide-react";

function formatMoney(amount) {
  const num = Number(amount) || 0;
  return `₹${num.toLocaleString("en-IN")}`;
}

function formatDateTime(dateString) {
  const date = new Date(dateString);
  if (Number.isNaN(date.getTime())) return "";
  return new Intl.DateTimeFormat("en-IN", { day: "numeric", month: "short", hour: "numeric", minute: "2-digit" }).format(date);
}

const ACTION_META = {
  offer: { icon: IndianRupee, verb: "offered", tone: "bg-primary/10 text-primary" },
  counter: { icon: RefreshCw, verb: "countered with", tone: "bg-warning/10 text-warning" },
  accept: { icon: Check, verb: "accepted", tone: "bg-success/10 text-success" },
  decline: { icon: X, verb: "declined at", tone: "bg-error/10 text-error" },
  withdraw: { icon: X, verb: "withdrew at", tone: "bg-base-200 text-base-content/60" },
};

// `history` is Offer.history straight from the API — every offer/counter/
// accept/decline entry, oldest first. `buyerName`/`ownerName` label who did
// what; `currentUserId` swaps in "You" for whichever side is viewing.
export default function OfferHistoryTimeline({ history, buyerName, ownerName, buyerId, currentUserId }) {
  const entries = Array.isArray(history) ? history : [];
  if (entries.length === 0) return null;

  const nameFor = (by) => {
    if (currentUserId && String(by) === String(currentUserId)) return "You";
    return String(by) === String(buyerId) ? buyerName || "Buyer" : ownerName || "Owner";
  };

  return (
    <div className="space-y-3">
      {entries.map((entry, index) => {
        const meta = ACTION_META[entry.action] || ACTION_META.offer;
        const Icon = meta.icon;
        return (
          <div key={entry._id || index} className="flex gap-3">
            <div className={`grid size-8 shrink-0 place-items-center rounded-full ${meta.tone}`}>
              <Icon className="size-4" />
            </div>
            <div className="min-w-0 flex-1 pb-1">
              <p className="text-sm text-base-content">
                <span className="font-semibold text-base-content">{nameFor(entry.by)}</span> {meta.verb}{" "}
                <span className="font-semibold text-base-content">{formatMoney(entry.price)}</span>
              </p>
              {entry.message && <p className="mt-0.5 text-xs italic text-base-content/60">"{entry.message}"</p>}
              <p className="mt-0.5 text-xs text-base-content/50">{formatDateTime(entry.at)}</p>
            </div>
          </div>
        );
      })}
    </div>
  );
}
