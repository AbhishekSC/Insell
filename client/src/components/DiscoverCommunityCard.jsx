import { Building2, HardHat, Sofa, TrendingUp, UserPlus, Users } from "lucide-react";

const CATEGORY_STYLES = {
  "Real Estate": { icon: Building2, bg: "bg-primary/10", text: "text-primary", pill: "bg-primary/15 text-primary" },
  Construction: { icon: HardHat, bg: "bg-warning/10", text: "text-warning", pill: "bg-warning/15 text-warning" },
  Investment: { icon: TrendingUp, bg: "bg-success/10", text: "text-success", pill: "bg-success/15 text-success" },
  Lifestyle: { icon: Sofa, bg: "bg-secondary/10", text: "text-secondary", pill: "bg-secondary/15 text-secondary" },
  General: { icon: Users, bg: "bg-base-200", text: "text-base-content/70", pill: "bg-base-200 text-base-content" },
};

function categoryStyle(category) {
  return CATEGORY_STYLES[category] || CATEGORY_STYLES.General;
}

export default function DiscoverCommunityCard({ community, onJoin }) {
  const style = categoryStyle(community.category);
  const Icon = style.icon;
  const memberCount = community.memberCount ?? community.members?.length ?? 0;

  return (
    <div className="flex flex-col rounded-xl border border-base-300 bg-base-100 p-4 shadow-sm transition-all hover:shadow-md">
      {community.photo ? (
        <img src={community.photo} alt={community.name} className="mb-3 h-12 w-12 rounded-xl object-cover" />
      ) : (
        <div className={`mb-3 grid size-12 place-items-center rounded-xl ${style.bg} ${style.text}`}>
          <Icon size={22} />
        </div>
      )}
      <h3 className="font-semibold text-base-content">{community.name}</h3>
      <p className="mt-0.5 line-clamp-2 text-sm text-base-content/60">{community.topic}</p>

      <p className="mt-3 text-xs text-base-content/60">{memberCount} members</p>
      <div className="mt-2 flex flex-wrap items-center gap-1.5">
        <span className={`inline-block w-fit rounded-full px-2.5 py-1 text-[11px] font-semibold ${style.pill}`}>
          {community.category || "General"}
        </span>
        {community.mutualFriendCount > 0 ? (
          <span className="inline-flex w-fit items-center gap-1 rounded-full bg-success/15 px-2.5 py-1 text-[11px] font-semibold text-success">
            <Users size={11} />
            {community.mutualFriendCount} {community.mutualFriendCount === 1 ? "friend" : "friends"} here
          </span>
        ) : null}
      </div>

      <button
        onClick={() => onJoin(community._id)}
        className="mt-4 flex items-center justify-center gap-2 rounded-lg border border-primary px-3 py-2 text-sm font-semibold text-primary hover:bg-primary/10 transition-colors"
      >
        <UserPlus size={16} />
        Join Community
      </button>
    </div>
  );
}
