import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Copy, Gift, Users } from "lucide-react";
import toast from "react-hot-toast";
import axiosInstance from "../lib/axios";

// Invite-a-friend program — a referral link that credits both sides once
// the invited friend verifies their account. Credits are redeemable
// against boosted listings once that ships; for now it's a running balance.
export default function ReferralCard() {
  const [copied, setCopied] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ["referralInfo"],
    queryFn: async () => {
      const res = await axiosInstance.get("/referral/me");
      return res.data?.data;
    },
    staleTime: 60 * 1000,
  });

  const copyLink = async () => {
    if (!data?.link) return;
    try {
      await navigator.clipboard.writeText(data.link);
      setCopied(true);
      toast.success("Referral link copied");
      setTimeout(() => setCopied(false), 1500);
    } catch {
      toast.error("Couldn't copy — long-press the link instead");
    }
  };

  const shareLink = async () => {
    if (!data?.link) return;
    if (navigator.share) {
      try {
        await navigator.share({ title: "Join me on NearMySpace", url: data.link });
      } catch {
        /* user cancelled the share sheet */
      }
    } else {
      copyLink();
    }
  };

  if (isLoading) return null;

  return (
    <div className="rounded-3xl border border-base-300 bg-base-100 p-5 shadow-sm">
      <div className="mb-4 flex items-center gap-2 text-sm font-semibold text-base-content/80">
        <Gift className="size-4 text-secondary" />
        Invite friends
      </div>

      <p className="text-sm text-base-content/65">
        Share your link — when a friend joins and verifies their account, you both earn a credit
        toward a boosted listing.
      </p>

      <div className="mt-4 flex items-center gap-2 rounded-xl border border-base-300 bg-base-200 px-3 py-2">
        <span className="min-w-0 flex-1 truncate text-sm font-mono text-base-content/80">{data?.link}</span>
        <button
          type="button"
          onClick={copyLink}
          className="shrink-0 rounded-lg p-1.5 text-base-content/50 transition hover:bg-base-300 hover:text-base-content"
          title="Copy link"
        >
          <Copy className="size-4" />
        </button>
      </div>

      <div className="mt-4 flex items-center gap-4">
        <div>
          <p className="text-2xl font-black text-primary">{data?.credits ?? 0}</p>
          <p className="text-xs text-base-content/55">credit{data?.credits === 1 ? "" : "s"} earned</p>
        </div>
        <div className="flex items-center gap-1.5 text-sm text-base-content/60">
          <Users className="size-4" />
          {data?.successfulReferrals ?? 0} friend{data?.successfulReferrals === 1 ? "" : "s"} joined
        </div>
      </div>

      <button type="button" className="btn btn-secondary btn-sm mt-4 w-full" onClick={shareLink}>
        {copied ? "Copied!" : "Share invite link"}
      </button>
    </div>
  );
}
