import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { Link } from "react-router";
import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ChevronLeft,
  ChevronRight,
  Eye,
  Flag,
  Image as ImageIcon,
  Loader2,
  Megaphone,
  MoreVertical,
  Search,
  ShieldAlert,
  ShieldCheck,
  ShieldOff,
  User as UserIcon,
  Users,
  X,
} from "lucide-react";
import toast from "react-hot-toast";
import AppShell from "../components/AppShell";
import UserAvatar from "../components/UserAvatar";
import axiosInstance from "../lib/axios";

const ROLE_OPTIONS = ["Buyer", "Seller", "Tenant", "Landlord", "Broker", "Builder"];

const BLOCK_REASON_OPTIONS = [
  { code: "SPAM", label: "Spam / misleading content" },
  { code: "INAPPROPRIATE_CONTENT", label: "Inappropriate content" },
  { code: "FRAUD", label: "Fraud / scam" },
  { code: "DUPLICATE", label: "Duplicate listing" },
  { code: "INCORRECT_INFORMATION", label: "Incorrect property information" },
  { code: "POLICY_VIOLATION", label: "Policy violation" },
  { code: "OTHER", label: "Other" },
];

const REPORT_REASON_LABELS = {
  SPAM: "Spam",
  FALSE_INFORMATION: "False information",
  INAPPROPRIATE_CONTENT: "Inappropriate content",
  RESTRICTED_ITEM: "Restricted item",
  HARASSMENT: "Harassment",
  INTELLECTUAL_PROPERTY: "Intellectual property",
  DUPLICATE_LISTING: "Duplicate / misleading listing",
  OTHER: "Other",
};

function getReportReasonLabel(code) {
  return REPORT_REASON_LABELS[code] || code || "Unknown";
}

function formatDate(dateString) {
  if (!dateString) return "—";
  const date = new Date(dateString);
  if (Number.isNaN(date.getTime())) return "—";
  const datePart = date.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
  const timePart = date.toLocaleTimeString("en-IN", { hour: "numeric", minute: "2-digit", hour12: true });
  return `${datePart}, ${timePart}`;
}

function formatMoney(amount) {
  const value = Number(amount || 0);
  return `₹${value.toLocaleString("en-IN")}`;
}

function ConfirmBlockModal({ user, isPending, onCancel, onConfirm }) {
  if (!user) return null;
  const isBlocking = !user.isBlocked;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={onCancel}>
      <div
        className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className={`mx-auto grid size-12 place-items-center rounded-full ${isBlocking ? "bg-red-50 text-red-600" : "bg-emerald-50 text-emerald-600"}`}>
          {isBlocking ? <ShieldOff className="size-6" /> : <ShieldCheck className="size-6" />}
        </div>
        <h3 className="mt-4 text-center text-lg font-semibold text-slate-800">
          {isBlocking ? "Block this user?" : "Unblock this user?"}
        </h3>
        <p className="mt-1.5 text-center text-sm text-slate-500">
          {isBlocking
            ? `${user.fullName || "This user"} will no longer be able to log in or use the platform.`
            : `${user.fullName || "This user"} will regain access to the platform.`}
        </p>

        <div className="mt-6 flex gap-3">
          <button
            type="button"
            onClick={onCancel}
            className="flex-1 rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={isPending}
            className={`flex-1 rounded-xl px-4 py-2.5 text-sm font-semibold text-white transition-colors disabled:opacity-60 ${
              isBlocking ? "bg-red-600 hover:bg-red-500" : "bg-emerald-600 hover:bg-emerald-500"
            }`}
          >
            {isPending ? <Loader2 className="mx-auto size-4 animate-spin" /> : isBlocking ? "Block" : "Unblock"}
          </button>
        </div>
      </div>
    </div>
  );
}

function BlockPostModal({ post, isPending, onCancel, onConfirm }) {
  const [reasonCode, setReasonCode] = useState("");
  const [note, setNote] = useState("");

  useEffect(() => {
    if (post) {
      setReasonCode("");
      setNote("");
    }
  }, [post]);

  if (!post) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={onCancel}>
      <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl" onClick={(e) => e.stopPropagation()}>
        <div className="mx-auto grid size-12 place-items-center rounded-full bg-red-50 text-red-600">
          <ShieldOff className="size-6" />
        </div>
        <h3 className="mt-4 text-center text-lg font-semibold text-slate-800">Block this post?</h3>
        <p className="mt-1.5 text-center text-sm text-slate-500">
          It will no longer be visible on the marketplace. The owner keeps seeing it on their own profile, badged as blocked.
        </p>

        <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50 p-3">
          <p className="truncate text-sm font-semibold text-slate-800">{post.title || "Untitled listing"}</p>
          <p className="text-xs text-slate-500">Posted by {post.author?.fullName || "Unknown"}</p>
        </div>

        <div className="mt-4">
          <label className="mb-1.5 block text-sm font-medium text-slate-700">Reason for blocking *</label>
          <div className="space-y-1.5">
            {BLOCK_REASON_OPTIONS.map((option) => (
              <label
                key={option.code}
                className={`flex cursor-pointer items-center gap-2 rounded-lg border px-3 py-2 text-sm transition-colors ${
                  reasonCode === option.code ? "border-red-300 bg-red-50 text-red-700" : "border-slate-200 text-slate-600 hover:bg-slate-50"
                }`}
              >
                <input
                  type="radio"
                  name="blockReason"
                  value={option.code}
                  checked={reasonCode === option.code}
                  onChange={() => setReasonCode(option.code)}
                  className="radio radio-sm"
                />
                {option.label}
              </label>
            ))}
          </div>
        </div>

        <div className="mt-4">
          <label className="mb-1.5 block text-sm font-medium text-slate-700">Additional note</label>
          <textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Explain why this post is being blocked..."
            rows={3}
            className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-indigo-300 focus:ring-2 focus:ring-indigo-100"
          />
        </div>

        <div className="mt-6 flex gap-3">
          <button
            type="button"
            onClick={onCancel}
            className="flex-1 rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={() => onConfirm({ reasonCode, note })}
            disabled={isPending || !reasonCode}
            className="flex-1 rounded-xl bg-red-600 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-red-500 disabled:opacity-60"
          >
            {isPending ? <Loader2 className="mx-auto size-4 animate-spin" /> : "Block Post"}
          </button>
        </div>
      </div>
    </div>
  );
}

