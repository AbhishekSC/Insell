import { useEffect, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Bell, BellRing, X } from "lucide-react";
import toast from "react-hot-toast";
import axiosInstance from "../lib/axios";

function formatMoney(amount) {
  const num = Number(amount);
  if (!Number.isFinite(num)) return "";
  if (num >= 10000000) return `₹${(num / 10000000).toFixed(2)} Cr`;
  if (num >= 100000) return `₹${(num / 100000).toFixed(2)} L`;
  return `₹${num.toLocaleString("en-IN")}`;
}

// "Tell me when this drops to my number" — a per-buyer price watch.
export default function PriceAlertButton({ postId, currentPrice }) {
  const queryClient = useQueryClient();
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState("");

  const { data } = useQuery({
    queryKey: ["priceAlert", postId],
    queryFn: async () => {
      const res = await axiosInstance.get(`/price-alerts/post/${postId}`, { skipErrorToast: true });
      return res.data?.data || { alert: null, watcherCount: 0 };
    },
    enabled: Boolean(postId),
    staleTime: 60_000,
  });

  const alert = data?.alert || null;
  const watcherCount = data?.watcherCount || 0;

  useEffect(() => {
    if (editing) {
      const suggested = alert?.targetPrice || (currentPrice > 0 ? Math.round(currentPrice * 0.95) : "");
      setValue(String(suggested || ""));
    }
  }, [editing, alert, currentPrice]);

  const save = useMutation({
    mutationFn: async (targetPrice) => {
      const res = await axiosInstance.put(`/price-alerts/post/${postId}`, { targetPrice });
      return res.data?.data;
    },
    onSuccess: (result) => {
      queryClient.setQueryData(["priceAlert", postId], result);
      setEditing(false);
      toast.success(`We'll alert you if the price drops to ${formatMoney(result.alert.targetPrice)}`);
    },
    onError: (err) => toast.error(err?.response?.data?.message || "Couldn't set the alert"),
  });

  const remove = useMutation({
    mutationFn: async () => {
      const res = await axiosInstance.delete(`/price-alerts/post/${postId}`);
      return res.data?.data;
    },
    onSuccess: (result) => {
      queryClient.setQueryData(["priceAlert", postId], { alert: null, watcherCount: result?.watcherCount || 0 });
      toast.success("Price alert removed");
    },
    onError: () => toast.error("Couldn't remove the alert"),
  });

  const submit = () => {
    const n = Math.round(Number(value));
    if (!Number.isFinite(n) || n < 1) return toast.error("Enter a valid target price");
    if (currentPrice > 0 && n >= currentPrice) return toast.error("Set a target below the current price");
    save.mutate(n);
  };

  if (editing) {
    return (
      <div className="w-full rounded-xl border border-primary/30 bg-primary/5 p-3">
        <label className="mb-1.5 block text-xs font-semibold text-base-content/70">
          Alert me when the price drops to
        </label>
        <div className="flex items-center gap-2">
          <input
            type="number"
            inputMode="numeric"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && submit()}
            placeholder="Target price (₹)"
            className="min-w-0 flex-1 rounded-lg border border-base-300 bg-base-100 px-3 py-2 text-sm outline-none focus:border-primary/50"
            autoFocus
          />
          <button
            onClick={submit}
            disabled={save.isPending}
            className="shrink-0 rounded-lg bg-primary px-3 py-2 text-sm font-semibold text-white disabled:opacity-50"
          >
            Set
          </button>
          <button
            onClick={() => setEditing(false)}
            className="shrink-0 rounded-lg p-2 text-base-content/50 hover:bg-base-200"
            aria-label="Cancel"
          >
            <X className="size-4" />
          </button>
        </div>
        {value && currentPrice > 0 && Number(value) < currentPrice && (
          <p className="mt-1.5 text-xs text-base-content/50">
            {Math.round((1 - Number(value) / currentPrice) * 100)}% below the current {formatMoney(currentPrice)}
          </p>
        )}
      </div>
    );
  }

  if (alert) {
    return (
      <div className="flex w-full items-center justify-between gap-2 rounded-xl border border-primary/30 bg-primary/10 px-4 py-3">
        <span className="flex items-center gap-2 text-sm font-semibold text-primary">
          <BellRing className="size-4" />
          Watching · {formatMoney(alert.targetPrice)}
        </span>
        <span className="flex items-center gap-1.5">
          <button
            onClick={() => setEditing(true)}
            className="rounded-lg px-2 py-1 text-xs font-medium text-primary hover:bg-primary/10"
          >
            Edit
          </button>
          <button
            onClick={() => remove.mutate()}
            disabled={remove.isPending}
            className="rounded-lg px-2 py-1 text-xs font-medium text-base-content/50 hover:bg-base-200 disabled:opacity-50"
          >
            Remove
          </button>
        </span>
      </div>
    );
  }

  return (
    <button
      onClick={() => setEditing(true)}
      className="flex w-full items-center justify-center gap-2 rounded-xl border border-base-300 bg-base-100 px-4 py-3 font-semibold text-base-content transition-colors hover:bg-base-200"
    >
      <Bell className="size-5" />
      Alert me on a price drop
      {watcherCount > 0 && (
        <span className="text-xs font-normal text-base-content/50">· {watcherCount} watching</span>
      )}
    </button>
  );
}
