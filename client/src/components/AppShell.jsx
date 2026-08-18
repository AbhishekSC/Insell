import { Fragment, useEffect, useMemo, useRef, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Bell,
  ChevronDown,
  Command,
  Filter,
  HelpCircle,
  Home,
  House,
  LogOut,
  Map,
  Menu,
  MessageCircle,
  MessageSquare,
  Newspaper,
  Phone,
  Plus,
  Search,
  ShieldCheck,
  TrendingUp,
  UserCircle,
  Users,
  X,
} from "lucide-react";
import toast from "react-hot-toast";
import axiosInstance from "../lib/axios";
import { clearAuthToken } from "../lib/authToken";
import { useStreamContext } from "../context/StreamProvider";
import UserAvatar from "./UserAvatar";
import SearchFiltersModal from "./SearchFiltersModal";
import PostModerationNotice from "./PostModerationNotice";

function notifyBrowser(title, body) {
  if (typeof window === "undefined" || !("Notification" in window)) return;
  if (Notification.permission === "granted") {
    new Notification(title, { body });
  }
}

// Mirrors MarketplacePage's own LEFT_NAV_ITEMS exactly (same labels, icons,
// and order) so the bottom nav is identical everywhere in the app, not just
// on the Marketplace page itself. Items with a `section` key open the same
// embedded hub tab Marketplace's own nav uses; Map View has no hub
// equivalent (Marketplace's own nav also sends it to the standalone route).
const navItems = [
  { to: "/marketplace", label: "Marketplace", icon: Home, section: "marketplace" },
  { to: "/marketplace?section=activity", label: "Activity", icon: Bell, section: "activity" },
  { to: "/map-view", label: "Map View", icon: Map },
  { to: "/marketplace?section=communities", label: "Communities", icon: Users, section: "communities" },
  { to: "/marketplace?section=chat", label: "Messages", icon: MessageCircle, section: "chat" },
  { to: "/marketplace?section=connections", label: "Connections", icon: Users, section: "connections" },
  { to: "/marketplace?section=call", label: "Calls", icon: Phone, section: "call" },
  { to: "/marketplace?section=profile", label: "Edit Profile", icon: UserCircle, section: "profile" },
];

const ADMIN_NAV_ITEM = { to: "/admin", label: "Admin", icon: ShieldCheck };

// The mobile bottom nav only has room for a handful of static (non-scrolling)
// slots — these five are the ones used often enough to earn one. Everything
// else in navItems shows up in the hamburger menu instead (see
// mobileOverflowNavItems below).
const MOBILE_PRIMARY_NAV_TOS = new Set([
  "/marketplace",
  "/map-view",
  "/marketplace?section=chat",
  "/marketplace?section=connections",
  "/marketplace?section=call",
]);

function isNavItemActive(item, location) {
  if (item.section) {
    if (location.pathname !== "/marketplace") return false;
    const activeSection = new URLSearchParams(location.search).get("section") || "marketplace";
    return activeSection === item.section;
  }
  return location.pathname === item.to;
}

function LogoSection({ isMarketplaceShell, showText = true }) {
  return (
    <Link to="/marketplace" className="min-w-0 flex shrink-0 items-center gap-3" aria-label="INSELL home">
      <div
        className={
          isMarketplaceShell
            ? "grid size-10 shrink-0 place-items-center rounded-lg bg-indigo-600 text-white"
            : "grid size-10 shrink-0 place-items-center rounded-2xl bg-gradient-to-br from-primary/25 via-secondary/20 to-accent/25 text-primary shadow-inner ring-1 ring-primary/20"
        }
      >
        {isMarketplaceShell ? <House className="size-5" /> : <MessageSquare className="size-5" />}
      </div>
      {showText ? (
        <div className="min-w-0">
          <p
            className={
              isMarketplaceShell
                ? "truncate text-xl font-black leading-none tracking-tight text-slate-800 sm:text-3xl"
                : "truncate text-lg font-extrabold tracking-tight"
            }
          >
            INSELL
          </p>
          <p
            className={
              isMarketplaceShell
                ? "hidden truncate text-xs text-slate-500 sm:block"
                : "hidden truncate text-xs text-base-content/60 sm:block"
            }
          >
            Social Real Estate Marketplace
          </p>
        </div>
      ) : null}
    </Link>
  );
}

