// Deterministic (not per-render-random) color per custom badge label — the
// same text always gets the same color, but different labels stand apart.
// Every class here is written out in full so Tailwind's scanner picks it up.
const PALETTE = [
  { bg: "bg-indigo-100", text: "text-indigo-700", border: "border-indigo-200" },
  { bg: "bg-emerald-100", text: "text-emerald-700", border: "border-emerald-200" },
  { bg: "bg-amber-100", text: "text-amber-700", border: "border-amber-200" },
  { bg: "bg-rose-100", text: "text-rose-700", border: "border-rose-200" },
  { bg: "bg-sky-100", text: "text-sky-700", border: "border-sky-200" },
  { bg: "bg-violet-100", text: "text-violet-700", border: "border-violet-200" },
  { bg: "bg-fuchsia-100", text: "text-fuchsia-700", border: "border-fuchsia-200" },
  { bg: "bg-cyan-100", text: "text-cyan-700", border: "border-cyan-200" },
  { bg: "bg-orange-100", text: "text-orange-700", border: "border-orange-200" },
  { bg: "bg-teal-100", text: "text-teal-700", border: "border-teal-200" },
];

function hashString(value) {
  let hash = 0;
  for (let i = 0; i < value.length; i++) {
    hash = (hash * 31 + value.charCodeAt(i)) >>> 0;
  }
  return hash;
}

// Returns a full className string (bg + text + border) for a custom badge
// label — pass through the return value directly into a className prop.
export function getCustomBadgeClasses(label) {
  const palette = PALETTE[hashString(String(label || "")) % PALETTE.length];
  return `${palette.bg} ${palette.text} border ${palette.border}`;
}
