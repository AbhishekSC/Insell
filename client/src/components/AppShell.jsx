import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Bell,
  ChevronDown,
  Command,
  Filter,
  Home,
  House,
  LogOut,
  MessageSquare,
  Moon,
  Phone,
  Plus,
  Search,
  Sparkles,
  Sun,
  UserCircle,
  UserRoundPlus,
} from "lucide-react";
import toast from "react-hot-toast";
import axiosInstance from "../lib/axios";
import { useStreamContext } from "../context/StreamProvider";
import { useTheme } from "../context/ThemeProvider";
import UserAvatar from "./UserAvatar";
import SearchFiltersModal from "./SearchFiltersModal";

function notifyBrowser(title, body) {
  if (typeof window === "undefined" || !("Notification" in window)) return;
  if (Notification.permission === "granted") {
    new Notification(title, { body });
  }
}

const navItems = [
  { to: "/marketplace", label: "Home", icon: Home },
  { to: "/activity", label: "Activity", icon: Bell },
  { to: "/property-tools", label: "Property Tools", icon: Sparkles },
  { to: "/connections", label: "Connections", icon: UserRoundPlus },
  { to: "/chat", label: "Chat", icon: MessageSquare },
  { to: "/call", label: "Call", icon: Phone },
  { to: "/profile", label: "Edit Profile", icon: UserCircle },
];

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

function HeaderActions({ onCreateProperty, toggleTheme, theme, onNotificationClick, notificationCount }) {
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
      <button type="button" className="btn btn-ghost btn-circle text-slate-600 hover:bg-slate-100 relative" onClick={onNotificationClick}>
        <Bell className="size-4" />
        {notificationCount > 0 && (
          <span className="absolute -top-1 -right-1 flex size-4 items-center justify-center rounded-full bg-red-500 text-[10px] font-bold text-white">
            {notificationCount > 9 ? "9+" : notificationCount}
          </span>
        )}
      </button>
      <button type="button" className="btn btn-ghost btn-circle text-slate-600 hover:bg-slate-100">
        <MessageSquare className="size-4" />
      </button>
      <button
        type="button"
        className="btn btn-ghost btn-sm btn-circle border border-slate-200 text-slate-600 hover:bg-slate-100"
        onClick={toggleTheme}
        aria-label={`Switch to ${theme === "light" ? "dark" : "light"} mode`}
        title={`Switch to ${theme === "light" ? "dark" : "light"} mode`}
      >
        {theme === "light" ? <Moon className="size-4" /> : <Sun className="size-4" />}
      </button>
    </div>
  );
}

