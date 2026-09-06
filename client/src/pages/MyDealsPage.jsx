import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router";
import { ChevronRight, Handshake } from "lucide-react";
import AppShell from "../components/AppShell";
import axiosInstance from "../lib/axios";

function fmtMoney(v) {
  const n = Number(v || 0);
  if (!n) return "Price on request";
  return new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(n);
}

const STATUS_STYLE = {
  ACTIVE: "bg-primary/10 text-primary",
  COMPLETED: "bg-success/10 text-success",
  CANCELLED: "bg-error/10 text-error",
};

export default function MyDealsPage() {
  const navigate = useNavigate();

  const { data: deals = [], isLoading } = useQuery({
    queryKey: ["myDeals"],
    queryFn: async () => {
      const res = await axiosInstance.get("/deals/mine");
      return res.data?.data?.deals || [];
    },
  });

  return (
    <AppShell hideHero title="My Deals" subtitle="Offers you've closed — track them through to registration">
      <div className="mx-auto max-w-3xl px-4 py-6 pb-24">
        {isLoading ? (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-24 animate-pulse rounded-2xl bg-base-200" />
            ))}
          </div>
        ) : deals.length === 0 ? (
          <div className="rounded-2xl border border-base-300 bg-base-100 p-8 text-center">
            <Handshake className="mx-auto mb-3 size-8 text-base-content/50" />
            <p className="text-lg font-semibold text-base-content">No deals yet</p>
            <p className="mt-2 text-sm text-base-content/60">
              When an offer you made or received gets accepted, it shows up here to track through closing.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {deals.map((deal) => {
              const doneCount = (deal.stages || []).filter((s) => s.done).length;
              const totalStages = (deal.stages || []).length;
              const currentLabel = (deal.stages || []).find((s) => !s.done)?.label || "Completed";
              return (
                <button
                  key={deal._id}
                  type="button"
                  onClick={() => navigate(`/property/${deal.post?._id || deal.post}`)}
                  className="group flex w-full items-center gap-3 rounded-2xl border border-base-300 bg-base-100 p-3.5 text-left shadow-sm transition hover:border-primary/30 hover:shadow-md"
                >
                  <img
                    src={deal.post?.mediaUrls?.[0] || "https://placehold.co/120x90?text=NearMySpace"}
                    alt={deal.post?.title || "Property"}
                    className="h-14 w-20 shrink-0 rounded-xl object-cover"
                  />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <p className="truncate text-sm font-semibold text-base-content">{deal.post?.title || "Property"}</p>
                      <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold ${STATUS_STYLE[deal.status] || ""}`}>
                        {deal.status === "ACTIVE" ? `Step ${doneCount}/${totalStages}` : deal.status.toLowerCase()}
                      </span>
                    </div>
                    <p className="mt-0.5 text-sm font-medium text-primary">{fmtMoney(deal.agreedPrice)}</p>
                    <p className="text-xs text-base-content/60">
                      {deal.status === "ACTIVE" ? `Next: ${currentLabel}` : deal.status === "COMPLETED" ? "Closed" : "Fell through"}
                      {deal.post?.city ? ` · ${deal.post.city}` : ""}
                    </p>
                  </div>
                  <ChevronRight className="size-4 shrink-0 text-base-content/40 transition group-hover:text-primary" />
                </button>
              );
            })}
          </div>
        )}
      </div>
    </AppShell>
  );
}
