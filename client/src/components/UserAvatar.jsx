import { useMemo, useState } from "react";
import { Link } from "react-router";

function resolveInitial(name) {
  if (!name || typeof name !== "string") {
    return "?";
  }

  const trimmed = name.trim();
  return trimmed ? trimmed.charAt(0).toUpperCase() : "?";
}

export default function UserAvatar({
  src,
  name,
  sizeClass = "size-10",
  roundedClass = "rounded-full",
  className = "",
  userId,
  onClick,
  user,
}) {
  const [imageFailed, setImageFailed] = useState(false);
  
  // Handle both individual props and user object prop
  const finalSrc = src || user?.profilePic;
  const finalName = name || user?.fullName || "User";
  const finalUserId = userId || user?._id;
  
  const initial = useMemo(() => resolveInitial(finalName), [finalName]);

  const avatarContent = finalSrc && !imageFailed ? (
    <img
      src={finalSrc}
      alt={finalName}
      className={`${sizeClass} ${roundedClass} object-cover ${className}`}
      onError={() => setImageFailed(true)}
    />
  ) : (
    <div
      className={`grid ${sizeClass} ${roundedClass} place-items-center bg-gradient-to-br from-primary/30 via-secondary/20 to-accent/25 font-semibold text-base-content ${className}`}
      aria-label={finalName}
      role="img"
    >
      {initial}
    </div>
  );

  if (finalUserId) {
    return (
      <Link
        to={`/users/${finalUserId}`}
        className="inline-block"
        onClick={(event) => {
          event.stopPropagation();
          if (onClick) onClick();
        }}
      >
        {avatarContent}
      </Link>
    );
  }

  return avatarContent;
}
