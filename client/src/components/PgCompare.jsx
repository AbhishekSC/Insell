import { Link } from "react-router";
import { X, ArrowRight, Star, UtensilsCrossed, Bed, Users, Wifi, MapPin, IndianRupee, Shield, Check } from "lucide-react";
import { usePgCompare } from "../context/PgCompareContext";

function avgRating(pg) {
  if (!pg?.avgRatings) return 0;
  const vals = Object.values(pg.avgRatings).filter((v) => typeof v === "number" && v > 0);
  return vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : 0;
}

function fmt(n) {
  if (!n && n !== 0) return "—";
  return `₹${Number(n).toLocaleString("en-IN")}`;
}

export function PgCompareTray() {
  const { items, remove, clear, setShowModal } = usePgCompare();
  if (items.length === 0) return null;

  return (
    <div className="fixed bottom-20 left-1/2 -translate-x-1/2 z-40 w-[calc(100%-2rem)] max-w-lg">
      <div className="rounded-2xl bg-base-100 border border-primary/30 shadow-2xl p-3 flex items-center gap-3">
        <div className="flex gap-2 flex-1 min-w-0 overflow-x-auto scrollbar-none">
          {items.map((post) => (
            <div key={post._id} className="relative shrink-0 w-16 h-16 rounded-xl overflow-hidden bg-base-200">
              {post.media?.[0] ? (
                <img src={typeof post.media[0] === "string" ? post.media[0] : post.media[0]?.url} alt="" className="w-full h-full object-cover" />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-base-content/30">
                  <Bed size={20} />
                </div>
              )}
              <button
                onClick={() => remove(post._id)}
                className="absolute top-0.5 right-0.5 w-5 h-5 rounded-full bg-black/60 flex items-center justify-center"
              >
                <X size={10} className="text-white" />
              </button>
              <div className="absolute bottom-0 left-0 right-0 bg-black/60 text-white text-[8px] font-semibold px-1 py-0.5 truncate text-center">
                {post.title || post.caption || "PG"}
              </div>
            </div>
          ))}
          {items.length < 3 && (
            <div className="shrink-0 w-16 h-16 rounded-xl border-2 border-dashed border-base-300 flex items-center justify-center text-base-content/30">
              <span className="text-[10px] text-center leading-tight">Add PG<br />{3 - items.length} more</span>
            </div>
          )}
        </div>
        <div className="flex flex-col gap-1.5 shrink-0">
          <button
            onClick={() => setShowModal(true)}
            disabled={items.length < 2}
            className="btn btn-primary btn-sm gap-1"
          >
            Compare <ArrowRight size={14} />
          </button>
          <button onClick={clear} className="btn btn-ghost btn-xs text-base-content/50">
            Clear
          </button>
        </div>
      </div>
    </div>
  );
}