function UserMenu({ userInitials, authUser, userRoleLabel, isPending, logout }) {
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
  hideMetrics = false,
  marketplaceSearch = "",
  onMarketplaceSearchChange,
  onCreateProperty,
  onNotificationClick,
  notificationCount = 0,
}) {
  const location = useLocation();
  const navigate = useNavigate();
  const isMarketplaceShell =
    location.pathname.startsWith("/marketplace") ||
    location.pathname.startsWith("/community") ||
    location.pathname.startsWith("/users/") ||
    location.pathname.startsWith("/news") ||
    location.pathname.startsWith("/property/") ||
    location.pathname.startsWith("/activity") ||
    location.pathname.startsWith("/chat") ||
    location.pathname.startsWith("/call") ||
    location.pathname.startsWith("/notification") ||
    location.pathname.startsWith("/connections") ||
    location.pathname.startsWith("/profile") ||
    location.pathname.startsWith("/toolkit") ||
    location.pathname.startsWith("/property-tools") ||
    location.pathname.startsWith("/friends/");

  const queryClient = useQueryClient();
  const previousRequestCountRef = useRef(0);
  const { unreadCount, streamClient, currentUserId } = useStreamContext();
  const { theme, toggleTheme } = useTheme();

  const [marketSearch, setMarketSearch] = useState(marketplaceSearch);
  const [searchFocused, setSearchFocused] = useState(false);
  const [mobileUserMenuOpen, setMobileUserMenuOpen] = useState(false);
  const [searchSuggestions, setSearchSuggestions] = useState([]);
  const [searchHistory, setSearchHistory] = useState([]);
  const [isLoadingSuggestions, setIsLoadingSuggestions] = useState(false);
  const [isFiltersModalOpen, setIsFiltersModalOpen] = useState(false);
  const [activeFilters, setActiveFilters] = useState(null);
  const searchInputRef = useRef(null);
  const searchDebounceRef = useRef(null);

  const authData = queryClient.getQueryData(["authUser"]);
  const authUser = authData?.data?.user || authData?.data || null;

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
                <HeaderActions onCreateProperty={onCreateProperty} toggleTheme={toggleTheme} theme={theme} onNotificationClick={onNotificationClick} notificationCount={notificationCount} />
                <UserMenu userInitials={userInitials} authUser={authUser} userRoleLabel={userRoleLabel} isPending={isPending} logout={logout} />
              </div>

              <div className="flex items-center justify-between gap-3 lg:hidden">
                <LogoSection isMarketplaceShell showText={false} />
                <div className="flex shrink-0 items-center gap-2">
                  <button
                    type="button"
                    className="btn btn-ghost btn-circle btn-sm border border-slate-200 text-slate-600 hover:bg-slate-100"
                    onClick={() => setSearchFocused(true)}
                  >
                    <Search className="size-4" />
                  </button>
                  <button
                    type="button"
                    className="btn btn-ghost btn-sm btn-circle border border-slate-200 text-slate-600 hover:bg-slate-100"
                    onClick={toggleTheme}
                    aria-label={`Switch to ${theme === "light" ? "dark" : "light"} mode`}
                    title={`Switch to ${theme === "light" ? "dark" : "light"} mode`}
                  >
                    {theme === "light" ? <Moon className="size-4" /> : <Sun className="size-4" />}
                  </button>

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

              <nav className="hidden items-center gap-1 rounded-2xl border border-base-300/80 bg-base-100/75 p-1.5 md:flex">
                {navItems.map((item) => {
                  const Icon = item.icon;
                  const active = location.pathname === item.to;

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
                <button
                  type="button"
                  className="btn btn-ghost btn-sm btn-circle border border-base-300/70"
                  onClick={toggleTheme}
                  aria-label={`Switch to ${theme === "light" ? "dark" : "light"} mode`}
                  title={`Switch to ${theme === "light" ? "dark" : "light"} mode`}
                >
                  {theme === "light" ? <Moon className="size-4" /> : <Sun className="size-4" />}
                </button>

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

      <nav className={isMarketplaceShell ? "fixed bottom-4 left-1/2 z-30 flex w-[calc(100%-1.5rem)] max-w-md -translate-x-1/2 items-center justify-around rounded-2xl border border-slate-200 bg-white/95 p-2 shadow-xl md:hidden" : "fixed bottom-4 left-1/2 z-30 flex w-[calc(100%-1.5rem)] max-w-md -translate-x-1/2 items-center justify-around rounded-2xl border border-base-300/80 bg-base-100/95 p-2 shadow-xl md:hidden"}>
        {navItems.map((item) => {
          const Icon = item.icon;
          const active = location.pathname === item.to;

          return (
            <Link
              key={item.to}
              to={item.to}
              className={`btn btn-sm relative ${
                isMarketplaceShell
                  ? active
                    ? "border-none bg-indigo-600 text-white"
                    : "border-none bg-transparent text-slate-600"
                  : active
                    ? "btn-primary"
                    : "btn-ghost"
              }`}
            >
              <Icon className="size-4" />
              {item.to === "/activity" && totalNotificationCount > 0 ? (
                <span className="badge badge-error badge-xs absolute -right-1 -top-1">{totalNotificationCount > 9 ? "9+" : totalNotificationCount}</span>
              ) : null}
              {item.to === "/connections" && incomingRequests.length > 0 ? (
                <span className="badge badge-error badge-xs absolute -right-1 -top-1">{incomingRequests.length > 9 ? "9+" : incomingRequests.length}</span>
              ) : null}
              {item.to === "/chat" && unreadCount > 0 ? (
                <span className="badge badge-secondary badge-xs absolute -right-1 -top-1">{unreadCount > 9 ? "9+" : unreadCount}</span>
              ) : null}
              {item.to === "/marketplace" && marketplaceUnreadCount > 0 ? (
                <span className="badge badge-warning badge-xs absolute -right-1 -top-1">{marketplaceUnreadCount > 9 ? "9+" : marketplaceUnreadCount}</span>
              ) : null}
            </Link>
          );
        })}

        <button
          type="button"
          className="btn btn-sm btn-ghost"
          onClick={toggleTheme}
          aria-label={`Switch to ${theme === "light" ? "dark" : "light"} mode`}
          title={`Switch to ${theme === "light" ? "dark" : "light"} mode`}
        >
          {theme === "light" ? <Moon className="size-4" /> : <Sun className="size-4" />}
        </button>
      </nav>

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
    </div>
  );
}
