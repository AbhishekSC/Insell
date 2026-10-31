import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router";
import { Award, ChevronRight, Handshake, ShieldCheck } from "lucide-react";
import AppShell from "../components/AppShell";
import axiosInstance from "../lib/axios";
import ClosingStatementModal from "../components/ClosingStatementModal";

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
  const [statementDealId, setStatementDealId] = useState(null);

  const { data: deals = [], isLoading } = useQuery({
    queryKey: ["myDeals"],
    queryFn: async () => {
      const res = await axiosInstance.get("/deals/mine");
      return res.data?.data?.deals || [];
    },
  });

  return (
    <AppShell hideHero showBackButton title="My Deals" subtitle="Offers you've closed — track them through to registration">
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
              const verifiedDocsCount = (deal.attachments || []).filter((a) => a.verifiedBy).length;
              const totalDocsCount = (deal.attachments || []).length;

              return (
                <div
                  key={deal._id}
                  className="group flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 rounded-2xl border border-base-300 bg-base-100 p-4 text-left shadow-xs transition hover:border-primary/40 hover:shadow-md"
                >
                  <div
                    onClick={() => navigate(`/property/${deal.post?._id || deal.post}`)}
                    className="flex flex-1 items-center gap-3 cursor-pointer min-w-0"
                  >
                    <img
                      src={deal.post?.mediaUrls?.[0] || "https://placehold.co/120x90?text=NearMySpace"}
                      alt={deal.post?.title || "Property"}
                      className="h-16 w-20 shrink-0 rounded-xl object-cover"
                    />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <p className="truncate text-sm font-semibold text-base-content group-hover:text-primary transition">
                          {deal.post?.title || "Property"}
                        </p>
                        <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold ${STATUS_STYLE[deal.status] || ""}`}>
                          {deal.status === "ACTIVE" ? `Step ${doneCount}/${totalStages}` : deal.status.toLowerCase()}
                        </span>
                      </div>
                      <p className="mt-0.5 text-sm font-bold text-primary">{fmtMoney(deal.agreedPrice)}</p>
                      <div className="flex flex-wrap items-center gap-2 text-xs text-base-content/60 mt-1">
                        <span>
                          {deal.status === "ACTIVE" ? `Next: ${currentLabel}` : deal.status === "COMPLETED" ? "Closed 🎉" : "Cancelled"}
                          {deal.post?.city ? ` · ${deal.post.city}` : ""}
                        </span>
                        {totalDocsCount > 0 && (
                          <span className="inline-flex items-center gap-1 rounded-md bg-base-200 px-1.5 py-0.5 text-[10px] font-medium text-base-content/70">
                            <ShieldCheck className="size-3 text-primary" />
                            {verifiedDocsCount}/{totalDocsCount} Docs Verified
                          </span>
                        )}
                        {deal.disputed && (
                          <span className="rounded-md bg-warning/10 px-1.5 py-0.5 text-[10px] font-semibold text-warning">
                            48h Dispute Resolution Active
                          </span>
                        )}
                        {deal.paymentAmount > 0 && (
                          <span className="rounded-md bg-success/10 px-1.5 py-0.5 text-[10px] font-semibold text-success">
                            Advance Paid
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 pt-2 sm:pt-0 border-t sm:border-t-0 border-base-200 shrink-0">
                    <button
                      type="button"
                      onClick={() => setStatementDealId(deal._id)}
                      className="btn btn-xs sm:btn-sm btn-outline btn-primary rounded-xl gap-1"
                    >
                      <Award className="size-3.5" />
                      <span>Statement</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => navigate(`/property/${deal.post?._id || deal.post}`)}
                      className="btn btn-xs sm:btn-sm btn-ghost btn-circle"
                      title="View Deal"
                    >
                      <ChevronRight className="size-4 text-base-content/40 group-hover:text-primary transition" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {statementDealId && (
        <ClosingStatementModal
          dealId={statementDealId}
          onClose={() => setStatementDealId(null)}
        />
      )}
    </AppShell>
  );
}
