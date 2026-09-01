import { Check, Square } from "lucide-react";

// The little checkbox-style button on a property card that adds/removes it
// from the compare-properties selection. Selection state itself stays owned
// by whichever page renders this (Marketplace, profile grids, ...) since
// each page's selection is independent — this just standardizes the toggle
// button's look and click behavior everywhere it appears.
export default function CompareToggleButton({ postId, selected, onToggle }) {
  const isSelected = selected.includes(postId);

  return (
    <button
      type="button"
      className={`size-8 rounded-full flex items-center justify-center transition-all duration-200 ${
        isSelected
          ? "bg-primary text-white shadow-lg shadow-primary/20"
          : "text-white drop-shadow-[0_1px_3px_rgba(0,0,0,0.6)] hover:opacity-75"
      }`}
      onClick={(event) => {
        event.stopPropagation();
        onToggle(postId);
      }}
      title={isSelected ? "Remove from comparison" : "Add to comparison"}
    >
      {isSelected ? <Check className="size-5" strokeWidth={3} /> : <Square className="size-4" strokeWidth={2} />}
    </button>
  );
}
