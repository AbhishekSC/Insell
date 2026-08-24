import toast from "react-hot-toast";

const MAX_COMPARE = 4;

// Toggles a post id in/out of a comparison selection, capped at MAX_COMPARE.
// Shared by every grid that offers the compare-properties feature so the
// cap and its error message can't drift between pages.
export function toggleCompareSelection(prev, postId) {
  const isSelected = prev.includes(postId);
  if (isSelected) {
    return prev.filter((id) => id !== postId);
  }
  if (prev.length < MAX_COMPARE) {
    return [...prev, postId];
  }
  toast.error(`Maximum ${MAX_COMPARE} properties can be compared`);
  return prev;
}
