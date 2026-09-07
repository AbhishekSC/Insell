import { useMemo } from "react";
import { summarizeNeighbourhood } from "../lib/neighbourhood";

const SCORE_TONE = (score) =>
  score >= 8
    ? "bg-success/15 text-success"
    : score >= 6
      ? "bg-primary/15 text-primary"
      : score >= 4
        ? "bg-warning/15 text-warning"
        : "bg-base-200 text-base-content/60";

// Compact "is this area any good?" block. Feed it the already-loaded
// /amenities/nearby list — renders nothing if there's no usable data.
export default function NeighbourhoodSummary({ items, locality, city, className = "" }) {
  const summary = useMemo(
    () => summarizeNeighbourhood(items, { locality, city }),
    [items, locality, city]
  );

  if (!summary) return null;

  return (
    <div className={`rounded-xl border border-base-300 bg-base-100 p-4 ${className}`}>
      <div className="flex items-center justify-between gap-3">
        <h4 className="text-sm font-semibold text-base-content">Neighbourhood</h4>
        <span
          className={`shrink-0 rounded-full px-2.5 py-0.5 text-xs font-semibold ${SCORE_TONE(summary.score)}`}
          title="Based on transit proximity and nearby daily-need amenities"
        >
          {summary.score}/10 · {summary.scoreLabel}
        </span>
      </div>

      <div className="mt-3 flex flex-wrap gap-2">
        {summary.chips.map((chip) => (
          <span
            key={chip.key}
            title={chip.title}
            className="inline-flex items-center gap-1.5 rounded-lg bg-base-200 px-2.5 py-1 text-xs text-base-content/80"
          >
            <span aria-hidden>{chip.emoji}</span>
            {chip.label}
          </span>
        ))}
      </div>

      {summary.blurb && (
        <p className="mt-3 text-xs leading-relaxed text-base-content/60">{summary.blurb}</p>
      )}
    </div>
  );
}
