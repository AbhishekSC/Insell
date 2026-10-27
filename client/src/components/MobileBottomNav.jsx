import { Link, useLocation } from "react-router";
import { Home, Map, MessageCircle, UserCircle, Users } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { useStreamContext } from "../context/StreamProvider";

const NAV_ITEMS = [
  { to: "/marketplace", label: "Marketplace", icon: Home, section: "marketplace" },
  { to: "/marketplace?section=communities", label: "Communities", icon: Users, section: "communities" },
  { to: "/map-view", label: "Map", icon: Map },
  { to: "/marketplace?section=chat", label: "Chat", icon: MessageCircle, section: "chat" },
  { to: "/marketplace?section=profile", label: "Profile", icon: UserCircle, section: "profile" },
];

function isItemActive(item, location, user) {
  const params = new URLSearchParams(location.search);
  const activeSection = params.get("section") || "marketplace";

  if (item.section === "marketplace") {
    return location.pathname === "/marketplace" && (!params.get("section") || activeSection === "marketplace");
  }
  if (item.section === "communities") {
    return (
      (location.pathname === "/marketplace" && activeSection === "communities") ||
      location.pathname.startsWith("/community") ||
      location.pathname.startsWith("/discover-communities") ||
      location.pathname.startsWith("/requested-communities")
    );
  }
  if (item.to === "/map-view") {
    return location.pathname === "/map-view";
  }
  if (item.section === "chat") {
    return (
      (location.pathname === "/marketplace" && activeSection === "chat") ||
      location.pathname.startsWith("/chat")
    );
  }
  if (item.section === "profile") {
    const isOwnProfile = Boolean(user?._id && location.pathname === `/users/${user._id}`);
    return (
      isOwnProfile ||
      location.pathname === "/profile" ||
      (location.pathname === "/marketplace" && activeSection === "profile")
    );
  }
  return location.pathname === item.to;
}

// Single source of truth for the mobile bottom nav — mirrors the native mobile app tabs
// exactly: Marketplace, Communities, Map, Chat, Profile.
export default function MobileBottomNav({
  isMarketplaceShell = true,
  unreadChatCount,
  authUser: propAuthUser,
}) {
  const location = useLocation();
  const { unreadCount: streamUnreadCount } = useStreamContext() || {};

  const { data: authData } = useQuery({
    queryKey: ["authUser"],
    staleTime: 1000 * 60 * 5,
  });
  const user = propAuthUser || authData?.data?.user || authData?.data || null;
  const unreadMessages = unreadChatCount !== undefined ? unreadChatCount : (streamUnreadCount || 0);

  return (
    <nav
      className={`fixed inset-x-0 bottom-0 z-40 grid h-16 grid-cols-5 border-t backdrop-blur xl:hidden ${
        isMarketplaceShell ? "border-base-300 bg-base-100/95" : "border-base-300/80 bg-base-100/95"
      }`}
    >
      {NAV_ITEMS.map((item) => {
        const Icon = item.icon;
        const active = isItemActive(item, location, user);
        let badgeCount = 0;
        const badgeColor = "bg-error";

        if (item.section === "chat") {
          badgeCount = unreadMessages;
        }

        const isProfileItem = item.section === "profile";
        const hasAvatar = isProfileItem && Boolean(user?.profilePic || user?.fullName);
        const targetTo = isProfileItem && user?._id ? `/users/${user._id}` : item.to;

        return (
          <Link
            key={item.to}
            to={targetTo}
            className={`flex min-w-0 flex-col items-center justify-center gap-0.5 px-1 text-[10px] font-medium transition-colors ${
              active
                ? "text-primary"
                : "text-base-content/60 hover:text-base-content"
            }`}
          >
            <div className="relative">
              {hasAvatar ? (
                <div
                  className={`size-6 rounded-full overflow-hidden border ${
                    active ? "border-primary ring-2 ring-primary/40" : "border-base-content/25"
                  }`}
                >
                  {user.profilePic ? (
                    <img
                      src={user.profilePic}
                      alt={user.fullName || "Profile"}
                      className="size-full object-cover"
                    />
                  ) : (
                    <span className="grid size-full place-items-center bg-primary/15 text-[10px] font-bold text-primary">
                      {(user.fullName || "U").charAt(0).toUpperCase()}
                    </span>
                  )}
                </div>
              ) : (
                <Icon className="size-5" />
              )}

              {badgeCount > 0 ? (
                <span className={`absolute -right-2 -top-1 flex size-4 items-center justify-center rounded-full text-[9px] font-bold text-white ${badgeColor}`}>
                  {badgeCount > 9 ? "9+" : badgeCount}
                </span>
              ) : null}
            </div>
            <span className="truncate">{item.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
