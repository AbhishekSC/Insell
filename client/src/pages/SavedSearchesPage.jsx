import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Link } from "react-router";
import { Bell, BellOff, Trash2, Search, Loader2 } from "lucide-react";
import toast from "react-hot-toast";
import axiosInstance from "../lib/axios";

// Turn a saved search's filters into a feed URL so "View matches" lands on
// the marketplace pre-filtered.
function feedLink(filters = {}) {
  const p = new URLSearchParams();
  if (filters.city) p.set("q", filters.city);
  return `/marketplace${p.toString() ? `?${p}` : ""}`;
}

export default function SavedSearchesPage() {
  const queryClient = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ["savedSearches"],
    queryFn: async () => {
      const res = await axiosInstance.get("/saved-searches");
      return res.data?.data?.searches || [];
    },
  });

  const searches = data || [];

  const toggle = useMutation({
    mutationFn: async ({ id, active }) => axiosInstance.patch(`/saved-searches/${id}`, { active }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["savedSearches"] }),
    onError: () => toast.error("Couldn't update the search"),
  });

  const remove = useMutation({
    mutationFn: async (id) => axiosInstance.delete(`/saved-searches/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["savedSearches"] });
      toast.success("Saved search removed");
    },
    onError: () => toast.error("Couldn't remove the search"),
  });

  return (
    <div className="mx-auto max-w-2xl px-4 py-6">
      <h1 className="text-xl font-bold text-base-content">Saved searches</h1>
      <p className="mt-1 text-sm text-base-content/60">
        We'll notify you the moment a new listing matches. Save a search from the marketplace filters.
      </p>

      {isLoading ? (
        <div className="flex justify-center py-16 text-base-content/40">
          <Loader2 className="size-6 animate-spin" />
        </div>
      ) : searches.length === 0 ? (
        <div className="mt-8 rounded-2xl border border-dashed border-base-300 p-8 text-center">
          <Search className="mx-auto size-8 text-base-content/30" />
          <p className="mt-3 text-sm text-base-content/60">No saved searches yet.</p>
          <Link to="/marketplace" className="mt-3 inline-block text-sm font-semibold text-primary hover:underline">
            Browse the marketplace →
          </Link>
        </div>
      ) : (
        <ul className="mt-5 space-y-3">
          {searches.map((s) => (
            <li
              key={s.id}
              className={`rounded-2xl border border-base-300 bg-base-100 p-4 ${s.active ? "" : "opacity-60"}`}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-base-content">{s.label}</p>
                  <p className="mt-0.5 text-xs text-base-content/50">
                    {s.matchCount > 0 ? `${s.matchCount} match${s.matchCount > 1 ? "es" : ""} so far` : "No matches yet"}
                    {s.active ? "" : " · paused"}
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-1">
                  <button
                    type="button"
                    title={s.active ? "Pause alerts" : "Resume alerts"}
                    onClick={() => toggle.mutate({ id: s.id, active: !s.active })}
                    className="rounded-lg p-2 text-base-content/50 hover:bg-base-200"
                  >
                    {s.active ? <Bell className="size-4" /> : <BellOff className="size-4" />}
                  </button>
                  <button
                    type="button"
                    title="Delete"
                    onClick={() => remove.mutate(s.id)}
                    className="rounded-lg p-2 text-base-content/50 hover:bg-error/10 hover:text-error"
                  >
                    <Trash2 className="size-4" />
                  </button>
                </div>
              </div>
              <Link
                to={feedLink(s.filters)}
                className="mt-2 inline-block text-xs font-semibold text-primary hover:underline"
              >
                View matches →
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