function GlobalSearch({
  marketSearch,
  setMarketSearch,
  onMarketplaceSearchChange,
  searchInputRef,
  searchFocused,
  setSearchFocused,
  visibleSuggestions,
  searchHistory,
  isLoadingSuggestions,
  onOpenFilters,
  hasActiveFilters,
}) {
  return (
    <div className="hidden min-w-0 lg:block">
      <div className="w-full min-w-0 max-w-[780px]">
        <div className="relative">
          <label className="flex h-12 w-full items-center gap-2 rounded-xl border border-slate-200 bg-white px-3">
            <Search className="size-4 shrink-0 text-slate-400" />
            <input
              ref={searchInputRef}
              type="text"
              placeholder="Search city, locality, property or builder"
              className="flex-1 min-w-0 bg-transparent text-sm text-slate-700 placeholder:text-slate-400 focus:outline-none"
              value={marketSearch}
              onFocus={() => setSearchFocused(true)}
              onBlur={() => setTimeout(() => setSearchFocused(false), 120)}
              onChange={(event) => {
                const value = event.target.value;
                setMarketSearch(value);
                onMarketplaceSearchChange?.(value);
              }}
            />
            <button
              type="button"
              onClick={onOpenFilters}
              className={`flex shrink-0 items-center gap-1 rounded-md px-2 py-1 text-[10px] font-semibold transition-colors ${
                hasActiveFilters
                  ? "bg-indigo-100 text-indigo-700"
                  : "border border-slate-200 bg-slate-50 text-slate-500 hover:bg-slate-100"
              }`}
            >
              <Filter className="size-3" />
              Filters
            </button>
            <span className="hidden shrink-0 items-center gap-1 rounded-md border border-slate-200 bg-slate-50 px-2 py-1 text-[10px] font-semibold text-slate-500 xl:inline-flex">
              <Command className="size-3" />
              K
            </span>
          </label>

          {searchFocused ? (
            <div className="absolute top-full left-0 right-0 z-50 mt-2 rounded-2xl border border-slate-200 bg-white p-3 shadow-xl">
              {searchHistory && searchHistory.length > 0 && !marketSearch ? (
                <>
                  <div className="mb-2 flex items-center justify-between">
                    <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Recent Searches</p>
                    <button
                      type="button"
                      className="text-[10px] text-slate-400 hover:text-slate-600"
                      onClick={() => onMarketplaceSearchChange?.('clear_history')}
                    >
                      Clear
                    </button>
                  </div>
                  <div className="space-y-1">
                    {searchHistory.slice(0, 5).map((item, index) => (
                      <button
                        key={index}
                        type="button"
                        className="flex w-full items-center gap-2 rounded-lg px-2 py-2 text-left text-sm text-slate-700 hover:bg-slate-50"
                        onMouseDown={() => {
                          setMarketSearch(item.query);
                          onMarketplaceSearchChange?.(item.query);
                          setSearchFocused(false);
                        }}
                      >
                        <Search className="size-3.5 text-slate-400" />
                        {item.query}
                      </button>
                    ))}
                  </div>
                </>
              ) : null}

              {isLoadingSuggestions ? (
                <div className="flex items-center justify-center py-4">
                  <div className="size-4 animate-spin rounded-full border-2 border-slate-300 border-t-indigo-600" />
                </div>
              ) : visibleSuggestions && visibleSuggestions.length > 0 ? (
                <>
                  {marketSearch && (
                    <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-slate-500">Suggestions</p>
                  )}
                  <div className="space-y-1">
                    {visibleSuggestions.map((item, index) => (
                      <button
                        key={`${item.type}-${index}`}
                        type="button"
                        className="flex w-full items-center gap-2 rounded-lg px-2 py-2 text-left text-sm text-slate-700 hover:bg-slate-50"
                        onMouseDown={() => {
                          setMarketSearch(item.value);
                          onMarketplaceSearchChange?.(item.value, item.type, item.authorId);
                          setSearchFocused(false);
                        }}
                      >
                        <Search className="size-3.5 text-slate-400" />
                        <span>{item.value}</span>
                        <span className="ml-auto text-[10px] text-slate-400">
                          {item.type === 'location' && '📍'}
                          {item.type === 'propertyType' && '🏠'}
                          {item.type === 'author' && '👤'}
                        </span>
                      </button>
                    ))}
                  </div>
                </>
              ) : marketSearch ? (
                <div className="py-4 text-center text-sm text-slate-400">
                  No suggestions found
                </div>
              ) : null}
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}

function HeaderActions({ onCreateProperty, unreadActivityCount }) {
  return (
    <div className="hidden shrink-0 items-center gap-3 lg:flex">
      <button
        type="button"
        className="btn h-11 w-[170px] rounded-lg border-none bg-indigo-600 px-5 text-white hover:bg-indigo-500"
        onClick={() => onCreateProperty?.()}
      >
        <Plus className="size-4" />
        Create Post
      </button>
      <Link
        to="/activity"
        className="btn btn-ghost btn-sm btn-circle relative border border-slate-200 text-slate-600 hover:bg-slate-100"
        aria-label="Activity"
        title="Activity"
      >
        <Bell className="size-4" />
        {unreadActivityCount > 0 && (
          <span className="absolute -right-1 -top-1 flex size-4 items-center justify-center rounded-full bg-red-500 text-[9px] font-bold text-white">
            {unreadActivityCount > 9 ? "9+" : unreadActivityCount}
          </span>
        )}
      </Link>
    </div>
  );
}

function UserMenu({ authUser, userRoleLabel, isPending, logout }) {
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const navigate = useNavigate();

  return (
    <div className="hidden shrink-0 items-center gap-2 lg:flex">
      <div className="relative">
        <button
          type="button"
          className="btn btn-ghost h-11 min-w-[180px] max-w-[260px] rounded-xl border border-slate-200 bg-white px-2.5 hover:bg-slate-50"
          onClick={() => setIsDropdownOpen((prev) => !prev)}
        >
          <UserAvatar src={authUser?.profilePic} name={authUser?.fullName || "User"} sizeClass="size-7" userId={authUser?._id} />
          <span className="min-w-0 text-left">
            <span className="block truncate text-xs font-semibold text-slate-700">{authUser?.fullName || "INSELL User"}</span>
            <span className="block truncate text-[10px] text-slate-500">{userRoleLabel}</span>
          </span>
          <ChevronDown className={`ml-1 size-3.5 shrink-0 text-slate-500 transition ${isDropdownOpen ? "rotate-180" : ""}`} />
        </button>

        {isDropdownOpen && (
          <div className="absolute right-0 top-full z-50 mt-2 w-48 rounded-xl border border-slate-200 bg-white shadow-lg">
            <button
              type="button"
              className="flex w-full items-center gap-2 px-4 py-2.5 text-left text-sm text-slate-700 hover:bg-slate-50"
              onClick={() => {
                setIsDropdownOpen(false);
                navigate(`/users/${authUser?._id}`);
              }}
            >
              <UserCircle className="size-4 text-slate-500" />
              View Profile
            </button>
            <button
              type="button"
              className="flex w-full items-center gap-2 px-4 py-2.5 text-left text-sm text-slate-700 hover:bg-slate-50"
              onClick={() => {
                setIsDropdownOpen(false);
                logout();
              }}
              disabled={isPending}
            >
              <LogOut className="size-4 text-slate-500" />
              {isPending ? "Logging out..." : "Logout"}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

export default function AppShell({
  title,
  subtitle,
  children,
  actions,
  lockPageScroll = false,
  hideHero = false,
  hideBottomNav = false,
  marketplaceSearch = "",
  onMarketplaceSearchChange,
  onCreateProperty,
}) {
  const location = useLocation();
  const navigate = useNavigate();
  const isMarketplaceShell =
    location.pathname.startsWith("/marketplace") ||
    location.pathname.startsWith("/community") ||
    location.pathname.startsWith("/users/") ||
    location.pathname.startsWith("/news") ||
    location.pathname.startsWith("/trending-localities") ||
    location.pathname.startsWith("/discover-communities") ||
    location.pathname.startsWith("/requested-communities") ||
    location.pathname.startsWith("/property/") ||
    location.pathname.startsWith("/activity") ||
    location.pathname.startsWith("/chat") ||
    location.pathname.startsWith("/call") ||
    location.pathname.startsWith("/notification") ||
    location.pathname.startsWith("/connections") ||
    location.pathname.startsWith("/profile") ||
    location.pathname.startsWith("/toolkit") ||
    location.pathname.startsWith("/property-tools") ||
    location.pathname.startsWith("/friends/") ||
    location.pathname.startsWith("/admin");

  const queryClient = useQueryClient();
  const previousRequestCountRef = useRef(0);
  const { unreadCount, streamClient, currentUserId } = useStreamContext();

  const [marketSearch, setMarketSearch] = useState(marketplaceSearch);
  const [searchFocused, setSearchFocused] = useState(false);
  const [mobileUserMenuOpen, setMobileUserMenuOpen] = useState(false);
  const [showMobileMenu, setShowMobileMenu] = useState(false);
  const [searchSuggestions, setSearchSuggestions] = useState([]);
  const [searchHistory, setSearchHistory] = useState([]);
  const [isLoadingSuggestions, setIsLoadingSuggestions] = useState(false);
  const [isFiltersModalOpen, setIsFiltersModalOpen] = useState(false);
  const [activeFilters, setActiveFilters] = useState(null);
  const searchInputRef = useRef(null);
  const searchDebounceRef = useRef(null);

  const authData = queryClient.getQueryData(["authUser"]);
  const authUser = authData?.data?.user || authData?.data || null;
  const visibleNavItems = authUser?.isAdmin ? [...navItems, ADMIN_NAV_ITEM] : navItems;
  const mobileBottomNavItems = visibleNavItems.filter((item) => MOBILE_PRIMARY_NAV_TOS.has(item.to));
  const mobileOverflowNavItems = visibleNavItems.filter(
    (item) => !MOBILE_PRIMARY_NAV_TOS.has(item.to) && item.section !== "activity"
  );

  const userRoleLabel = authUser?.activeRole || authUser?.primaryRole || "Buyer";
  const userInitials = useMemo(() => {
    const name = String(authUser?.fullName || "INSELL User").trim();
    if (!name) return "IU";
    const parts = name.split(/\s+/).slice(0, 2);
    return parts.map((part) => part[0]?.toUpperCase() || "").join("");
  }, [authUser?.fullName]);

  useEffect(() => {
    setMarketSearch(marketplaceSearch);
  }, [marketplaceSearch]);

  // Fetch search history on mount
  useEffect(() => {
    if (authUser?._id) {
      axiosInstance.get("/search/history")
        .then(res => {
          setSearchHistory(res.data?.data?.searchHistory || []);
        })
        .catch(err => {
          console.error("Failed to fetch search history:", err);
        });
    }
  }, [authUser?._id]);

  // Fetch search suggestions with debounce
  useEffect(() => {
    if (searchDebounceRef.current) {
      clearTimeout(searchDebounceRef.current);
    }

    if (marketSearch.length >= 2) {
      setIsLoadingSuggestions(true);
      searchDebounceRef.current = setTimeout(() => {
        axiosInstance.get(`/search/suggestions?query=${encodeURIComponent(marketSearch)}`)
          .then(res => {
            setSearchSuggestions(res.data?.data?.suggestions || []);
            setIsLoadingSuggestions(false);
          })
          .catch(err => {
            console.error("Failed to fetch search suggestions:", err);
            setSearchSuggestions([]);
            setIsLoadingSuggestions(false);
          });
      }, 300);
    } else {
      setSearchSuggestions([]);
      setIsLoadingSuggestions(false);
    }

    return () => {
      if (searchDebounceRef.current) {
        clearTimeout(searchDebounceRef.current);
      }
    };
  }, [marketSearch]);

  useEffect(() => {
    const onKeyDown = (event) => {
      if (!isMarketplaceShell) return;
      const openSearchShortcut = (event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k";
      if (openSearchShortcut) {
        event.preventDefault();
        searchInputRef.current?.focus();
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [isMarketplaceShell]);

  const { data: incomingRequests = [] } = useQuery({
    // Shared key with MarketplacePage.jsx's identical query — same endpoint,
    // same data, so they coalesce into one fetch instead of two independent ones.
    queryKey: ["incomingRequests"],
    queryFn: async () => {
      const response = await axiosInstance.get("/users/friend-requests");
      return response.data?.data?.incomingRequests || [];
    },
    enabled: Boolean(authUser?._id),
    staleTime: 10000,
    refetchInterval: 15000,
    refetchIntervalInBackground: true,
  });

  const { data: activityNotifications = 0 } = useQuery({
    // Shared key with MarketplacePage.jsx's identical query.
    queryKey: ["activityNotifications"],
    queryFn: async () => {
      const response = await axiosInstance.get("/notifications?unreadOnly=true");
      return response.data?.data?.unreadCount || 0;
    },
    enabled: Boolean(authUser?._id),
    staleTime: 10000,
    refetchInterval: 15000,
    refetchIntervalInBackground: true,
  });

  const { data: messageRequests = 0 } = useQuery({
    // Shared key with MarketplacePage.jsx's identical query.
    queryKey: ["messageRequests"],
    queryFn: async () => {
      const response = await axiosInstance.get("/notifications?type=message_request&unreadOnly=true");
      return response.data?.data?.unreadCount || 0;
    },
    enabled: Boolean(authUser?._id),
    staleTime: 10000,
    refetchInterval: 15000,
    refetchIntervalInBackground: true,
  });

  // Unified notification count for bell icon (all types)
  const totalNotificationCount = activityNotifications + messageRequests + incomingRequests.length;

  const { data: marketplaceUnreadCount = 0 } = useQuery({
    queryKey: ["marketplaceUnreadCount", currentUserId],
    enabled: Boolean(streamClient && currentUserId),
    refetchInterval: 15000,
    queryFn: async () => {
      if (!streamClient || !currentUserId) return 0;

      const channels = await streamClient.queryChannels(
        {
          type: "messaging",
          members: { $in: [currentUserId] },
        },
        { last_message_at: -1 },
        { watch: false, state: true, limit: 50 }
      );

      return channels
        .filter((channel) => String(channel.id || "").startsWith("community-"))
        .reduce((sum, channel) => sum + Number(channel.countUnread() || 0), 0);
    },
  });

  useEffect(() => {
    const currentCount = incomingRequests.length;
    const previousCount = previousRequestCountRef.current;

    if (previousCount > 0 && currentCount > previousCount) {
      const newCount = currentCount - previousCount;
      const text = newCount === 1 ? "You have 1 new friend request" : `You have ${newCount} new friend requests`;
      toast.success(text);
      notifyBrowser("SyncSpace", text);
    }

    previousRequestCountRef.current = currentCount;
  }, [incomingRequests.length]);

  const { mutate: logout, isPending } = useMutation({
    mutationFn: async () => {
      const response = await axiosInstance.post("/auth/logout");
      return response.data;
    },
    onSuccess: () => {
      clearAuthToken();
      toast.success("Logged out successfully");
      // setQueryData already clears the cache; invalidating on top of that would
      // just trigger a pointless extra /auth/verify call that returns 401.
      queryClient.setQueryData(["authUser"], null);
    },
    onError: (err) => {
      toast.error(err?.response?.data?.message || "Logout failed");
    },
  });

  return (
    <div
      className={
        isMarketplaceShell
          ? "min-h-screen bg-[#f4f6fb] text-slate-900"
          : "min-h-screen bg-[radial-gradient(circle_at_20%_20%,hsl(var(--p)/0.16),transparent_45%),radial-gradient(circle_at_85%_15%,hsl(var(--s)/0.18),transparent_35%),radial-gradient(circle_at_80%_85%,hsl(var(--a)/0.18),transparent_45%)] bg-base-200"
      }
    >
      <header className={isMarketplaceShell ? "sticky top-0 z-30 border-b border-slate-200 bg-white/95 backdrop-blur" : "sticky top-0 z-30 border-b border-base-300/70 bg-base-100/75 backdrop-blur-2xl"}>
        <div className={`mx-auto px-4 py-3 sm:px-6 ${isMarketplaceShell ? "max-w-[1440px]" : "max-w-7xl"}`}>
          {isMarketplaceShell ? (
            <>
              <div className="hidden items-center gap-6 lg:grid lg:grid-cols-[250px_minmax(300px,1fr)_auto_auto]">
                <LogoSection isMarketplaceShell />
                <GlobalSearch
                  marketSearch={marketSearch}
                  setMarketSearch={setMarketSearch}
                  onMarketplaceSearchChange={(value) => {
                    if (value === 'clear_history') {
                      axiosInstance.delete("/search/history")
                        .then(() => setSearchHistory([]))
                        .catch(err => console.error("Failed to clear search history:", err));
                    } else {
                      onMarketplaceSearchChange?.(value);
                      // Save search to history
                      if (value && value.length >= 2) {
                        axiosInstance.post("/search/history", { query: value })
                          .catch(err => console.error("Failed to save search history:", err));
                      }
                    }
                  }}
                  searchInputRef={searchInputRef}
                  searchFocused={searchFocused}
                  setSearchFocused={setSearchFocused}
                  visibleSuggestions={searchSuggestions}
                  searchHistory={searchHistory}
                  isLoadingSuggestions={isLoadingSuggestions}
                  onOpenFilters={() => setIsFiltersModalOpen(true)}
                  hasActiveFilters={!!activeFilters}
                />
                <HeaderActions onCreateProperty={onCreateProperty} unreadActivityCount={activityNotifications} />
                <UserMenu authUser={authUser} userRoleLabel={userRoleLabel} isPending={isPending} logout={logout} />
              </div>

              <div className="flex items-center justify-between gap-3 lg:hidden">
                <button
                  type="button"
                  className="btn btn-ghost btn-circle btn-sm border border-slate-200 text-slate-600 hover:bg-slate-100"
                  onClick={() => setShowMobileMenu(true)}
                  aria-label="Open menu"
                >
                  <Menu className="size-5" />
                </button>
                <div className="flex shrink-0 items-center gap-2">
                  <button
                    type="button"
                    className="btn btn-ghost btn-circle btn-sm border border-slate-200 text-slate-600 hover:bg-slate-100"
                    onClick={() => setSearchFocused(true)}
                  >
                    <Search className="size-4" />
                  </button>
                  <Link
                    to="/marketplace?section=activity"
                    className="btn btn-ghost btn-sm btn-circle relative border border-slate-200 text-slate-600 hover:bg-slate-100"
                    aria-label="Activity"
                    title="Activity"
                  >
                    <Bell className="size-4" />
                    {totalNotificationCount > 0 ? (
                      <span className="absolute -right-1 -top-1 flex size-4 items-center justify-center rounded-full bg-red-500 text-[10px] font-bold text-white">
                        {totalNotificationCount > 9 ? "9+" : totalNotificationCount}
                      </span>
                    ) : null}
                  </Link>

                  <div className="relative">
                    <button
                      type="button"
                      className="btn btn-ghost btn-circle btn-sm border border-slate-200 bg-white hover:bg-slate-50"
                      onClick={() => setMobileUserMenuOpen((prev) => !prev)}
                      aria-label="Account menu"
                    >
                      <span className="grid size-6 shrink-0 place-items-center rounded-full bg-indigo-100 text-xs font-bold text-indigo-700">{userInitials}</span>
                    </button>

                    {mobileUserMenuOpen && (
                      <div className="absolute right-0 top-full z-50 mt-2 w-48 rounded-xl border border-slate-200 bg-white shadow-lg">
                        <button
                          type="button"
                          className="flex w-full items-center gap-2 px-4 py-2.5 text-left text-sm text-slate-700 hover:bg-slate-50"
                          onClick={() => {
                            setMobileUserMenuOpen(false);
                            navigate(`/users/${authUser?._id}`);
                          }}
                        >
                          <UserCircle className="size-4 text-slate-500" />
                          View Profile
                        </button>
                        <button
                          type="button"
                          className="flex w-full items-center gap-2 px-4 py-2.5 text-left text-sm text-slate-700 hover:bg-slate-50"
                          onClick={() => {
                            setMobileUserMenuOpen(false);
                            logout();
                          }}
                          disabled={isPending}
                        >
                          <LogOut className="size-4 text-slate-500" />
                          {isPending ? "Logging out..." : "Logout"}
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </>
          ) : (
            <div className="flex items-center gap-3">
              <LogoSection isMarketplaceShell={false} />

              <nav className="hidden max-w-full flex-nowrap items-center gap-1 overflow-x-auto rounded-2xl border border-base-300/80 bg-base-100/75 p-1.5 md:flex">
                {visibleNavItems.map((item) => {
                  const Icon = item.icon;
                  const active = isNavItemActive(item, location);

                  return (
                    <Link key={item.to} to={item.to} className={`btn btn-sm relative rounded-xl ${active ? "btn-primary" : "btn-ghost"}`}>
                      <Icon className="size-4" />
                      {item.label}
                      {item.to === "/activity" && totalNotificationCount > 0 ? (
                        <span className="badge badge-error badge-xs absolute -right-1 -top-1">{totalNotificationCount > 9 ? "9+" : totalNotificationCount}</span>
                      ) : null}
                      {item.to === "/connections" && incomingRequests.length > 0 ? (
                        <span className="badge badge-error badge-xs absolute -right-1 -top-1">{incomingRequests.length > 9 ? "9+" : incomingRequests.length}</span>
                      ) : null}
                      {item.to === "/chat" && (unreadCount + messageRequests) > 0 ? (
                        <span className="badge badge-secondary badge-xs absolute -right-1 -top-1">{(unreadCount + messageRequests) > 9 ? "9+" : (unreadCount + messageRequests)}</span>
                      ) : null}
                      {item.to === "/marketplace" && marketplaceUnreadCount > 0 ? (
                        <span className="badge badge-warning badge-xs absolute -right-1 -top-1">{marketplaceUnreadCount > 9 ? "9+" : marketplaceUnreadCount}</span>
                      ) : null}
                    </Link>
                  );
                })}
              </nav>

              <div className="ml-auto flex shrink-0 items-center gap-2.5">
                <div className="relative">
                  <button
                    type="button"
                    className="btn btn-ghost h-9 min-w-[140px] max-w-[200px] rounded-xl border border-slate-200 bg-white px-2.5 hover:bg-slate-50"
                    onClick={() => setMobileUserMenuOpen((prev) => !prev)}
                  >
                    <UserAvatar src={authUser?.profilePic} name={authUser?.fullName || "User"} sizeClass="size-6" userId={authUser?._id} />
                    <span className="min-w-0 text-left">
                      <span className="block truncate text-xs font-semibold text-slate-700">{authUser?.fullName || "INSELL User"}</span>
                    </span>
                    <ChevronDown className={`ml-1 size-3 shrink-0 text-slate-500 transition ${mobileUserMenuOpen ? "rotate-180" : ""}`} />
                  </button>

                  {mobileUserMenuOpen && (
                    <div className="absolute right-0 top-full z-50 mt-2 w-48 rounded-xl border border-slate-200 bg-white shadow-lg">
                      <button
                        type="button"
                        className="flex w-full items-center gap-2 px-4 py-2.5 text-left text-sm text-slate-700 hover:bg-slate-50"
                        onClick={() => {
                          setMobileUserMenuOpen(false);
                          navigate(`/users/${authUser?._id}`);
                        }}
                      >
                        <UserCircle className="size-4 text-slate-500" />
                        View Profile
                      </button>
                      <button
                        type="button"
                        className="flex w-full items-center gap-2 px-4 py-2.5 text-left text-sm text-slate-700 hover:bg-slate-50"
                        onClick={() => {
                          setMobileUserMenuOpen(false);
                          logout();
                        }}
                        disabled={isPending}
                      >
                        <LogOut className="size-4 text-slate-500" />
                        {isPending ? "Logging out..." : "Logout"}
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      </header>

      <main
        className={`mx-auto w-full px-4 pb-24 pt-6 sm:px-6 md:pb-8 ${isMarketplaceShell ? "max-w-[1440px]" : "max-w-7xl"} ${
          lockPageScroll ? "xl:flex xl:h-[calc(100dvh-4.75rem)] xl:flex-col xl:overflow-hidden" : ""
        }`}
      >
        {!hideHero ? (
          <section className="glass-wrap mb-5 p-5 sm:p-6">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <h1 className="hero-title break-words text-2xl sm:text-3xl md:text-4xl">{title}</h1>
              {actions ? <div className="flex w-full flex-wrap items-center gap-2 sm:ml-auto sm:w-auto sm:justify-end">{actions}</div> : null}
            </div>
            <p className="muted-copy mt-1">{subtitle}</p>
          </section>
        ) : null}

        <div className={`${lockPageScroll ? "xl:flex-1 xl:min-h-0 xl:overflow-hidden" : ""} pb-6`}>{children}</div>
      </main>

      {!hideBottomNav && (
        <nav
          className={`fixed inset-x-0 bottom-0 z-40 grid grid-cols-5 border-t backdrop-blur xl:hidden ${
            isMarketplaceShell ? "border-slate-200 bg-white/95" : "border-base-300/80 bg-base-100/95"
          }`}
        >
          {mobileBottomNavItems.map((item) => {
            const Icon = item.icon;
            const active = isNavItemActive(item, location);
            let badgeCount = 0;
            let badgeColor = "bg-red-500";
            if (item.to === "/connections") badgeCount = incomingRequests.length;
            else if (item.to === "/chat") badgeCount = unreadCount;
            else if (item.to === "/marketplace") {
              badgeCount = marketplaceUnreadCount;
              badgeColor = "bg-amber-500";
            }

            return (
              <Link
                key={item.to}
                to={item.to}
                className={`flex min-w-0 flex-col items-center gap-0.5 px-1 py-2 text-[10px] font-medium ${
                  active
                    ? isMarketplaceShell
                      ? "text-indigo-600"
                      : "text-primary"
                    : isMarketplaceShell
                      ? "text-slate-500"
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
      )}

      {/* Mobile hamburger menu — houses the nav items that don't fit as one
          of the 5 static bottom-nav slots (Communities, Edit Profile,
          Admin — Activity moved to the top bar), plus the theme toggle
          below Admin, currently disabled while dark mode is finished. */}
      {showMobileMenu ? (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div className="absolute inset-0 bg-black/40" onClick={() => setShowMobileMenu(false)} />
          <div className="absolute inset-y-0 left-0 flex w-[82%] max-w-xs flex-col bg-white shadow-2xl">
            <div className="flex items-center gap-3 border-b border-slate-100 p-4">
              <div className="grid size-11 shrink-0 place-items-center rounded-lg bg-indigo-600 text-white">
                <House className="size-5" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-base font-bold text-slate-800">{authUser?.fullName || "INSELL User"}</p>
                <p className="truncate text-xs text-slate-500">INSELL · Social Real Estate Marketplace</p>
              </div>
              <button
                type="button"
                onClick={() => setShowMobileMenu(false)}
                className="btn btn-ghost btn-circle btn-sm shrink-0"
                aria-label="Close menu"
              >
                <X className="size-5" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-2">
              {mobileOverflowNavItems.map((item) => {
                const Icon = item.icon;
                const active = isNavItemActive(item, location);
                let badgeCount = 0;
                if (item.to === "/activity") badgeCount = totalNotificationCount;

                return (
                  <Fragment key={item.to}>
                    <Link
                      to={item.to}
                      onClick={() => setShowMobileMenu(false)}
                      className={`flex items-center gap-3 rounded-xl px-3 py-3 text-sm font-medium ${
                        active ? "bg-indigo-50 text-indigo-600" : "text-slate-600 hover:bg-slate-50"
                      }`}
                    >
                      <Icon className="size-5" />
                      {item.label}
                      {badgeCount > 0 ? (
                        <span className="ml-auto flex size-5 items-center justify-center rounded-full bg-red-500 text-[10px] font-bold text-white">
                          {badgeCount > 9 ? "9+" : badgeCount}
                        </span>
                      ) : null}
                    </Link>
                    {item.section === "communities" ? (
                      <>
                        <Link
                          to="/trending-localities"
                          onClick={() => setShowMobileMenu(false)}
                          className="flex items-center gap-3 rounded-xl px-3 py-3 text-sm font-medium text-slate-600 hover:bg-slate-50"
                        >
                          <TrendingUp className="size-5" />
                          Trending Localities
                        </Link>
                        <Link
                          to="/news"
                          onClick={() => setShowMobileMenu(false)}
                          className="flex items-center gap-3 rounded-xl px-3 py-3 text-sm font-medium text-slate-600 hover:bg-slate-50"
                        >
                          <Newspaper className="size-5" />
                          Trending News
                        </Link>
                      </>
                    ) : null}
                  </Fragment>
                );
              })}
            </div>

            <div className="border-t border-slate-100 p-2">
              <button
                type="button"
                disabled
                aria-disabled="true"
                className="flex w-full cursor-not-allowed items-center gap-3 rounded-xl px-3 py-3 text-sm font-medium text-slate-400"
              >
                <HelpCircle className="size-5" />
                Help &amp; Support
                <span className="ml-auto text-[10px] font-semibold text-slate-400">(Coming soon)</span>
              </button>
            </div>
          </div>
        </div>
      ) : null}

      <SearchFiltersModal
        isOpen={isFiltersModalOpen}
        onClose={() => setIsFiltersModalOpen(false)}
        onApplyFilters={(filters) => {
          setActiveFilters(filters);
          onMarketplaceSearchChange?.({ ...filters, query: marketSearch });
        }}
        currentFilters={activeFilters}
      />

      {/* Mobile Search Modal */}
      {searchFocused && (
        <div className="fixed inset-0 z-50 bg-white lg:hidden">
          <div className="flex items-center gap-3 p-4 border-b border-slate-200">
            <button
              type="button"
              onClick={() => setSearchFocused(false)}
              className="btn btn-ghost btn-circle"
            >
              <ChevronDown className="size-5" />
            </button>
            <div className="flex-1 flex items-center gap-2 bg-slate-100 rounded-lg px-3 py-2">
              <Search className="size-4 text-slate-400" />
              <input
                type="text"
                placeholder="Search city, locality, property or builder"
                className="flex-1 bg-transparent text-sm text-slate-700 placeholder:text-slate-400 focus:outline-none"
                value={marketSearch}
                onChange={(e) => {
                  setMarketSearch(e.target.value);
                  onMarketplaceSearchChange?.(e.target.value);
                }}
                autoFocus
              />
            </div>
            <button
              type="button"
              onClick={() => setIsFiltersModalOpen(true)}
              className={`flex items-center gap-1 rounded-md px-2 py-1.5 text-xs font-semibold transition-colors ${
                activeFilters
                  ? "bg-indigo-100 text-indigo-700"
                  : "bg-slate-100 text-slate-600"
              }`}
            >
              <Filter className="size-3" />
              Filters
            </button>
          </div>

          <div className="p-4 overflow-y-auto max-h-[calc(100vh-60px)]">
            {searchHistory && searchHistory.length > 0 && !marketSearch ? (
              <>
                <div className="mb-2 flex items-center justify-between">
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Recent Searches</p>
                  <button
                    type="button"
                    className="text-[10px] text-slate-400 hover:text-slate-600"
                    onClick={() => {
                      axiosInstance.delete("/search/history")
                        .then(() => setSearchHistory([]))
                        .catch(err => console.error("Failed to clear search history:", err));
                    }}
                  >
                    Clear
                  </button>
                </div>
                <div className="space-y-1">
                  {searchHistory.slice(0, 5).map((item, index) => (
                    <button
                      key={index}
                      type="button"
                      className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm text-slate-700 hover:bg-slate-50"
                      onClick={() => {
                        setMarketSearch(item.query);
                        onMarketplaceSearchChange?.(item.query);
                        setSearchFocused(false);
                      }}
                    >
                      <Search className="size-3.5 text-slate-400" />
                      {item.query}
                    </button>
                  ))}
                </div>
              </>
            ) : null}

            {isLoadingSuggestions ? (
              <div className="flex items-center justify-center py-8">
                <div className="size-4 animate-spin rounded-full border-2 border-slate-300 border-t-indigo-600" />
              </div>
            ) : searchSuggestions && searchSuggestions.length > 0 ? (
              <>
                {marketSearch && (
                  <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">Suggestions</p>
                )}
                <div className="space-y-1">
                  {searchSuggestions.map((item, index) => (
                    <button
                      key={`${item.type}-${index}`}
                      type="button"
                      className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm text-slate-700 hover:bg-slate-50"
                      onClick={() => {
                        setMarketSearch(item.value);
                        onMarketplaceSearchChange?.(item.value, item.type, item.authorId);
                        setSearchFocused(false);
                      }}
                    >
                      <Search className="size-3.5 text-slate-400" />
                      <span>{item.value}</span>
                      <span className="ml-auto text-xs text-slate-400">
                        {item.type === 'location' && '📍'}
                        {item.type === 'propertyType' && '🏠'}
                        {item.type === 'author' && '👤'}
                      </span>
                    </button>
                  ))}
                </div>
              </>
            ) : marketSearch ? (
              <div className="py-8 text-center text-sm text-slate-400">
                No suggestions found
              </div>
            ) : null}
          </div>
        </div>
      )}

      <PostModerationNotice enabled={Boolean(authUser?._id)} />
    </div>
  );
}
