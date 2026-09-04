import { Eye, Bookmark, CalendarClock, Lightbulb } from "lucide-react";

// Shown to a listing's owner — real numbers off the post, plus the single
// most useful next step. No invented statistics; tips are either self-evident
// good practice or a direct reading of this listing's own numbers.

function daysSince(d) {
  const t = new Date(d).getTime();
  if (!Number.isFinite(t)) return 0;
  return Math.floor((Date.now() - t) / 86400000);
}

function pickTip(post, { age, views, saves }) {
  const photos =
    (Array.isArray(post.mediaUrls) && post.mediaUrls.length) ||
    (Array.isArray(post.media) && post.media.length) ||
    0;
  const caption = String(post.caption || "").trim();
  const priceChanges = Array.isArray(post.priceHistory) ? post.priceHistory.length : 0;

  if (photos === 0) return "Add photos — listings without any photo get very little interest.";
  if (photos < 3) return `Only ${photos} photo${photos > 1 ? "s" : ""}. More photos (rooms, building, surroundings) usually means more enquiries.`;
  if (caption.length < 40) return "Add a proper description — what's nearby, what's included, why someone should visit.";
  if (age >= 21 && views >= 40 && saves === 0) return "Plenty of views but nobody's saved it — the price or the photos may be putting people off.";
  if (age >= 30 && priceChanges <= 1 && views < 25) return "It's slipped down the feed. A price update, or refreshing the listing, brings it back up.";
  if (age >= 45) return `Listed ${Math.round(age / 30)} months ago. If it's still available, refresh it to move back up the feed.`;
  if (views < 10 && age < 7) return "Just getting started — check back in a few days to see how it's doing.";
  return "Looking healthy. Keep the photos and details current.";
}

function Stat({ icon, value, label }) {
  const Icon = icon;
  return (
    <div className="flex items-center gap-2">
      <Icon className="size-4 text-base-content/40" />
      <span className="text-sm font-semibold text-base-content">{value}</span>
      <span className="text-xs text-base-content/60">{label}</span>
    </div>
  );
}

export default function ListingPerformance({ post }) {
  if (!post) return null;
  const age = daysSince(post.publishedAt || post.createdAt);
  const views = Number(post.viewCount) || 0;
  const saves = Number(post.savesCount ?? (Array.isArray(post.savedBy) ? post.savedBy.length : 0)) || 0;
  const visits = Number(post.visitRequestCount) || 0;

  const tip = pickTip(post, { age, views, saves });

  return (
    <div className="rounded-2xl border border-base-300 bg-base-100 p-4">
      <p className="text-sm font-semibold text-base-content">How your listing is doing</p>
      <div className="mt-3 flex flex-wrap gap-x-5 gap-y-2">
        <Stat icon={Eye} value={views} label={views === 1 ? "view" : "views"} />
        <Stat icon={Bookmark} value={saves} label={saves === 1 ? "save" : "saves"} />
        {visits > 0 && <Stat icon={CalendarClock} value={visits} label={visits === 1 ? "visit request" : "visit requests"} />}
        <Stat icon={CalendarClock} value={age === 0 ? "Today" : `${age}d`} label="live" />
      </div>
      <p className="mt-3 flex items-start gap-2 rounded-lg bg-primary/5 p-2.5 text-xs text-base-content/80">
        <Lightbulb className="mt-0.5 size-3.5 shrink-0 text-primary" />
        {tip}
      </p>
    </div>
  );
}
