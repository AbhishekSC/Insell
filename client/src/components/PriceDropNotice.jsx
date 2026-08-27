import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Link } from "react-router";
import { IndianRupee, X } from "lucide-react";
import axiosInstance from "../lib/axios";

function relativeDate(dateString) {
  if (!dateString) return "";
  const time = new Date(dateString).getTime();
  if (!Number.isFinite(time)) return "";
  const hours = Math.floor((Date.now() - time) / (1000 * 60 * 60));
  if (hours < 1) return "Just now";
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

// Same must-dismiss pattern as AnnouncementNotice/PostModerationNotice —
// stays up until explicitly closed, refetches instantly on the "price_drop"
// realtime push (StreamProvider.jsx) instead of polling.
export default function PriceDropNotice({ enabled }) {
  const queryClient = useQueryClient();

  const { data } = useQuery({
    queryKey: ["notifications", "priceDrop", "unread"],
    queryFn: async () => {
      const res = await axiosInstance.get("/notifications", {
        params: { unreadOnly: "true", type: "price_drop" },
      });
      return res.data?.data;
    },
    enabled,
    staleTime: 0,
  });

  const notices = data?.notifications || [];

  const { mutate: dismissAll, isPending } = useMutation({
    mutationFn: async () => {
      await Promise.all(notices.map((notice) => axiosInstance.patch(`/notifications/${notice._id}/read`)));
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["notifications", "priceDrop", "unread"] });
    },
  });

  if (notices.length === 0) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-xl">
        <div className="flex items-start justify-between gap-3">
          <div className="grid size-10 shrink-0 place-items-center rounded-full bg-emerald-50 text-emerald-600">
            <IndianRupee className="size-5" />
          </div>
          <button
            type="button"
            onClick={() => dismissAll()}
            disabled={isPending}
            className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600 disabled:opacity-60"
            title="Dismiss"
          >
            <X className="size-5" />
          </button>
        </div>

        <h3 className="mt-3 text-lg font-semibold text-slate-800">
          {notices.length > 1 ? `${notices.length} price drops` : "Price drop"}
        </h3>
        <p className="mt-1 text-sm text-slate-500">A property you liked or saved just got cheaper.</p>

        <div className="mt-4 max-h-64 space-y-2 overflow-y-auto">
          {notices.map((notice) => (
            <Link
              key={notice._id}
              to={notice.propertyPost?._id ? `/property/${notice.propertyPost._id}` : "#"}
              onClick={() => dismissAll()}
              className="flex items-center gap-3 rounded-xl border border-slate-200 bg-slate-50 p-3 hover:bg-slate-100"
            >
              {notice.propertyPost?.mediaUrls?.[0] && (
                <img
                  src={notice.propertyPost.mediaUrls[0]}
                  alt=""
                  className="size-12 shrink-0 rounded-lg object-cover"
                />
              )}
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-slate-800">{notice.propertyPost?.title || "Property"}</p>
                <p className="mt-0.5 text-xs text-emerald-600">{notice.message}</p>
                <p className="mt-1 text-xs text-slate-400">{relativeDate(notice.createdAt)}</p>
              </div>
            </Link>
          ))}
        </div>

        <button
          type="button"
          onClick={() => dismissAll()}
          disabled={isPending}
          className="mt-5 w-full rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white hover:bg-slate-800 disabled:opacity-60"
        >
          Got it
        </button>
      </div>
    </div>
  );
}
