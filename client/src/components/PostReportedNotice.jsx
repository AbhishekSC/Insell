import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Flag, X } from "lucide-react";
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

// A no-TTL, must-dismiss notice for post owners — unlike a toast, this stays
// up until the owner explicitly closes it with the X button.
export default function PostReportedNotice({ enabled }) {
  const queryClient = useQueryClient();

  const { data } = useQuery({
    queryKey: ["notifications", "post_reported", "unread"],
    queryFn: async () => {
      const res = await axiosInstance.get("/notifications", {
        params: { unreadOnly: "true", type: "post_reported" },
      });
      return res.data?.data;
    },
    enabled,
  });

  const notices = data?.notifications || [];

  const { mutate: dismissAll, isPending } = useMutation({
    mutationFn: async () => {
      await Promise.all(notices.map((notice) => axiosInstance.patch(`/notifications/${notice._id}/read`)));
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["notifications", "post_reported", "unread"] });
    },
  });

  if (notices.length === 0) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-xl">
        <div className="flex items-start justify-between gap-3">
          <div className="grid size-10 shrink-0 place-items-center rounded-full bg-amber-50 text-amber-600">
            <Flag className="size-5" />
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
          {notices.length > 1 ? `${notices.length} of your posts were reported` : "Your post was reported"}
        </h3>
        <p className="mt-1 text-sm text-slate-500">
          It's still visible while our team reviews it — nothing changes unless we find a policy violation.
        </p>

        <div className="mt-4 max-h-52 space-y-2 overflow-y-auto">
          {notices.map((notice) => (
            <div key={notice._id} className="rounded-xl border border-slate-200 bg-slate-50 p-3">
              <p className="text-sm text-slate-700">{notice.message}</p>
              <p className="mt-1 text-xs text-slate-400">{relativeDate(notice.createdAt)}</p>
            </div>
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
