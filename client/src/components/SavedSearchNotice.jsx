import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Link } from "react-router";
import { BellRing, X } from "lucide-react";
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

// Same must-dismiss pattern as AnnouncementNotice / PriceDropNotice — a new
// listing matched one of the user's saved searches. Refetches instantly on
// the "saved_search_match" realtime push (StreamProvider.jsx).
export default function SavedSearchNotice({ enabled }) {
  const queryClient = useQueryClient();

  const { data } = useQuery({
    queryKey: ["notifications", "savedSearch", "unread"],
    queryFn: async () => {
      const res = await axiosInstance.get("/notifications", {
        params: { unreadOnly: "true", type: "saved_search_match" },
      });
      return res.data?.data;
    },
    enabled,
    staleTime: 0,
  });

  const notices = data?.notifications || [];

  const { mutate: dismissAll, isPending } = useMutation({
    mutationFn: async () => {
      await Promise.all(notices.map((n) => axiosInstance.patch(`/notifications/${n._id}/read`)));
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["notifications", "savedSearch", "unread"] });
    },
  });

  if (notices.length === 0) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-sm rounded-2xl bg-base-100 p-6 shadow-xl">
        <div className="flex items-start justify-between gap-3">
          <div className="grid size-10 shrink-0 place-items-center rounded-full bg-primary/10 text-primary">
            <BellRing className="size-5" />
          </div>
          <button
            type="button"
            onClick={() => dismissAll()}
            disabled={isPending}
            className="rounded-lg p-1 text-base-content/50 hover:bg-base-200 hover:text-base-content/70 disabled:opacity-60"
            title="Dismiss"
          >
            <X className="size-5" />
          </button>
        </div>

        <h3 className="mt-3 text-lg font-semibold text-base-content">
          {notices.length > 1 ? `${notices.length} new matches` : "New listing match"}
        </h3>
        <p className="mt-1 text-sm text-base-content/60">A new listing matches a search you saved.</p>

        <div className="mt-4 max-h-64 space-y-2 overflow-y-auto">
          {notices.map((notice) => (
            <Link
              key={notice._id}
              to={notice.propertyPost?._id ? `/property/${notice.propertyPost._id}` : "#"}
              onClick={() => dismissAll()}
              className="flex items-center gap-3 rounded-xl border border-base-300 bg-base-200 p-3 hover:bg-base-200"
            >
              {notice.propertyPost?.mediaUrls?.[0] && (
                <img src={notice.propertyPost.mediaUrls[0]} alt="" className="size-12 shrink-0 rounded-lg object-cover" />
              )}
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-base-content">
                  {notice.propertyPost?.title || "New listing"}
                </p>
                <p className="mt-0.5 line-clamp-2 text-xs text-base-content/70">{notice.message}</p>
                <p className="mt-1 text-xs text-base-content/50">{relativeDate(notice.createdAt)}</p>
              </div>
            </Link>
          ))}
        </div>

        <button
          type="button"
          onClick={() => dismissAll()}
          disabled={isPending}
          className="mt-5 w-full rounded-xl bg-neutral px-4 py-2.5 text-sm font-semibold text-white hover:bg-neutral disabled:opacity-60"
        >
          Got it
        </button>
      </div>
    </div>
  );
}
