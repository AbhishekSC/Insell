import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Building2,
  CheckCircle2,
  Clock,
  Copy,
  Gift,
  Loader2,
  MapPin,
  Share2,
  Sparkles,
  TrendingUp,
  X,
  Zap,
} from "lucide-react";
import toast from "react-hot-toast";
import axiosInstance from "../lib/axios";

function formatMoney(value) {
  const amount = Number(value || 0);
  if (!Number.isFinite(amount) || amount <= 0) return "Price on request";
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(amount);
}

function formatExpiresAt(dateStr) {
  if (!dateStr) return "";
  const d = new Date(dateStr);
  return d.toLocaleDateString("en-IN", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function BoostPropertyModal({ isOpen, post, onClose, onSuccess }) {
  const queryClient = useQueryClient();
  const [copied, setCopied] = useState(false);

  // Close on Escape
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  const { data: referralData, isLoading: isReferralLoading } = useQuery({
    queryKey: ["referralInfo"],
    queryFn: async () => {
      const res = await axiosInstance.get("/referral/me");
      return res.data?.data;
    },
    enabled: isOpen,
    staleTime: 30 * 1000,
  });

  const { mutate: boostPost, isPending: isBoosting } = useMutation({
    mutationFn: async (postId) => {
      const res = await axiosInstance.post(`/posts/${postId}/boost`);
      return res.data?.data;
    },
    onSuccess: (updatedPost) => {
      toast.success("Listing boosted for 24 hours! 🚀");
      queryClient.invalidateQueries({ queryKey: ["propertyFeed"] });
      queryClient.invalidateQueries({ queryKey: ["userPosts"] });
      queryClient.invalidateQueries({ queryKey: ["userProfile"] });
      queryClient.invalidateQueries({ queryKey: ["referralInfo"] });
      queryClient.invalidateQueries({ queryKey: ["authUser"] });
      if (post?._id) {
        queryClient.invalidateQueries({ queryKey: ["post", post._id] });
      }
      onSuccess?.(updatedPost);
      onClose();
    },
    onError: (err) => {
      const msg = err?.response?.data?.message || "Failed to boost listing. Please try again.";
      toast.error(msg);
    },
  });

  if (!isOpen || !post) return null;

  const credits = referralData?.credits ?? 0;
  const isCurrentlyBoosted = Boolean(
    post.isBoosted &&
    post.boostExpiresAt &&
    new Date(post.boostExpiresAt).getTime() > Date.now()
  );

  const coverImage =
    (Array.isArray(post.mediaUrls) && post.mediaUrls[0]) ||
    (Array.isArray(post.media) && post.media[0]) ||
    null;
  const locationLabel = [post.locality, post.city].filter(Boolean).join(", ");

  const handleCopyLink = async () => {
    if (!referralData?.link) return;
    try {
      await navigator.clipboard.writeText(referralData.link);
      setCopied(true);
      toast.success("Referral link copied!");
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error("Couldn't copy link — select and copy manually");
    }
  };

  const handleShareLink = async () => {
    if (!referralData?.link) return;
    if (navigator.share) {
      try {
        await navigator.share({
          title: "Join me on NearMySpace",
          text: "Join NearMySpace and earn free referral coins to boost your property listings!",
          url: referralData.link,
        });
      } catch {
        /* user dismissed share dialog */
      }
    } else {
      handleCopyLink();
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 backdrop-blur-xs sm:items-center sm:p-4"
      onClick={onClose}
    >
      <div
        className="max-h-[90vh] w-full overflow-y-auto rounded-t-3xl bg-base-100 p-6 shadow-2xl transition-all sm:max-w-lg sm:rounded-3xl border border-base-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="grid size-11 place-items-center rounded-2xl bg-gradient-to-br from-amber-400 to-amber-600 text-white shadow-md shadow-amber-500/20">
              <Zap className="size-6 fill-white" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-lg font-bold text-base-content">Boost Property Listing</h3>
                <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-bold text-amber-900 border border-amber-300">
                  1 Coin = 24h
                </span>
              </div>
              <p className="text-xs text-base-content/60">
                Priority feed placement & Instagram-style boosted badge
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full p-1.5 text-base-content/50 hover:bg-base-200 hover:text-base-content transition-colors"
            title="Close"
          >
            <X className="size-5" />
          </button>
        </div>

        {/* Property Snapshot Card */}
        <div className="mt-4 flex items-center gap-3 rounded-2xl border border-base-200 bg-base-200/50 p-3">
          {coverImage ? (
            <img
              src={coverImage}
              alt={post.title}
              className="size-16 rounded-xl object-cover ring-1 ring-base-300 shrink-0"
            />
          ) : (
            <div className="grid size-16 place-items-center rounded-xl bg-base-300 text-base-content/40 shrink-0">
              <Building2 className="size-7" />
            </div>
          )}
          <div className="min-w-0 flex-1">
            <h4 className="truncate text-sm font-bold text-base-content">{post.title || "Untitled Property"}</h4>
            {locationLabel && (
              <p className="mt-0.5 flex items-center gap-1 truncate text-xs text-base-content/60">
                <MapPin className="size-3 shrink-0 text-base-content/50" />
                {locationLabel}
              </p>
            )}
            <div className="mt-1 flex items-center gap-2">
              <span className="text-xs font-extrabold text-primary">{formatMoney(post.price)}</span>
              {isCurrentlyBoosted && (
                <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-bold text-emerald-800 border border-emerald-300">
                  <Zap className="size-2.5 fill-emerald-600 text-emerald-600" />
                  Active Boost
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Currently Active Banner */}
        {isCurrentlyBoosted && (
          <div className="mt-3 flex items-center justify-between rounded-xl border border-emerald-300/80 bg-emerald-50/90 px-3.5 py-2 text-xs text-emerald-900">
            <div className="flex items-center gap-1.5">
              <Clock className="size-3.5 text-emerald-600 shrink-0" />
              <span>
                Boost active until <strong>{formatExpiresAt(post.boostExpiresAt)}</strong>
              </span>
            </div>
            <span className="font-semibold text-emerald-700">Priority Ranked</span>
          </div>
        )}

        {/* Coins Balance Banner */}
        <div className="mt-4 flex items-center justify-between rounded-2xl border border-amber-300/80 bg-gradient-to-r from-amber-50 to-amber-100/60 p-4 shadow-xs">
          <div className="flex items-center gap-3">
            <div className="grid size-10 place-items-center rounded-xl bg-amber-500/20 text-xl shadow-xs">
              🪙
            </div>
            <div>
              <p className="text-xs font-semibold text-amber-900/70 uppercase tracking-wide">
                Your Referral Coins
              </p>
              <div className="flex items-baseline gap-1.5">
                <span className="text-2xl font-black text-amber-950">
                  {isReferralLoading ? "..." : credits}
                </span>
                <span className="text-xs font-semibold text-amber-900">
                  {credits === 1 ? "Coin available" : "Coins available"}
                </span>
              </div>
            </div>
          </div>

          <div className="text-right">
            <span className="rounded-xl bg-amber-500/15 px-2.5 py-1 text-[11px] font-bold text-amber-900">
              1 Coin = 1 Boost
            </span>
          </div>
        </div>

        {/* Benefits Breakdown */}
        <div className="mt-4 space-y-2.5">
          <p className="text-xs font-bold uppercase tracking-wider text-base-content/60">
            Boost Benefits
          </p>

          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            <div className="flex items-start gap-2.5 rounded-xl border border-base-200 bg-base-100 p-2.5">
              <div className="grid size-7 shrink-0 place-items-center rounded-lg bg-amber-100 text-amber-700">
                <Zap className="size-4 fill-amber-600 text-amber-600" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-xs font-bold text-base-content">Priority Feed Placement</p>
                <p className="text-[11px] text-base-content/60">Ranks at the top of buyer and tenant feeds</p>
              </div>
            </div>

            <div className="flex items-start gap-2.5 rounded-xl border border-base-200 bg-base-100 p-2.5">
              <div className="grid size-7 shrink-0 place-items-center rounded-lg bg-primary/10 text-primary">
                <Sparkles className="size-4" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-xs font-bold text-base-content">Boosted Badge</p>
                <p className="text-[11px] text-base-content/60">Instagram-style badge catches attention</p>
              </div>
            </div>

            <div className="flex items-start gap-2.5 rounded-xl border border-base-200 bg-base-100 p-2.5">
              <div className="grid size-7 shrink-0 place-items-center rounded-lg bg-emerald-100 text-emerald-700">
                <TrendingUp className="size-4" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-xs font-bold text-base-content">3x More Inquiries</p>
                <p className="text-[11px] text-base-content/60">Attract qualified buyers and deals faster</p>
              </div>
            </div>

            <div className="flex items-start gap-2.5 rounded-xl border border-base-200 bg-base-100 p-2.5">
              <div className="grid size-7 shrink-0 place-items-center rounded-lg bg-info/10 text-info">
                <Clock className="size-4" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-xs font-bold text-base-content">24 Hours Duration</p>
                <p className="text-[11px] text-base-content/60">Continuous boost, extend anytime</p>
              </div>
            </div>
          </div>
        </div>

        {/* Action Section: Has Coins vs Needs Coins */}
        {credits >= 1 ? (
          <div className="mt-6 space-y-2">
            <button
              type="button"
              disabled={isBoosting}
              onClick={() => boostPost(post._id)}
              className="flex w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-amber-500 to-amber-600 px-5 py-3.5 text-sm font-bold text-white shadow-md shadow-amber-500/25 transition-all hover:from-amber-600 hover:to-amber-700 active:scale-[0.99] disabled:opacity-50"
            >
              {isBoosting ? (
                <>
                  <Loader2 className="size-4 animate-spin" />
                  <span>Boosting Listing...</span>
                </>
              ) : (
                <>
                  <Zap className="size-4 fill-white" />
                  <span>
                    {isCurrentlyBoosted
                      ? "Extend Boost for 24h (1 Coin)"
                      : "Boost Listing for 24h (1 Coin)"}
                  </span>
                </>
              )}
            </button>
            <p className="text-center text-[11px] text-base-content/50">
              1 referral coin will be deducted from your balance.
            </p>
          </div>
        ) : (
          <div className="mt-5 rounded-2xl border border-amber-200 bg-amber-50/70 p-4">
            <div className="flex items-start gap-3">
              <div className="grid size-9 shrink-0 place-items-center rounded-xl bg-amber-500/20 text-amber-800">
                <Gift className="size-5" />
              </div>
              <div className="min-w-0 flex-1">
                <h5 className="text-xs font-bold text-amber-950">Earn Free Coins by Inviting Friends</h5>
                <p className="mt-0.5 text-[11px] text-amber-900/80">
                  You need 1 coin to boost this listing. Share your referral link — whenever a friend
                  joins and verifies, you each receive 1 coin!
                </p>

                {referralData?.link && (
                  <div className="mt-3 flex items-center gap-2 rounded-xl border border-amber-300/80 bg-base-100 p-1.5 shadow-xs">
                    <span className="min-w-0 flex-1 truncate px-2 font-mono text-xs text-base-content/75">
                      {referralData.link}
                    </span>
                    <button
                      type="button"
                      onClick={handleCopyLink}
                      className="flex shrink-0 items-center gap-1 rounded-lg bg-amber-500 px-3 py-1.5 text-xs font-bold text-white hover:bg-amber-600 transition-colors"
                    >
                      {copied ? (
                        <>
                          <CheckCircle2 className="size-3.5" />
                          Copied
                        </>
                      ) : (
                        <>
                          <Copy className="size-3.5" />
                          Copy Link
                        </>
                      )}
                    </button>
                  </div>
                )}

                <div className="mt-3 flex gap-2">
                  <button
                    type="button"
                    onClick={handleShareLink}
                    className="flex flex-1 items-center justify-center gap-1.5 rounded-xl border border-amber-400 bg-amber-100/70 py-2 text-xs font-bold text-amber-950 hover:bg-amber-200 transition-colors"
                  >
                    <Share2 className="size-3.5" />
                    Share Invite Link
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
