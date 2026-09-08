import { useEffect } from "react";
import { Link } from "react-router";
import { useInfiniteQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { X, BadgeCheck, Loader2 } from "lucide-react";
import toast from "react-hot-toast";
import axiosInstance from "../lib/axios";
import UserAvatar from "./UserAvatar";

function ConnectButton({ liker }) {
  const queryClient = useQueryClient();
  const { mutate, isPending } = useMutation({
    mutationFn: async () => axiosInstance.post(`/users/connection-request/${liker.id}`),
    onSuccess: () => {
      liker.connectionStatus = "pending_sent";
      queryClient.invalidateQueries({ queryKey: ["postLikers"] });
    },
    onError: (err) => toast.error(err?.response?.data?.message || "Couldn't send request"),
  });

  if (liker.connectionStatus === "self" || liker.connectionStatus === "friends") return null;
  if (liker.connectionStatus === "pending_sent") {
    return <span className="rounded-lg bg-base-200 px-3.5 py-1.5 text-xs font-semibold text-base-content/50">Requested</span>;
  }
  if (liker.connectionStatus === "pending_received") {
    return (
      <Link to="/connections" className="rounded-lg bg-base-200 px-3.5 py-1.5 text-xs font-semibold text-base-content/70 hover:bg-base-300">
        Respond
      </Link>
    );
  }
  return (
    <button
      type="button"
      onClick={() => mutate()}
      disabled={isPending}
      className="rounded-lg bg-primary px-4 py-1.5 text-xs font-semibold text-white hover:bg-primary/90 disabled:opacity-50"
    >
      Connect
    </button>
  );
}

export default function PostLikesModal({ postId, open, onClose }) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  const { data, isLoading, fetchNextPage, hasNextPage, isFetchingNextPage } = useInfiniteQuery({
    queryKey: ["postLikers", postId],
    enabled: open && Boolean(postId),
    initialPageParam: 1,
    queryFn: async ({ pageParam }) => {
      const res = await axiosInstance.get(`/posts/${postId}/likers`, { params: { page: pageParam } });
      return res.data?.data;
    },
    getNextPageParam: (last) =>
      last?.pagination && last.pagination.page < last.pagination.totalPages ? last.pagination.page + 1 : undefined,
  });

  if (!open) return null;

  const likers = (data?.pages || []).flatMap((p) => p?.likers || []);
  const total = data?.pages?.[0]?.pagination?.total ?? likers.length;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={onClose}>
      <div
        className="flex max-h-[80vh] w-full max-w-md flex-col overflow-hidden rounded-2xl bg-base-100 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="relative flex items-center justify-center border-b border-base-200 px-4 py-3">
          <h3 className="text-sm font-bold text-base-content">
            Likes{total ? <span className="ml-1 font-normal text-base-content/50">{total.toLocaleString("en-IN")}</span> : null}
          </h3>
          <button onClick={onClose} className="absolute right-3 rounded-lg p-1 text-base-content/50 hover:bg-base-200" aria-label="Close">
            <X className="size-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto">
          {isLoading ? (
            <div className="grid place-items-center py-16 text-base-content/40">
              <Loader2 className="size-6 animate-spin" />
            </div>
          ) : likers.length === 0 ? (
            <p className="py-16 text-center text-sm text-base-content/50">No likes yet.</p>
          ) : (
            <ul className="divide-y divide-base-100">
              {likers.map((u) => (
                <li key={u.id} className="flex items-center gap-3 px-4 py-2.5">
                  <Link to={`/users/${u.id}`} onClick={onClose} className="flex min-w-0 flex-1 items-center gap-3">
                    <UserAvatar src={u.avatar} name={u.fullName} sizeClass="size-11" />
                    <div className="min-w-0">
                      <p className="flex items-center gap-1 truncate text-sm font-semibold text-base-content">
                        <span className="truncate">{u.fullName}</span>
                        {u.isVerified && <BadgeCheck className="size-3.5 shrink-0 text-primary" />}
                      </p>
                      {u.city && <p className="truncate text-xs text-base-content/50">{u.city}</p>}
                    </div>
                  </Link>
                  <ConnectButton liker={u} />
                </li>
              ))}
            </ul>
          )}

          {hasNextPage && (
            <button
              type="button"
              onClick={() => fetchNextPage()}
              disabled={isFetchingNextPage}
              className="w-full py-3 text-sm font-semibold text-primary hover:bg-base-200 disabled:opacity-50"
            >
              {isFetchingNextPage ? "Loading…" : "Show more"}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
