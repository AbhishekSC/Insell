import { Clock, X } from "lucide-react";
import CommunityAvatar from "./CommunityAvatar";

export default function RequestedCommunityCard({ community, onCancel, isCancelling }) {
  const memberCount = community.members?.length || 0;

  return (
    <div className="flex flex-col rounded-xl border border-base-300 bg-base-100 p-4 shadow-sm transition-all hover:shadow-md">
      <div className="flex items-center gap-3">
        <CommunityAvatar name={community.name} photo={community.photo} />
        <div className="min-w-0 flex-1">
          <h3 className="truncate text-sm font-semibold text-base-content">{community.name}</h3>
          <p className="mt-0.5 line-clamp-1 text-xs text-base-content/60">{community.topic}</p>
        </div>
      </div>

      <p className="mt-3 text-xs text-base-content/60">{memberCount} members</p>
      <span className="mt-2 inline-flex w-fit items-center gap-1 rounded-full bg-warning/15 px-2.5 py-1 text-[11px] font-semibold text-warning">
        <Clock size={11} />
        Pending approval
      </span>

      <button
        type="button"
        onClick={onCancel}
        disabled={isCancelling}
        className="mt-4 flex items-center justify-center gap-2 rounded-lg border border-base-300 px-3 py-2 text-sm font-semibold text-base-content/70 transition-colors hover:bg-base-200 disabled:opacity-50"
      >
        <X size={16} />
        {isCancelling ? "Cancelling..." : "Cancel request"}
      </button>
    </div>
  );
}
