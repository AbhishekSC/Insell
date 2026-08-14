import { Link } from "react-router";
import { Loader2, X } from "lucide-react";
import UserAvatar from "./UserAvatar";

export default function UserListModal({ isOpen, onClose, title, users, isLoading, onNavigate, emptyMessage = "Nobody here yet." }) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={onClose}>
      <div
        className="flex max-h-[80vh] w-full max-w-sm flex-col rounded-2xl bg-white shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-slate-200 p-4">
          <h3 className="text-lg font-semibold text-slate-900">{title}</h3>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full p-1 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600"
          >
            <X className="size-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-2">
          {isLoading ? (
            <div className="flex items-center justify-center py-10">
              <Loader2 className="size-6 animate-spin text-slate-400" />
            </div>
          ) : !users || users.length === 0 ? (
            <p className="py-10 text-center text-sm text-slate-500">{emptyMessage}</p>
          ) : (
            <ul className="divide-y divide-slate-100">
              {users.map((user) => (
                <li key={user._id}>
                  <Link
                    to={`/users/${user._id}`}
                    onClick={() => {
                      onNavigate?.();
                      onClose();
                    }}
                    className="flex items-center gap-3 rounded-lg p-2 transition-colors hover:bg-slate-50"
                  >
                    <UserAvatar
                      src={user.profilePic}
                      name={user.fullName}
                      sizeClass="size-11"
                    />
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-slate-900">
                        {user.fullName || "Unknown User"}
                      </p>
                      {user.city ? (
                        <p className="truncate text-xs text-slate-500">{user.city}</p>
                      ) : null}
                    </div>
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
