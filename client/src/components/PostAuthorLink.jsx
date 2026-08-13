import { Link } from "react-router";
import { BadgeCheck } from "lucide-react";
import UserAvatar from "./UserAvatar";

export default function PostAuthorLink({
  author,
  sizeClass = "size-8",
  className = "",
  showMeta = true,
  meta,
  textColor = "slate",
  onClick,
}) {
  const authorId = author?._id;
  const authorName = author?.fullName || "Unknown";
  const authorRole = author?.activeRole || author?.primaryRole || "User";
  const isVerified = author?.isVerified || false;

  const nameColor = textColor === "white" ? "text-white font-medium" : "text-slate-800 font-semibold";
  const metaColor = textColor === "white" ? "text-white/90" : "text-slate-500";
  const hoverBg = textColor === "white" ? "hover:bg-white/10" : "hover:bg-slate-50";
  const hoverText = textColor === "white" ? "hover:text-white" : "hover:text-indigo-700";

  if (!authorId) {
    return (
      <div className={`flex items-center gap-2 ${className}`}>
        <UserAvatar src={author?.profilePic} name={authorName} sizeClass={sizeClass} />
        {showMeta ? (
          <div className="min-w-0">
            <p className={`truncate text-sm ${nameColor} flex items-center gap-1`}>
              {authorName}
              {isVerified && <BadgeCheck className="size-3 text-emerald-400" />}
            </p>
            {meta ? meta : <p className={`truncate text-[11px] ${metaColor}`}>{authorRole}</p>}
          </div>
        ) : null}
      </div>
    );
  }

  return (
    <Link
      to={`/users/${authorId}`}
      className={`flex min-w-0 items-center gap-2 rounded-lg transition ${hoverBg} ${className}`}
      onClick={(event) => {
        event.stopPropagation();
        if (onClick) onClick();
      }}
    >
      <UserAvatar src={author?.profilePic} name={authorName} sizeClass={sizeClass} />
      {showMeta ? (
        <div className="min-w-0">
          <p className={`truncate text-sm ${nameColor} ${hoverText} flex items-center gap-1`}>
            {authorName}
            {isVerified && <BadgeCheck className="size-3 text-emerald-400" />}
          </p>
          {meta ? meta : <p className={`truncate text-[11px] ${metaColor}`}>{authorRole}</p>}
        </div>
      ) : null}
    </Link>
  );
}
