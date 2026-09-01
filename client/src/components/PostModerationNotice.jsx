import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Flag, ShieldOff, ShieldCheck, X } from "lucide-react";
import axiosInstance from "../lib/axios";

const NOTICE_TYPES = ["post_reported", "post_blocked", "post_report_resolved"];

const NOTICE_ICONS = {
  post_reported: { Icon: Flag, bg: "bg-warning/10", text: "text-warning" },
  post_blocked: { Icon: ShieldOff, bg: "bg-error/10", text: "text-error" },
  post_report_resolved: { Icon: ShieldCheck, bg: "bg-success/10", text: "text-success" },
};

function relativeDate(dateString) {
  if (!dateString) return "";
  const time = new Date(dateString).getTime();
  if (!Number.isFinite(time)) return "";
  const hours = Math.floor((Date.now() - time) / (1000 * 60 * 60));
  if (hours < 1) return "Just now";
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

// A no-TTL, must-dismiss notice for post moderation events (a post you own
// was reported or blocked, or a post you reported was acted on) — unlike a
// toast, this stays up until the user explicitly closes it with the X button.
export default function PostModerationNotice({ enabled }) {
  const queryClient = useQueryClient();

  const { data } = useQuery({
    queryKey: ["notifications", "postModeration", "unread"],
    queryFn: async () => {
      const res = await axiosInstance.get("/notifications", {
        params: { unreadOnly: "true", type: NOTICE_TYPES.join(",") },
      });
      return res.data?.data;
    },
    enabled,
    // No polling — StreamProvider's socket listener invalidates this query
    // as soon as the server pushes a "post_moderation_notice" custom event
    // (see stream.service.js's pushRealtimeNotification), so it refetches
    // in real time instead. That only reaches users connected at send
    // time though — staleTime: 0 makes sure anyone who was logged out
    // still gets a real check (not a stale cached empty result) on their
    // next login instead of missing it entirely.
    staleTime: 0,
  });

  const notices = data?.notifications || [];

  const { mutate: dismissAll, isPending } = useMutation({
    mutationFn: async () => {
      await Promise.all(notices.map((notice) => axiosInstance.patch(`/notifications/${notice._id}/read`)));
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["notifications", "postModeration", "unread"] });
    },
  });

  if (notices.length === 0) return null;

  const headerIcon = NOTICE_ICONS[notices[0].type] || NOTICE_ICONS.post_reported;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-sm rounded-2xl bg-base-100 p-6 shadow-xl">
        <div className="flex items-start justify-between gap-3">
          <div className={`grid size-10 shrink-0 place-items-center rounded-full ${headerIcon.bg} ${headerIcon.text}`}>
            <headerIcon.Icon className="size-5" />
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
          {notices.length > 1 ? `${notices.length} updates on your posts` : "Update on your posts"}
        </h3>
        <p className="mt-1 text-sm text-base-content/60">Moderation activity on posts you own or reported.</p>

        <div className="mt-4 max-h-52 space-y-2 overflow-y-auto">
          {notices.map((notice) => {
            const { Icon, bg, text } = NOTICE_ICONS[notice.type] || NOTICE_ICONS.post_reported;
            return (
              <div key={notice._id} className="flex items-start gap-2.5 rounded-xl border border-base-300 bg-base-200 p-3">
                <div className={`grid size-6 shrink-0 place-items-center rounded-full ${bg} ${text}`}>
                  <Icon className="size-3.5" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm text-base-content">{notice.message}</p>
                  <p className="mt-1 text-xs text-base-content/50">{relativeDate(notice.createdAt)}</p>
                </div>
              </div>
            );
          })}
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
