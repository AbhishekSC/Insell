import { useEffect, useState } from "react";
import { Link } from "react-router";
import { Clock } from "lucide-react";
import { getRecentlyViewed } from "../utils/recentlyViewed";

function formatMoney(value) {
  const amount = Number(value || 0);
  if (!Number.isFinite(amount) || amount <= 0) return "Price on request";
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
    notation: "compact",
  }).format(amount);
}

// Reads from localStorage on mount only — this is a "what did I just look
// at" convenience, not something that needs to react to writes happening
// in other tabs/components in real time.
export default function RecentlyViewedRail() {
  const [items, setItems] = useState([]);

  useEffect(() => {
    setItems(getRecentlyViewed());
  }, []);

  if (items.length === 0) return null;

  return (
    <section className="mb-6">
      <div className="mb-3 flex items-center gap-2">
        <Clock className="size-4 text-slate-500" />
        <h2 className="text-sm font-semibold text-slate-700">Recently Viewed</h2>
      </div>
      <div className="flex gap-3 overflow-x-auto pb-2">
        {items.map((item) => (
          <Link
            key={item.id}
            to={`/property/${item.id}`}
            className="w-40 shrink-0 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm transition-shadow hover:shadow-md"
          >
            <div className="aspect-square bg-slate-100">
              {item.image ? (
                <img src={item.image} alt={item.title} className="h-full w-full object-cover" loading="lazy" />
              ) : null}
            </div>
            <div className="p-2">
              <p className="truncate text-xs font-semibold text-slate-800">{item.title || "Property"}</p>
              <p className="mt-0.5 truncate text-[11px] text-slate-500">
                {formatMoney(item.price)}
                {item.city ? ` · ${item.city}` : ""}
              </p>
            </div>
          </Link>
        ))}
      </div>
    </section>
  );
}
