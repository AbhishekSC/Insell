import { useEffect, useState } from "react";
import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ChevronLeft, ChevronRight, Loader2, Search, ShieldCheck, ShieldOff, Users } from "lucide-react";
import toast from "react-hot-toast";
import AppShell from "../components/AppShell";
import UserAvatar from "../components/UserAvatar";
import axiosInstance from "../lib/axios";

const ROLE_OPTIONS = ["Buyer", "Seller", "Tenant", "Landlord", "Broker", "Builder"];

function formatDate(dateString) {
  if (!dateString) return "—";
  const date = new Date(dateString);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
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

export default function AdminPage() {
  const queryClient = useQueryClient();
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("all");
  const [role, setRole] = useState("");
  const [page, setPage] = useState(1);
  const [pendingBlockId, setPendingBlockId] = useState(null);
  const [confirmTarget, setConfirmTarget] = useState(null);

  // Debounce the search box so we don't fire a request on every keystroke.
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
    <AppShell title="Admin" subtitle="Manage platform users.">
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
      </div>

      <ConfirmBlockModal
        user={confirmTarget}
        isPending={Boolean(confirmTarget) && pendingBlockId === confirmTarget?._id}
        onCancel={() => setConfirmTarget(null)}
        onConfirm={handleConfirmToggleBlock}
      />
    </AppShell>
  );
}
