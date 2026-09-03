import { Link } from "react-router";
import { Heart, Loader2, X } from "lucide-react";
import UserAvatar from "./UserAvatar";

export default function UserListModal({ isOpen, onClose, title, users, isLoading, onNavigate, emptyMessage = "Nobody here yet." }) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={onClose}>
      <div
        className="flex max-h-[80vh] w-full max-w-sm flex-col rounded-2xl bg-base-100 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-base-300 p-4">
          <h3 className="text-lg font-semibold text-base-content">{title}</h3>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full p-1 text-base-content/50 transition-colors hover:bg-base-200 hover:text-base-content/70"
          >
            <X className="size-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-2">
          {isLoading ? (
            <div className="flex items-center justify-center py-10">
              <Loader2 className="size-6 animate-spin text-base-content/50" />
            </div>
          ) : !users || users.length === 0 ? (
            <p className="py-10 text-center text-sm text-base-content/60">{emptyMessage}</p>
          ) : (
            <ul className="divide-y divide-base-300">
              {users.map((user) => (
                <li key={user._id}>
                  <Link
                    to={`/users/${user._id}`}
                    onClick={() => {
                      onNavigate?.();
                      onClose();
                    }}
                    className="flex items-center gap-3 rounded-lg p-2 transition-colors hover:bg-base-200"
                  >
                    <UserAvatar
                      src={user.profilePic}
                      name={user.fullName}
                      sizeClass="size-11"
                    />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold text-base-content">
                        {user.fullName || "Unknown User"}
                      </p>
                      {user.city ? (
                        <p className="truncate text-xs text-base-content/60">{user.city}</p>
                      ) : null}
                    </div>
                    {user.liked ? (
                      <Heart className="size-4 shrink-0 fill-error text-error" aria-label="Liked" />
                    ) : null}
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