export function PgCompareModal() {
  const { items, setShowModal, showModal } = usePgCompare();
  if (!showModal || items.length < 2) return null;

  const rows = [
    {
      label: "Price (Lowest)",
      render: (p) => {
        const sharing = p.postMeta?.pgHostel?.sharingTypes || [];
        const min = sharing.length > 0 ? Math.min(...sharing.map((s) => s.price || Infinity)) : p.price;
        return fmt(min) + "/mo";
      },
    },
    {
      label: "Sharing Options",
      render: (p) => {
        const sharing = p.postMeta?.pgHostel?.sharingTypes || [];
        return sharing.map((s) => `${s.type} (${fmt(s.price)})`).join(", ") || "—";
      },
    },
    { label: "Gender", render: (p) => (p.postMeta?.pgHostel?.genderPreference || "Any").replace(/^./, (c) => c.toUpperCase()) },
    {
      label: "Food",
      render: (p) => {
        const pg = p.postMeta?.pgHostel;
        if (!pg?.foodIncluded) return "Not included";
        return pg.foodType === "veg" ? "Veg" : pg.foodType === "nonveg" ? "Non-Veg" : "Veg & Non-Veg";
      },
    },
    { label: "Total Beds", render: (p) => p.postMeta?.pgHostel?.totalBeds || "—" },
    { label: "Available", render: (p) => p.postMeta?.pgHostel?.availableBeds ?? "—" },
    { label: "Security Deposit", render: (p) => fmt(p.postMeta?.pgHostel?.securityDeposit) },
    { label: "Lock-in", render: (p) => (p.postMeta?.pgHostel?.lockInPeriodMonths || 0) > 0 ? `${p.postMeta.pgHostel.lockInPeriodMonths} months` : "None" },
    { label: "WiFi", render: (p) => p.postMeta?.pgHostel?.wifiSpeed || "—" },
    {
      label: "Rating",
      render: (p) => {
        const r = avgRating(p.postMeta?.pgHostel);
        return r > 0 ? `${r.toFixed(1)} ★ (${p.postMeta?.pgHostel?.reviewCount || 0})` : "No reviews";
      },
    },
    {
      label: "Amenities",
      render: (p) => {
        const a = p.postMeta?.pgHostel?.amenities || [];
        return a.length > 0 ? a.map((x) => x.replace(/_/g, " ")).join(", ") : "—";
      },
    },
    { label: "Location", render: (p) => [p.locality, p.city].filter(Boolean).join(", ") || "—" },
    {
      label: "Nearby Colleges",
      render: (p) => (p.postMeta?.pgHostel?.nearbyColleges || []).join(", ") || "—",
    },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={() => setShowModal(false)}>
      <div
        className="bg-base-100 rounded-2xl shadow-xl w-full max-w-3xl max-h-[85vh] flex flex-col overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-5 py-4 border-b border-base-200 flex items-center justify-between shrink-0">
          <h3 className="text-lg font-bold">Compare PGs</h3>
          <button onClick={() => setShowModal(false)} className="btn btn-sm btn-ghost btn-circle">
            <X size={18} />
          </button>
        </div>

        <div className="overflow-x-auto overflow-y-auto flex-1">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-base-200">
                <th className="sticky left-0 bg-base-100 z-10 p-3 text-left text-xs font-semibold text-base-content/50 uppercase w-36 min-w-36">Feature</th>
                {items.map((post) => (
                  <th key={post._id} className="p-3 text-center min-w-44">
                    <div className="space-y-2">
                      <div className="w-16 h-16 rounded-xl overflow-hidden bg-base-200 mx-auto">
                        {post.media?.[0] ? (
                          <img src={typeof post.media[0] === "string" ? post.media[0] : post.media[0]?.url} alt="" className="w-full h-full object-cover" />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center text-base-content/30">
                            <Bed size={20} />
                          </div>
                        )}
                      </div>
                      <Link
                        to={`/property/${post._id}`}
                        className="text-sm font-bold hover:text-primary transition-colors line-clamp-2"
                        onClick={() => setShowModal(false)}
                      >
                        {post.title || post.caption || "PG"}
                      </Link>
                    </div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.label} className="border-b border-base-200/50 hover:bg-base-200/30">
                  <td className="sticky left-0 bg-base-100 z-10 p-3 text-xs font-semibold text-base-content/60">{row.label}</td>
                  {items.map((post) => (
                    <td key={post._id} className="p-3 text-center text-sm">
                      {row.render(post)}
                    </td>
                  ))}
                </tr>
              ))}
              <tr>
                <td className="sticky left-0 bg-base-100 z-10 p-3" />
                {items.map((post) => (
                  <td key={post._id} className="p-3 text-center">
                    <Link
                      to={`/property/${post._id}`}
                      className="btn btn-primary btn-sm"
                      onClick={() => setShowModal(false)}
                    >
                      View Details
                    </Link>
                  </td>
                ))}
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

export function PgCompareButton({ post }) {
  const { add, remove, has } = usePgCompare();
  const isAdded = has(post._id);
  const isPg = post.postType === "PG_HOSTEL";
  if (!isPg) return null;

  return (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation();
        e.preventDefault();
        isAdded ? remove(post._id) : add(post);
      }}
      className={`btn btn-xs rounded-full gap-1 ${isAdded ? "btn-primary" : "btn-ghost border border-base-300"}`}
    >
      {isAdded ? <Check size={12} /> : <ArrowRight size={12} />}
      {isAdded ? "Added" : "Compare"}
    </button>
  );
}
