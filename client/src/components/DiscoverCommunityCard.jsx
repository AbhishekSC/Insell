import { Building2, HardHat, Sofa, TrendingUp, UserPlus, Users } from "lucide-react";

const CATEGORY_STYLES = {
  "Real Estate": { icon: Building2, bg: "bg-indigo-50", text: "text-indigo-600", pill: "bg-indigo-100 text-indigo-700" },
  Construction: { icon: HardHat, bg: "bg-orange-50", text: "text-orange-600", pill: "bg-orange-100 text-orange-700" },
  Investment: { icon: TrendingUp, bg: "bg-emerald-50", text: "text-emerald-600", pill: "bg-emerald-100 text-emerald-700" },
  Lifestyle: { icon: Sofa, bg: "bg-purple-50", text: "text-purple-600", pill: "bg-purple-100 text-purple-700" },
  General: { icon: Users, bg: "bg-slate-100", text: "text-slate-600", pill: "bg-slate-100 text-slate-700" },
};

function categoryStyle(category) {
  return CATEGORY_STYLES[category] || CATEGORY_STYLES.General;
}

export default function DiscoverCommunityCard({ community, onJoin }) {
  const style = categoryStyle(community.category);
  const Icon = style.icon;
  const memberCount = community.memberCount ?? community.members?.length ?? 0;

  return (
    <div className="flex flex-col rounded-xl border border-slate-200 bg-white p-4 shadow-sm transition-all hover:shadow-md">
      {community.photo ? (
        <img src={community.photo} alt={community.name} className="mb-3 h-12 w-12 rounded-xl object-cover" />
      ) : (
        <div className={`mb-3 grid size-12 place-items-center rounded-xl ${style.bg} ${style.text}`}>
          <Icon size={22} />
        </div>
      )}
      <h3 className="font-semibold text-slate-900">{community.name}</h3>
      <p className="mt-0.5 line-clamp-2 text-sm text-slate-500">{community.topic}</p>

      <p className="mt-3 text-xs text-slate-500">{memberCount} members</p>
      <div className="mt-2 flex flex-wrap items-center gap-1.5">
        <span className={`inline-block w-fit rounded-full px-2.5 py-1 text-[11px] font-semibold ${style.pill}`}>
          {community.category || "General"}
        </span>
        {community.mutualFriendCount > 0 ? (
          <span className="inline-flex w-fit items-center gap-1 rounded-full bg-emerald-100 px-2.5 py-1 text-[11px] font-semibold text-emerald-700">
            <Users size={11} />
            {community.mutualFriendCount} {community.mutualFriendCount === 1 ? "friend" : "friends"} here
          </span>
        ) : null}
      </div>

      <button
        onClick={() => onJoin(community._id)}
        className="mt-4 flex items-center justify-center gap-2 rounded-lg border border-indigo-600 px-3 py-2 text-sm font-semibold text-indigo-600 hover:bg-indigo-50 transition-colors"
      >
        <UserPlus size={16} />
        Join Community
      </button>
    </div>
  );
}
