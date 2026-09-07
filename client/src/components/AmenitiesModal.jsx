import { useEffect, useMemo } from "react";
import { X } from "lucide-react";

const TYPE_META = {
  metro: { emoji: "🚇", label: "Transit" },
  schools: { emoji: "🏫", label: "Schools" },
  hospitals: { emoji: "🏥", label: "Healthcare" },
  malls: { emoji: "🛒", label: "Shopping" },
};
const TYPE_ORDER = ["metro", "schools", "hospitals", "malls"];

function fmt(m) {
  const n = Number(m);
  if (!Number.isFinite(n)) return "";
  return n >= 1000 ? `${(n / 1000).toFixed(1)} km` : `${Math.round(n)} m`;
}

export default function AmenitiesModal({ open, onClose, items = [], radiusKm }) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  const groups = useMemo(() => {
    const byType = {};
    for (const a of items || []) {
      if (!a?.type) continue;
      (byType[a.type] ||= []).push(a);
    }
    return TYPE_ORDER.filter((t) => byType[t]?.length).map((t) => ({
      type: t,
      ...TYPE_META[t],
      places: byType[t].slice().sort((x, y) => (x.distance || 0) - (y.distance || 0)),
    }));
  }, [items]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 p-0 sm:items-center sm:p-4"
      onClick={onClose}
    >
      <div
        className="flex max-h-[85vh] w-full max-w-lg flex-col overflow-hidden rounded-t-2xl bg-base-100 shadow-xl sm:rounded-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-base-200 px-5 py-4">
          <div>
            <h3 className="text-base font-semibold text-base-content">Nearby places</h3>
            {radiusKm && (
              <p className="text-xs text-base-content/50">Within {radiusKm} km of this property</p>
            )}
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-1.5 text-base-content/50 hover:bg-base-200"
            aria-label="Close"
          >
            <X className="size-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-4">
          {groups.length === 0 && (
            <p className="py-8 text-center text-sm text-base-content/50">No nearby places found.</p>
          )}
          <div className="space-y-5">
            {groups.map((g) => (
              <div key={g.type}>
                <p className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-base-content/50">
                  <span aria-hidden>{g.emoji}</span>
                  {g.label}
                  <span className="font-normal normal-case">· {g.places.length}</span>
                </p>
                <ul className="divide-y divide-base-200 rounded-xl border border-base-200">
                  {g.places.map((p) => (
                    <li key={p.id} className="flex items-center justify-between gap-3 px-3 py-2.5">
                      <span className="min-w-0 truncate text-sm text-base-content">{p.name}</span>
                      <span className="shrink-0 text-xs font-medium text-base-content/60">{fmt(p.distance)}</span>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