function ConfirmUnblockPostModal({ post, isPending, onCancel, onConfirm }) {
  if (!post) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={onCancel}>
      <div className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-xl" onClick={(e) => e.stopPropagation()}>
        <div className="mx-auto grid size-12 place-items-center rounded-full bg-emerald-50 text-emerald-600">
          <ShieldCheck className="size-6" />
        </div>
        <h3 className="mt-4 text-center text-lg font-semibold text-slate-800">Unblock this post?</h3>
        <p className="mt-1.5 text-center text-sm text-slate-500">
          "{post.title || "This post"}" will become visible to users again across the marketplace.
        </p>

        <div className="mt-6 flex gap-3">
          <button
            type="button"
            onClick={onCancel}
            className="flex-1 rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={isPending}
            className="flex-1 rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-emerald-500 disabled:opacity-60"
          >
            {isPending ? <Loader2 className="mx-auto size-4 animate-spin" /> : "Unblock"}
          </button>
        </div>
      </div>
    </div>
  );
}

function UsersPanel() {
  const queryClient = useQueryClient();
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("all");
  const [role, setRole] = useState("");
  const [page, setPage] = useState(1);
  const [pendingBlockId, setPendingBlockId] = useState(null);
  const [confirmTarget, setConfirmTarget] = useState(null);

  useEffect(() => {
    const timer = setTimeout(() => {
      setSearch(searchInput.trim());
      setPage(1);
    }, 350);
    return () => clearTimeout(timer);
  }, [searchInput]);

  useEffect(() => {
    setPage(1);
  }, [status, role]);

  const { data, isLoading, isFetching, isError } = useQuery({
    queryKey: ["adminUsers", page, search, status, role],
    queryFn: async () => {
      const response = await axiosInstance.get("/admin/users", {
        params: { page, limit: 20, search: search || undefined, status, role: role || undefined },
      });
      return response.data?.data;
    },
    placeholderData: keepPreviousData,
  });

  const users = data?.users || [];
  const pagination = data?.pagination || { page: 1, totalPages: 1, total: 0 };

  const { mutate: toggleBlock } = useMutation({
    mutationFn: async (userId) => {
      const response = await axiosInstance.post(`/admin/users/${userId}/block`);
      return response.data?.data;
    },
    onMutate: (userId) => setPendingBlockId(userId),
    onSuccess: (result) => {
      toast.success(result?.isBlocked ? "User blocked" : "User unblocked");
      queryClient.invalidateQueries({ queryKey: ["adminUsers"] });
      setConfirmTarget(null);
    },
    onError: (error) => {
      toast.error(error?.response?.data?.message || "Failed to update user");
    },
    onSettled: () => setPendingBlockId(null),
  });

  const handleConfirmToggleBlock = () => {
    if (!confirmTarget) return;
    toggleBlock(confirmTarget._id);
  };

  return (
    <div className="rounded-2xl border border-slate-200 bg-white shadow-sm">
      <div className="flex flex-col gap-3 border-b border-slate-200 p-4 sm:flex-row sm:items-center sm:justify-between sm:p-5">
        <div className="flex items-center gap-2">
          <div className="grid size-9 place-items-center rounded-xl bg-indigo-100 text-indigo-600">
            <Users className="size-4" />
          </div>
          <div>
            <h2 className="font-semibold text-slate-800">All users</h2>
            <p className="text-xs text-slate-500">{pagination.total} total</p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              placeholder="Search name, email, phone..."
              className="w-56 rounded-lg border border-slate-200 py-2 pl-9 pr-3 text-sm outline-none focus:border-indigo-300 focus:ring-2 focus:ring-indigo-100"
            />
          </div>

          <select
            value={status}
            onChange={(e) => setStatus(e.target.value)}
            className="rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-indigo-300 focus:ring-2 focus:ring-indigo-100"
          >
            <option value="all">All statuses</option>
            <option value="active">Active</option>
            <option value="blocked">Blocked</option>
          </select>

          <select
            value={role}
            onChange={(e) => setRole(e.target.value)}
            className="rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-indigo-300 focus:ring-2 focus:ring-indigo-100"
          >
            <option value="">All roles</option>
            {ROLE_OPTIONS.map((r) => (
              <option key={r} value={r}>{r}</option>
            ))}
          </select>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full min-w-[720px] text-sm">
          <thead>
            <tr className="border-b border-slate-100 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
              <th className="px-4 py-3 sm:px-5">User</th>
              <th className="px-4 py-3">Email</th>
              <th className="px-4 py-3">Phone</th>
              <th className="px-4 py-3">Location</th>
              <th className="px-4 py-3">Joined</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3 text-right sm:pr-5">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {isLoading ? (
              <tr>
                <td colSpan={7} className="px-5 py-10 text-center text-slate-400">
                  <Loader2 className="mx-auto size-6 animate-spin" />
                </td>
              </tr>
            ) : isError ? (
              <tr>
                <td colSpan={7} className="px-5 py-10 text-center text-sm text-red-500">
                  Failed to load users.
                </td>
              </tr>
            ) : users.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-5 py-10 text-center text-sm text-slate-500">
                  No users match these filters.
                </td>
              </tr>
            ) : (
              users.map((user) => (
                <tr key={user._id} className="hover:bg-slate-50/70">
                  <td className="px-4 py-3 sm:px-5">
                    <div className="flex items-center gap-3">
                      <UserAvatar src={user.profilePic} name={user.fullName} sizeClass="size-9" userId={user._id} />
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold text-slate-800">{user.fullName || "Unknown"}</p>
                        <p className="truncate text-xs text-slate-500">{user.activeRole || user.primaryRole || "—"}</p>
                      </div>
                    </div>
                  </td>
                  <td className="max-w-[200px] truncate px-4 py-3 text-slate-600">{user.email}</td>
                  <td className="px-4 py-3 text-slate-600">{user.mobileNumber || "—"}</td>
                  <td className="max-w-[160px] truncate px-4 py-3 text-slate-600">{user.location || user.city || "—"}</td>
                  <td className="whitespace-nowrap px-4 py-3 text-slate-600">{formatDate(user.createdAt)}</td>
                  <td className="px-4 py-3">
                    {user.isBlocked ? (
                      <span className="inline-flex items-center rounded-full bg-red-50 px-2.5 py-1 text-xs font-semibold text-red-600">Blocked</span>
                    ) : (
                      <span className="inline-flex items-center rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-600">Active</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-right sm:pr-5">
                    <button
                      type="button"
                      onClick={() => setConfirmTarget(user)}
                      disabled={pendingBlockId === user._id}
                      className={`inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-semibold transition-colors disabled:opacity-60 ${
                        user.isBlocked
                          ? "border-emerald-200 text-emerald-600 hover:bg-emerald-50"
                          : "border-red-200 text-red-600 hover:bg-red-50"
                      }`}
                    >
                      {pendingBlockId === user._id ? (
                        <Loader2 className="size-3.5 animate-spin" />
                      ) : user.isBlocked ? (
                        <ShieldCheck className="size-3.5" />
                      ) : (
                        <ShieldOff className="size-3.5" />
                      )}
                      {user.isBlocked ? "Unblock" : "Block"}
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <div className="flex items-center justify-between border-t border-slate-200 px-4 py-3 sm:px-5">
        <p className="text-xs text-slate-500">
          Page {pagination.page} of {pagination.totalPages}
          {isFetching ? " · updating..." : ""}
        </p>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page <= 1}
            className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-50 disabled:opacity-40"
          >
            <ChevronLeft className="size-3.5" /> Prev
          </button>
          <button
            type="button"
            onClick={() => setPage((p) => Math.min(pagination.totalPages, p + 1))}
            disabled={page >= pagination.totalPages}
            className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-50 disabled:opacity-40"
          >
            Next <ChevronRight className="size-3.5" />
          </button>
        </div>
      </div>

      <ConfirmBlockModal
        user={confirmTarget}
        isPending={Boolean(confirmTarget) && pendingBlockId === confirmTarget?._id}
        onCancel={() => setConfirmTarget(null)}
        onConfirm={handleConfirmToggleBlock}
      />
    </div>
  );
}

function PostsPanel() {
  const queryClient = useQueryClient();
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("all");
  const [page, setPage] = useState(1);
  const [menuAnchor, setMenuAnchor] = useState(null); // { post, top, left, openUpward }
  const [blockTarget, setBlockTarget] = useState(null);
  const [unblockTarget, setUnblockTarget] = useState(null);

  // The menu is portaled to <body> (see render below) specifically so it
  // isn't clipped by the table's own overflow-x-auto wrapper — that wrapper
  // implicitly clips the Y axis too, which was cutting the dropdown off for
  // any row near the bottom of the visible table. Since it's `position:
  // fixed` at a viewport coordinate captured on open, it won't track the
  // table/page scrolling on its own — closing on scroll/resize is simpler
  // and less surprising than trying to keep it glued to a button that moved.
  useEffect(() => {
    if (!menuAnchor) return;
    const close = () => setMenuAnchor(null);
    window.addEventListener("scroll", close, true);
    window.addEventListener("resize", close);
    return () => {
      window.removeEventListener("scroll", close, true);
      window.removeEventListener("resize", close);
    };
  }, [menuAnchor]);

  const toggleMenu = (post, event) => {
    if (menuAnchor?.post._id === post._id) {
      setMenuAnchor(null);
      return;
    }
    const rect = event.currentTarget.getBoundingClientRect();
    const menuWidth = 176; // w-44
    const estimatedMenuHeight = 190;
    const openUpward = rect.bottom + estimatedMenuHeight > window.innerHeight;
    setMenuAnchor({
      post,
      left: Math.max(8, rect.right - menuWidth),
      top: openUpward ? Math.max(8, rect.top - estimatedMenuHeight - 4) : rect.bottom + 4,
    });
  };

  useEffect(() => {
    const timer = setTimeout(() => {
      setSearch(searchInput.trim());
      setPage(1);
    }, 350);
    return () => clearTimeout(timer);
  }, [searchInput]);

  useEffect(() => {
    setPage(1);
  }, [status]);

  const { data, isLoading, isFetching, isError } = useQuery({
    queryKey: ["adminPosts", page, search, status],
    queryFn: async () => {
      const response = await axiosInstance.get("/admin/posts", {
        params: { page, limit: 20, search: search || undefined, status },
      });
      return response.data?.data;
    },
    placeholderData: keepPreviousData,
  });

  const posts = data?.posts || [];
  const pagination = data?.pagination || { page: 1, totalPages: 1, total: 0 };

  const { mutate: blockPostMutate, isPending: isBlocking } = useMutation({
    mutationFn: async ({ postId, reasonCode, note }) => {
      const response = await axiosInstance.post(`/admin/posts/${postId}/block`, { reasonCode, note });
      return response.data?.data;
    },
    onSuccess: () => {
      toast.success("Post blocked");
      queryClient.invalidateQueries({ queryKey: ["adminPosts"] });
      setBlockTarget(null);
    },
    onError: (error) => {
      toast.error(error?.response?.data?.message || "Failed to block post");
    },
  });

  const { mutate: unblockPostMutate, isPending: isUnblocking } = useMutation({
    mutationFn: async (postId) => {
      const response = await axiosInstance.post(`/admin/posts/${postId}/unblock`);
      return response.data?.data;
    },
    onSuccess: () => {
      toast.success("Post unblocked");
      queryClient.invalidateQueries({ queryKey: ["adminPosts"] });
      setUnblockTarget(null);
    },
    onError: (error) => {
      toast.error(error?.response?.data?.message || "Failed to unblock post");
    },
  });

  return (
    <div className="rounded-2xl border border-slate-200 bg-white shadow-sm">
      <div className="flex flex-col gap-3 border-b border-slate-200 p-4 sm:flex-row sm:items-center sm:justify-between sm:p-5">
        <div className="flex items-center gap-2">
          <div className="grid size-9 place-items-center rounded-xl bg-indigo-100 text-indigo-600">
            <ShieldAlert className="size-4" />
          </div>
          <div>
            <h2 className="font-semibold text-slate-800">Marketplace posts</h2>
            <p className="text-xs text-slate-500">{pagination.total} total</p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              placeholder="Search title, city..."
              className="w-56 rounded-lg border border-slate-200 py-2 pl-9 pr-3 text-sm outline-none focus:border-indigo-300 focus:ring-2 focus:ring-indigo-100"
            />
          </div>

          <select
            value={status}
            onChange={(e) => setStatus(e.target.value)}
            className="rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-indigo-300 focus:ring-2 focus:ring-indigo-100"
          >
            <option value="all">All statuses</option>
            <option value="active">Active</option>
            <option value="blocked">Blocked</option>
          </select>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full min-w-[720px] text-sm">
          <thead>
            <tr className="border-b border-slate-100 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
              <th className="px-4 py-3 sm:px-5">Post</th>
              <th className="px-4 py-3">Owner</th>
              <th className="px-4 py-3">Price</th>
              <th className="px-4 py-3">City</th>
              <th className="px-4 py-3">Posted</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3 text-right sm:pr-5">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {isLoading ? (
              <tr>
                <td colSpan={7} className="px-5 py-10 text-center text-slate-400">
                  <Loader2 className="mx-auto size-6 animate-spin" />
                </td>
              </tr>
            ) : isError ? (
              <tr>
                <td colSpan={7} className="px-5 py-10 text-center text-sm text-red-500">
                  Failed to load posts.
                </td>
              </tr>
            ) : posts.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-5 py-10 text-center text-sm text-slate-500">
                  No posts match these filters.
                </td>
              </tr>
            ) : (
              posts.map((post) => (
                <tr key={post._id} className="hover:bg-slate-50/70">
                  <td className="px-4 py-3 sm:px-5">
                    <div className="flex items-center gap-3">
                      <img
                        src={post.mediaUrls?.[0] || "https://placehold.co/80x80?text=%20"}
                        alt=""
                        className="size-9 shrink-0 rounded-lg object-cover"
                      />
                      <p className="max-w-[220px] truncate text-sm font-semibold text-slate-800">{post.title || "Untitled listing"}</p>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <UserAvatar src={post.author?.profilePic} name={post.author?.fullName} sizeClass="size-7" userId={post.author?._id} />
                      <span className="max-w-[140px] truncate text-slate-600">{post.author?.fullName || "Unknown"}</span>
                    </div>
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 text-slate-600">{formatMoney(post.price)}</td>
                  <td className="max-w-[140px] truncate px-4 py-3 text-slate-600">{post.city || "—"}</td>
                  <td className="whitespace-nowrap px-4 py-3 text-slate-600">{formatDate(post.createdAt)}</td>
                  <td className="px-4 py-3">
                    {post.isBlocked ? (
                      <span className="inline-flex items-center rounded-full bg-red-50 px-2.5 py-1 text-xs font-semibold text-red-600">Blocked</span>
                    ) : (
                      <span className="inline-flex items-center rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-600">Active</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-right sm:pr-5">
                    <button
                      type="button"
                      onClick={(event) => toggleMenu(post, event)}
                      className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100"
                    >
                      <MoreVertical className="size-4" />
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <div className="flex items-center justify-between border-t border-slate-200 px-4 py-3 sm:px-5">
        <p className="text-xs text-slate-500">
          Page {pagination.page} of {pagination.totalPages}
          {isFetching ? " · updating..." : ""}
        </p>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page <= 1}
            className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-50 disabled:opacity-40"
          >
            <ChevronLeft className="size-3.5" /> Prev
          </button>
          <button
            type="button"
            onClick={() => setPage((p) => Math.min(pagination.totalPages, p + 1))}
            disabled={page >= pagination.totalPages}
            className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-50 disabled:opacity-40"
          >
            Next <ChevronRight className="size-3.5" />
          </button>
        </div>
      </div>

      {menuAnchor &&
        createPortal(
          <>
            <div className="fixed inset-0 z-40" onClick={() => setMenuAnchor(null)} />
            <div
              className="fixed z-50 w-44 rounded-xl border border-slate-200 bg-white py-1 shadow-lg"
              style={{ top: menuAnchor.top, left: menuAnchor.left }}
            >
              <Link
                to={`/property/${menuAnchor.post._id}`}
                onClick={() => setMenuAnchor(null)}
                className="flex items-center gap-2 px-4 py-2 text-left text-sm text-slate-700 hover:bg-slate-50"
              >
                <Eye className="size-4 text-slate-500" />
                View Post
              </Link>
              {menuAnchor.post.author?._id && (
                <Link
                  to={`/users/${menuAnchor.post.author._id}`}
                  onClick={() => setMenuAnchor(null)}
                  className="flex items-center gap-2 px-4 py-2 text-left text-sm text-slate-700 hover:bg-slate-50"
                >
                  <UserIcon className="size-4 text-slate-500" />
                  View User
                </Link>
              )}
              <div className="my-1 border-t border-slate-100" />
              {menuAnchor.post.isBlocked ? (
                <button
                  type="button"
                  onClick={() => {
                    setUnblockTarget(menuAnchor.post);
                    setMenuAnchor(null);
                  }}
                  className="flex w-full items-center gap-2 px-4 py-2 text-left text-sm text-emerald-600 hover:bg-emerald-50"
                >
                  <ShieldCheck className="size-4" />
                  Unblock Post
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => {
                    setBlockTarget(menuAnchor.post);
                    setMenuAnchor(null);
                  }}
                  className="flex w-full items-center gap-2 px-4 py-2 text-left text-sm text-red-600 hover:bg-red-50"
                >
                  <ShieldOff className="size-4" />
                  Block Post
                </button>
              )}
            </div>
          </>,
          document.body
        )}

      <BlockPostModal
        post={blockTarget}
        isPending={isBlocking}
        onCancel={() => setBlockTarget(null)}
        onConfirm={({ reasonCode, note }) => blockPostMutate({ postId: blockTarget._id, reasonCode, note })}
      />
      <ConfirmUnblockPostModal
        post={unblockTarget}
        isPending={isUnblocking}
        onCancel={() => setUnblockTarget(null)}
        onConfirm={() => unblockPostMutate(unblockTarget._id)}
      />
    </div>
  );
}

function ReportDetailModal({ postId, onClose, onBlockPost, onUnblockPost, onDismiss, isDismissing }) {
  const { data, isLoading } = useQuery({
    queryKey: ["adminReportDetail", postId],
    queryFn: async () => {
      const response = await axiosInstance.get(`/admin/reports/${postId}`);
      return response.data?.data;
    },
    enabled: Boolean(postId),
  });

  if (!postId) return null;

  const post = data?.post;
  const reports = data?.reports || [];
  const pendingReports = reports.filter((report) => report.status === "PENDING");

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={onClose}>
      <div
        className="flex max-h-[85vh] w-full max-w-lg flex-col rounded-2xl bg-white shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-slate-200 p-4">
          <h3 className="font-semibold text-slate-800">Reported post</h3>
          <button type="button" onClick={onClose} className="rounded-lg p-1 text-slate-500 hover:bg-slate-100">
            <X className="size-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4">
          {isLoading ? (
            <div className="py-10 text-center">
              <Loader2 className="mx-auto size-6 animate-spin text-slate-400" />
            </div>
          ) : !post ? (
            <p className="py-10 text-center text-sm text-slate-500">Post not found.</p>
          ) : (
            <>
              <div className="flex items-center gap-3 rounded-xl border border-slate-200 bg-slate-50 p-3">
                <img
                  src={post.mediaUrls?.[0] || "https://placehold.co/80x80?text=%20"}
                  alt=""
                  className="size-12 shrink-0 rounded-lg object-cover"
                />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-slate-800">{post.title || "Untitled listing"}</p>
                  <p className="text-xs text-slate-500">
                    Posted by {post.author?.fullName || "Unknown"} · {formatMoney(post.price)}
                  </p>
                </div>
                {post.isBlocked ? (
                  <span className="shrink-0 rounded-full bg-red-50 px-2.5 py-1 text-xs font-semibold text-red-600">Blocked</span>
                ) : (
                  <span className="shrink-0 rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-600">Active</span>
                )}
              </div>

              <p className="mb-2 mt-4 text-xs font-semibold uppercase tracking-wide text-slate-400">
                {reports.length} report{reports.length === 1 ? "" : "s"}
              </p>
              <div className="space-y-2">
                {reports.map((report) => (
                  <div key={report._id} className="rounded-xl border border-slate-200 p-3">
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <UserAvatar src={report.reporter?.profilePic} name={report.reporter?.fullName} sizeClass="size-6" userId={report.reporter?._id} />
                        <span className="text-sm font-medium text-slate-800">{report.reporter?.fullName || "Unknown"}</span>
                      </div>
                      <span className="text-xs text-slate-400">{formatDate(report.createdAt)}</span>
                    </div>
                    <p className="mt-1.5 text-xs font-semibold text-red-600">{getReportReasonLabel(report.reasonCode)}</p>
                    {report.description && <p className="mt-1 text-xs text-slate-600">{report.description}</p>}
                    {report.status !== "PENDING" && (
                      <span className="mt-1.5 inline-flex items-center rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-semibold text-slate-500">
                        {report.status === "DISMISSED" ? "Dismissed" : "Action taken"}
                      </span>
                    )}
                  </div>
                ))}
              </div>
            </>
          )}
        </div>

        {post && (
          <div className="flex gap-3 border-t border-slate-200 p-4">
            {pendingReports.length > 0 && (
              <button
                type="button"
                onClick={() => onDismiss(post._id)}
                disabled={isDismissing}
                className="flex-1 rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-60"
              >
                {isDismissing ? <Loader2 className="mx-auto size-4 animate-spin" /> : "Dismiss Reports"}
              </button>
            )}
            {post.isBlocked ? (
              <button
                type="button"
                onClick={() => onUnblockPost(post)}
                className="flex-1 rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-emerald-500"
              >
                Unblock Post
              </button>
            ) : (
              <button
                type="button"
                onClick={() => onBlockPost(post)}
                className="flex-1 rounded-xl bg-red-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-red-500"
              >
                Block Post
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function ReportsPanel() {
  const queryClient = useQueryClient();
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("pending");
  const [page, setPage] = useState(1);
  const [selectedPostId, setSelectedPostId] = useState(null);
  const [blockTarget, setBlockTarget] = useState(null);
  const [unblockTarget, setUnblockTarget] = useState(null);

  useEffect(() => {
    const timer = setTimeout(() => {
      setSearch(searchInput.trim());
      setPage(1);
    }, 350);
    return () => clearTimeout(timer);
  }, [searchInput]);

  useEffect(() => {
    setPage(1);
  }, [status]);

  const { data, isLoading, isFetching, isError } = useQuery({
    queryKey: ["adminReports", page, search, status],
    queryFn: async () => {
      const response = await axiosInstance.get("/admin/reports", {
        params: { page, limit: 20, search: search || undefined, status },
      });
      return response.data?.data;
    },
    placeholderData: keepPreviousData,
  });

  const reports = data?.reports || [];
  const pagination = data?.pagination || { page: 1, totalPages: 1, total: 0 };

  const invalidateReports = () => {
    queryClient.invalidateQueries({ queryKey: ["adminReports"] });
    queryClient.invalidateQueries({ queryKey: ["adminReportDetail"] });
  };

  const { mutate: dismissReports, isPending: isDismissing } = useMutation({
    mutationFn: async (postId) => {
      const response = await axiosInstance.post(`/admin/reports/${postId}/dismiss`);
      return response.data?.data;
    },
    onSuccess: () => {
      toast.success("Reports dismissed");
      invalidateReports();
      setSelectedPostId(null);
    },
    onError: (error) => {
      toast.error(error?.response?.data?.message || "Failed to dismiss reports");
    },
  });

  const { mutate: blockPostMutate, isPending: isBlocking } = useMutation({
    mutationFn: async ({ postId, reasonCode, note }) => {
      const response = await axiosInstance.post(`/admin/posts/${postId}/block`, { reasonCode, note });
      return response.data?.data;
    },
    onSuccess: () => {
      toast.success("Post blocked");
      invalidateReports();
      setBlockTarget(null);
      setSelectedPostId(null);
    },
    onError: (error) => {
      toast.error(error?.response?.data?.message || "Failed to block post");
    },
  });

  const { mutate: unblockPostMutate, isPending: isUnblocking } = useMutation({
    mutationFn: async (postId) => {
      const response = await axiosInstance.post(`/admin/posts/${postId}/unblock`);
      return response.data?.data;
    },
    onSuccess: () => {
      toast.success("Post unblocked");
      invalidateReports();
      setUnblockTarget(null);
      setSelectedPostId(null);
    },
    onError: (error) => {
      toast.error(error?.response?.data?.message || "Failed to unblock post");
    },
  });

  return (
    <div className="rounded-2xl border border-slate-200 bg-white shadow-sm">
      <div className="flex flex-col gap-3 border-b border-slate-200 p-4 sm:flex-row sm:items-center sm:justify-between sm:p-5">
        <div className="flex items-center gap-2">
          <div className="grid size-9 place-items-center rounded-xl bg-indigo-100 text-indigo-600">
            <Flag className="size-4" />
          </div>
          <div>
            <h2 className="font-semibold text-slate-800">Reported posts</h2>
            <p className="text-xs text-slate-500">{pagination.total} total</p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              placeholder="Search post title..."
              className="w-56 rounded-lg border border-slate-200 py-2 pl-9 pr-3 text-sm outline-none focus:border-indigo-300 focus:ring-2 focus:ring-indigo-100"
            />
          </div>

          <select
            value={status}
            onChange={(e) => setStatus(e.target.value)}
            className="rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-indigo-300 focus:ring-2 focus:ring-indigo-100"
          >
            <option value="pending">Pending</option>
            <option value="reviewed">Reviewed</option>
            <option value="all">All</option>
          </select>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full min-w-[720px] text-sm">
          <thead>
            <tr className="border-b border-slate-100 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
              <th className="px-4 py-3 sm:px-5">Post</th>
              <th className="px-4 py-3">Reports</th>
              <th className="px-4 py-3">Top reason</th>
              <th className="px-4 py-3">Latest report</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3 text-right sm:pr-5">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {isLoading ? (
              <tr>
                <td colSpan={6} className="px-5 py-10 text-center text-slate-400">
                  <Loader2 className="mx-auto size-6 animate-spin" />
                </td>
              </tr>
            ) : isError ? (
              <tr>
                <td colSpan={6} className="px-5 py-10 text-center text-sm text-red-500">
                  Failed to load reports.
                </td>
              </tr>
            ) : reports.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-5 py-10 text-center text-sm text-slate-500">
                  No reports match these filters.
                </td>
              </tr>
            ) : (
              reports.map((entry) => (
                <tr key={entry.postId} className="hover:bg-slate-50/70">
                  <td className="px-4 py-3 sm:px-5">
                    <div className="flex items-center gap-3">
                      <img
                        src={entry.post?.mediaUrls?.[0] || "https://placehold.co/80x80?text=%20"}
                        alt=""
                        className="size-9 shrink-0 rounded-lg object-cover"
                      />
                      <p className="max-w-[220px] truncate text-sm font-semibold text-slate-800">{entry.post?.title || "Untitled listing"}</p>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-slate-600">
                    {entry.reportCount} {entry.pendingCount > 0 && <span className="text-xs text-red-500">({entry.pendingCount} pending)</span>}
                  </td>
                  <td className="px-4 py-3 text-slate-600">{getReportReasonLabel(entry.topReason)}</td>
                  <td className="whitespace-nowrap px-4 py-3 text-slate-600">{formatDate(entry.latestReportAt)}</td>
                  <td className="px-4 py-3">
                    {entry.post?.isBlocked ? (
                      <span className="inline-flex items-center rounded-full bg-red-50 px-2.5 py-1 text-xs font-semibold text-red-600">Blocked</span>
                    ) : (
                      <span className="inline-flex items-center rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-600">Active</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-right sm:pr-5">
                    <button
                      type="button"
                      onClick={() => setSelectedPostId(entry.postId)}
                      className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                    >
                      <Eye className="size-3.5" />
                      Review
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <div className="flex items-center justify-between border-t border-slate-200 px-4 py-3 sm:px-5">
        <p className="text-xs text-slate-500">
          Page {pagination.page} of {pagination.totalPages}
          {isFetching ? " · updating..." : ""}
        </p>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page <= 1}
            className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-50 disabled:opacity-40"
          >
            <ChevronLeft className="size-3.5" /> Prev
          </button>
          <button
            type="button"
            onClick={() => setPage((p) => Math.min(pagination.totalPages, p + 1))}
            disabled={page >= pagination.totalPages}
            className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-50 disabled:opacity-40"
          >
            Next <ChevronRight className="size-3.5" />
          </button>
        </div>
      </div>

      {selectedPostId && (
        <ReportDetailModal
          postId={selectedPostId}
          onClose={() => setSelectedPostId(null)}
          onBlockPost={(post) => setBlockTarget(post)}
          onUnblockPost={(post) => setUnblockTarget(post)}
          onDismiss={(postId) => dismissReports(postId)}
          isDismissing={isDismissing}
        />
      )}

      <BlockPostModal
        post={blockTarget}
        isPending={isBlocking}
        onCancel={() => setBlockTarget(null)}
        onConfirm={({ reasonCode, note }) => blockPostMutate({ postId: blockTarget._id, reasonCode, note })}
      />
      <ConfirmUnblockPostModal
        post={unblockTarget}
        isPending={isUnblocking}
        onCancel={() => setUnblockTarget(null)}
        onConfirm={() => unblockPostMutate(unblockTarget._id)}
      />
    </div>
  );
}

function AnnouncementsPanel() {
  const queryClient = useQueryClient();
  const [message, setMessage] = useState("");
  const [role, setRole] = useState("");
  const [city, setCity] = useState("");
  const [verifiedOnly, setVerifiedOnly] = useState(false);
  const [imageUrl, setImageUrl] = useState("");
  const [page, setPage] = useState(1);

  const { mutate: uploadImage, isPending: isUploadingImage } = useMutation({
    mutationFn: async (file) => {
      const formData = new FormData();
      formData.append("image", file);
      const response = await axiosInstance.post("/admin/announcements/upload-image", formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      return response.data?.data;
    },
    onSuccess: (result) => setImageUrl(result.url),
    onError: (error) => toast.error(error?.response?.data?.message || "Failed to upload image"),
  });

  const { data, isLoading, isFetching } = useQuery({
    queryKey: ["adminAnnouncements", page],
    queryFn: async () => {
      const response = await axiosInstance.get("/admin/announcements", { params: { page, limit: 20 } });
      return response.data?.data;
    },
    placeholderData: keepPreviousData,
  });

  const announcements = data?.announcements || [];
  const pagination = data?.pagination || { page: 1, totalPages: 1, total: 0 };

  const { mutate: sendAnnouncement, isPending: isSending } = useMutation({
    mutationFn: async () => {
      const response = await axiosInstance.post("/admin/announcements", {
        message: message.trim(),
        role: role || undefined,
        city: city.trim() || undefined,
        verifiedOnly,
        image: imageUrl || undefined,
      });
      return response.data?.data;
    },
    onSuccess: (result) => {
      toast.success(`Sent to ${result.announcement.recipientCount} users`);
      setMessage("");
      setRole("");
      setCity("");
      setVerifiedOnly(false);
      setImageUrl("");
      setPage(1);
      queryClient.invalidateQueries({ queryKey: ["adminAnnouncements"] });
    },
    onError: (error) => {
      toast.error(error?.response?.data?.message || "Failed to send announcement");
    },
  });

  const segmentLabel = (announcement) => {
    const parts = [];
    if (announcement.segment?.verifiedOnly) parts.push("Verified");
    if (announcement.segment?.role) parts.push(announcement.segment.role);
    if (announcement.segment?.city) parts.push(announcement.segment.city);
    return parts.length ? parts.join(" · ") : "All users";
  };

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
        <div className="mb-4 flex items-center gap-2">
          <div className="grid size-9 place-items-center rounded-xl bg-indigo-100 text-indigo-600">
            <Megaphone className="size-4" />
          </div>
          <div>
            <h2 className="font-semibold text-slate-800">New announcement</h2>
            <p className="text-xs text-slate-500">Pushes instantly as a must-dismiss notice to matching users.</p>
          </div>
        </div>

        <textarea
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          maxLength={240}
          rows={3}
          placeholder="e.g. We're rolling out a new verification badge for brokers this week."
          className="w-full rounded-xl border border-slate-200 px-3.5 py-2.5 text-sm text-slate-800 placeholder:text-slate-400 focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-100"
        />
        <p className="mt-1 text-right text-xs text-slate-400">{message.length}/240</p>

        <div className="mt-3">
          {imageUrl ? (
            <div className="relative inline-block">
              <img src={imageUrl} alt="Announcement" className="h-28 w-auto rounded-xl border border-slate-200 object-cover" />
              <button
                type="button"
                onClick={() => setImageUrl("")}
                className="absolute -right-2 -top-2 grid size-6 place-items-center rounded-full bg-slate-900 text-white shadow-sm hover:bg-slate-700"
                title="Remove image"
              >
                <X className="size-3.5" />
              </button>
            </div>
          ) : (
            <label className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg border border-dashed border-slate-300 px-3.5 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50">
              {isUploadingImage ? <Loader2 className="size-4 animate-spin" /> : <ImageIcon className="size-4" />}
              {isUploadingImage ? "Uploading..." : "Add image (optional)"}
              <input
                type="file"
                accept="image/png,image/jpeg,image/webp"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) uploadImage(file);
                  e.target.value = "";
                }}
                disabled={isUploadingImage}
                className="hidden"
              />
            </label>
          )}
        </div>

        <div className="mt-3 flex flex-col gap-3 sm:flex-row sm:items-center">
          <select
            value={role}
            onChange={(e) => setRole(e.target.value)}
            disabled={verifiedOnly}
            className="rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-700 disabled:opacity-50"
          >
            <option value="">Any role</option>
            {ROLE_OPTIONS.map((r) => (
              <option key={r} value={r}>{r}</option>
            ))}
          </select>

          <input
            type="text"
            value={city}
            onChange={(e) => setCity(e.target.value)}
            placeholder="Any city"
            className="rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-700 placeholder:text-slate-400"
          />

          <label className="inline-flex items-center gap-2 text-sm text-slate-700">
            <input
              type="checkbox"
              checked={verifiedOnly}
              onChange={(e) => {
                setVerifiedOnly(e.target.checked);
                if (e.target.checked) setRole("");
              }}
              className="size-4 rounded border-slate-300"
            />
            Verified brokers/sellers/landlords only
          </label>

          <button
            type="button"
            onClick={() => sendAnnouncement()}
            disabled={isSending || isUploadingImage || !message.trim()}
            className="inline-flex items-center gap-1.5 rounded-xl bg-indigo-600 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-indigo-500 disabled:opacity-50 sm:ml-auto"
          >
            {isSending ? <Loader2 className="size-4 animate-spin" /> : <Megaphone className="size-4" />}
            Send
          </button>
        </div>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-200 p-4 sm:p-5">
          <h2 className="font-semibold text-slate-800">History</h2>
          <p className="text-xs text-slate-500">{pagination.total} sent</p>
        </div>

        <div className="divide-y divide-slate-100">
          {isLoading ? (
            <div className="p-8 text-center text-sm text-slate-500">Loading...</div>
          ) : announcements.length === 0 ? (
            <div className="p-8 text-center text-sm text-slate-500">No announcements sent yet</div>
          ) : (
            announcements.map((a) => (
              <div key={a._id} className="flex items-start gap-3 px-4 py-3 sm:px-5">
                {a.image && (
                  <img src={a.image} alt="" className="size-12 shrink-0 rounded-lg border border-slate-200 object-cover" />
                )}
                <div className="min-w-0 flex-1">
                  <p className="text-sm text-slate-800">{a.message}</p>
                  <p className="text-xs text-slate-500">
                    {segmentLabel(a)} · {a.recipientCount} recipients · by {a.sentBy?.fullName || "Admin"} · {formatDate(a.createdAt)}
                  </p>
                </div>
              </div>
            ))
          )}
        </div>

        <div className="flex items-center justify-between border-t border-slate-200 px-4 py-3 sm:px-5">
          <p className="text-xs text-slate-500">
            Page {pagination.page} of {pagination.totalPages}
            {isFetching ? " · updating..." : ""}
          </p>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page <= 1}
              className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-50 disabled:opacity-40"
            >
              <ChevronLeft className="size-3.5" /> Prev
            </button>
            <button
              type="button"
              onClick={() => setPage((p) => Math.min(pagination.totalPages, p + 1))}
              disabled={page >= pagination.totalPages}
              className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-50 disabled:opacity-40"
            >
              Next <ChevronRight className="size-3.5" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function AdminPage() {
  const [activeTab, setActiveTab] = useState("users");

  return (
    <AppShell title="Admin" subtitle="Manage platform users and marketplace posts.">
      <div className="mb-4 flex gap-2">
        <button
          type="button"
          onClick={() => setActiveTab("users")}
          className={`rounded-lg px-4 py-2 text-sm font-semibold transition-colors ${
            activeTab === "users" ? "bg-indigo-600 text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200"
          }`}
        >
          Users
        </button>
        <button
          type="button"
          onClick={() => setActiveTab("posts")}
          className={`rounded-lg px-4 py-2 text-sm font-semibold transition-colors ${
            activeTab === "posts" ? "bg-indigo-600 text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200"
          }`}
        >
          Posts
        </button>
        <button
          type="button"
          onClick={() => setActiveTab("reports")}
          className={`rounded-lg px-4 py-2 text-sm font-semibold transition-colors ${
            activeTab === "reports" ? "bg-indigo-600 text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200"
          }`}
        >
          Reports
        </button>
        <button
          type="button"
          onClick={() => setActiveTab("announcements")}
          className={`rounded-lg px-4 py-2 text-sm font-semibold transition-colors ${
            activeTab === "announcements" ? "bg-indigo-600 text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200"
          }`}
        >
          Announcements
        </button>
      </div>

      {activeTab === "users" ? (
        <UsersPanel />
      ) : activeTab === "posts" ? (
        <PostsPanel />
      ) : activeTab === "reports" ? (
        <ReportsPanel />
      ) : (
        <AnnouncementsPanel />
      )}
    </AppShell>
  );
}
