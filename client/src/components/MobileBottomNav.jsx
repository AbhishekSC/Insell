import { Link, useLocation } from "react-router";
import { Home, Map, MessageCircle, Phone, Users } from "lucide-react";

const NAV_ITEMS = [
  { to: "/marketplace", label: "Marketplace", icon: Home, section: "marketplace" },
  { to: "/map-view", label: "Map View", icon: Map },
  { to: "/marketplace?section=chat", label: "Messages", icon: MessageCircle, section: "chat" },
  { to: "/marketplace?section=connections", label: "Connections", icon: Users, section: "connections" },
  { to: "/marketplace?section=call", label: "Calls", icon: Phone, section: "call" },
];

function isItemActive(item, location) {
  if (item.section) {
    if (location.pathname !== "/marketplace") return false;
    const activeSection = new URLSearchParams(location.search).get("section") || "marketplace";
    return activeSection === item.section;
  }
  return location.pathname === item.to;
}

// Single source of truth for the mobile bottom nav — used by AppShell (every
// marketplace-hub page) and by pages that render outside AppShell entirely,
// like the full-screen Map View. Extracted after a bug where AppShell's own
// inline copy compared badge paths against the wrong URLs (`/chat` instead
// of `/marketplace?section=chat`), silently breaking two badges — a second,
// separately-maintained copy for Map View would risk the exact same drift.
export default function MobileBottomNav({
  isMarketplaceShell = true,
  connectionsCount = 0,
}) {
  const location = useLocation();

  return (
    <nav
      className={`fixed inset-x-0 bottom-0 z-40 grid h-16 grid-cols-5 border-t backdrop-blur xl:hidden ${
        isMarketplaceShell ? "border-base-300 bg-base-100/95" : "border-base-300/80 bg-base-100/95"
      }`}
    >
      {NAV_ITEMS.map((item) => {
        const Icon = item.icon;
        const active = isItemActive(item, location);
        let badgeCount = 0;
        const badgeColor = "bg-error";
        if (item.to === "/marketplace?section=connections") badgeCount = connectionsCount;

        return (
          <Link
            key={item.to}
            to={item.to}
            className={`flex min-w-0 flex-col items-center justify-center gap-0.5 px-1 text-[10px] font-medium ${
              active
                ? isMarketplaceShell
                  ? "text-primary"
                  : "text-primary"
                : isMarketplaceShell
                  ? "text-base-content/60"
                  : "text-base-content/60"
            }`}
          >
            <div className="relative">
              <Icon className="size-5" />
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
