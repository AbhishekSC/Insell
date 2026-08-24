import { useEffect, useRef, useState } from "react";

// Only shows "Read more" when the single-line caption is actually being cut
// off — measured via real DOM overflow (scrollHeight vs clientHeight)
// instead of a fixed character count, which can't account for the card's
// width, font metrics, or word-wrap breaks. Re-measures on resize since a
// responsive grid changing column count changes how much fits.
export default function ClampedCaption({ text }) {
  const [isOverflowing, setIsOverflowing] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const textRef = useRef(null);

  useEffect(() => {
    // Skip while expanded — the clamp class is off then, so scrollHeight
    // would always equal clientHeight and a resize could wrongly flip this
    // to false, stranding the user with no way to collapse back.
    if (expanded) return undefined;
    const measure = () => {
      const el = textRef.current;
      if (!el) return;
      setIsOverflowing(el.scrollHeight > el.clientHeight + 1);
    };
    measure();
    window.addEventListener("resize", measure);
    return () => window.removeEventListener("resize", measure);
  }, [text, expanded]);

  return (
    <div className="text-xs text-slate-600">
      <p ref={textRef} className={expanded ? "" : "line-clamp-1"}>
        {text}
      </p>
      {isOverflowing && (
        <button
          type="button"
          className="mt-1 font-semibold text-indigo-600"
          onClick={(event) => {
            event.stopPropagation();
            setExpanded((prev) => !prev);
          }}
        >
          {expanded ? "Read less" : "Read more"}
        </button>
      )}
    </div>
  );
}
