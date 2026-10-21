import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { Link, Navigate } from "react-router";
import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  AlertTriangle,
  BarChart3,
  Calendar,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Clock,
  Download,
  ExternalLink,
  Eye,
  FileText,
  Flag,
  Handshake,
  Home,
  Image as ImageIcon,
  Info,
  Loader2,
  Lock,
  MapPin,
  Megaphone,
  MessageSquareWarning,
  MoreVertical,
  MousePointerClick,
  Pencil,
  Phone,
  Plus,
  Search,
  ShieldAlert,
  ShieldCheck,
  ShieldOff,
  Sliders,
  Sparkles,
  ToggleLeft,
  ToggleRight,
  Trash2,
  User as UserIcon,
  UserCheck,
  Users,
  X,
} from "lucide-react";
import toast from "react-hot-toast";
import AppShell from "../components/AppShell";
import UserAvatar from "../components/UserAvatar";
import axiosInstance from "../lib/axios";
import { downloadVerificationReportPDF } from "../lib/pdfReportService";

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
        className="w-full max-w-sm rounded-2xl bg-base-100 p-6 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className={`mx-auto grid size-12 place-items-center rounded-full ${isBlocking ? "bg-error/10 text-error" : "bg-success/10 text-success"}`}>
          {isBlocking ? <ShieldOff className="size-6" /> : <ShieldCheck className="size-6" />}
        </div>
        <h3 className="mt-4 text-center text-lg font-semibold text-base-content">
          {isBlocking ? "Block this user?" : "Unblock this user?"}
        </h3>
        <p className="mt-1.5 text-center text-sm text-base-content/60">
          {isBlocking
            ? `${user.fullName || "This user"} will no longer be able to log in or use the platform.`
            : `${user.fullName || "This user"} will regain access to the platform.`}
        </p>

        <div className="mt-6 flex gap-3">
          <button
            type="button"
            onClick={onCancel}
            className="flex-1 rounded-xl border border-base-300 px-4 py-2.5 text-sm font-semibold text-base-content hover:bg-base-200"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={isPending}
            className={`flex-1 rounded-xl px-4 py-2.5 text-sm font-semibold text-white transition-colors disabled:opacity-60 ${
              isBlocking ? "bg-error hover:bg-error" : "bg-success hover:bg-success"
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
      <div className="w-full max-w-md rounded-2xl bg-base-100 p-6 shadow-xl" onClick={(e) => e.stopPropagation()}>
        <div className="mx-auto grid size-12 place-items-center rounded-full bg-error/10 text-error">
          <ShieldOff className="size-6" />
        </div>
        <h3 className="mt-4 text-center text-lg font-semibold text-base-content">Block this post?</h3>
        <p className="mt-1.5 text-center text-sm text-base-content/60">
          It will no longer be visible on the marketplace. The owner keeps seeing it on their own profile, badged as blocked.
        </p>

        <div className="mt-4 rounded-xl border border-base-300 bg-base-200 p-3">
          <p className="truncate text-sm font-semibold text-base-content">{post.title || "Untitled listing"}</p>
          <p className="text-xs text-base-content/60">Posted by {post.author?.fullName || "Unknown"}</p>
        </div>

        <div className="mt-4">
          <label className="mb-1.5 block text-sm font-medium text-base-content">Reason for blocking *</label>
          <div className="space-y-1.5">
            {BLOCK_REASON_OPTIONS.map((option) => (
              <label
                key={option.code}
                className={`flex cursor-pointer items-center gap-2 rounded-lg border px-3 py-2 text-sm transition-colors ${
                  reasonCode === option.code ? "border-error/30 bg-error/10 text-error" : "border-base-300 text-base-content/70 hover:bg-base-200"
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
          <label className="mb-1.5 block text-sm font-medium text-base-content">Additional note</label>
          <textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Explain why this post is being blocked..."
            rows={3}
            className="w-full rounded-lg border border-base-300 px-3 py-2 text-sm outline-none focus:border-primary/30 focus:ring-2 focus:ring-primary/20"
          />
        </div>

        <div className="mt-6 flex gap-3">
          <button
            type="button"
            onClick={onCancel}
            className="flex-1 rounded-xl border border-base-300 px-4 py-2.5 text-sm font-semibold text-base-content hover:bg-base-200"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={() => onConfirm({ reasonCode, note })}
            disabled={isPending || !reasonCode}
            className="flex-1 rounded-xl bg-error px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-error disabled:opacity-60"
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
      <div className="w-full max-w-sm rounded-2xl bg-base-100 p-6 shadow-xl" onClick={(e) => e.stopPropagation()}>
        <div className="mx-auto grid size-12 place-items-center rounded-full bg-success/10 text-success">
          <ShieldCheck className="size-6" />
        </div>
        <h3 className="mt-4 text-center text-lg font-semibold text-base-content">Unblock this post?</h3>
        <p className="mt-1.5 text-center text-sm text-base-content/60">
          "{post.title || "This post"}" will become visible to users again across the marketplace.
        </p>

        <div className="mt-6 flex gap-3">
          <button
            type="button"
            onClick={onCancel}
            className="flex-1 rounded-xl border border-base-300 px-4 py-2.5 text-sm font-semibold text-base-content hover:bg-base-200"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={isPending}
            className="flex-1 rounded-xl bg-success px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-success disabled:opacity-60"
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
  const [coinTarget, setCoinTarget] = useState(null);
  const [coinAmount, setCoinAmount] = useState("");
  const [coinReason, setCoinReason] = useState("");

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

  const { mutate: creditCoins, isPending: isCreditPending } = useMutation({
    mutationFn: async ({ userId, amount, reason }) => {
      const response = await axiosInstance.post(`/admin/users/${userId}/credit-coins`, { amount, reason });
      return response.data?.data;
    },
    onSuccess: (result) => {
      toast.success(`${result.coinsGranted} coins credited! New balance: ${result.newBalance}`);
      setCoinTarget(null);
      setCoinAmount("");
      setCoinReason("");
    },
    onError: (error) => {
      toast.error(error?.response?.data?.message || "Failed to credit coins");
    },
  });

  const handleConfirmToggleBlock = () => {
    if (!confirmTarget) return;
    toggleBlock(confirmTarget._id);
  };

  const handleCreditCoins = () => {
    if (!coinTarget || !coinAmount) return;
    creditCoins({ userId: coinTarget._id, amount: Number(coinAmount), reason: coinReason });
  };

  return (
    <div className="rounded-2xl border border-base-300 bg-base-100 shadow-sm">
      <div className="flex flex-col gap-3 border-b border-base-300 p-4 sm:flex-row sm:items-center sm:justify-between sm:p-5">
        <div className="flex items-center gap-2">
          <div className="grid size-9 place-items-center rounded-xl bg-primary/15 text-primary">
            <Users className="size-4" />
          </div>
          <div>
            <h2 className="font-semibold text-base-content">All users</h2>
            <p className="text-xs text-base-content/60">{pagination.total} total</p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-base-content/50" />
            <input
              type="text"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              placeholder="Search name, email, phone..."
              className="w-56 rounded-lg border border-base-300 py-2 pl-9 pr-3 text-sm outline-none focus:border-primary/30 focus:ring-2 focus:ring-primary/20"
            />
          </div>

          <select
            value={status}
            onChange={(e) => setStatus(e.target.value)}
            className="rounded-lg border border-base-300 px-3 py-2 text-sm outline-none focus:border-primary/30 focus:ring-2 focus:ring-primary/20"
          >
            <option value="all">All statuses</option>
            <option value="active">Active</option>
            <option value="blocked">Blocked</option>
          </select>

          <select
            value={role}
            onChange={(e) => setRole(e.target.value)}
            className="rounded-lg border border-base-300 px-3 py-2 text-sm outline-none focus:border-primary/30 focus:ring-2 focus:ring-primary/20"
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
            <tr className="border-b border-base-200 text-left text-xs font-semibold uppercase tracking-wide text-base-content/60">
              <th className="px-4 py-3 sm:px-5">User</th>
              <th className="px-4 py-3">Email</th>
              <th className="px-4 py-3">Phone</th>
              <th className="px-4 py-3">Location</th>
              <th className="px-4 py-3">Joined</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3 text-right sm:pr-5">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-base-300">
            {isLoading ? (
              <tr>
                <td colSpan={7} className="px-5 py-10 text-center text-base-content/50">
                  <Loader2 className="mx-auto size-6 animate-spin" />
                </td>
              </tr>
            ) : isError ? (
              <tr>
                <td colSpan={7} className="px-5 py-10 text-center text-sm text-error">
                  Failed to load users.
                </td>
              </tr>
            ) : users.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-5 py-10 text-center text-sm text-base-content/60">
                  No users match these filters.
                </td>
              </tr>
            ) : (
              users.map((user) => (
                <tr key={user._id} className="hover:bg-base-200/70">
                  <td className="px-4 py-3 sm:px-5">
                    <div className="flex items-center gap-3">
                      <UserAvatar src={user.profilePic} name={user.fullName} sizeClass="size-9" userId={user._id} />
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold text-base-content">{user.fullName || "Unknown"}</p>
                        <p className="truncate text-xs text-base-content/60">{user.activeRole || user.primaryRole || "—"}</p>
                      </div>
                    </div>
                  </td>
                  <td className="max-w-[200px] truncate px-4 py-3 text-base-content/70">{user.email}</td>
                  <td className="px-4 py-3 text-base-content/70">{user.mobileNumber || "—"}</td>
                  <td className="max-w-[160px] truncate px-4 py-3 text-base-content/70">{user.location || user.city || "—"}</td>
                  <td className="whitespace-nowrap px-4 py-3 text-base-content/70">{formatDate(user.createdAt)}</td>
                  <td className="px-4 py-3">
                    {user.isBlocked ? (
                      <span className="inline-flex items-center rounded-full bg-error/10 px-2.5 py-1 text-xs font-semibold text-error">Blocked</span>
                    ) : (
                      <span className="inline-flex items-center rounded-full bg-success/10 px-2.5 py-1 text-xs font-semibold text-success">Active</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-right sm:pr-5">
                    <div className="flex items-center justify-end gap-2">
                      <button
                        type="button"
                        onClick={() => { setCoinTarget(user); setCoinAmount(""); setCoinReason(""); }}
                        className="inline-flex items-center gap-1.5 rounded-lg border border-amber-400/30 px-3 py-1.5 text-xs font-semibold text-amber-600 transition-colors hover:bg-amber-50 dark:text-amber-400 dark:hover:bg-amber-900/20"
                      >
                        <Sparkles className="size-3.5" />
                        Grant Coins
                      </button>
                      <button
                        type="button"
                        onClick={() => setConfirmTarget(user)}
                        disabled={pendingBlockId === user._id}
                        className={`inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-semibold transition-colors disabled:opacity-60 ${
                          user.isBlocked
                            ? "border-success/30 text-success hover:bg-success/10"
                            : "border-error/30 text-error hover:bg-error/10"
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
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <div className="flex items-center justify-between border-t border-base-300 px-4 py-3 sm:px-5">
        <p className="text-xs text-base-content/60">
          Page {pagination.page} of {pagination.totalPages}
          {isFetching ? " · updating..." : ""}
        </p>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page <= 1}
            className="inline-flex items-center gap-1 rounded-lg border border-base-300 px-2.5 py-1.5 text-xs font-semibold text-base-content/70 hover:bg-base-200 disabled:opacity-40"
          >
            <ChevronLeft className="size-3.5" /> Prev
          </button>
          <button
            type="button"
            onClick={() => setPage((p) => Math.min(pagination.totalPages, p + 1))}
            disabled={page >= pagination.totalPages}
            className="inline-flex items-center gap-1 rounded-lg border border-base-300 px-2.5 py-1.5 text-xs font-semibold text-base-content/70 hover:bg-base-200 disabled:opacity-40"
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

      {coinTarget
        ? createPortal(
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
              <div className="w-full max-w-sm rounded-2xl bg-base-100 p-6 shadow-xl">
                <div className="mx-auto grid size-12 place-items-center rounded-full bg-amber-100 text-amber-600 dark:bg-amber-900/30 dark:text-amber-400">
                  <Sparkles className="size-6" />
                </div>
                <h3 className="mt-4 text-center text-lg font-semibold text-base-content">Grant Coins</h3>
                <p className="mt-1 text-center text-sm text-base-content/60">
                  Credit bonus coins to <span className="font-semibold">{coinTarget.fullName}</span>
                </p>

                <div className="mt-4 space-y-3">
                  <div>
                    <label className="mb-1.5 block text-sm font-medium text-base-content">Amount *</label>
                    <input
                      type="number"
                      min={1}
                      max={10000}
                      value={coinAmount}
                      onChange={(e) => setCoinAmount(e.target.value)}
                      placeholder="e.g. 250"
                      className="w-full rounded-lg border border-base-300 bg-base-100 px-3 py-2 text-sm text-base-content placeholder:text-base-content/40 focus:border-amber-400 focus:outline-none focus:ring-1 focus:ring-amber-400"
                    />
                  </div>
                  <div>
                    <label className="mb-1.5 block text-sm font-medium text-base-content">Reason (optional)</label>
                    <input
                      type="text"
                      value={coinReason}
                      onChange={(e) => setCoinReason(e.target.value)}
                      placeholder="e.g. Promotional bonus, contest winner"
                      maxLength={200}
                      className="w-full rounded-lg border border-base-300 bg-base-100 px-3 py-2 text-sm text-base-content placeholder:text-base-content/40 focus:border-amber-400 focus:outline-none focus:ring-1 focus:ring-amber-400"
                    />
                  </div>
                </div>

                <div className="mt-5 flex gap-2.5">
                  <button
                    type="button"
                    onClick={() => setCoinTarget(null)}
                    className="flex-1 rounded-lg border border-base-300 px-3 py-2 text-sm font-semibold text-base-content transition-colors hover:bg-base-200"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={handleCreditCoins}
                    disabled={!coinAmount || Number(coinAmount) <= 0 || isCreditPending}
                    className="flex-1 rounded-lg bg-amber-500 px-3 py-2 text-sm font-semibold text-white transition-colors hover:bg-amber-600 disabled:opacity-60"
                  >
                    {isCreditPending ? <Loader2 className="mx-auto size-4 animate-spin" /> : `Grant ${coinAmount || 0} Coins`}
                  </button>
                </div>
              </div>
            </div>,
            document.body,
          )
        : null}
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
    <div className="rounded-2xl border border-base-300 bg-base-100 shadow-sm">
      <div className="flex flex-col gap-3 border-b border-base-300 p-4 sm:flex-row sm:items-center sm:justify-between sm:p-5">
        <div className="flex items-center gap-2">
          <div className="grid size-9 place-items-center rounded-xl bg-primary/15 text-primary">
            <ShieldAlert className="size-4" />
          </div>
          <div>
            <h2 className="font-semibold text-base-content">Marketplace posts</h2>
            <p className="text-xs text-base-content/60">{pagination.total} total</p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-base-content/50" />
            <input
              type="text"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              placeholder="Search title, city..."
              className="w-56 rounded-lg border border-base-300 py-2 pl-9 pr-3 text-sm outline-none focus:border-primary/30 focus:ring-2 focus:ring-primary/20"
            />
          </div>

          <select
            value={status}
            onChange={(e) => setStatus(e.target.value)}
            className="rounded-lg border border-base-300 px-3 py-2 text-sm outline-none focus:border-primary/30 focus:ring-2 focus:ring-primary/20"
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
            <tr className="border-b border-base-200 text-left text-xs font-semibold uppercase tracking-wide text-base-content/60">
              <th className="px-4 py-3 sm:px-5">Post</th>
              <th className="px-4 py-3">Owner</th>
              <th className="px-4 py-3">Price</th>
              <th className="px-4 py-3">City</th>
              <th className="px-4 py-3">Posted</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3 text-right sm:pr-5">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-base-300">
            {isLoading ? (
              <tr>
                <td colSpan={7} className="px-5 py-10 text-center text-base-content/50">
                  <Loader2 className="mx-auto size-6 animate-spin" />
                </td>
              </tr>
            ) : isError ? (
              <tr>
                <td colSpan={7} className="px-5 py-10 text-center text-sm text-error">
                  Failed to load posts.
                </td>
              </tr>
            ) : posts.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-5 py-10 text-center text-sm text-base-content/60">
                  No posts match these filters.
                </td>
              </tr>
            ) : (
              posts.map((post) => (
                <tr key={post._id} className="hover:bg-base-200/70">
                  <td className="px-4 py-3 sm:px-5">
                    <div className="flex items-center gap-3">
                      <img
                        src={post.mediaUrls?.[0] || "https://placehold.co/80x80?text=%20"}
                        alt=""
                        className="size-9 shrink-0 rounded-lg object-cover"
                      />
                      <p className="max-w-[220px] truncate text-sm font-semibold text-base-content">{post.title || "Untitled listing"}</p>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <UserAvatar src={post.author?.profilePic} name={post.author?.fullName} sizeClass="size-7" userId={post.author?._id} />
                      <span className="max-w-[140px] truncate text-base-content/70">{post.author?.fullName || "Unknown"}</span>
                    </div>
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 text-base-content/70">{formatMoney(post.price)}</td>
                  <td className="max-w-[140px] truncate px-4 py-3 text-base-content/70">{post.city || "—"}</td>
                  <td className="whitespace-nowrap px-4 py-3 text-base-content/70">{formatDate(post.createdAt)}</td>
                  <td className="px-4 py-3">
                    {post.isBlocked ? (
                      <span className="inline-flex items-center rounded-full bg-error/10 px-2.5 py-1 text-xs font-semibold text-error">Blocked</span>
                    ) : (
                      <span className="inline-flex items-center rounded-full bg-success/10 px-2.5 py-1 text-xs font-semibold text-success">Active</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-right sm:pr-5">
                    <button
                      type="button"
                      onClick={(event) => toggleMenu(post, event)}
                      className="rounded-lg p-1.5 text-base-content/60 hover:bg-base-200"
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

      <div className="flex items-center justify-between border-t border-base-300 px-4 py-3 sm:px-5">
        <p className="text-xs text-base-content/60">
          Page {pagination.page} of {pagination.totalPages}
          {isFetching ? " · updating..." : ""}
        </p>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page <= 1}
            className="inline-flex items-center gap-1 rounded-lg border border-base-300 px-2.5 py-1.5 text-xs font-semibold text-base-content/70 hover:bg-base-200 disabled:opacity-40"
          >
            <ChevronLeft className="size-3.5" /> Prev
          </button>
          <button
            type="button"
            onClick={() => setPage((p) => Math.min(pagination.totalPages, p + 1))}
            disabled={page >= pagination.totalPages}
            className="inline-flex items-center gap-1 rounded-lg border border-base-300 px-2.5 py-1.5 text-xs font-semibold text-base-content/70 hover:bg-base-200 disabled:opacity-40"
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
              className="fixed z-50 w-44 rounded-xl border border-base-300 bg-base-100 py-1 shadow-lg"
              style={{ top: menuAnchor.top, left: menuAnchor.left }}
            >
              <Link
                to={`/property/${menuAnchor.post._id}`}
                onClick={() => setMenuAnchor(null)}
                className="flex items-center gap-2 px-4 py-2 text-left text-sm text-base-content hover:bg-base-200"
              >
                <Eye className="size-4 text-base-content/60" />
                View Post
              </Link>
              {menuAnchor.post.author?._id && (
                <Link
                  to={`/users/${menuAnchor.post.author._id}`}
                  onClick={() => setMenuAnchor(null)}
                  className="flex items-center gap-2 px-4 py-2 text-left text-sm text-base-content hover:bg-base-200"
                >
                  <UserIcon className="size-4 text-base-content/60" />
                  View User
                </Link>
              )}
              <div className="my-1 border-t border-base-200" />
              {menuAnchor.post.isBlocked ? (
                <button
                  type="button"
                  onClick={() => {
                    setUnblockTarget(menuAnchor.post);
                    setMenuAnchor(null);
                  }}
                  className="flex w-full items-center gap-2 px-4 py-2 text-left text-sm text-success hover:bg-success/10"
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
                  className="flex w-full items-center gap-2 px-4 py-2 text-left text-sm text-error hover:bg-error/10"
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
        className="flex max-h-[85vh] w-full max-w-lg flex-col rounded-2xl bg-base-100 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-base-300 p-4">
          <h3 className="font-semibold text-base-content">Reported post</h3>
          <button type="button" onClick={onClose} className="rounded-lg p-1 text-base-content/60 hover:bg-base-200">
            <X className="size-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4">
          {isLoading ? (
            <div className="py-10 text-center">
              <Loader2 className="mx-auto size-6 animate-spin text-base-content/50" />
            </div>
          ) : !post ? (
            <p className="py-10 text-center text-sm text-base-content/60">Post not found.</p>
          ) : (
            <>
              <div className="flex items-center gap-3 rounded-xl border border-base-300 bg-base-200 p-3">
                <img
                  src={post.mediaUrls?.[0] || "https://placehold.co/80x80?text=%20"}
                  alt=""
                  className="size-12 shrink-0 rounded-lg object-cover"
                />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-base-content">{post.title || "Untitled listing"}</p>
                  <p className="text-xs text-base-content/60">
                    Posted by {post.author?.fullName || "Unknown"} · {formatMoney(post.price)}
                  </p>
                </div>
                {post.isBlocked ? (
                  <span className="shrink-0 rounded-full bg-error/10 px-2.5 py-1 text-xs font-semibold text-error">Blocked</span>
                ) : (
                  <span className="shrink-0 rounded-full bg-success/10 px-2.5 py-1 text-xs font-semibold text-success">Active</span>
                )}
              </div>

              <p className="mb-2 mt-4 text-xs font-semibold uppercase tracking-wide text-base-content/50">
                {reports.length} report{reports.length === 1 ? "" : "s"}
              </p>
              <div className="space-y-2">
                {reports.map((report) => (
                  <div key={report._id} className="rounded-xl border border-base-300 p-3">
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <UserAvatar src={report.reporter?.profilePic} name={report.reporter?.fullName} sizeClass="size-6" userId={report.reporter?._id} />
                        <span className="text-sm font-medium text-base-content">{report.reporter?.fullName || "Unknown"}</span>
                      </div>
                      <span className="text-xs text-base-content/50">{formatDate(report.createdAt)}</span>
                    </div>
                    <p className="mt-1.5 text-xs font-semibold text-error">{getReportReasonLabel(report.reasonCode)}</p>
                    {report.description && <p className="mt-1 text-xs text-base-content/70">{report.description}</p>}
                    {report.status !== "PENDING" && (
                      <span className="mt-1.5 inline-flex items-center rounded-full bg-base-200 px-2 py-0.5 text-[11px] font-semibold text-base-content/60">
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
          <div className="flex gap-3 border-t border-base-300 p-4">
            {pendingReports.length > 0 && (
              <button
                type="button"
                onClick={() => onDismiss(post._id)}
                disabled={isDismissing}
                className="flex-1 rounded-xl border border-base-300 px-4 py-2.5 text-sm font-semibold text-base-content hover:bg-base-200 disabled:opacity-60"
              >
                {isDismissing ? <Loader2 className="mx-auto size-4 animate-spin" /> : "Dismiss Reports"}
              </button>
            )}
            {post.isBlocked ? (
              <button
                type="button"
                onClick={() => onUnblockPost(post)}
                className="flex-1 rounded-xl bg-success px-4 py-2.5 text-sm font-semibold text-white hover:bg-success"
              >
                Unblock Post
              </button>
            ) : (
              <button
                type="button"
                onClick={() => onBlockPost(post)}
                className="flex-1 rounded-xl bg-error px-4 py-2.5 text-sm font-semibold text-white hover:bg-error"
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
    <div className="rounded-2xl border border-base-300 bg-base-100 shadow-sm">
      <div className="flex flex-col gap-3 border-b border-base-300 p-4 sm:flex-row sm:items-center sm:justify-between sm:p-5">
        <div className="flex items-center gap-2">
          <div className="grid size-9 place-items-center rounded-xl bg-primary/15 text-primary">
            <Flag className="size-4" />
          </div>
          <div>
            <h2 className="font-semibold text-base-content">Reported posts</h2>
            <p className="text-xs text-base-content/60">{pagination.total} total</p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-base-content/50" />
            <input
              type="text"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              placeholder="Search post title..."
              className="w-56 rounded-lg border border-base-300 py-2 pl-9 pr-3 text-sm outline-none focus:border-primary/30 focus:ring-2 focus:ring-primary/20"
            />
          </div>

          <select
            value={status}
            onChange={(e) => setStatus(e.target.value)}
            className="rounded-lg border border-base-300 px-3 py-2 text-sm outline-none focus:border-primary/30 focus:ring-2 focus:ring-primary/20"
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
            <tr className="border-b border-base-200 text-left text-xs font-semibold uppercase tracking-wide text-base-content/60">
              <th className="px-4 py-3 sm:px-5">Post</th>
              <th className="px-4 py-3">Reports</th>
              <th className="px-4 py-3">Top reason</th>
              <th className="px-4 py-3">Latest report</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3 text-right sm:pr-5">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-base-300">
            {isLoading ? (
              <tr>
                <td colSpan={6} className="px-5 py-10 text-center text-base-content/50">
                  <Loader2 className="mx-auto size-6 animate-spin" />
                </td>
              </tr>
            ) : isError ? (
              <tr>
                <td colSpan={6} className="px-5 py-10 text-center text-sm text-error">
                  Failed to load reports.
                </td>
              </tr>
            ) : reports.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-5 py-10 text-center text-sm text-base-content/60">
                  No reports match these filters.
                </td>
              </tr>
            ) : (
              reports.map((entry) => (
                <tr key={entry.postId} className="hover:bg-base-200/70">
                  <td className="px-4 py-3 sm:px-5">
                    <div className="flex items-center gap-3">
                      <img
                        src={entry.post?.mediaUrls?.[0] || "https://placehold.co/80x80?text=%20"}
                        alt=""
                        className="size-9 shrink-0 rounded-lg object-cover"
                      />
                      <p className="max-w-[220px] truncate text-sm font-semibold text-base-content">{entry.post?.title || "Untitled listing"}</p>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-base-content/70">
                    {entry.reportCount} {entry.pendingCount > 0 && <span className="text-xs text-error">({entry.pendingCount} pending)</span>}
                  </td>
                  <td className="px-4 py-3 text-base-content/70">{getReportReasonLabel(entry.topReason)}</td>
                  <td className="whitespace-nowrap px-4 py-3 text-base-content/70">{formatDate(entry.latestReportAt)}</td>
                  <td className="px-4 py-3">
                    {entry.post?.isBlocked ? (
                      <span className="inline-flex items-center rounded-full bg-error/10 px-2.5 py-1 text-xs font-semibold text-error">Blocked</span>
                    ) : (
                      <span className="inline-flex items-center rounded-full bg-success/10 px-2.5 py-1 text-xs font-semibold text-success">Active</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-right sm:pr-5">
                    <button
                      type="button"
                      onClick={() => setSelectedPostId(entry.postId)}
                      className="inline-flex items-center gap-1.5 rounded-lg border border-base-300 px-3 py-1.5 text-xs font-semibold text-base-content hover:bg-base-200"
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

      <div className="flex items-center justify-between border-t border-base-300 px-4 py-3 sm:px-5">
        <p className="text-xs text-base-content/60">
          Page {pagination.page} of {pagination.totalPages}
          {isFetching ? " · updating..." : ""}
        </p>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page <= 1}
            className="inline-flex items-center gap-1 rounded-lg border border-base-300 px-2.5 py-1.5 text-xs font-semibold text-base-content/70 hover:bg-base-200 disabled:opacity-40"
          >
            <ChevronLeft className="size-3.5" /> Prev
          </button>
          <button
            type="button"
            onClick={() => setPage((p) => Math.min(pagination.totalPages, p + 1))}
            disabled={page >= pagination.totalPages}
            className="inline-flex items-center gap-1 rounded-lg border border-base-300 px-2.5 py-1.5 text-xs font-semibold text-base-content/70 hover:bg-base-200 disabled:opacity-40"
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

function FeedbackPanel() {
  const queryClient = useQueryClient();
  const [status, setStatus] = useState("OPEN");
  const [page, setPage] = useState(1);
  const [preview, setPreview] = useState(null);
  const [selectedFeedback, setSelectedFeedback] = useState(null);

  useEffect(() => {
    setPage(1);
  }, [status]);

  const { data, isLoading, isFetching, isError } = useQuery({
    queryKey: ["adminFeedback", page, status],
    queryFn: async () => {
      const response = await axiosInstance.get("/admin/feedback", {
        params: { page, limit: 20, status },
      });
      return response.data?.data;
    },
    placeholderData: keepPreviousData,
  });

  const items = data?.items || [];
  const pagination = data?.pagination || { page: 1, totalPages: 1, total: 0 };

  const { mutate: resolveFeedback, isPending: isResolving } = useMutation({
    mutationFn: async (id) => {
      const response = await axiosInstance.post(`/admin/feedback/${id}/resolve`);
      return response.data?.data;
    },
    onSuccess: () => {
      toast.success("Marked resolved");
      queryClient.invalidateQueries({ queryKey: ["adminFeedback"] });
    },
    onError: (error) => {
      toast.error(error?.response?.data?.message || "Failed to update feedback");
    },
  });

  return (
    <div className="rounded-2xl border border-base-300 bg-base-100 shadow-sm">
      <div className="flex flex-col gap-3 border-b border-base-300 p-4 sm:flex-row sm:items-center sm:justify-between sm:p-5">
        <div className="flex items-center gap-2">
          <div className="grid size-9 place-items-center rounded-xl bg-primary/15 text-primary">
            <MessageSquareWarning className="size-4" />
          </div>
          <div>
            <h2 className="font-semibold text-base-content">Reported issues</h2>
            <p className="text-xs text-base-content/60">{pagination.total} total</p>
          </div>
        </div>

        <select
          value={status}
          onChange={(e) => setStatus(e.target.value)}
          className="rounded-lg border border-base-300 px-3 py-2 text-sm outline-none focus:border-primary/30 focus:ring-2 focus:ring-primary/20"
        >
          <option value="OPEN">Open</option>
          <option value="RESOLVED">Resolved</option>
          <option value="all">All</option>
        </select>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full min-w-[720px] text-sm">
          <thead>
            <tr className="border-b border-base-200 text-left text-xs font-semibold uppercase tracking-wide text-base-content/60">
              <th className="px-4 py-3 sm:px-5">Reporter</th>
              <th className="px-4 py-3">Message</th>
              <th className="px-4 py-3">Page</th>
              <th className="px-4 py-3">Submitted</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3 text-right sm:pr-5">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-base-300">
            {isLoading ? (
              <tr>
                <td colSpan={6} className="px-5 py-10 text-center text-base-content/50">
                  <Loader2 className="mx-auto size-6 animate-spin" />
                </td>
              </tr>
            ) : isError ? (
              <tr>
                <td colSpan={6} className="px-5 py-10 text-center text-sm text-error">
                  Failed to load feedback.
                </td>
              </tr>
            ) : items.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-5 py-10 text-center text-sm text-base-content/60">
                  No feedback matches these filters.
                </td>
              </tr>
            ) : (
              items.map((item) => (
                <tr key={item._id} className="cursor-pointer hover:bg-base-200/70" onClick={() => setSelectedFeedback(item)}>
                  <td className="px-4 py-3 sm:px-5">
                    <div className="flex items-center gap-2">
                      <UserAvatar src={item.reporter?.profilePic} name={item.reporter?.fullName || "User"} sizeClass="size-7" />
                      <span className="max-w-[140px] truncate text-sm font-medium text-base-content">{item.reporter?.fullName || "Unknown"}</span>
                    </div>
                  </td>
                  <td className="max-w-[280px] px-4 py-3 text-base-content/70">
                    <p className="line-clamp-2">{item.message}</p>
                    {item.screenshotUrl && (
                      <button
                        type="button"
                        onClick={(e) => { e.stopPropagation(); setPreview(item.screenshotUrl); }}
                        className="mt-1 text-xs font-semibold text-primary hover:underline"
                      >
                        View screenshot
                      </button>
                    )}
                  </td>
                  <td className="max-w-[160px] truncate px-4 py-3 text-xs text-base-content/60">{item.page || "—"}</td>
                  <td className="whitespace-nowrap px-4 py-3 text-base-content/70">{formatDate(item.createdAt)}</td>
                  <td className="px-4 py-3">
                    {item.status === "RESOLVED" ? (
                      <span className="inline-flex items-center rounded-full bg-success/10 px-2.5 py-1 text-xs font-semibold text-success">Resolved</span>
                    ) : (
                      <span className="inline-flex items-center rounded-full bg-warning/10 px-2.5 py-1 text-xs font-semibold text-warning">Open</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-right sm:pr-5">
                    {item.status !== "RESOLVED" && (
                      <button
                        type="button"
                        onClick={(e) => { e.stopPropagation(); resolveFeedback(item._id); }}
                        disabled={isResolving}
                        className="inline-flex items-center gap-1.5 rounded-lg border border-base-300 px-3 py-1.5 text-xs font-semibold text-base-content hover:bg-base-200 disabled:opacity-50"
                      >
                        Mark resolved
                      </button>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <div className="flex items-center justify-between border-t border-base-300 px-4 py-3 sm:px-5">
        <p className="text-xs text-base-content/60">
          Page {pagination.page} of {pagination.totalPages}
          {isFetching ? " · updating..." : ""}
        </p>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page <= 1}
            className="inline-flex items-center gap-1 rounded-lg border border-base-300 px-2.5 py-1.5 text-xs font-semibold text-base-content/70 hover:bg-base-200 disabled:opacity-40"
          >
            <ChevronLeft className="size-3.5" /> Prev
          </button>
          <button
            type="button"
            onClick={() => setPage((p) => Math.min(pagination.totalPages, p + 1))}
            disabled={page >= pagination.totalPages}
            className="inline-flex items-center gap-1 rounded-lg border border-base-300 px-2.5 py-1.5 text-xs font-semibold text-base-content/70 hover:bg-base-200 disabled:opacity-40"
          >
            Next <ChevronRight className="size-3.5" />
          </button>
        </div>
      </div>

      {preview && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4" onClick={() => setPreview(null)}>
          <img src={preview} alt="Feedback screenshot" className="max-h-[85vh] max-w-full rounded-lg object-contain" />
        </div>
      )}

      <FeedbackDetailModal
        feedback={selectedFeedback}
        isResolving={isResolving}
        onClose={() => setSelectedFeedback(null)}
        onResolve={(id) => resolveFeedback(id, { onSuccess: () => setSelectedFeedback(null) })}
        onPreviewScreenshot={(url) => setPreview(url)}
      />
    </div>
  );
}

function FeedbackDetailModal({ feedback, isResolving, onClose, onResolve, onPreviewScreenshot }) {
  if (!feedback) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 sm:items-center sm:p-4" onClick={onClose}>
      <div
        className="max-h-[90vh] w-full overflow-y-auto rounded-t-2xl bg-base-100 p-6 shadow-xl sm:max-w-lg sm:rounded-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between">
          <h3 className="text-lg font-semibold text-base-content">Reported issue</h3>
          <button type="button" onClick={onClose} className="rounded-full p-1 text-base-content/50 hover:bg-base-200 hover:text-base-content/70">
            <X className="size-5" />
          </button>
        </div>

        <div className="mt-4 flex items-center gap-3">
          <UserAvatar src={feedback.reporter?.profilePic} name={feedback.reporter?.fullName || "User"} sizeClass="size-10" />
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold text-base-content">{feedback.reporter?.fullName || "Unknown"}</p>
            <p className="truncate text-xs text-base-content/60">{feedback.reporter?.email || "—"}</p>
          </div>
          {feedback.status === "RESOLVED" ? (
            <span className="ml-auto shrink-0 inline-flex items-center rounded-full bg-success/10 px-2.5 py-1 text-xs font-semibold text-success">Resolved</span>
          ) : (
            <span className="ml-auto shrink-0 inline-flex items-center rounded-full bg-warning/10 px-2.5 py-1 text-xs font-semibold text-warning">Open</span>
          )}
        </div>

        <div className="mt-5 space-y-3 text-sm">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-base-content/50">Message</p>
            <p className="mt-1 whitespace-pre-wrap text-base-content">{feedback.message}</p>
          </div>
          <div className="flex gap-6">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-base-content/50">Page</p>
              <p className="mt-1 text-base-content">{feedback.page || "—"}</p>
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-base-content/50">Submitted</p>
              <p className="mt-1 text-base-content">{formatDate(feedback.createdAt)}</p>
            </div>
          </div>
          {feedback.status === "RESOLVED" && (
            <div className="flex gap-6">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-base-content/50">Resolved by</p>
                <p className="mt-1 text-base-content">{feedback.resolvedBy?.fullName || "—"}</p>
              </div>
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-base-content/50">Resolved at</p>
                <p className="mt-1 text-base-content">{formatDate(feedback.resolvedAt)}</p>
              </div>
            </div>
          )}
          {feedback.screenshotUrl && (
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-base-content/50">Screenshot</p>
              <button type="button" onClick={() => onPreviewScreenshot(feedback.screenshotUrl)} className="mt-1.5 block">
                <img
                  src={feedback.screenshotUrl}
                  alt="Feedback screenshot"
                  className="max-h-48 rounded-lg border border-base-300 object-contain hover:opacity-90"
                />
              </button>
            </div>
          )}
        </div>

        <div className="mt-6 flex gap-3">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 rounded-xl border border-base-300 px-4 py-2.5 text-sm font-semibold text-base-content hover:bg-base-200"
          >
            Close
          </button>
          {feedback.status !== "RESOLVED" && (
            <button
              type="button"
              onClick={() => onResolve(feedback._id)}
              disabled={isResolving}
              className="flex-1 rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-primary disabled:opacity-60"
            >
              {isResolving ? <Loader2 className="mx-auto size-4 animate-spin" /> : "Mark resolved"}
            </button>
          )}
        </div>
      </div>
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
      const response = await axiosInstance.get("/admin/announcements", { params: { page, limit: 6 } });
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
      <div className="rounded-2xl border border-base-300 bg-base-100 p-4 shadow-sm sm:p-5">
        <div className="mb-4 flex items-center gap-2">
          <div className="grid size-9 place-items-center rounded-xl bg-primary/15 text-primary">
            <Megaphone className="size-4" />
          </div>
          <div>
            <h2 className="font-semibold text-base-content">New announcement</h2>
            <p className="text-xs text-base-content/60">Pushes instantly as a must-dismiss notice to matching users.</p>
          </div>
        </div>

        <textarea
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          maxLength={240}
          rows={3}
          placeholder="e.g. We're rolling out a new verification badge for brokers this week."
          className="w-full rounded-xl border border-base-300 px-3.5 py-2.5 text-sm text-base-content placeholder:text-base-content/50 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
        />
        <p className="mt-1 text-right text-xs text-base-content/50">{message.length}/240</p>

        <div className="mt-3">
          {imageUrl ? (
            <div className="relative inline-block">
              <img src={imageUrl} alt="Announcement" className="h-28 w-auto rounded-xl border border-base-300 object-cover" />
              <button
                type="button"
                onClick={() => setImageUrl("")}
                className="absolute -right-2 -top-2 grid size-6 place-items-center rounded-full bg-neutral text-white shadow-sm hover:bg-neutral"
                title="Remove image"
              >
                <X className="size-3.5" />
              </button>
            </div>
          ) : (
            <label className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg border border-dashed border-base-300 px-3.5 py-2 text-sm font-medium text-base-content/70 hover:bg-base-200">
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
            className="rounded-lg border border-base-300 px-3 py-2 text-sm text-base-content disabled:opacity-50"
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
            className="rounded-lg border border-base-300 px-3 py-2 text-sm text-base-content placeholder:text-base-content/50"
          />

          <label className="inline-flex items-center gap-2 text-sm text-base-content">
            <input
              type="checkbox"
              checked={verifiedOnly}
              onChange={(e) => {
                setVerifiedOnly(e.target.checked);
                if (e.target.checked) setRole("");
              }}
              className="size-4 rounded border-base-300"
            />
            Verified brokers/sellers/landlords only
          </label>

          <button
            type="button"
            onClick={() => sendAnnouncement()}
            disabled={isSending || isUploadingImage || !message.trim()}
            className="inline-flex items-center gap-1.5 rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-primary disabled:opacity-50 sm:ml-auto"
          >
            {isSending ? <Loader2 className="size-4 animate-spin" /> : <Megaphone className="size-4" />}
            Send
          </button>
        </div>
      </div>

      <div className="rounded-2xl border border-base-300 bg-base-100 shadow-sm">
        <div className="border-b border-base-300 p-4 sm:p-5">
          <h2 className="font-semibold text-base-content">History</h2>
          <p className="text-xs text-base-content/60">{pagination.total} sent</p>
        </div>

        <div className="divide-y divide-base-300">
          {isLoading ? (
            <div className="p-8 text-center text-sm text-base-content/60">Loading...</div>
          ) : announcements.length === 0 ? (
            <div className="p-8 text-center text-sm text-base-content/60">No announcements sent yet</div>
          ) : (
            announcements.map((a) => (
              <div key={a._id} className="flex items-start gap-3 px-4 py-3 sm:px-5">
                {a.image && (
                  <img src={a.image} alt="" className="size-12 shrink-0 rounded-lg border border-base-300 object-cover" />
                )}
                <div className="min-w-0 flex-1">
                  <p className="text-sm text-base-content">{a.message}</p>
                  <p className="text-xs text-base-content/60">
                    {segmentLabel(a)} · {a.recipientCount} recipients · by {a.sentBy?.fullName || "Admin"} · {formatDate(a.createdAt)}
                  </p>
                </div>
              </div>
            ))
          )}
        </div>

        <div className="flex items-center justify-between border-t border-base-300 px-4 py-3 sm:px-5">
          <p className="text-xs text-base-content/60">
            Page {pagination.page} of {pagination.totalPages}
            {isFetching ? " · updating..." : ""}
          </p>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page <= 1}
              className="inline-flex items-center gap-1 rounded-lg border border-base-300 px-2.5 py-1.5 text-xs font-semibold text-base-content/70 hover:bg-base-200 disabled:opacity-40"
            >
              <ChevronLeft className="size-3.5" /> Prev
            </button>
            <button
              type="button"
              onClick={() => setPage((p) => Math.min(pagination.totalPages, p + 1))}
              disabled={page >= pagination.totalPages}
              className="inline-flex items-center gap-1 rounded-lg border border-base-300 px-2.5 py-1.5 text-xs font-semibold text-base-content/70 hover:bg-base-200 disabled:opacity-40"
            >
              Next <ChevronRight className="size-3.5" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function Metric({ label, value, sub }) {
  return (
    <div className="rounded-xl border border-base-300 bg-base-100 p-4">
      <p className="text-xs font-medium uppercase tracking-wide text-base-content/50">{label}</p>
      <p className="mt-1 text-2xl font-bold text-base-content">{value ?? "—"}</p>
      {sub && <p className="text-xs text-base-content/50">{sub}</p>}
    </div>
  );
}

const DEAL_STAGE_LABELS = { agreed: "Agreed", documents: "Documents", agreement: "Agreement", payment: "Payment", registration: "Registration", completed: "Final" };

function PartyLink({ p }) {
  if (!p?.id) return <span>{p?.name || "—"}</span>;
  return <Link to={`/users/${p.id}`} className="text-primary hover:underline">{p.name}</Link>;
}

function DealsPanel() {
  const queryClient = useQueryClient();
  const [cancelTarget, setCancelTarget] = useState(null);
  const [cancelReason, setCancelReason] = useState("");
  const [listStatus, setListStatus] = useState("");
  const [listPage, setListPage] = useState(1);

  const { data, isLoading, isError } = useQuery({
    queryKey: ["adminDealStats"],
    queryFn: async () => (await axiosInstance.get("/admin/deal-stats")).data?.data?.stats,
  });

  const { data: list } = useQuery({
    queryKey: ["adminDealList", listStatus, listPage],
    queryFn: async () =>
      (await axiosInstance.get("/admin/deals", { params: { status: listStatus || undefined, page: listPage, limit: 20 } })).data?.data,
    placeholderData: keepPreviousData,
  });

  const { mutate: resolve, isPending: isResolving } = useMutation({
    mutationFn: async (id) => (await axiosInstance.post(`/admin/deals/${id}/resolve-report`)).data,
    onSuccess: () => { toast.success("Marked resolved"); queryClient.invalidateQueries({ queryKey: ["adminDealStats"] }); },
    onError: (e) => toast.error(e?.response?.data?.message || "Failed"),
  });
  const { mutate: forceCancel, isPending: isCancelling } = useMutation({
    mutationFn: async ({ id, reason }) => (await axiosInstance.post(`/admin/deals/${id}/force-cancel`, { reason })).data,
    onSuccess: () => { toast.success("Deal cancelled, both parties notified"); setCancelTarget(null); setCancelReason(""); queryClient.invalidateQueries({ queryKey: ["adminDealStats"] }); },
    onError: (e) => toast.error(e?.response?.data?.message || "Failed"),
  });

  if (isLoading) return <div className="grid place-items-center py-16"><Loader2 className="size-6 animate-spin text-primary" /></div>;
  if (isError || !data) return <p className="rounded-xl border border-base-300 bg-base-100 p-6 text-sm text-base-content/60">Couldn't load deal stats.</p>;

  const s = data;
  const num = (list, k) => list?.find((x) => x._id === k)?.n || 0;
  const active = num(s.byStatus, "ACTIVE");
  const completed = num(s.byStatus, "COMPLETED");
  const cancelled = num(s.byStatus, "CANCELLED");
  const stageLabels = DEAL_STAGE_LABELS;

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Metric label="Active" value={active} />
        <Metric label="Completed" value={completed} />
        <Metric label="Cancelled" value={cancelled} />
        <Metric label="Completion rate" value={s.completionRate != null ? `${s.completionRate}%` : "—"} sub={`avg ${s.avgDaysToClose ?? "—"} days to close`} />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="rounded-xl border border-base-300 bg-base-100 p-4">
          <h3 className="mb-3 text-sm font-semibold text-base-content">Active deals by stage</h3>
          {(s.activeByStage || []).length === 0 ? (
            <p className="text-sm text-base-content/50">No active deals.</p>
          ) : (
            <ul className="space-y-2">
              {(s.activeByStage || []).sort((a, b) => b.n - a.n).map((row) => (
                <li key={row._id} className="flex items-center gap-3">
                  <span className="w-28 shrink-0 text-sm text-base-content/70">{stageLabels[row._id] || row._id}</span>
                  <span className="h-2 flex-1 rounded-full bg-base-200">
                    <span className="block h-full rounded-full bg-primary" style={{ width: `${active ? Math.round((row.n / active) * 100) : 0}%` }} />
                  </span>
                  <span className="w-8 text-right text-sm font-semibold text-base-content">{row.n}</span>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="rounded-xl border border-base-300 bg-base-100 p-4">
          <h3 className="mb-3 text-sm font-semibold text-base-content">Top cancellation reasons</h3>
          {(s.topCancelReasons || []).length === 0 ? (
            <p className="text-sm text-base-content/50">None recorded.</p>
          ) : (
            <ul className="space-y-1.5 text-sm">
              {s.topCancelReasons.map((r) => (
                <li key={r._id} className="flex justify-between gap-3">
                  <span className="truncate text-base-content/70">{r._id}</span>
                  <span className="shrink-0 font-semibold text-base-content">{r.n}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      <div className="rounded-xl border border-base-300 bg-base-100">
        <div className="flex items-center gap-2 border-b border-base-200 p-4">
          <ShieldAlert className="size-4 text-error" />
          <h3 className="text-sm font-semibold text-base-content">Needs attention ({(s.attention || []).length})</h3>
        </div>
        {(s.attention || []).length === 0 ? (
          <p className="p-4 text-sm text-base-content/50">No disputed or reported deals.</p>
        ) : (
          <ul className="divide-y divide-base-200">
            {s.attention.map((d) => (
              <li key={d._id} className="p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <Link to={`/property/${d.postId}`} className="text-sm font-semibold text-primary hover:underline">{d.title}</Link>
                    <p className="text-xs text-base-content/60"><PartyLink p={d.buyer} /> ↔ <PartyLink p={d.owner} /> · {d.status.toLowerCase()} · {stageLabels[d.currentStage] || d.currentStage}</p>
                  </div>
                  <div className="flex shrink-0 gap-1.5">
                    {d.disputed && <span className="rounded-full bg-warning/15 px-2 py-0.5 text-[11px] font-semibold text-warning">disputed</span>}
                    {d.openReports.length > 0 && <span className="rounded-full bg-error/15 px-2 py-0.5 text-[11px] font-semibold text-error">{d.openReports.length} report{d.openReports.length > 1 ? "s" : ""}</span>}
                  </div>
                </div>
                {d.openReports.map((r, i) => (
                  <p key={i} className="mt-1.5 rounded-lg bg-error/5 px-2 py-1 text-xs text-base-content/70">“{r.reason}”</p>
                ))}
                <div className="mt-2 flex gap-2">
                  <button
                    type="button"
                    className="rounded-lg bg-base-200 px-2.5 py-1 text-xs font-semibold text-base-content/70 hover:bg-base-300 disabled:opacity-50"
                    disabled={isResolving}
                    onClick={() => resolve(d._id)}
                  >
                    Mark resolved
                  </button>
                  {d.status === "ACTIVE" && (
                    <button
                      type="button"
                      className="rounded-lg bg-error/10 px-2.5 py-1 text-xs font-semibold text-error hover:bg-error/20"
                      onClick={() => setCancelTarget(d)}
                    >
                      Force-cancel deal
                    </button>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* All deals */}
      <div className="rounded-xl border border-base-300 bg-base-100">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-base-200 p-4">
          <h3 className="text-sm font-semibold text-base-content">Deals ({list?.pagination?.total ?? "…"})</h3>
          <select
            value={listStatus}
            onChange={(e) => { setListStatus(e.target.value); setListPage(1); }}
            className="rounded-lg border border-base-300 px-2.5 py-1.5 text-sm outline-none focus:border-primary/30"
          >
            <option value="">All statuses</option>
            <option value="ACTIVE">Active</option>
            <option value="COMPLETED">Completed</option>
            <option value="CANCELLED">Cancelled</option>
          </select>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[640px] text-sm">
            <thead>
              <tr className="border-b border-base-200 text-left text-xs font-semibold uppercase tracking-wide text-base-content/50">
                <th className="px-4 py-2.5">Property</th>
                <th className="px-4 py-2.5">Parties</th>
                <th className="px-4 py-2.5">Price</th>
                <th className="px-4 py-2.5">Stage</th>
                <th className="px-4 py-2.5">Updated</th>
              </tr>
            </thead>
            <tbody>
              {(list?.deals || []).map((d) => (
                <tr key={d._id} className="border-b border-base-100 hover:bg-base-200/50">
                  <td className="px-4 py-2.5">
                    <Link to={`/property/${d.postId}`} className="font-medium text-primary hover:underline">{d.title}</Link>
                    <div className="mt-0.5 flex gap-1">
                      {d.disputed && <span className="rounded bg-warning/15 px-1.5 py-0.5 text-[10px] font-semibold text-warning">disputed</span>}
                      {d.openReports > 0 && <span className="rounded bg-error/15 px-1.5 py-0.5 text-[10px] font-semibold text-error">{d.openReports} report{d.openReports > 1 ? "s" : ""}</span>}
                    </div>
                  </td>
                  <td className="px-4 py-2.5 text-base-content/70"><PartyLink p={d.buyer} /> ↔ <PartyLink p={d.owner} /></td>
                  <td className="px-4 py-2.5 text-base-content/80">₹{Number(d.agreedPrice || 0).toLocaleString("en-IN")}</td>
                  <td className="px-4 py-2.5">
                    <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${
                      d.status === "COMPLETED" ? "bg-success/10 text-success" : d.status === "CANCELLED" ? "bg-error/10 text-error" : "bg-primary/10 text-primary"
                    }`}>
                      {d.status === "ACTIVE" ? (DEAL_STAGE_LABELS[d.currentStage] || d.currentStage) : d.status.toLowerCase()}
                    </span>
                  </td>
                  <td className="px-4 py-2.5 text-xs text-base-content/50">{new Date(d.updatedAt).toLocaleDateString("en-IN")}</td>
                </tr>
              ))}
              {(list?.deals || []).length === 0 && (
                <tr><td colSpan={5} className="px-4 py-8 text-center text-sm text-base-content/50">No deals.</td></tr>
              )}
            </tbody>
          </table>
        </div>
        {(list?.pagination?.totalPages ?? 1) > 1 && (
          <div className="flex items-center justify-between border-t border-base-200 p-3 text-sm">
            <button type="button" disabled={listPage <= 1} onClick={() => setListPage((p) => p - 1)} className="rounded-lg bg-base-200 px-3 py-1.5 font-medium disabled:opacity-40">Prev</button>
            <span className="text-base-content/60">Page {list?.pagination?.page} of {list?.pagination?.totalPages}</span>
            <button type="button" disabled={listPage >= (list?.pagination?.totalPages ?? 1)} onClick={() => setListPage((p) => p + 1)} className="rounded-lg bg-base-200 px-3 py-1.5 font-medium disabled:opacity-40">Next</button>
          </div>
        )}
      </div>

      {cancelTarget && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/50 p-4" onClick={() => setCancelTarget(null)}>
          <div className="w-full max-w-sm rounded-2xl bg-base-100 p-5 shadow-xl" onClick={(e) => e.stopPropagation()}>
            <h4 className="text-base font-semibold text-base-content">Force-cancel “{cancelTarget.title}”?</h4>
            <p className="mt-1 text-xs text-base-content/60">Both parties are notified, the listing goes back on the market. Can't be undone.</p>
            <textarea
              className="textarea textarea-bordered mt-3 min-h-16 w-full border-base-300 text-sm"
              placeholder="Reason (shown to both parties)"
              maxLength={500}
              value={cancelReason}
              onChange={(e) => setCancelReason(e.target.value)}
            />
            <div className="mt-3 flex gap-2">
              <button
                type="button"
                className="rounded-lg bg-error px-3 py-2 text-sm font-semibold text-white disabled:opacity-50"
                disabled={isCancelling || !cancelReason.trim()}
                onClick={() => forceCancel({ id: cancelTarget._id, reason: cancelReason })}
              >
                Cancel the deal
              </button>
              <button type="button" className="rounded-lg bg-base-200 px-3 py-2 text-sm font-semibold text-base-content/70" onClick={() => setCancelTarget(null)}>
                Keep it
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

const VERIFICATION_TABS = [
  { value: "PENDING", label: "Pending" },
  { value: "APPROVED", label: "Approved" },
  { value: "REJECTED", label: "Rejected" },
];

// Cloudinary serves uploaded docs inline by default (they open in a new tab
// instead of downloading). Inserting the `fl_attachment` transformation
// flag right after `/upload/` makes Cloudinary send it as a real download
// (Content-Disposition: attachment) instead.
function toDownloadUrl(url) {
  if (!url || !url.includes("/upload/")) return url;
  return url.replace("/upload/", "/upload/fl_attachment/");
}

// Cloudinary blocks public .pdf requests on default accounts (401 deny or ACL failure).
// But Cloudinary's image engine converts any PDF under /image/upload/ to .jpg dynamically with HTTP 200!
function toViewUrl(url) {
  if (!url) return "";
  if (url.includes("res.cloudinary.com") && /\.pdf$/i.test(url)) {
    return url.replace(/\.pdf$/i, ".jpg");
  }
  return url;
}

function OwnerVerificationQueue() {
  const queryClient = useQueryClient();
  const [statusTab, setStatusTab] = useState("PENDING");
  const [reviewTarget, setReviewTarget] = useState(null); // { id, approve }
  const [reviewNote, setReviewNote] = useState("");
  const [reportTarget, setReportTarget] = useState(null); // the full request row

  const { data, isLoading } = useQuery({
    queryKey: ["adminOwnerVerificationQueue", statusTab],
    queryFn: async () => {
      const response = await axiosInstance.get("/owner-verification/admin/queue", { params: { status: statusTab } });
      return response.data?.data;
    },
  });

  const requests = data?.requests || [];

  const { mutate: reviewRequest, isPending } = useMutation({
    mutationFn: async ({ id, approve, reviewNote: note }) => {
      const response = await axiosInstance.patch(`/owner-verification/admin/${id}`, { approve, reviewNote: note });
      return response.data?.data;
    },
    onSuccess: (_data, variables) => {
      toast.success(variables.approve ? "Owner verified" : "Request rejected");
      queryClient.invalidateQueries({ queryKey: ["adminOwnerVerificationQueue"] });
      setReviewTarget(null);
      setReviewNote("");
    },
    onError: (error) => {
      toast.error(error?.response?.data?.message || "Failed to review request");
    },
  });

  return (
    <div className="rounded-2xl border border-base-300 bg-base-100 shadow-sm">
      <div className="flex items-center gap-2 border-b border-base-300 p-4 sm:p-5">
        <div className="grid size-9 place-items-center rounded-xl bg-primary/15 text-primary">
          <ShieldCheck className="size-4" />
        </div>
        <div>
          <h2 className="font-semibold text-base-content">Owner verification requests</h2>
          <p className="text-xs text-base-content/60">
            {isLoading ? "Loading…" : `${requests.length} ${statusTab.toLowerCase()}`}
          </p>
        </div>
      </div>

      {/* Approved/rejected requests never disappear — they just leave the
          pending queue. These tabs are how an admin looks one back up later
          (e.g. to see when a user was verified, or why they were rejected). */}
      <div className="flex gap-1 border-b border-base-300 px-4 pt-3 sm:px-5">
        {VERIFICATION_TABS.map((tab) => (
          <button
            key={tab.value}
            type="button"
            onClick={() => setStatusTab(tab.value)}
            className={`rounded-t-lg px-3 py-1.5 text-sm font-semibold transition-colors ${
              statusTab === tab.value
                ? "border-b-2 border-primary text-primary"
                : "text-base-content/50 hover:text-base-content"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {isLoading ? (
        <div className="flex justify-center py-16 text-base-content/40">
          <Loader2 className="size-6 animate-spin" />
        </div>
      ) : requests.length === 0 ? (
        <p className="p-8 text-center text-sm text-base-content/60">
          No {statusTab.toLowerCase()} requests.
        </p>
      ) : (
        <div className="divide-y divide-base-200">
          {requests.map((r) => (
            <div key={r.id} className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between sm:p-5">
              <div className="flex items-center gap-3 min-w-0">
                <img
                  src={r.user?.profilePic || "https://placehold.co/40x40?text=U"}
                  alt={r.user?.fullName || "User"}
                  className="size-10 shrink-0 rounded-full object-cover"
                />
                <div className="min-w-0">
                  <Link to={`/users/${r.user?.id}`} className="truncate font-semibold text-base-content hover:text-primary">
                    {r.user?.fullName || "Unknown"}
                  </Link>
                  <p className="truncate text-xs text-base-content/60">{r.user?.email} · {r.user?.city || "No city"}</p>
                  <p className="mt-0.5 text-xs text-base-content/50">
                    {r.docType.replace(/_/g, " ")} · submitted {new Date(r.createdAt).toLocaleDateString()}
                  </p>
                  {r.note && <p className="mt-0.5 text-xs italic text-base-content/50">"{r.note}"</p>}
                  {r.status !== "PENDING" && (
                    <p className="mt-0.5 text-xs text-base-content/50">
                      {r.status === "APPROVED" ? "Approved" : "Rejected"}
                      {r.reviewedBy?.fullName ? ` by ${r.reviewedBy.fullName}` : ""}
                      {r.reviewedAt ? ` · ${new Date(r.reviewedAt).toLocaleDateString()}` : ""}
                      {r.reviewNote ? ` — "${r.reviewNote}"` : ""}
                    </p>
                  )}
                </div>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                <a
                  href={r.docUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="btn btn-sm border-base-300"
                >
                  <ImageIcon className="size-4" /> View document
                </a>
                <button
                  type="button"
                  className="btn btn-sm border-base-300"
                  onClick={() => setReportTarget(r)}
                >
                  <FileText className="size-4" /> Report
                </button>
                {r.status === "PENDING" && (
                  <>
                    <button
                      type="button"
                      className="btn btn-sm border-none bg-success text-white hover:bg-success"
                      disabled={isPending}
                      onClick={() => reviewRequest({ id: r.id, approve: true })}
                    >
                      Approve
                    </button>
                    <button
                      type="button"
                      className="btn btn-sm border-error/30 text-error hover:bg-error/10"
                      onClick={() => setReviewTarget({ id: r.id, approve: false })}
                    >
                      Reject
                    </button>
                  </>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {reviewTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={() => setReviewTarget(null)}>
          <div className="w-full max-w-sm rounded-2xl bg-base-100 p-5" onClick={(e) => e.stopPropagation()}>
            <h3 className="font-semibold text-base-content">Reject this request?</h3>
            <textarea
              className="textarea textarea-bordered mt-3 w-full text-sm"
              placeholder="Reason (shown to the user)"
              value={reviewNote}
              onChange={(e) => setReviewNote(e.target.value)}
              maxLength={500}
            />
            <div className="mt-3 flex justify-end gap-2">
              <button type="button" className="btn btn-sm border-base-300" onClick={() => setReviewTarget(null)}>
                Cancel
              </button>
              <button
                type="button"
                className="btn btn-sm border-none bg-error text-white hover:bg-error"
                disabled={isPending}
                onClick={() => reviewRequest({ id: reviewTarget.id, approve: false, reviewNote })}
              >
                {isPending ? "Rejecting…" : "Reject"}
              </button>
            </div>
          </div>
        </div>
      )}

      {reportTarget && <VerificationReportModal request={reportTarget} onClose={() => setReportTarget(null)} />}
    </div>
  );
}

const REPORT_TABS = [
  { value: "overview", label: "Overview" },
  { value: "document", label: "Document" },
];

// The interactive drill-down behind the "Report" button: an Overview tab
// with the applicant's full picture (pulling live profile fields — role,
// mobile, email-verified/account status, member-since — beyond what the
// verification-queue row itself carries) and a Document tab that previews
// the actual submitted file inline, zoomable, instead of just linking out.
function VerificationReportModal({ request, onClose }) {
  const [tab, setTab] = useState("overview");
  const [zoomed, setZoomed] = useState(false);
  const [generatingPdf, setGeneratingPdf] = useState(false);

  const { data: profile, isLoading: profileLoading } = useQuery({
    queryKey: ["adminUserLookup", request.user?.email],
    queryFn: async () => {
      const response = await axiosInstance.get("/admin/users", {
        params: { search: request.user?.email, limit: 1 },
      });
      return response.data?.data?.users?.[0] || null;
    },
    enabled: Boolean(request.user?.email),
    staleTime: 60_000,
  });

  const isPdf = /\.pdf(\?|$)/i.test(request.docUrl || "");

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={onClose}>
      <div
        className="flex max-h-[90vh] w-full max-w-2xl flex-col overflow-hidden rounded-2xl bg-base-100"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between gap-3 border-b border-base-300 p-4">
          <div className="flex min-w-0 items-center gap-3">
            <img
              src={request.user?.profilePic || "https://placehold.co/40x40?text=U"}
              alt={request.user?.fullName || "User"}
              className="size-10 shrink-0 rounded-full object-cover"
            />
            <div className="min-w-0">
              <p className="truncate font-semibold text-base-content">{request.user?.fullName || "Unknown"}</p>
              <p className="truncate text-xs text-base-content/60">{request.user?.email || "No email"}</p>
            </div>
          </div>
          <button type="button" className="btn btn-ghost btn-sm btn-circle shrink-0" onClick={onClose}>
            <X className="size-4" />
          </button>
        </div>

        <div className="flex gap-1 border-b border-base-300 px-4 pt-2">
          {REPORT_TABS.map((t) => (
            <button
              key={t.value}
              type="button"
              onClick={() => setTab(t.value)}
              className={`rounded-t-lg px-3 py-1.5 text-sm font-semibold transition-colors ${
                tab === t.value ? "border-b-2 border-primary text-primary" : "text-base-content/50 hover:text-base-content"
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        <div className="flex-1 overflow-y-auto p-5">
          {tab === "overview" ? (
            <dl className="space-y-2 text-sm">
              <div className="flex justify-between gap-3">
                <dt className="text-base-content/60">City</dt>
                <dd className="font-medium text-base-content">{request.user?.city || "—"}</dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="text-base-content/60">Mobile</dt>
                <dd className="font-medium text-base-content">
                  {profileLoading ? "Loading…" : profile?.mobileNumber || "—"}
                </dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="text-base-content/60">Role</dt>
                <dd className="font-medium text-base-content">
                  {profileLoading ? "Loading…" : profile?.activeRole || profile?.primaryRole || "—"}
                </dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="text-base-content/60">Email verified</dt>
                <dd className="font-medium text-base-content">
                  {profileLoading ? "Loading…" : profile?.isVerified ? "Yes" : "No"}
                </dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="text-base-content/60">Account status</dt>
                <dd className={`font-medium ${profile?.isBlocked ? "text-error" : "text-base-content"}`}>
                  {profileLoading ? "Loading…" : profile?.isBlocked ? "Blocked" : "Active"}
                </dd>
              </div>
              {profile?.isAdmin && (
                <div className="flex justify-between gap-3">
                  <dt className="text-base-content/60">Platform role</dt>
                  <dd className="font-semibold text-primary">Admin</dd>
                </div>
              )}
              <div className="flex justify-between gap-3">
                <dt className="text-base-content/60">Rating</dt>
                <dd className="font-medium text-base-content">
                  {profileLoading
                    ? "Loading…"
                    : profile?.ratingCount > 0
                      ? `${(profile.ratingAvg || 0).toFixed(1)} ★ (${profile.ratingCount})`
                      : "No ratings yet"}
                </dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="text-base-content/60">Connections</dt>
                <dd className="font-medium text-base-content">
                  {profileLoading ? "Loading…" : Array.isArray(profile?.friends) ? profile.friends.length : "—"}
                </dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="text-base-content/60">Member since</dt>
                <dd className="font-medium text-base-content">
                  {profileLoading ? "Loading…" : profile?.createdAt ? new Date(profile.createdAt).toLocaleDateString() : "—"}
                </dd>
              </div>
              <div className="my-1 border-t border-base-200" />
              <div className="flex justify-between gap-3">
                <dt className="text-base-content/60">Document type</dt>
                <dd className="font-medium text-base-content">{request.docType.replace(/_/g, " ")}</dd>
              </div>
              {request.docNumber && (
                <div className="flex justify-between gap-3">
                  <dt className="text-base-content/60">Document number</dt>
                  <dd className="font-mono font-medium text-base-content">{request.docNumber}</dd>
                </div>
              )}
              <div className="flex justify-between gap-3">
                <dt className="text-base-content/60">Submitted</dt>
                <dd className="font-medium text-base-content">{new Date(request.createdAt).toLocaleString()}</dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="text-base-content/60">Status</dt>
                <dd className="font-medium text-base-content">{request.status}</dd>
              </div>
              {request.status !== "PENDING" && (
                <>
                  <div className="flex justify-between gap-3">
                    <dt className="text-base-content/60">Reviewed by</dt>
                    <dd className="font-medium text-base-content">{request.reviewedBy?.fullName || "—"}</dd>
                  </div>
                  <div className="flex justify-between gap-3">
                    <dt className="text-base-content/60">Reviewed at</dt>
                    <dd className="font-medium text-base-content">
                      {request.reviewedAt ? new Date(request.reviewedAt).toLocaleString() : "—"}
                    </dd>
                  </div>
                </>
              )}
              {request.note && (
                <div>
                  <dt className="text-base-content/60">Applicant note</dt>
                  <dd className="mt-0.5 italic text-base-content">"{request.note}"</dd>
                </div>
              )}
              {request.reviewNote && (
                <div>
                  <dt className="text-base-content/60">Review note</dt>
                  <dd className="mt-0.5 italic text-base-content">"{request.reviewNote}"</dd>
                </div>
              )}
              <div className="pt-2">
                <Link to={`/users/${request.user?.id}`} className="text-sm font-semibold text-primary hover:underline">
                  View full profile →
                </Link>
              </div>
            </dl>
          ) : (
            <div>
              {isPdf ? (
                <iframe
                  src={request.docUrl}
                  title="Submitted document"
                  className="h-[60vh] w-full rounded-lg border border-base-300"
                />
              ) : (
                <>
                  <button type="button" className="block w-full" onClick={() => setZoomed(true)}>
                    <img
                      src={request.docUrl}
                      alt="Submitted document"
                      className="max-h-[60vh] w-full rounded-lg border border-base-300 object-contain"
                    />
                  </button>
                  <p className="mt-2 text-center text-xs text-base-content/50">Click the image to zoom in</p>
                </>
              )}
            </div>
          )}
        </div>

        <div className="flex flex-wrap justify-end gap-2 border-t border-base-300 p-4">
          <a href={toDownloadUrl(request.docUrl)} className="btn btn-sm border-base-300">
            <Download className="size-4" /> Download document
          </a>
          <button
            type="button"
            className="btn btn-sm border-none bg-primary text-white hover:bg-primary"
            disabled={generatingPdf}
            onClick={async () => {
              setGeneratingPdf(true);
              try {
                await downloadVerificationReportPDF(request, profile);
              } catch {
                toast.error("Couldn't generate the PDF — try again");
              } finally {
                setGeneratingPdf(false);
              }
            }}
          >
            {generatingPdf ? <Loader2 className="size-4 animate-spin" /> : <Download className="size-4" />}
            {generatingPdf ? "Generating…" : "Download report"}
          </button>
        </div>
      </div>

      {zoomed && !isPdf && (
        <div
          className="fixed inset-0 z-[60] flex items-center justify-center bg-black/90 p-4"
          onClick={() => setZoomed(false)}
        >
          <img src={request.docUrl} alt="Submitted document" className="max-h-full max-w-full object-contain" />
        </div>
      )}
    </div>
  );
}

const PROPERTY_VERIFICATION_TABS = [
  { value: "PENDING", label: "Pending" },
  { value: "VERIFIED", label: "Verified" },
  { value: "REJECTED", label: "Rejected" },
  { value: "ALL", label: "All" },
];

function PropertyAddressVerificationQueue() {
  const queryClient = useQueryClient();
  const [statusTab, setStatusTab] = useState("PENDING");
  const [page, setPage] = useState(1);
  const [rejectTarget, setRejectTarget] = useState(null);
  const [rejectionReason, setRejectionReason] = useState("");
  const [verifyTarget, setVerifyTarget] = useState(null);
  const [verificationNote, setVerificationNote] = useState("");
  const [auditTarget, setAuditTarget] = useState(null);

  const { data, isLoading } = useQuery({
    queryKey: ["adminPropertyVerifications", statusTab, page],
    queryFn: async () => {
      const response = await axiosInstance.get("/admin/property-verifications", {
        params: { status: statusTab, page, limit: 15 },
      });
      return response.data?.data;
    },
  });

  const posts = data?.posts || [];
  const counts = data?.counts || { pending: 0, verified: 0, rejected: 0, all: 0 };
  const pagination = data?.pagination || { page: 1, totalPages: 1 };

  const { mutate: reviewBill, isPending } = useMutation({
    mutationFn: async ({ id, status, rejectionReason, verificationNote }) => {
      const response = await axiosInstance.patch(`/admin/property-verifications/${id}`, {
        status,
        rejectionReason,
        verificationNote,
      });
      return response.data?.data;
    },
    onSuccess: (_data, variables) => {
      toast.success(variables.status === "VERIFIED" ? "Address verified successfully!" : "Verification rejected");
      queryClient.invalidateQueries({ queryKey: ["adminPropertyVerifications"] });
      queryClient.invalidateQueries({ queryKey: ["propertyPost"] });
      queryClient.invalidateQueries({ queryKey: ["propertyFeed"] });
      setVerifyTarget(null);
      setRejectTarget(null);
      setVerificationNote("");
      setRejectionReason("");
    },
    onError: (error) => {
      toast.error(error?.response?.data?.message || "Failed to update verification status");
    },
  });

  return (
    <div className="rounded-2xl border border-base-300 bg-base-100 shadow-sm">
      <div className="flex items-center justify-between border-b border-base-300 p-4 sm:p-5">
        <div className="flex items-center gap-2">
          <div className="grid size-9 place-items-center rounded-xl bg-primary/15 text-primary">
            <FileText className="size-4" />
          </div>
          <div>
            <h2 className="font-semibold text-base-content">Property Address Verification (Bills)</h2>
            <p className="text-xs text-base-content/60">
              {isLoading ? "Loading…" : `${posts.length} listing${posts.length !== 1 ? "s" : ""} on page ${page}`}
            </p>
          </div>
        </div>
      </div>

      {/* Status Filter Tabs */}
      <div className="flex gap-1 border-b border-base-300 px-4 pt-3 sm:px-5">
        {PROPERTY_VERIFICATION_TABS.map((tab) => {
          const count =
            tab.value === "PENDING"
              ? counts.pending
              : tab.value === "VERIFIED"
                ? counts.verified
                : tab.value === "REJECTED"
                  ? counts.rejected
                  : counts.all;
          return (
            <button
              key={tab.value}
              type="button"
              onClick={() => {
                setStatusTab(tab.value);
                setPage(1);
              }}
              className={`rounded-t-lg px-3 py-1.5 text-sm font-semibold transition-colors flex items-center gap-1.5 ${
                statusTab === tab.value
                  ? "border-b-2 border-primary text-primary"
                  : "text-base-content/50 hover:text-base-content"
              }`}
            >
              <span>{tab.label}</span>
              <span
                className={`text-[11px] px-1.5 py-0.2 rounded-full ${
                  statusTab === tab.value ? "bg-primary/20 text-primary" : "bg-base-200 text-base-content/60"
                }`}
              >
                {count ?? 0}
              </span>
            </button>
          );
        })}
      </div>

      {isLoading ? (
        <div className="flex justify-center py-16 text-base-content/40">
          <Loader2 className="size-6 animate-spin" />
        </div>
      ) : posts.length === 0 ? (
        <div className="p-12 text-center">
          <FileText className="mx-auto size-10 text-base-content/30 stroke-[1.5]" />
          <p className="mt-3 text-sm font-semibold text-base-content/70">
            No {statusTab.toLowerCase()} property address verification requests.
          </p>
          <p className="mt-1 text-xs text-base-content/50">
            Properties with uploaded electricity bills will appear here for admin review.
          </p>
        </div>
      ) : (
        <div className="divide-y divide-base-200/80">
          {posts.map((post) => {
            const billUrl = post.postMeta?.residential?.electricityBillUrl || post.postMeta?.electricityBillUrl;
            const billStatus = post.postMeta?.residential?.electricityBillStatus || (billUrl ? "PENDING" : "NONE");
            const rejectionReasonText = post.postMeta?.residential?.electricityBillRejectionReason;
            const verifiedAt = post.postMeta?.residential?.electricityBillVerifiedAt;
            const verifiedBy = post.postMeta?.residential?.electricityBillVerifiedBy || post.postMeta?.electricityBillVerifiedBy;
            const verificationNote = post.postMeta?.residential?.electricityBillVerificationNote || post.postMeta?.electricityBillVerificationNote;

            return (
              <div key={post._id} className="p-4 sm:p-5 hover:bg-base-200/30 transition-colors">
                <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                  {/* Left: Media + Information */}
                  <div className="flex items-start gap-3.5 min-w-0 flex-1">
                    {post.mediaUrls?.[0] ? (
                      <img
                        src={post.mediaUrls[0]}
                        alt={post.title}
                        className="size-18 sm:size-20 shrink-0 rounded-xl object-cover border border-base-300"
                      />
                    ) : (
                      <div className="size-18 sm:size-20 shrink-0 rounded-xl bg-base-200 flex items-center justify-center text-base-content/40 border border-base-300">
                        <Home className="size-8 stroke-[1.5]" />
                      </div>
                    )}

                    <div className="min-w-0 flex-1 space-y-1.5">
                      {/* Title + Badges */}
                      <div className="flex flex-wrap items-center gap-2">
                        <Link
                          to={`/property/${post._id}`}
                          target="_blank"
                          className="font-bold text-sm sm:text-base text-base-content hover:text-primary transition-colors inline-flex items-center gap-1"
                        >
                          <span className="truncate">{post.title}</span>
                          <ExternalLink className="size-3 text-base-content/40 shrink-0" />
                        </Link>

                        <span className="badge badge-sm badge-outline text-[10px] uppercase font-bold tracking-wider">
                          {post.postType?.replace(/_/g, " ")}
                        </span>

                        {billStatus === "VERIFIED" ? (
                          <span className="inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[11px] font-semibold text-emerald-700 bg-emerald-500/10 border border-emerald-500/25 dark:text-emerald-400">
                            <CheckCircle2 className="size-3 shrink-0" />
                            Address Verified
                          </span>
                        ) : billStatus === "REJECTED" ? (
                          <span className="inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[11px] font-semibold text-error bg-error/10 border border-error/25">
                            <AlertTriangle className="size-3 shrink-0" />
                            Rejected
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[11px] font-semibold text-amber-700 bg-amber-500/10 border border-amber-500/25 dark:text-amber-400">
                            <Clock className="size-3 shrink-0" />
                            Pending Review
                          </span>
                        )}
                      </div>

                      {/* Location & Price */}
                      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-base-content/70">
                        <span className="inline-flex items-center gap-1">
                          <MapPin className="size-3.5 text-primary shrink-0" />
                          {[post.locality, post.city].filter(Boolean).join(", ") || "Location not specified"}
                        </span>
                        <span className="font-semibold text-base-content">
                          ₹{post.price?.toLocaleString?.("en-IN") ?? post.price}
                        </span>
                        {post.createdAt && (
                          <span className="inline-flex items-center gap-1 text-base-content/50">
                            <Calendar className="size-3.5 shrink-0" />
                            {new Date(post.createdAt).toLocaleDateString("en-IN", {
                              day: "numeric",
                              month: "short",
                              year: "numeric",
                            })}
                          </span>
                        )}
                      </div>

                      {/* Poster Info */}
                      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-base-content/60">
                        <span className="inline-flex items-center gap-1.5">
                          <UserIcon className="size-3.5 text-base-content/50 shrink-0" />
                          <span>
                            Posted by <strong className="text-base-content/85">{post.author?.fullName || "User"}</strong>{" "}
                            <span className="text-[11px] text-base-content/50">
                              ({post.author?.activeRole || post.author?.primaryRole || "User"})
                            </span>
                          </span>
                        </span>
                        {post.author?.mobileNumber && (
                          <span className="inline-flex items-center gap-1">
                            <Phone className="size-3.5 text-base-content/50 shrink-0" />
                            {post.author.mobileNumber}
                          </span>
                        )}
                      </div>

                      {/* Audit summaries if verified or rejected */}
                      {billStatus === "VERIFIED" && (
                        <div className="mt-2 rounded-xl bg-emerald-500/5 border border-emerald-500/20 p-2.5 text-xs text-emerald-800 dark:text-emerald-300 flex flex-wrap items-center justify-between gap-2">
                          <div className="inline-flex items-center gap-1.5 min-w-0">
                            <CheckCircle2 className="size-3.5 text-emerald-600 dark:text-emerald-400 shrink-0" />
                            <span>
                              Verified by <strong className="font-semibold">{verifiedBy?.fullName || "Admin"}</strong>
                              {verifiedAt && ` on ${new Date(verifiedAt).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" })}`}
                            </span>
                            {verificationNote && (
                              <span className="text-base-content/65 truncate max-w-xs italic">
                                · "{verificationNote}"
                              </span>
                            )}
                          </div>
                          <button
                            type="button"
                            onClick={() => setAuditTarget(post)}
                            className="text-[11px] font-semibold text-emerald-700 dark:text-emerald-400 hover:underline cursor-pointer"
                          >
                            Audit Details
                          </button>
                        </div>
                      )}

                      {billStatus === "REJECTED" && (
                        <div className="mt-2 rounded-xl bg-error/5 border border-error/20 p-2.5 text-xs text-error flex flex-wrap items-center justify-between gap-2">
                          <div className="inline-flex items-center gap-1.5 min-w-0">
                            <AlertTriangle className="size-3.5 shrink-0" />
                            <span>
                              Rejected by <strong className="font-semibold">{verifiedBy?.fullName || "Admin"}</strong>
                              {rejectionReasonText && `: "${rejectionReasonText}"`}
                            </span>
                          </div>
                          <button
                            type="button"
                            onClick={() => setAuditTarget(post)}
                            className="text-[11px] font-semibold text-error hover:underline cursor-pointer"
                          >
                            Audit Details
                          </button>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Right: Bill Document Actions & Review Controls */}
                  <div className="flex flex-wrap lg:flex-col items-center lg:items-end gap-2 shrink-0 pt-2 lg:pt-0 border-t border-base-200/80 lg:border-t-0">
                    {billUrl && (
                      <div className="flex items-center gap-1.5">
                        <a
                          href={toViewUrl(billUrl)}
                          target="_blank"
                          rel="noreferrer"
                          className="btn btn-sm btn-outline border-base-300 gap-1.5 text-xs"
                        >
                          <Eye className="size-3.5" /> View Bill
                        </a>
                        <a
                          href={`/api/admin/property-verifications/${post._id}/bill-download`}
                          target="_blank"
                          rel="noreferrer"
                          className="btn btn-sm btn-ghost gap-1.5 text-xs"
                          title="Download Original Bill (PDF)"
                        >
                          <Download className="size-3.5" />
                        </a>
                      </div>
                    )}

                    <div className="flex items-center gap-2">
                      {billStatus !== "VERIFIED" && (
                        <button
                          type="button"
                          disabled={isPending}
                          className="btn btn-sm btn-success text-white gap-1.5"
                          onClick={() => {
                            setVerifyTarget(post);
                            setVerificationNote("");
                          }}
                        >
                          <CheckCircle2 className="size-4" />
                          Verify
                        </button>
                      )}

                      {billStatus !== "REJECTED" && (
                        <button
                          type="button"
                          disabled={isPending}
                          className="btn btn-sm btn-outline btn-error gap-1.5"
                          onClick={() => {
                            setRejectTarget(post);
                            setRejectionReason("");
                          }}
                        >
                          <ShieldAlert className="size-4" />
                          Reject
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Pagination */}
      {pagination.totalPages > 1 && (
        <div className="flex items-center justify-between border-t border-base-300 px-4 py-3 sm:px-5">
          <p className="text-xs text-base-content/60">
            Page {pagination.page} of {pagination.totalPages}
          </p>
          <div className="flex gap-1">
            <button
              type="button"
              disabled={page <= 1}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              className="btn btn-xs border-base-300"
            >
              Previous
            </button>
            <button
              type="button"
              disabled={page >= pagination.totalPages}
              onClick={() => setPage((p) => p + 1)}
              className="btn btn-xs border-base-300"
            >
              Next
            </button>
          </div>
        </div>
      )}

      {/* Verification Confirmation Modal */}
      {verifyTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={() => setVerifyTarget(null)}>
          <div className="w-full max-w-md rounded-2xl bg-base-100 p-5 shadow-xl border border-base-300" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center gap-2 text-success font-bold text-base">
              <CheckCircle2 className="size-5" />
              <span>Verify Property Address</span>
            </div>
            <p className="text-xs text-base-content/70 mt-1">
              Confirm that the uploaded electricity bill matches the listing address and details for:
            </p>

            <div className="mt-3 rounded-xl bg-base-200/60 p-3 text-xs space-y-1.5">
              <p className="font-semibold text-base-content truncate">"{verifyTarget.title}"</p>
              <p className="text-base-content/65 inline-flex items-center gap-1.5">
                <MapPin className="size-3.5 text-primary shrink-0" />
                {[verifyTarget.locality, verifyTarget.city].filter(Boolean).join(", ") || "Location not specified"}
              </p>
              <div className="text-base-content/65 flex items-center gap-3">
                <span className="inline-flex items-center gap-1">
                  <UserIcon className="size-3.5 text-base-content/50 shrink-0" />
                  {verifyTarget.author?.fullName || "User"}
                </span>
                {verifyTarget.author?.mobileNumber && (
                  <span className="inline-flex items-center gap-1">
                    <Phone className="size-3.5 text-base-content/50 shrink-0" />
                    {verifyTarget.author.mobileNumber}
                  </span>
                )}
              </div>
            </div>

            {/* Document preview & links */}
            {(verifyTarget.postMeta?.residential?.electricityBillUrl || verifyTarget.postMeta?.electricityBillUrl) && (() => {
              const bUrl = verifyTarget.postMeta?.residential?.electricityBillUrl || verifyTarget.postMeta?.electricityBillUrl;
              return (
                <div className="mt-3 space-y-2">
                  <div className="flex items-center justify-between text-xs font-semibold">
                    <span className="text-base-content/70">Attached Electricity Bill:</span>
                    <div className="flex items-center gap-1.5">
                      <a
                        href={toViewUrl(bUrl)}
                        target="_blank"
                        rel="noreferrer"
                        className="btn btn-xs border-base-300 gap-1 text-primary"
                      >
                        <Eye className="size-3" /> View Full
                      </a>
                      <a
                        href={`/api/admin/property-verifications/${verifyTarget._id}/bill-download`}
                        target="_blank"
                        rel="noreferrer"
                        className="btn btn-xs btn-ghost gap-1"
                        title="Download Bill (PDF)"
                      >
                        <Download className="size-3" /> Download
                      </a>
                    </div>
                  </div>

                  {/* Inline visual bill preview */}
                  <div className="rounded-xl border border-base-300 bg-base-200/50 p-2 flex items-center justify-center max-h-56 overflow-auto">
                    <img
                      src={toViewUrl(bUrl)}
                      alt="Electricity bill preview"
                      className="max-h-52 w-auto object-contain rounded-lg shadow-xs"
                      onError={(e) => {
                        e.target.style.display = 'none';
                      }}
                    />
                  </div>
                </div>
              );
            })()}

            {/* Verification Note (Admin Only / Internal Audit) */}
            <label className="form-control mt-3">
              <span className="label-text text-xs text-base-content/70 font-semibold mb-1">
                Verification Note (Admin Only / Internal Audit)
              </span>
              <textarea
                className="textarea textarea-bordered w-full text-xs"
                placeholder="e.g. Consumer number and address verified against listing"
                value={verificationNote}
                onChange={(e) => setVerificationNote(e.target.value)}
                maxLength={500}
                rows={2}
              />
            </label>

            <div className="mt-4 flex justify-end gap-2">
              <button
                type="button"
                className="btn btn-sm border-base-300"
                onClick={() => setVerifyTarget(null)}
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={isPending}
                className="btn btn-sm btn-success text-white gap-1.5"
                onClick={() =>
                  reviewBill({
                    id: verifyTarget._id,
                    status: "VERIFIED",
                    verificationNote,
                  })
                }
              >
                <CheckCircle2 className="size-4" />
                Confirm & Verify Address
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Rejection Modal */}
      {rejectTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={() => setRejectTarget(null)}>
          <div className="w-full max-w-sm rounded-2xl bg-base-100 p-5 shadow-xl border border-base-300" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center gap-2 text-error font-bold text-base">
              <ShieldAlert className="size-5" />
              <span>Reject Address Verification</span>
            </div>
            <p className="text-xs text-base-content/60 mt-1">
              Provide a reason for rejecting the electricity bill for <span className="font-medium text-base-content">"{rejectTarget.title}"</span>.
            </p>
            <textarea
              className="textarea textarea-bordered mt-3 w-full text-sm"
              placeholder="e.g. Document unreadable, address mismatch, or outdated bill"
              value={rejectionReason}
              onChange={(e) => setRejectionReason(e.target.value)}
              maxLength={500}
              rows={3}
            />
            <div className="mt-3 flex justify-end gap-2">
              <button type="button" className="btn btn-sm border-base-300" onClick={() => setRejectTarget(null)}>
                Cancel
              </button>
              <button
                type="button"
                disabled={isPending}
                className="btn btn-sm btn-error text-white gap-1.5"
                onClick={() =>
                  reviewBill({
                    id: rejectTarget._id,
                    status: "REJECTED",
                    rejectionReason,
                  })
                }
              >
                <ShieldAlert className="size-4" />
                Reject Bill
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Audit Details Modal (Admin Eyes Only) */}
      {auditTarget && (() => {
        const targetBillUrl = auditTarget.postMeta?.residential?.electricityBillUrl || auditTarget.postMeta?.electricityBillUrl;
        const targetStatus = auditTarget.postMeta?.residential?.electricityBillStatus || (targetBillUrl ? "PENDING" : "NONE");
        const targetVerifiedBy = auditTarget.postMeta?.residential?.electricityBillVerifiedBy || auditTarget.postMeta?.electricityBillVerifiedBy;
        const targetVerifiedAt = auditTarget.postMeta?.residential?.electricityBillVerifiedAt;
        const targetNote = auditTarget.postMeta?.residential?.electricityBillVerificationNote || auditTarget.postMeta?.electricityBillVerificationNote;
        const targetReason = auditTarget.postMeta?.residential?.electricityBillRejectionReason;

        return (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={() => setAuditTarget(null)}>
            <div className="w-full max-w-md rounded-2xl bg-base-100 p-5 shadow-2xl border border-base-300" onClick={(e) => e.stopPropagation()}>
              <div className="flex items-center justify-between pb-3 border-b border-base-200">
                <div className="flex items-center gap-2">
                  {targetStatus === "VERIFIED" ? (
                    <div className="grid size-8 place-items-center rounded-xl bg-success/15 text-success">
                      <CheckCircle2 className="size-4.5" />
                    </div>
                  ) : (
                    <div className="grid size-8 place-items-center rounded-xl bg-error/15 text-error">
                      <ShieldAlert className="size-4.5" />
                    </div>
                  )}
                  <div>
                    <h3 className="font-bold text-sm text-base-content">
                      {targetStatus === "VERIFIED" ? "Address Verification Audit" : "Verification Rejection Audit"}
                    </h3>
                    <p className="text-[11px] text-base-content/50">Internal Admin Records Only</p>
                  </div>
                </div>
                <button
                  type="button"
                  className="btn btn-ghost btn-xs btn-circle"
                  onClick={() => setAuditTarget(null)}
                >
                  <X className="size-4" />
                </button>
              </div>

              <div className="mt-3.5 space-y-3 text-xs">
                <div className="rounded-xl bg-base-200/50 p-3 space-y-1.5">
                  <p className="font-semibold text-base-content truncate">"{auditTarget.title}"</p>
                  <p className="text-base-content/65 inline-flex items-center gap-1.5">
                    <MapPin className="size-3.5 text-primary shrink-0" />
                    {[auditTarget.locality, auditTarget.city].filter(Boolean).join(", ") || "Location not specified"}
                  </p>
                  <div className="text-base-content/65 flex items-center gap-3">
                    <span className="inline-flex items-center gap-1">
                      <UserIcon className="size-3.5 text-base-content/50 shrink-0" />
                      Listed by <strong className="text-base-content/85">{auditTarget.author?.fullName || "User"}</strong>
                    </span>
                    {auditTarget.author?.mobileNumber && (
                      <span className="inline-flex items-center gap-1">
                        <Phone className="size-3.5 text-base-content/50 shrink-0" />
                        {auditTarget.author.mobileNumber}
                      </span>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-3 p-3 rounded-xl border border-base-200 bg-base-100">
                  {targetVerifiedBy?.profilePic ? (
                    <img src={targetVerifiedBy.profilePic} alt="" className="size-10 rounded-full object-cover border border-base-300" />
                  ) : (
                    <div className="grid size-10 place-items-center rounded-full bg-primary/10 text-primary font-bold text-sm">
                      {(targetVerifiedBy?.fullName || "A")[0]}
                    </div>
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="text-[11px] text-base-content/50 font-medium">Reviewed by</p>
                    <p className="font-bold text-sm text-base-content truncate">{targetVerifiedBy?.fullName || "Admin"}</p>
                    {targetVerifiedBy?.email && <p className="text-xs text-base-content/60 truncate">{targetVerifiedBy.email}</p>}
                  </div>
                </div>

                {targetVerifiedAt && (
                  <div className="flex items-center justify-between p-2.5 rounded-lg bg-base-200/40 text-xs">
                    <span className="text-base-content/60 inline-flex items-center gap-1">
                      <Calendar className="size-3.5 shrink-0" /> Verification Timestamp:
                    </span>
                    <span className="font-medium text-base-content">
                      {new Date(targetVerifiedAt).toLocaleString("en-IN", {
                        dateStyle: "medium",
                        timeStyle: "short",
                      })}
                    </span>
                  </div>
                )}

                {targetStatus === "VERIFIED" && targetNote && (
                  <div className="p-3 rounded-xl bg-success/5 border border-success/20 text-xs">
                    <span className="font-semibold text-success block mb-0.5">Admin Verification Note:</span>
                    <p className="text-base-content/80 leading-relaxed italic">"{targetNote}"</p>
                  </div>
                )}

                {targetStatus === "REJECTED" && targetReason && (
                  <div className="p-3 rounded-xl bg-error/5 border border-error/20 text-xs">
                    <span className="font-semibold text-error block mb-0.5">Rejection Reason:</span>
                    <p className="text-error leading-relaxed italic">"{targetReason}"</p>
                  </div>
                )}

                {targetBillUrl && (
                  <div className="pt-1 flex items-center justify-between">
                    <div className="flex items-center gap-1.5">
                      <a
                        href={toViewUrl(targetBillUrl)}
                        target="_blank"
                        rel="noreferrer"
                        className="btn btn-sm border-base-300 gap-1.5 text-xs text-primary"
                      >
                        <Eye className="size-3.5" /> View Bill
                      </a>
                      <a
                        href={`/api/admin/property-verifications/${auditTarget._id}/bill-download`}
                        target="_blank"
                        rel="noreferrer"
                        className="btn btn-sm btn-ghost gap-1.5 text-xs"
                        title="Download Bill (PDF)"
                      >
                        <Download className="size-3.5" /> Download
                      </a>
                    </div>
                    <span className="text-[10px] text-base-content/50 inline-flex items-center gap-1">
                      <Lock className="size-3" /> Audit trail protected
                    </span>
                  </div>
                )}
              </div>

              <div className="mt-4 flex justify-end">
                <button
                  type="button"
                  className="btn btn-sm btn-primary"
                  onClick={() => setAuditTarget(null)}
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        );
      })()}
    </div>
  );
}

function VerificationPanel() {
  const [category, setCategory] = useState("owner"); // "owner" | "property"

  return (
    <div className="space-y-4">
      {/* Category Toggle Buttons */}
      <div className="flex gap-2 border-b border-base-300 pb-3">
        <button
          type="button"
          onClick={() => setCategory("owner")}
          className={`flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-semibold transition-all ${
            category === "owner"
              ? "bg-primary text-white shadow-sm"
              : "bg-base-200 text-base-content/70 hover:bg-base-300"
          }`}
        >
          <ShieldCheck className="size-4" />
          Owner Identity Verification
        </button>
        <button
          type="button"
          onClick={() => setCategory("property")}
          className={`flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-semibold transition-all ${
            category === "property"
              ? "bg-primary text-white shadow-sm"
              : "bg-base-200 text-base-content/70 hover:bg-base-300"
          }`}
        >
          <FileText className="size-4" />
          Property Address Verification (Bills)
        </button>
      </div>

      {category === "owner" ? <OwnerVerificationQueue /> : <PropertyAddressVerificationQueue />}
    </div>
  );
}

function FeatureFlagsPanel() {
  const queryClient = useQueryClient();
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [whitelistTargetFlag, setWhitelistTargetFlag] = useState(null);
  const [userSearchQuery, setUserSearchQuery] = useState("");
  const [newFlag, setNewFlag] = useState({
    key: "",
    name: "",
    description: "",
    rolloutPercentage: 0,
    isActive: true,
  });

  const { data, isLoading, isError, error } = useQuery({
    queryKey: ["adminFeatureFlags"],
    queryFn: async () => {
      try {
        const res = await axiosInstance.get("/admin/feature-flags");
        return res.data?.data?.flags || [];
      } catch (err) {
        toast.error(err?.response?.data?.message || "Failed to load feature flags");
        throw err;
      }
    },
  });

  const createMutation = useMutation({
    mutationFn: async (payload) => {
      const res = await axiosInstance.post("/admin/feature-flags", payload);
      return res.data;
    },
    onSuccess: () => {
      toast.success("Feature flag created");
      queryClient.invalidateQueries({ queryKey: ["adminFeatureFlags"] });
      setShowCreateModal(false);
      setNewFlag({ key: "", name: "", description: "", rolloutPercentage: 0, isActive: true });
    },
    onError: (err) => {
      toast.error(err?.response?.data?.message || "Failed to create feature flag");
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, updates }) => {
      const res = await axiosInstance.patch(`/admin/feature-flags/${id}`, updates);
      return res.data;
    },
    onSuccess: () => {
      toast.success("Feature flag updated");
      queryClient.invalidateQueries({ queryKey: ["adminFeatureFlags"] });
    },
    onError: (err) => {
      toast.error(err?.response?.data?.message || "Failed to update feature flag");
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id) => {
      const res = await axiosInstance.delete(`/admin/feature-flags/${id}`);
      return res.data;
    },
    onSuccess: () => {
      toast.success("Feature flag deleted");
      queryClient.invalidateQueries({ queryKey: ["adminFeatureFlags"] });
    },
    onError: (err) => {
      toast.error(err?.response?.data?.message || "Failed to delete feature flag");
    },
  });

  const whitelistMutation = useMutation({
    mutationFn: async ({ id, userIdentifier }) => {
      const res = await axiosInstance.post(`/admin/feature-flags/${id}/whitelist-user`, { userIdentifier });
      return res.data;
    },
    onSuccess: (data) => {
      toast.success(data?.message || "User whitelisted");
      queryClient.invalidateQueries({ queryKey: ["adminFeatureFlags"] });
      setUserSearchQuery("");
      setWhitelistTargetFlag(null);
    },
    onError: (err) => {
      toast.error(err?.response?.data?.message || "Failed to whitelist user");
    },
  });

  const removeWhitelistedUser = (flag, userIdToRemove) => {
    const updatedIds = (flag.enabledUserIds || [])
      .map((u) => (typeof u === "object" ? u._id : u))
      .filter((id) => id !== userIdToRemove);

    updateMutation.mutate({
      id: flag._id,
      updates: { enabledUserIds: updatedIds },
    });
  };

  const flags = data || [];

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-xl font-bold text-base-content flex items-center gap-2">
            <Flag className="size-5 text-primary" /> Feature Flags & % Rollouts
          </h2>
          <p className="text-sm text-base-content/60">
            Dynamically roll out features to percentages of users using deterministic MD5 hashing, or whitelist specific accounts.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setShowCreateModal(true)}
          className="btn btn-primary btn-sm gap-2"
        >
          <Plus className="size-4" /> New Flag
        </button>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center p-12">
          <Loader2 className="size-8 animate-spin text-primary" />
        </div>
      ) : isError ? (
        <div className="rounded-2xl border border-error/20 bg-error/5 p-8 text-center">
          <p className="text-sm font-semibold text-error">
            Failed to load feature flags: {error?.response?.data?.message || error?.message || "Unknown error"}
          </p>
          <button
            type="button"
            onClick={() => queryClient.invalidateQueries({ queryKey: ["adminFeatureFlags"] })}
            className="btn btn-sm btn-outline btn-error mt-3"
          >
            Retry
          </button>
        </div>
      ) : flags.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-base-300 p-12 text-center">
          <Flag className="mx-auto size-12 text-base-content/30" />
          <h3 className="mt-4 font-semibold text-base-content">No feature flags created yet</h3>
          <p className="mt-1 text-sm text-base-content/60">
            Create your first flag to start canary-testing new features safely.
          </p>
          <button
            type="button"
            onClick={() => setShowCreateModal(true)}
            className="btn btn-primary btn-sm mt-4 gap-2"
          >
            <Plus className="size-4" /> Create Feature Flag
          </button>
        </div>
      ) : (
        <div className="grid gap-4">
          {flags.map((flag) => {
            const isKillswitchOff = !flag.isActive;
            return (
              <div
                key={flag._id}
                className="rounded-2xl border border-base-200 bg-base-100 p-5 shadow-sm transition-all"
              >
                <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-xs font-bold uppercase tracking-wider text-primary bg-primary/10 px-2 py-0.5 rounded">
                        {flag.key}
                      </span>
                      <h3 className="font-bold text-base-content text-base">{flag.name}</h3>
                      {flag.isActive ? (
                        <span className="badge badge-success badge-sm">Active</span>
                      ) : (
                        <span className="badge badge-error badge-sm">Disabled (Killswitch)</span>
                      )}
                    </div>
                    {flag.description && (
                      <p className="text-sm text-base-content/70">{flag.description}</p>
                    )}
                  </div>

                  <div className="flex items-center gap-2 self-end lg:self-start">
                    <button
                      type="button"
                      onClick={() =>
                        updateMutation.mutate({
                          id: flag._id,
                          updates: { isActive: !flag.isActive },
                        })
                      }
                      className={`btn btn-sm gap-2 ${flag.isActive ? "btn-outline btn-error" : "btn-success"}`}
                      title="Killswitch Toggle"
                    >
                      {flag.isActive ? <ToggleRight className="size-4" /> : <ToggleLeft className="size-4" />}
                      {flag.isActive ? "Killswitch / Disable" : "Enable"}
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        if (confirm(`Are you sure you want to permanently delete flag "${flag.key}"?`)) {
                          deleteMutation.mutate(flag._id);
                        }
                      }}
                      className="btn btn-ghost btn-sm text-error"
                      title="Delete Flag"
                    >
                      <Trash2 className="size-4" />
                    </button>
                  </div>
                </div>

                {/* Rollout Percentage Controls */}
                <div className="mt-5 rounded-xl bg-base-200/50 p-4">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <Sliders className="size-4 text-primary" />
                      <span className="text-sm font-semibold text-base-content">Deterministic Rollout:</span>
                      <span className="text-sm font-bold text-primary font-mono">{flag.rolloutPercentage}%</span>
                    </div>
                    <div className="flex gap-1.5">
                      {[0, 10, 25, 50, 100].map((pct) => (
                        <button
                          key={pct}
                          type="button"
                          onClick={() =>
                            updateMutation.mutate({
                              id: flag._id,
                              updates: { rolloutPercentage: pct },
                            })
                          }
                          className={`btn btn-xs ${flag.rolloutPercentage === pct ? "btn-primary" : "btn-ghost"}`}
                        >
                          {pct}%
                        </button>
                      ))}
                    </div>
                  </div>

                  <input
                    type="range"
                    min="0"
                    max="100"
                    value={flag.rolloutPercentage}
                    onChange={(e) => {
                      const val = Number(e.target.value);
                      updateMutation.mutate({
                        id: flag._id,
                        updates: { rolloutPercentage: val },
                      });
                    }}
                    className="range range-primary range-sm w-full"
                    disabled={isKillswitchOff}
                  />
                  <div className="mt-1 flex justify-between text-[11px] text-base-content/50">
                    <span>0% (Whitelisted only)</span>
                    <span>25%</span>
                    <span>50%</span>
                    <span>75%</span>
                    <span>100% (All users)</span>
                  </div>
                </div>

                {/* Explicit Whitelist Section */}
                <div className="mt-4 pt-3 border-t border-base-200">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Users className="size-4 text-base-content/70" />
                      <span className="text-xs font-bold uppercase tracking-wider text-base-content/70">
                        Explicit User Whitelist ({(flag.enabledUserIds || []).length})
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={() => setWhitelistTargetFlag(flag)}
                      className="btn btn-ghost btn-xs text-primary gap-1"
                    >
                      <Plus className="size-3" /> Add Specific User
                    </button>
                  </div>

                  <div className="mt-2.5 flex flex-wrap gap-2">
                    {(flag.enabledUserIds || []).length === 0 ? (
                      <span className="text-xs text-base-content/50 italic">
                        No specific users whitelisted. Access is determined purely by rollout percentage and roles.
                      </span>
                    ) : (
                      flag.enabledUserIds.map((u) => {
                        const userId = typeof u === "object" ? u._id : u;
                        const label = typeof u === "object" ? (u.fullName || u.email || userId) : userId;
                        return (
                          <span
                            key={userId}
                            className="inline-flex items-center gap-1.5 rounded-full bg-base-200 px-3 py-1 text-xs font-medium text-base-content"
                          >
                            <UserAvatar
                              src={typeof u === "object" ? u.profilePic : null}
                              name={label}
                              className="size-4 rounded-full"
                            />
                            <span>{label}</span>
                            <button
                              type="button"
                              onClick={() => removeWhitelistedUser(flag, userId)}
                              className="text-base-content/50 hover:text-error ml-0.5"
                            >
                              <X className="size-3" />
                            </button>
                          </span>
                        );
                      })
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Whitelist User Modal */}
      {whitelistTargetFlag && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-md rounded-2xl bg-base-100 p-6 shadow-xl space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-bold text-base-content">
                Whitelist User for {whitelistTargetFlag.name}
              </h3>
              <button
                type="button"
                onClick={() => setWhitelistTargetFlag(null)}
                className="btn btn-ghost btn-sm btn-circle"
              >
                <X className="size-4" />
              </button>
            </div>
            <p className="text-xs text-base-content/70">
              Users added here will ALWAYS have access to this feature, even if the rollout percentage is set to 0%.
            </p>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                if (!userSearchQuery.trim()) return;
                whitelistMutation.mutate({
                  id: whitelistTargetFlag._id,
                  userIdentifier: userSearchQuery.trim(),
                });
              }}
              className="space-y-4"
            >
              <div>
                <label className="text-xs font-semibold text-base-content/80 mb-1 block">
                  User Email or MongoDB ID
                </label>
                <div className="relative">
                  <input
                    type="text"
                    required
                    placeholder="e.g. tester@example.com or 64f1..."
                    value={userSearchQuery}
                    onChange={(e) => setUserSearchQuery(e.target.value)}
                    className="input input-bordered w-full pr-10"
                  />
                  <Search className="absolute right-3 top-1/2 -translate-y-1/2 size-4 text-base-content/40" />
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setWhitelistTargetFlag(null)}
                  className="btn btn-ghost btn-sm"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={whitelistMutation.isPending || !userSearchQuery.trim()}
                  className="btn btn-primary btn-sm gap-2"
                >
                  {whitelistMutation.isPending && <Loader2 className="size-3 animate-spin" />}
                  Add User
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Create Flag Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-lg rounded-2xl bg-base-100 p-6 shadow-xl space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-bold text-base-content">Create Feature Flag</h3>
              <button
                type="button"
                onClick={() => setShowCreateModal(false)}
                className="btn btn-ghost btn-sm btn-circle"
              >
                <X className="size-4" />
              </button>
            </div>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                createMutation.mutate(newFlag);
              }}
              className="space-y-4"
            >
              <div>
                <label className="text-xs font-semibold text-base-content/80 mb-1 block">
                  Unique Key (snake_case)
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. ai_property_valuation"
                  value={newFlag.key}
                  onChange={(e) =>
                    setNewFlag((prev) => ({
                      ...prev,
                      key: e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, "_"),
                    }))
                  }
                  className="input input-bordered w-full font-mono text-sm"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-base-content/80 mb-1 block">
                  Display Name
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. AI Property Valuation"
                  value={newFlag.name}
                  onChange={(e) => setNewFlag((prev) => ({ ...prev, name: e.target.value }))}
                  className="input input-bordered w-full text-sm"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-base-content/80 mb-1 block">
                  Description
                </label>
                <textarea
                  rows={2}
                  placeholder="Briefly describe what this feature does..."
                  value={newFlag.description}
                  onChange={(e) => setNewFlag((prev) => ({ ...prev, description: e.target.value }))}
                  className="textarea textarea-bordered w-full text-sm"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-base-content/80 mb-1 block">
                  Initial Rollout Percentage ({newFlag.rolloutPercentage}%)
                </label>
                <input
                  type="range"
                  min="0"
                  max="100"
                  value={newFlag.rolloutPercentage}
                  onChange={(e) =>
                    setNewFlag((prev) => ({ ...prev, rolloutPercentage: Number(e.target.value) }))
                  }
                  className="range range-primary range-sm w-full"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="btn btn-ghost btn-sm"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={createMutation.isPending || !newFlag.key.trim() || !newFlag.name.trim()}
                  className="btn btn-primary btn-sm gap-2"
                >
                  {createMutation.isPending && <Loader2 className="size-3 animate-spin" />}
                  Create Flag
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

const AD_CATEGORIES = [
  "Real Estate",
  "Home Loans & Finance",
  "Interiors & Services",
  "Lifestyle & Entertainment",
];

function AdvertisementsPanel() {
  const queryClient = useQueryClient();
  const [page, setPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState("all");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [search, setSearch] = useState("");
  const [showModal, setShowModal] = useState(false);
  const [editingAd, setEditingAd] = useState(null);

  // Form state
  const [formData, setFormData] = useState({
    title: "",
    description: "",
    mediaUrl: "",
    ctaText: "Learn More",
    targetUrl: "",
    badgeText: "Sponsored",
    companyName: "",
    targetCity: "",
    targetIntent: "All",
    adCategory: "Real Estate",
    status: "active",
    frequencyCap: 3,
    startDate: new Date().toISOString().split("T")[0],
    endDate: "",
  });

  const { data, isLoading, isFetching } = useQuery({
    queryKey: ["adminAdvertisements", page, statusFilter, categoryFilter, search],
    queryFn: async () => {
      const response = await axiosInstance.get("/admin/advertisements", {
        params: {
          page,
          limit: 9,
          status: statusFilter !== "all" ? statusFilter : undefined,
          category: categoryFilter !== "all" ? categoryFilter : undefined,
          search: search.trim() || undefined,
        },
      });
      return response.data?.data;
    },
    placeholderData: keepPreviousData,
  });

  const advertisements = data?.advertisements || [];
  const pagination = data?.pagination || { page: 1, totalPages: 1, total: 0 };

  // Image upload mutation
  const { mutate: uploadImage, isPending: isUploadingImage } = useMutation({
    mutationFn: async (file) => {
      const form = new FormData();
      form.append("image", file);
      const response = await axiosInstance.post("/admin/advertisements/upload-image", form, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      return response.data?.data;
    },
    onSuccess: (result) => {
      setFormData((prev) => ({ ...prev, mediaUrl: result.url }));
      toast.success("Banner image uploaded successfully");
    },
    onError: (err) => {
      toast.error(err?.response?.data?.message || "Failed to upload banner image");
    },
  });

  // Create / Update mutation
  const { mutate: saveAd, isPending: isSaving } = useMutation({
    mutationFn: async () => {
      const payload = {
        title: formData.title.trim(),
        description: formData.description.trim(),
        mediaUrl: formData.mediaUrl.trim(),
        ctaText: formData.ctaText.trim() || "Learn More",
        targetUrl: formData.targetUrl.trim(),
        badgeText: formData.badgeText.trim() || "Sponsored",
        companyName: formData.companyName.trim(),
        targetCity: formData.targetCity.trim(),
        targetIntent: formData.targetIntent,
        adCategory: formData.adCategory || "Real Estate",
        status: formData.status,
        frequencyCap: Math.max(1, Math.min(50, Number(formData.frequencyCap) || 3)),
        startDate: formData.startDate ? new Date(formData.startDate) : undefined,
        endDate: formData.endDate ? new Date(formData.endDate) : null,
      };

      if (editingAd) {
        const response = await axiosInstance.patch(`/admin/advertisements/${editingAd._id}`, payload);
        return response.data?.data;
      }
      const response = await axiosInstance.post("/admin/advertisements", payload);
      return response.data?.data;
    },
    onSuccess: () => {
      toast.success(editingAd ? "Advertisement updated" : "Advertisement campaign created!");
      setShowModal(false);
      setEditingAd(null);
      queryClient.invalidateQueries({ queryKey: ["adminAdvertisements"] });
      queryClient.invalidateQueries({ queryKey: ["activeAdvertisements"] });
    },
    onError: (err) => {
      toast.error(err?.response?.data?.message || "Failed to save advertisement");
    },
  });

  // Toggle active/paused
  const { mutate: toggleStatus } = useMutation({
    mutationFn: async ({ id, newStatus }) => {
      const response = await axiosInstance.patch(`/admin/advertisements/${id}`, { status: newStatus });
      return response.data?.data;
    },
    onSuccess: (_, vars) => {
      toast.success(`Campaign marked as ${vars.newStatus}`);
      queryClient.invalidateQueries({ queryKey: ["adminAdvertisements"] });
      queryClient.invalidateQueries({ queryKey: ["activeAdvertisements"] });
    },
    onError: () => toast.error("Failed to update status"),
  });

  // Delete mutation
  const { mutate: deleteAd } = useMutation({
    mutationFn: async (id) => {
      const response = await axiosInstance.delete(`/admin/advertisements/${id}`);
      return response.data?.data;
    },
    onSuccess: () => {
      toast.success("Campaign deleted");
      queryClient.invalidateQueries({ queryKey: ["adminAdvertisements"] });
      queryClient.invalidateQueries({ queryKey: ["activeAdvertisements"] });
    },
    onError: () => toast.error("Failed to delete campaign"),
  });

  const handleOpenCreate = () => {
    setEditingAd(null);
    setFormData({
      title: "",
      description: "",
      mediaUrl: "",
      ctaText: "Learn More",
      targetUrl: "",
      badgeText: "Sponsored",
      companyName: "",
      targetCity: "",
      targetIntent: "All",
      adCategory: "Real Estate",
      status: "active",
      frequencyCap: 3,
      startDate: new Date().toISOString().split("T")[0],
      endDate: "",
    });
    setShowModal(true);
  };

  const handleOpenEdit = (ad) => {
    setEditingAd(ad);
    setFormData({
      title: ad.title || "",
      description: ad.description || "",
      mediaUrl: ad.mediaUrl || "",
      ctaText: ad.ctaText || "Learn More",
      targetUrl: ad.targetUrl || "",
      badgeText: ad.badgeText || "Sponsored",
      companyName: ad.companyName || "",
      targetCity: ad.targetCity || "",
      targetIntent: ad.targetIntent || "All",
      adCategory: ad.adCategory || "Real Estate",
      status: ad.status || "active",
      frequencyCap: ad.frequencyCap || 3,
      startDate: ad.startDate ? new Date(ad.startDate).toISOString().split("T")[0] : "",
      endDate: ad.endDate ? new Date(ad.endDate).toISOString().split("T")[0] : "",
    });
    setShowModal(true);
  };

  const handleDeletePrompt = (id, title) => {
    if (window.confirm(`Are you sure you want to delete campaign "${title}"?`)) {
      deleteAd(id);
    }
  };

  return (
    <div className="space-y-5">
      {/* Top Banner & Action */}
      <div className="flex flex-col gap-4 rounded-2xl border border-base-300 bg-base-100 p-4 shadow-sm sm:flex-row sm:items-center sm:justify-between sm:p-5">
        <div className="flex items-center gap-3">
          <div className="grid size-11 place-items-center rounded-xl bg-primary/15 text-primary">
            <Sparkles className="size-5" />
          </div>
          <div>
            <h2 className="text-base sm:text-lg font-bold text-base-content">
              Advertisements & Sponsored Campaigns
            </h2>
            <p className="text-xs text-base-content/60">
              Create and manage native sponsored ad cards interleaved into the marketplace feed.
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={handleOpenCreate}
          className="btn btn-primary btn-sm gap-2 shrink-0 shadow-sm"
        >
          <Plus className="size-4" />
          <span>New Campaign</span>
        </button>
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex flex-wrap gap-1.5">
            {["all", "active", "paused", "draft"].map((st) => (
              <button
                key={st}
                type="button"
                onClick={() => {
                  setStatusFilter(st);
                  setPage(1);
                }}
                className={`rounded-lg px-3 py-1.5 text-xs font-semibold capitalize transition-colors ${
                  statusFilter === st
                    ? "bg-primary text-white"
                    : "bg-base-200 text-base-content/70 hover:bg-base-300"
                }`}
              >
                {st}
              </button>
            ))}
          </div>

          <div className="h-4 w-px bg-base-300 hidden sm:block" />

          {/* Category Filter */}
          <select
            value={categoryFilter}
            onChange={(e) => {
              setCategoryFilter(e.target.value);
              setPage(1);
            }}
            className="select select-bordered select-xs text-xs h-8 rounded-lg"
          >
            <option value="all">All Categories</option>
            {AD_CATEGORIES.map((cat) => (
              <option key={cat} value={cat}>
                {cat}
              </option>
            ))}
          </select>
        </div>

        <div className="relative w-full sm:w-72">
          <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-base-content/40" />
          <input
            type="text"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
            placeholder="Search campaigns..."
            className="input input-sm input-bordered w-full pl-9 text-xs"
          />
        </div>
      </div>

      {/* Campaign Cards List */}
      {isLoading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="size-8 animate-spin text-primary" />
        </div>
      ) : advertisements.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-base-300 bg-base-100 p-12 text-center">
          <Megaphone className="mx-auto size-10 text-base-content/30" />
          <h3 className="mt-3 text-sm font-semibold text-base-content">No campaigns found</h3>
          <p className="mt-1 text-xs text-base-content/60">
            Create your first sponsored campaign to feature developer projects or announcements in the feed.
          </p>
          <button
            type="button"
            onClick={handleOpenCreate}
            className="btn btn-primary btn-sm mt-4 gap-2"
          >
            <Plus className="size-4" />
            <span>Create Campaign</span>
          </button>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {advertisements.map((ad) => {
            const isActive = ad.status === "active";
            const impressions = ad.impressionsCount || 0;
            const clicks = ad.clicksCount || 0;
            const ctr = ad.ctr != null ? ad.ctr : impressions > 0 ? ((clicks / impressions) * 100).toFixed(2) : 0;

            return (
              <div
                key={ad._id}
                className="flex flex-col justify-between overflow-hidden rounded-2xl border border-base-300 bg-base-100 shadow-sm transition hover:border-primary/40 hover:shadow-md"
              >
                <div>
                  {/* Image banner preview */}
                  <div className="relative aspect-[16/9] w-full overflow-hidden bg-base-200">
                    {ad.mediaUrl ? (
                      <img
                        src={ad.mediaUrl}
                        alt={ad.title}
                        className="h-full w-full object-cover"
                        loading="lazy"
                      />
                    ) : (
                      <div className="flex h-full items-center justify-center bg-base-300">
                        <ImageIcon className="size-8 text-base-content/30" />
                      </div>
                    )}

                    <div className="absolute top-2.5 left-2.5 flex items-center gap-1.5">
                      <span
                        className={`rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider ${
                          isActive
                            ? "bg-emerald-500 text-white"
                            : ad.status === "paused"
                              ? "bg-amber-500 text-white"
                              : "bg-gray-500 text-white"
                        }`}
                      >
                        {ad.status}
                      </span>
                      <span className="rounded-full bg-black/60 backdrop-blur px-2 py-0.5 text-[10px] font-medium text-white">
                        {ad.badgeText || "Sponsored"}
                      </span>
                    </div>

                    {ad.targetCity && (
                      <div className="absolute top-2.5 right-2.5">
                        <span className="rounded-full bg-base-100/90 backdrop-blur px-2 py-0.5 text-[10px] font-semibold text-base-content shadow">
                          {ad.targetCity}
                        </span>
                      </div>
                    )}
                  </div>

                  {/* Body Info */}
                  <div className="p-4">
                    <div className="flex items-center justify-between text-xs text-base-content/60">
                      <div className="flex items-center gap-1.5 truncate mr-2">
                        <span className="truncate">{ad.companyName || "Partner"}</span>
                        {ad.adCategory && (
                          <span className="shrink-0 rounded bg-base-200 px-1.5 py-0.5 text-[10px] font-semibold text-primary">
                            {ad.adCategory}
                          </span>
                        )}
                      </div>
                      <span className="shrink-0">Intent: {ad.targetIntent || "All"}</span>
                    </div>

                    <h3 className="mt-1.5 font-bold text-base-content text-sm sm:text-base line-clamp-1">
                      {ad.title}
                    </h3>
                    <p className="mt-1 text-xs text-base-content/70 line-clamp-2 leading-relaxed">
                      {ad.description}
                    </p>

                    {/* Schedule Date Badge */}
                    <div className="mt-2 flex items-center justify-between text-[11px] text-base-content/60">
                      <span>Schedule:</span>
                      <span className="font-medium text-base-content/80">
                        {ad.startDate ? new Date(ad.startDate).toLocaleDateString("en-IN", { month: "short", day: "numeric" }) : "Immediate"}
                        {ad.endDate ? ` → ${new Date(ad.endDate).toLocaleDateString("en-IN", { month: "short", day: "numeric" })}` : " (Ongoing)"}
                      </span>
                    </div>

                    {/* Analytics Summary */}
                    <div className="mt-3 grid grid-cols-3 gap-1.5 rounded-xl bg-base-200/60 p-2 text-center text-xs">
                      <div>
                        <div className="flex items-center justify-center gap-1 text-[11px] text-base-content/60">
                          <Eye className="size-3" />
                          <span>Views</span>
                        </div>
                        <span className="font-bold text-base-content">{impressions.toLocaleString()}</span>
                      </div>
                      <div>
                        <div className="flex items-center justify-center gap-1 text-[11px] text-base-content/60">
                          <MousePointerClick className="size-3" />
                          <span>Clicks</span>
                        </div>
                        <span className="font-bold text-base-content">{clicks.toLocaleString()}</span>
                      </div>
                      <div>
                        <div className="flex items-center justify-center gap-1 text-[11px] text-base-content/60">
                          <BarChart3 className="size-3" />
                          <span>CTR</span>
                        </div>
                        <span className="font-bold text-primary">{ctr}%</span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Footer Controls */}
                <div className="flex items-center justify-between border-t border-base-200 bg-base-100 px-4 py-2.5">
                  <button
                    type="button"
                    onClick={() =>
                      toggleStatus({
                        id: ad._id,
                        newStatus: isActive ? "paused" : "active",
                      })
                    }
                    className={`btn btn-xs gap-1 ${
                      isActive ? "btn-warning btn-outline" : "btn-success btn-outline"
                    }`}
                  >
                    {isActive ? <ToggleRight className="size-3.5" /> : <ToggleLeft className="size-3.5" />}
                    <span>{isActive ? "Pause" : "Activate"}</span>
                  </button>

                  <div className="flex items-center gap-1">
                    {ad.targetUrl && (
                      <a
                        href={ad.targetUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="btn btn-ghost btn-xs btn-circle text-base-content/60 hover:text-base-content"
                        title="Open Target Link"
                      >
                        <ExternalLink className="size-3.5" />
                      </a>
                    )}
                    <button
                      type="button"
                      onClick={() => handleOpenEdit(ad)}
                      className="btn btn-ghost btn-xs btn-circle text-base-content/60 hover:text-base-content"
                      title="Edit Campaign"
                    >
                      <Pencil className="size-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDeletePrompt(ad._id, ad.title)}
                      className="btn btn-ghost btn-xs btn-circle text-error/70 hover:text-error"
                      title="Delete Campaign"
                    >
                      <Trash2 className="size-3.5" />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Pagination */}
      {pagination.totalPages > 1 && (
        <div className="flex items-center justify-between pt-2 text-xs text-base-content/70">
          <span>
            Page {pagination.page} of {pagination.totalPages} ({pagination.total} total)
          </span>
          <div className="flex gap-2">
            <button
              type="button"
              disabled={page <= 1 || isFetching}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              className="btn btn-xs btn-ghost gap-1"
            >
              <ChevronLeft className="size-3.5" /> Prev
            </button>
            <button
              type="button"
              disabled={page >= pagination.totalPages || isFetching}
              onClick={() => setPage((p) => p + 1)}
              className="btn btn-xs btn-ghost gap-1"
            >
              Next <ChevronRight className="size-3.5" />
            </button>
          </div>
        </div>
      )}

      {/* Create / Edit Campaign Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="w-full max-w-lg rounded-2xl bg-base-100 p-5 shadow-2xl max-h-[92vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-3 border-b border-base-200">
              <div className="flex items-center gap-2">
                <Sparkles className="size-5 text-primary" />
                <h3 className="font-bold text-base text-base-content">
                  {editingAd ? "Edit Advertisement Campaign" : "New Advertisement Campaign"}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setShowModal(false)}
                className="btn btn-ghost btn-xs btn-circle text-base-content/60"
              >
                <X className="size-4" />
              </button>
            </div>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                saveAd();
              }}
              className="mt-4 space-y-3.5"
            >
              {/* Campaign Title */}
              <div>
                <label className="text-xs font-semibold text-base-content/80 mb-1 block">
                  Campaign Title *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Godrej Horizon Luxury 3 BHKs"
                  value={formData.title}
                  onChange={(e) => setFormData((prev) => ({ ...prev, title: e.target.value }))}
                  className="input input-sm input-bordered w-full text-xs"
                />
              </div>

              {/* Description */}
              <div>
                <label className="text-xs font-semibold text-base-content/80 mb-1 block">
                  Description / Copy *
                </label>
                <textarea
                  required
                  rows={3}
                  placeholder="e.g. Exclusive launch with world-class amenities. Zero brokerage on first 20 bookings."
                  value={formData.description}
                  onChange={(e) => setFormData((prev) => ({ ...prev, description: e.target.value }))}
                  className="textarea textarea-bordered w-full text-xs"
                />
              </div>

              {/* Advertiser & Badge */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold text-base-content/80 mb-1 block">
                    Advertiser / Brand Name
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Godrej Properties"
                    value={formData.companyName}
                    onChange={(e) => setFormData((prev) => ({ ...prev, companyName: e.target.value }))}
                    className="input input-sm input-bordered w-full text-xs"
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-base-content/80 mb-1 block">
                    Badge Label
                  </label>
                  <input
                    type="text"
                    placeholder="Sponsored"
                    value={formData.badgeText}
                    onChange={(e) => setFormData((prev) => ({ ...prev, badgeText: e.target.value }))}
                    className="input input-sm input-bordered w-full text-xs"
                  />
                </div>
              </div>

              {/* Banner Image Upload & Preview */}
              <div>
                <label className="text-xs font-semibold text-base-content/80 mb-1 block">
                  Banner Image *
                </label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    required
                    placeholder="Image URL or upload banner below"
                    value={formData.mediaUrl}
                    onChange={(e) => setFormData((prev) => ({ ...prev, mediaUrl: e.target.value }))}
                    className="input input-sm input-bordered flex-1 text-xs"
                  />
                  <label className="btn btn-sm btn-outline gap-1 text-xs cursor-pointer">
                    {isUploadingImage ? (
                      <Loader2 className="size-3.5 animate-spin" />
                    ) : (
                      <ImageIcon className="size-3.5" />
                    )}
                    <span>Upload</span>
                    <input
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) uploadImage(file);
                      }}
                    />
                  </label>
                </div>

                {formData.mediaUrl && (
                  <div className="mt-2 relative aspect-[21/9] w-full overflow-hidden rounded-xl border border-base-200">
                    <img
                      src={formData.mediaUrl}
                      alt="Banner Preview"
                      className="h-full w-full object-cover"
                    />
                  </div>
                )}
              </div>

              {/* Target Link & CTA Text */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold text-base-content/80 mb-1 block">
                    Target URL / Link *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="https://... or /property/..."
                    value={formData.targetUrl}
                    onChange={(e) => setFormData((prev) => ({ ...prev, targetUrl: e.target.value }))}
                    className="input input-sm input-bordered w-full text-xs"
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-base-content/80 mb-1 block">
                    CTA Button Label
                  </label>
                  <input
                    type="text"
                    placeholder="Learn More"
                    value={formData.ctaText}
                    onChange={(e) => setFormData((prev) => ({ ...prev, ctaText: e.target.value }))}
                    className="input input-sm input-bordered w-full text-xs"
                  />
                </div>
              </div>

              {/* Category & Targeting (City & Intent) */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="text-xs font-semibold text-base-content/80 mb-1 block">
                    Category *
                  </label>
                  <select
                    value={formData.adCategory}
                    onChange={(e) => setFormData((prev) => ({ ...prev, adCategory: e.target.value }))}
                    className="select select-sm select-bordered w-full text-xs"
                  >
                    {AD_CATEGORIES.map((cat) => (
                      <option key={cat} value={cat}>
                        {cat}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-xs font-semibold text-base-content/80 mb-1 block">
                    Target City (Optional)
                  </label>
                  <input
                    type="text"
                    placeholder="Leave empty for Pan-India"
                    value={formData.targetCity}
                    onChange={(e) => setFormData((prev) => ({ ...prev, targetCity: e.target.value }))}
                    className="input input-sm input-bordered w-full text-xs"
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-base-content/80 mb-1 block">
                    Target Intent
                  </label>
                  <select
                    value={formData.targetIntent}
                    onChange={(e) => setFormData((prev) => ({ ...prev, targetIntent: e.target.value }))}
                    className="select select-sm select-bordered w-full text-xs"
                  >
                    <option value="All">All Intent (Buy/Rent/Sell)</option>
                    <option value="Buy">Buyers only</option>
                    <option value="Rent">Renters only</option>
                    <option value="Sell">Sellers only</option>
                  </select>
                </div>
              </div>

              {/* Status & Daily Frequency Cap */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold text-base-content/80 mb-1 block">
                    Campaign Status
                  </label>
                  <select
                    value={formData.status}
                    onChange={(e) => setFormData((prev) => ({ ...prev, status: e.target.value }))}
                    className="select select-sm select-bordered w-full text-xs"
                  >
                    <option value="active">Active (Served in feed)</option>
                    <option value="paused">Paused (Hidden)</option>
                    <option value="draft">Draft (Saved for later)</option>
                  </select>
                </div>
                <div>
                  <label className="text-xs font-semibold text-base-content/80 mb-1 block">
                    Frequency Cap (Views/day)
                  </label>
                  <input
                    type="number"
                    min="1"
                    max="50"
                    placeholder="e.g. 3"
                    value={formData.frequencyCap}
                    onChange={(e) => setFormData((prev) => ({ ...prev, frequencyCap: e.target.value }))}
                    className="input input-sm input-bordered w-full text-xs"
                  />
                  <span className="mt-0.5 block text-[10px] text-base-content/50">
                    Max views per user per 24 hours
                  </span>
                </div>
              </div>

              {/* Schedule: Start Date & End Date */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold text-base-content/80 mb-1 block">
                    Start Date *
                  </label>
                  <input
                    type="date"
                    required
                    value={formData.startDate}
                    onChange={(e) => setFormData((prev) => ({ ...prev, startDate: e.target.value }))}
                    className="input input-sm input-bordered w-full text-xs"
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-base-content/80 mb-1 block">
                    End Date (Optional)
                  </label>
                  <input
                    type="date"
                    value={formData.endDate}
                    onChange={(e) => setFormData((prev) => ({ ...prev, endDate: e.target.value }))}
                    className="input input-sm input-bordered w-full text-xs"
                  />
                  <span className="mt-1 block text-[10px] text-base-content/50">
                    Leave blank to run continuously
                  </span>
                </div>
              </div>

              {/* Actions */}
              <div className="flex justify-end gap-2 pt-3 border-t border-base-200">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="btn btn-ghost btn-sm text-xs"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSaving || !formData.title.trim() || !formData.mediaUrl.trim() || !formData.targetUrl.trim()}
                  className="btn btn-primary btn-sm gap-2 text-xs"
                >
                  {isSaving && <Loader2 className="size-3.5 animate-spin" />}
                  <span>{editingAd ? "Save Changes" : "Publish Campaign"}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

function CoinHistoryPanel() {
  const [page, setPage] = useState(1);

  const { data, isLoading, isFetching } = useQuery({
    queryKey: ["adminCoinHistory", page],
    queryFn: async () => {
      const response = await axiosInstance.get("/admin/coin-history", { params: { page, limit: 20 } });
      return response.data?.data;
    },
    placeholderData: keepPreviousData,
  });

  const transactions = data?.transactions || [];
  const pagination = data?.pagination || { page: 1, totalPages: 1, total: 0 };
  const totalCoinsGranted = data?.totalCoinsGranted || 0;

  return (
    <div className="rounded-2xl border border-base-300 bg-base-100 shadow-sm">
      <div className="flex items-center justify-between border-b border-base-300 p-4 sm:p-5">
        <div className="flex items-center gap-2">
          <div className="grid size-9 place-items-center rounded-xl bg-amber-100 text-amber-600 dark:bg-amber-900/30 dark:text-amber-400">
            <Sparkles className="size-4" />
          </div>
          <div>
            <h2 className="font-semibold text-base-content">Coin Grant History</h2>
            <p className="text-xs text-base-content/60">{pagination.total} grants · {totalCoinsGranted.toLocaleString("en-IN")} total coins</p>
          </div>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b border-base-200 bg-base-200/40 text-xs uppercase tracking-wider text-base-content/60">
              <th className="px-4 py-3 sm:px-5">USER</th>
              <th className="px-4 py-3">COINS</th>
              <th className="px-4 py-3">REASON</th>
              <th className="px-4 py-3">BALANCE AFTER</th>
              <th className="px-4 py-3">DATE</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-base-200">
            {isLoading ? (
              <tr>
                <td colSpan={5} className="px-5 py-10 text-center">
                  <Loader2 className="mx-auto size-6 animate-spin text-primary" />
                </td>
              </tr>
            ) : transactions.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-5 py-10 text-center text-sm text-base-content/60">
                  No coin grants yet.
                </td>
              </tr>
            ) : (
              transactions.map((tx) => (
                <tr key={tx._id} className="hover:bg-base-200/70">
                  <td className="px-4 py-3 sm:px-5">
                    <div className="flex items-center gap-3">
                      <UserAvatar src={tx.user?.profilePic} name={tx.user?.fullName} sizeClass="size-8" userId={tx.user?._id} />
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold text-base-content">{tx.user?.fullName || "Unknown"}</p>
                        <p className="truncate text-xs text-base-content/60">{tx.user?.email || "—"}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2.5 py-1 text-xs font-bold text-amber-700 dark:bg-amber-900/20 dark:text-amber-400">
                      +{tx.amount}
                    </span>
                  </td>
                  <td className="max-w-[240px] truncate px-4 py-3 text-base-content/70">{tx.description || "—"}</td>
                  <td className="px-4 py-3 text-base-content/70">{tx.balanceAfter} coins</td>
                  <td className="whitespace-nowrap px-4 py-3 text-base-content/70">{formatDate(tx.createdAt)}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <div className="flex items-center justify-between border-t border-base-300 px-4 py-3 sm:px-5">
        <p className="text-xs text-base-content/60">
          Page {pagination.page} of {pagination.totalPages}
          {isFetching ? " · updating..." : ""}
        </p>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page <= 1}
            className="rounded-lg border border-base-300 p-1.5 text-base-content/60 transition-colors hover:bg-base-200 disabled:opacity-40"
          >
            <ChevronLeft className="size-4" />
          </button>
          <button
            type="button"
            onClick={() => setPage((p) => Math.min(pagination.totalPages, p + 1))}
            disabled={page >= pagination.totalPages}
            className="rounded-lg border border-base-300 p-1.5 text-base-content/60 transition-colors hover:bg-base-200 disabled:opacity-40"
          >
            <ChevronRight className="size-4" />
          </button>
        </div>
      </div>
    </div>
  );
}

export default function AdminPage() {
  const [activeTab, setActiveTab] = useState("users");
  const { data: authData } = useQuery({ queryKey: ["authUser"] });
  const authUser = authData?.data?.user || authData?.data || null;

  if (!authUser?.isAdmin) {
    return <Navigate to="/marketplace" replace />;
  }

  return (
    <AppShell title="Admin" subtitle="Manage platform users and marketplace posts.">
      <div className="mb-4 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => setActiveTab("users")}
          className={`rounded-lg px-4 py-2 text-sm font-semibold transition-colors ${
            activeTab === "users" ? "bg-primary text-white" : "bg-base-200 text-base-content/70 hover:bg-base-300"
          }`}
        >
          Users
        </button>
        <button
          type="button"
          onClick={() => setActiveTab("posts")}
          className={`rounded-lg px-4 py-2 text-sm font-semibold transition-colors ${
            activeTab === "posts" ? "bg-primary text-white" : "bg-base-200 text-base-content/70 hover:bg-base-300"
          }`}
        >
          Posts
        </button>
        <button
          type="button"
          onClick={() => setActiveTab("reports")}
          className={`rounded-lg px-4 py-2 text-sm font-semibold transition-colors ${
            activeTab === "reports" ? "bg-primary text-white" : "bg-base-200 text-base-content/70 hover:bg-base-300"
          }`}
        >
          Reports
        </button>
        <button
          type="button"
          onClick={() => setActiveTab("announcements")}
          className={`rounded-lg px-4 py-2 text-sm font-semibold transition-colors ${
            activeTab === "announcements" ? "bg-primary text-white" : "bg-base-200 text-base-content/70 hover:bg-base-300"
          }`}
        >
          Announcements
        </button>
        <button
          type="button"
          onClick={() => setActiveTab("feedback")}
          className={`rounded-lg px-4 py-2 text-sm font-semibold transition-colors ${
            activeTab === "feedback" ? "bg-primary text-white" : "bg-base-200 text-base-content/70 hover:bg-base-300"
          }`}
        >
          Feedback
        </button>
        <button
          type="button"
          onClick={() => setActiveTab("deals")}
          className={`inline-flex items-center gap-1.5 rounded-lg px-4 py-2 text-sm font-semibold transition-colors ${
            activeTab === "deals" ? "bg-primary text-white" : "bg-base-200 text-base-content/70 hover:bg-base-300"
          }`}
        >
          <Handshake className="size-4" /> Deals
        </button>
        <button
          type="button"
          onClick={() => setActiveTab("verification")}
          className={`inline-flex items-center gap-1.5 rounded-lg px-4 py-2 text-sm font-semibold transition-colors ${
            activeTab === "verification" ? "bg-primary text-white" : "bg-base-200 text-base-content/70 hover:bg-base-300"
          }`}
        >
          <ShieldCheck className="size-4" /> Verification
        </button>
        <button
          type="button"
          onClick={() => setActiveTab("feature-flags")}
          className={`inline-flex items-center gap-1.5 rounded-lg px-4 py-2 text-sm font-semibold transition-colors ${
            activeTab === "feature-flags" ? "bg-primary text-white" : "bg-base-200 text-base-content/70 hover:bg-base-300"
          }`}
        >
          <Flag className="size-4" /> Feature Flags
        </button>
        <button
          type="button"
          onClick={() => setActiveTab("advertisements")}
          className={`inline-flex items-center gap-1.5 rounded-lg px-4 py-2 text-sm font-semibold transition-colors ${
            activeTab === "advertisements" ? "bg-primary text-white" : "bg-base-200 text-base-content/70 hover:bg-base-300"
          }`}
        >
          <Sparkles className="size-4" /> Advertisements
        </button>
        <button
          type="button"
          onClick={() => setActiveTab("coins")}
          className={`inline-flex items-center gap-1.5 rounded-lg px-4 py-2 text-sm font-semibold transition-colors ${
            activeTab === "coins" ? "bg-amber-500 text-white" : "bg-base-200 text-base-content/70 hover:bg-base-300"
          }`}
        >
          <Sparkles className="size-4" /> Coins
        </button>
      </div>

      {activeTab === "users" ? (
        <UsersPanel />
      ) : activeTab === "posts" ? (
        <PostsPanel />
      ) : activeTab === "reports" ? (
        <ReportsPanel />
      ) : activeTab === "feedback" ? (
        <FeedbackPanel />
      ) : activeTab === "deals" ? (
        <DealsPanel />
      ) : activeTab === "verification" ? (
        <VerificationPanel />
      ) : activeTab === "feature-flags" ? (
        <FeatureFlagsPanel />
      ) : activeTab === "advertisements" ? (
        <AdvertisementsPanel />
      ) : activeTab === "coins" ? (
        <CoinHistoryPanel />
      ) : (
        <AnnouncementsPanel />
      )}
    </AppShell>
  );
}
