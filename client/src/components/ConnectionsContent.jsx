import { useCallback, useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  BadgeCheck,
  Building2,
  Check,
  CheckCircle2,
  Clock3,
  Ellipsis,
  MapPin,
  MessageCircle,
  RefreshCw,
  Search,
  Sparkles,
  UserCheck,
  UserPlus,
  Users,
  X,
} from "lucide-react";
import toast from "react-hot-toast";
import { Link } from "react-router";
import UserAvatar from "./UserAvatar";
import axiosInstance from "../lib/axios";

const EMPTY_LIST = [];

const FILTER_CHIPS = [
  { label: "All", value: "all" },
  { label: "Nearby", value: "nearby" },
  { label: "Verified", value: "verified" },
  { label: "Buyers", value: "buyer" },
  { label: "Sellers", value: "seller" },
  { label: "Owners", value: "owner" },
  { label: "Tenants", value: "tenant" },
  { label: "Agents / Brokers", value: "agent" },
  { label: "Investors", value: "investor" },
];

function entityId(entity) {
  return String(typeof entity === "object" ? entity?._id || entity?.id || "" : entity || "");
}

function userRole(user) {
  return user?.primaryRole || user?.activeRole || user?.travelStyle || "Marketplace member";
}

function userLocation(user) {
  return user?.city || user?.homeBase || user?.location || "";
}

export default function ConnectionsContent({ onOpenMessages }) {
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState("discover"); // "discover" | "requests" | "network"
  const [requestSubTab, setRequestSubTab] = useState("received"); // "received" | "sent"
  const [searchQuery, setSearchQuery] = useState("");
  const [debouncedSearchQuery, setDebouncedSearchQuery] = useState("");
  const [selectedFilter, setSelectedFilter] = useState("all");
  const [pendingSendingIds, setPendingSendingIds] = useState(new Set());

  // Debounce search query
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearchQuery(searchQuery.trim());
    }, 300);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  // Auth User
  const { data: authData } = useQuery({
    queryKey: ["authUser"],
    queryFn: async () => (await axiosInstance.get("/auth/verify", { skipErrorToast: true })).data,
    retry: false,
    staleTime: 1000 * 60 * 5,
  });
  const authUser = authData?.data?.user || authData?.data || null;

  // Friends query
  const {
    data: friendsData,
    isRefetching: friendsRefetching,
    refetch: refetchFriends,
  } = useQuery({
    queryKey: ["friends"],
    queryFn: async () => (await axiosInstance.get("/users/friends")).data?.data?.friends || [],
  });
  const friendsList = friendsData ?? EMPTY_LIST;

  // Incoming connection requests
  const {
    data: incomingData,
    isRefetching: incomingRefetching,
    refetch: refetchIncoming,
  } = useQuery({
    queryKey: ["incomingRequests"],
    queryFn: async () => (await axiosInstance.get("/users/friend-requests")).data?.data?.incomingRequests || [],
    refetchInterval: 15000,
  });
  const incomingRequests = incomingData ?? EMPTY_LIST;

  // Outgoing connection requests
  const {
    data: outgoingData,
    isRefetching: outgoingRefetching,
    refetch: refetchOutgoing,
  } = useQuery({
    queryKey: ["outgoingRequests"],
    queryFn: async () => (await axiosInstance.get("/users/outgoing-friend-requests")).data?.data?.outgoingRequests || [],
  });
  const outgoingRequests = outgoingData ?? EMPTY_LIST;

  // Message requests notifications
  const {
    data: notificationsData,
    refetch: refetchNotifications,
  } = useQuery({
    queryKey: ["notifications", "message_request"],
    queryFn: async () => (await axiosInstance.get("/notifications?type=message_request")).data?.data?.notifications || [],
    refetchInterval: 30000,
    select: (notifications) => notifications.filter((n) => n.requestStatus === "pending"),
  });
  const messageRequests = notificationsData ?? EMPTY_LIST;

  // Discover recommendations & universal search query
  const {
    data: discoverResponse,
    isLoading: discoverLoading,
    isRefetching: discoverRefetching,
    refetch: refetchDiscover,
  } = useQuery({
    queryKey: ["discoverUsers", debouncedSearchQuery, selectedFilter],
    queryFn: async () => {
      const params = new URLSearchParams({ limit: "30" });
      if (debouncedSearchQuery) params.set("q", debouncedSearchQuery);
      if (selectedFilter !== "all") params.set("filter", selectedFilter);
      return (await axiosInstance.get(`/users/discover?${params.toString()}`)).data?.data || { users: [] };
    },
    placeholderData: (previousData) => previousData,
  });
  const discoverUsers = discoverResponse?.users ?? EMPTY_LIST;

  // Set of user IDs with pending outgoing requests
  const pendingOutgoingUserIds = useMemo(() => {
    const ids = new Set();
    outgoingRequests.forEach((req) => {
      const receiverId = entityId(req.receiver);
      if (receiverId) ids.add(receiverId);
    });
    pendingSendingIds.forEach((id) => ids.add(id));
    return ids;
  }, [outgoingRequests, pendingSendingIds]);

  // Map of incoming pending request IDs
  const incomingRequestMap = useMemo(() => {
    const map = new Map();
    incomingRequests.forEach((req) => {
      const senderId = entityId(req.sender);
      if (senderId) map.set(senderId, req._id);
    });
    return map;
  }, [incomingRequests]);

  // Refresh lists
  const handleRefresh = useCallback(() => {
    refetchDiscover();
    refetchIncoming();
    refetchOutgoing();
    refetchFriends();
    refetchNotifications();
  }, [refetchDiscover, refetchIncoming, refetchOutgoing, refetchFriends, refetchNotifications]);

  const isRefreshing =
    (activeTab === "discover" && discoverRefetching) ||
    (activeTab === "requests" && (incomingRefetching || outgoingRefetching)) ||
    (activeTab === "network" && friendsRefetching);

  // Mutations
  const sendRequestMutation = useMutation({
    mutationFn: async (userId) => axiosInstance.post(`/users/friend-request/${userId}`),
    onMutate: (userId) => {
      setPendingSendingIds((prev) => new Set(prev).add(userId));
    },
    onSuccess: () => {
      toast.success("Connection request sent");
      queryClient.invalidateQueries({ queryKey: ["outgoingRequests"] });
      queryClient.invalidateQueries({ queryKey: ["discoverUsers"] });
    },
    onError: (error, userId) => {
      setPendingSendingIds((prev) => {
        const next = new Set(prev);
        next.delete(userId);
        return next;
      });
      toast.error(error?.response?.data?.message || "Could not send connection request");
    },
    onSettled: () => {
      setPendingSendingIds((prev) => new Set(prev));
    },
  });

  const acceptRequestMutation = useMutation({
    mutationFn: async (requestId) => axiosInstance.put(`/users/friend-request/${requestId}/accept`),
    onSuccess: () => {
      toast.success("Connection accepted");
      queryClient.invalidateQueries({ queryKey: ["incomingRequests"] });
      queryClient.invalidateQueries({ queryKey: ["friends"] });
      queryClient.invalidateQueries({ queryKey: ["discoverUsers"] });
    },
    onError: (error) => {
      toast.error(error?.response?.data?.message || "Could not accept request");
    },
  });

  const rejectRequestMutation = useMutation({
    mutationFn: async (requestId) => axiosInstance.put(`/users/friend-request/${requestId}/reject`),
    onSuccess: () => {
      toast.success("Connection request declined");
      queryClient.invalidateQueries({ queryKey: ["incomingRequests"] });
      queryClient.invalidateQueries({ queryKey: ["discoverUsers"] });
    },
    onError: (error) => {
      toast.error(error?.response?.data?.message || "Could not decline request");
    },
  });

  const handleMessageRequestMutation = useMutation({
    mutationFn: async ({ notificationId, action, senderId }) => {
      const response = await axiosInstance.patch(`/notifications/${notificationId}/handle-request`, { action });
      if (action === "accept" && senderId) {
        try {
          await axiosInstance.post(`/users/friend-request/${senderId}`);
          await axiosInstance.put(`/users/friend-request/${senderId}/accept`);
        } catch {
          // Non-fatal if connection link is already created
        }
      }
      return response.data;
    },
    onSuccess: () => {
      toast.success("Request updated");
      queryClient.invalidateQueries({ queryKey: ["notifications"] });
      queryClient.invalidateQueries({ queryKey: ["friends"] });
      queryClient.invalidateQueries({ queryKey: ["incomingRequests"] });
    },
    onError: (error) => {
      toast.error(error?.response?.data?.message || "Failed to handle request");
    },
  });

  // Filtered friends list
  const filteredFriends = useMemo(() => {
    if (!debouncedSearchQuery) return friendsList;
    const q = debouncedSearchQuery.toLowerCase();
    return friendsList.filter((f) => {
      const name = (f?.fullName || "").toLowerCase();
      const city = (f?.city || f?.homeBase || "").toLowerCase();
      const role = (f?.primaryRole || f?.activeRole || "").toLowerCase();
      return name.includes(q) || city.includes(q) || role.includes(q);
    });
  }, [friendsList, debouncedSearchQuery]);

  const totalIncomingCount = incomingRequests.length + messageRequests.length;

  return (
    <div className="mx-auto w-full max-w-5xl min-w-0 space-y-4 px-2 sm:px-4 pb-12 box-border overflow-x-hidden">
      {/* Top Header */}
      <div className="flex w-full min-w-0 flex-wrap items-center justify-between gap-3 border-b border-base-200 pb-3 pt-1 box-border">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-base-content sm:text-2xl">
            Connections &amp; People
          </h1>
          <p className="mt-0.5 text-xs text-base-content/60 sm:text-sm">
            Find owners, buyers, brokers &amp; tenants in your network
          </p>
        </div>
        <button
          type="button"
          onClick={handleRefresh}
          className="btn btn-ghost btn-sm h-9 gap-1.5 rounded-xl text-base-content/70 hover:bg-base-200"
          title="Refresh connections"
        >
          <RefreshCw className={`size-4 ${isRefreshing ? "animate-spin" : ""}`} />
          <span className="hidden sm:inline">Refresh</span>
        </button>
      </div>

      {/* Global Search Bar */}
      <div className="relative w-full min-w-0 box-border">
        <div className="flex h-11 w-full min-w-0 items-center gap-2.5 rounded-2xl border border-base-300 bg-base-100 px-3.5 shadow-[0_2px_8px_rgba(15,23,42,0.03)] focus-within:border-primary focus-within:ring-2 focus-within:ring-primary/20 box-border">
          <Search className="size-4 shrink-0 text-base-content/40" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder={
              activeTab === "network"
                ? "Search among your connections..."
                : "Search by name, role, city, locality..."
            }
            className="min-w-0 flex-1 bg-transparent text-sm text-base-content outline-none placeholder:text-base-content/40"
          />
          {searchQuery ? (
            <button
              type="button"
              onClick={() => setSearchQuery("")}
              className="grid size-6 place-items-center rounded-full text-base-content/40 hover:bg-base-200 hover:text-base-content"
              aria-label="Clear search"
            >
              <X className="size-3.5" />
            </button>
          ) : null}
        </div>
      </div>

      {/* Segmented Tabs Bar */}
      <div className="flex w-full max-w-full min-w-0 items-center gap-1 border-b border-base-200 box-border">
        {/* Tab 1: Discover */}
        <button
          type="button"
          onClick={() => setActiveTab("discover")}
          className={`relative flex flex-1 min-w-0 items-center justify-center gap-1.5 whitespace-nowrap border-b-2 px-2 sm:px-3 py-2.5 text-xs font-bold transition sm:text-sm ${
            activeTab === "discover"
              ? "border-primary text-primary"
              : "border-transparent text-base-content/60 hover:text-base-content"
          }`}
        >
          <Sparkles className="size-4 shrink-0" />
          <span className="truncate whitespace-nowrap">Discover</span>
        </button>

        {/* Tab 2: Requests */}
        <button
          type="button"
          onClick={() => setActiveTab("requests")}
          className={`relative flex flex-1 min-w-0 items-center justify-center gap-1.5 whitespace-nowrap border-b-2 px-2 sm:px-3 py-2.5 text-xs font-bold transition sm:text-sm ${
            activeTab === "requests"
              ? "border-primary text-primary"
              : "border-transparent text-base-content/60 hover:text-base-content"
          }`}
        >
          <UserCheck className="size-4 shrink-0" />
          <span className="truncate whitespace-nowrap">Requests</span>
          {totalIncomingCount > 0 ? (
            <span className="grid size-4.5 shrink-0 place-items-center rounded-full bg-error px-1 text-[10px] font-bold text-white">
              {totalIncomingCount}
            </span>
          ) : null}
        </button>

        {/* Tab 3: My Network */}
        <button
          type="button"
          onClick={() => setActiveTab("network")}
          className={`relative flex flex-1 min-w-0 items-center justify-center gap-1.5 whitespace-nowrap border-b-2 px-2 sm:px-3 py-2.5 text-xs font-bold transition sm:text-sm ${
            activeTab === "network"
              ? "border-primary text-primary"
              : "border-transparent text-base-content/60 hover:text-base-content"
          }`}
        >
          <Users className="size-4 shrink-0" />
          <span className="truncate whitespace-nowrap">My Network</span>
          {friendsList.length > 0 ? (
            <span className="shrink-0 rounded-full bg-base-200 px-1.5 py-0.5 text-[10px] font-semibold text-base-content/70">
              {friendsList.length}
            </span>
          ) : null}
        </button>
      </div>

      {/* TAB CONTENT: DISCOVER */}
      {activeTab === "discover" && (
        <div className="w-full max-w-full min-w-0 space-y-4 box-border">
          {/* Quick Filter Chips (visible when not actively searching) */}
          {!debouncedSearchQuery ? (
            <div className="flex w-full max-w-full min-w-0 flex-wrap items-center gap-1.5 sm:gap-2 py-1 box-border">
              {FILTER_CHIPS.map((chip) => {
                const isSelected = selectedFilter === chip.value;
                return (
                  <button
                    key={chip.value}
                    type="button"
                    onClick={() => setSelectedFilter(chip.value)}
                    className={`rounded-full px-3.5 py-1.5 text-xs font-semibold transition ${
                      isSelected
                        ? "border border-primary bg-primary text-white shadow-xs"
                        : "border border-base-300 bg-base-100 text-base-content/70 hover:border-primary/40 hover:text-primary"
                    }`}
                  >
                    {chip.label}
                  </button>
                );
              })}
            </div>
          ) : (
            <div className="flex items-center justify-between px-1 py-1 text-xs text-base-content/60">
              <span>
                Search results for &ldquo;<strong className="text-base-content">{debouncedSearchQuery}</strong>&rdquo;
              </span>
              <button
                type="button"
                onClick={() => setSearchQuery("")}
                className="font-medium text-primary hover:underline"
              >
                Clear
              </button>
            </div>
          )}

          {/* Cards Grid */}
          {discoverLoading ? (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {Array.from({ length: 6 }).map((_, i) => (
                <div
                  key={i}
                  className="h-32 animate-pulse rounded-2xl border border-base-200 bg-base-200/50"
                />
              ))}
            </div>
          ) : discoverUsers.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-base-300 bg-base-100 px-6 py-14 text-center">
              <div className="mx-auto grid size-14 place-items-center rounded-full bg-base-200 text-base-content/40">
                <Users className="size-6" />
              </div>
              <p className="mt-3 text-base font-bold text-base-content">
                No matching people found
              </p>
              <p className="mx-auto mt-1 max-w-sm text-xs leading-relaxed text-base-content/60">
                {debouncedSearchQuery
                  ? "Try searching with a different name, locality, or professional role."
                  : "We're matching new verified users in your area. Check back soon!"}
              </p>
              {debouncedSearchQuery ? (
                <button
                  type="button"
                  onClick={() => setSearchQuery("")}
                  className="btn btn-sm mt-4 h-9 rounded-xl border-none bg-primary px-4 text-xs font-bold text-white shadow-none hover:bg-primary/90"
                >
                  Clear Search
                </button>
              ) : null}
            </div>
          ) : (
            <div className="grid min-w-0 gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {discoverUsers.map((user) => {
                const isSent = pendingOutgoingUserIds.has(user._id) || user.isPendingSent;
                const isSelf = user.isSelf || entityId(user) === entityId(authUser);
                const isFriend = user.isFriend;
                const incomingReqId = incomingRequestMap.get(user._id);

                return (
                  <DiscoverCard
                    key={user._id}
                    user={user}
                    isSelf={isSelf}
                    isFriend={isFriend}
                    isSent={isSent}
                    incomingReqId={incomingReqId}
                    onConnect={() => sendRequestMutation.mutate(user._id)}
                    onAccept={(reqId) => acceptRequestMutation.mutate(reqId)}
                    onOpenMessages={onOpenMessages}
                    busy={sendRequestMutation.isPending && sendRequestMutation.variables === user._id}
                  />
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* TAB CONTENT: REQUESTS */}
      {activeTab === "requests" && (
        <div className="w-full max-w-full min-w-0 space-y-4 box-border">
          {/* Sub-tab pills: Received vs Sent */}
          <div className="inline-flex rounded-xl bg-base-200 p-1">
            <button
              type="button"
              onClick={() => setRequestSubTab("received")}
              className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-bold transition ${
                requestSubTab === "received"
                  ? "bg-base-100 text-primary shadow-xs"
                  : "text-base-content/60 hover:text-base-content"
              }`}
            >
              <span>Received</span>
              {totalIncomingCount > 0 ? (
                <span className="rounded-full bg-error px-1.5 py-0.2 text-[10px] font-bold text-white">
                  {totalIncomingCount}
                </span>
              ) : null}
            </button>
            <button
              type="button"
              onClick={() => setRequestSubTab("sent")}
              className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-bold transition ${
                requestSubTab === "sent"
                  ? "bg-base-100 text-primary shadow-xs"
                  : "text-base-content/60 hover:text-base-content"
              }`}
            >
              <span>Sent</span>
              {outgoingRequests.length > 0 ? (
                <span className="rounded-full bg-base-300 px-1.5 py-0.2 text-[10px] font-semibold text-base-content/70">
                  {outgoingRequests.length}
                </span>
              ) : null}
            </button>
          </div>

          {/* SubTab: Received */}
          {requestSubTab === "received" && (
            <div className="space-y-3">
              {incomingRequests.length === 0 && messageRequests.length === 0 ? (
                <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-base-300 bg-base-100 px-6 py-12 text-center">
                  <div className="grid size-12 place-items-center rounded-full bg-success/15 text-success">
                    <CheckCircle2 className="size-6" />
                  </div>
                  <h3 className="mt-3 text-base font-bold text-base-content">
                    You&apos;re all caught up!
                  </h3>
                  <p className="mt-1 text-xs text-base-content/60">
                    No pending connection or message requests right now.
                  </p>
                  <button
                    type="button"
                    onClick={() => setActiveTab("discover")}
                    className="btn btn-sm mt-4 h-9 gap-1.5 rounded-xl border-none bg-primary px-4 text-xs font-semibold text-white shadow-none hover:bg-primary/90"
                  >
                    <Sparkles className="size-3.5" />
                    Discover People
                  </button>
                </div>
              ) : (
                <div className="grid min-w-0 gap-3 sm:grid-cols-2">
                  {/* Connection Requests */}
                  {incomingRequests.map((req) => (
                    <IncomingRequestRow
                      key={req._id}
                      request={req}
                      onAccept={() => acceptRequestMutation.mutate(req._id)}
                      onReject={() => rejectRequestMutation.mutate(req._id)}
                      busy={acceptRequestMutation.isPending || rejectRequestMutation.isPending}
                    />
                  ))}

                  {/* Message Requests */}
                  {messageRequests.map((req) => (
                    <MessageRequestRow
                      key={req._id}
                      request={req}
                      onAccept={() =>
                        handleMessageRequestMutation.mutate({
                          notificationId: req._id,
                          action: "accept",
                          senderId: req?.sender?._id || req?.actor?._id,
                        })
                      }
                      onReject={() =>
                        handleMessageRequestMutation.mutate({
                          notificationId: req._id,
                          action: "ignore",
                        })
                      }
                      busy={handleMessageRequestMutation.isPending}
                    />
                  ))}
                </div>
              )}
            </div>
          )}

          {/* SubTab: Sent */}
          {requestSubTab === "sent" && (
            <div className="space-y-3">
              {outgoingRequests.length === 0 ? (
                <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-base-300 bg-base-100 px-6 py-12 text-center">
                  <div className="grid size-12 place-items-center rounded-full bg-base-200 text-base-content/40">
                    <Clock3 className="size-6" />
                  </div>
                  <h3 className="mt-3 text-base font-bold text-base-content">
                    No outgoing requests
                  </h3>
                  <p className="mt-1 text-xs text-base-content/60">
                    Explore members in the Discover tab and send connection requests.
                  </p>
                  <button
                    type="button"
                    onClick={() => setActiveTab("discover")}
                    className="btn btn-sm mt-4 h-9 gap-1.5 rounded-xl border-none bg-primary px-4 text-xs font-semibold text-white shadow-none hover:bg-primary/90"
                  >
                    <Sparkles className="size-3.5" />
                    Discover People
                  </button>
                </div>
              ) : (
                <div className="grid min-w-0 gap-3 sm:grid-cols-2">
                  {outgoingRequests.map((req) => (
                    <OutgoingRequestRow key={req._id} request={req} />
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* TAB CONTENT: MY NETWORK */}
      {activeTab === "network" && (
        <div className="w-full max-w-full min-w-0 space-y-4 box-border">
          <div className="flex items-center justify-between px-1">
            <span className="text-xs font-bold uppercase tracking-wider text-base-content/60">
              {filteredFriends.length} Connection{filteredFriends.length === 1 ? "" : "s"}
            </span>
          </div>

          {filteredFriends.length === 0 ? (
            <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-base-300 bg-base-100 px-6 py-12 text-center">
              <div className="grid size-12 place-items-center rounded-full bg-base-200 text-base-content/40">
                <Users className="size-6" />
              </div>
              <h3 className="mt-3 text-base font-bold text-base-content">
                {debouncedSearchQuery ? "No connections match your search" : "Your network starts here"}
              </h3>
              <p className="mx-auto mt-1 max-w-sm text-xs leading-relaxed text-base-content/60">
                {debouncedSearchQuery
                  ? "Try searching by another name or role."
                  : "Connect with owners, buyers, brokers, and consultants to expand your deals."}
              </p>
              {!debouncedSearchQuery ? (
                <button
                  type="button"
                  onClick={() => setActiveTab("discover")}
                  className="btn btn-sm mt-4 h-9 gap-1.5 rounded-xl border-none bg-primary px-4 text-xs font-semibold text-white shadow-none hover:bg-primary/90"
                >
                  <Sparkles className="size-3.5" />
                  Discover People
                </button>
              ) : null}
            </div>
          ) : (
            <div className="grid min-w-0 gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {filteredFriends.map((friend) => (
                <FriendCard
                  key={friend._id}
                  user={friend}
                  onOpenMessages={() => {
                    if (typeof onOpenMessages === "function") {
                      onOpenMessages(friend._id);
                    }
                  }}
                />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// -------------------------------------------------------------
// Component: DiscoverCard (matches mobile DiscoverUserCard)
// -------------------------------------------------------------
function DiscoverCard({
  user,
  isSelf,
  isFriend,
  isSent,
  incomingReqId,
  onConnect,
  onAccept,
  onOpenMessages,
  busy,
}) {
  const isVerified = Boolean(user.isOwnerVerified);
  const role = userRole(user);
  const location = userLocation(user);

  const mutualCount = user.mutualConnections || 0;
  const mutualUsers = user.mutualConnectionUsers || [];
  const reason = user.recommendationReason;

  return (
    <div
      className={`group flex flex-col justify-between min-w-0 w-full overflow-hidden rounded-2xl border p-3.5 sm:p-4 box-border shadow-[0_1px_3px_rgba(15,23,42,0.03)] transition duration-200 hover:-translate-y-0.5 hover:shadow-md ${
        isFriend
          ? "border-emerald-500/30 bg-emerald-500/[0.04] dark:bg-emerald-950/20 dark:border-emerald-800/40 hover:border-emerald-500/50"
          : "border-base-200 bg-base-100 hover:border-primary/40"
      }`}
    >
      {/* Top Header: Avatar + Info + Action */}
      <div className="flex min-w-0 w-full items-start justify-between gap-2 sm:gap-2.5 box-border">
        <div className="flex min-w-0 flex-1 items-center gap-3">
          <div className="shrink-0">
            <UserAvatar
              src={user.profilePic}
              name={user.fullName || "User"}
              userId={user._id}
              sizeClass="size-11"
            />
          </div>
          <div className="min-w-0 flex-1 overflow-hidden">
            <div className="flex min-w-0 items-center gap-1">
              <Link
                to={`/users/${user._id}`}
                title={user.fullName || "User"}
                className="min-w-0 truncate text-sm font-bold text-base-content hover:text-primary"
              >
                {user.fullName || "User"}
              </Link>
              {isVerified ? (
                <BadgeCheck className="size-4 shrink-0 text-primary" aria-label="Verified Owner" />
              ) : null}
            </div>
            <p
              title={`${role}${location ? ` · ${location}` : ""}`}
              className="min-w-0 truncate text-xs capitalize text-base-content/60"
            >
              {role}
              {location ? ` · ${location}` : ""}
            </p>
          </div>
        </div>

        {/* Action Button / Pill */}
        <div className="shrink-0">
          {isSelf ? (
            <span className="inline-flex rounded-full bg-base-200 px-3 py-1 text-xs font-semibold text-base-content/60 whitespace-nowrap">
              You
            </span>
          ) : isFriend ? (
            <div className="flex items-center gap-1">
              <span className="inline-flex items-center gap-1 rounded-full border border-emerald-500/20 bg-emerald-500/10 px-2.5 py-1 text-xs font-semibold text-emerald-600 whitespace-nowrap">
                <Check className="size-3" />
                Connected
              </span>
              <button
                type="button"
                onClick={() => onOpenMessages?.(user._id)}
                className="btn btn-ghost btn-xs btn-circle text-primary hover:bg-primary/10"
                title="Send message"
              >
                <MessageCircle className="size-3.5" />
              </button>
            </div>
          ) : isSent ? (
            <span className="inline-flex items-center gap-1 rounded-full bg-base-200 px-3 py-1 text-xs font-medium text-base-content/60 whitespace-nowrap">
              <Check className="size-3" />
              Sent
            </span>
          ) : incomingReqId ? (
            <button
              type="button"
              onClick={() => onAccept(incomingReqId)}
              className="btn btn-sm h-8 rounded-full border-none bg-primary px-3 text-xs font-semibold text-white hover:bg-primary/90 whitespace-nowrap"
            >
              Accept
            </button>
          ) : (
            <button
              type="button"
              onClick={onConnect}
              disabled={busy}
              className="btn btn-sm h-8 gap-1 rounded-full border-none bg-primary px-3 text-xs font-semibold text-white shadow-xs hover:bg-primary/90 disabled:opacity-50 whitespace-nowrap"
            >
              {busy ? (
                <span className="loading loading-spinner loading-xs" />
              ) : (
                <>
                  <UserPlus className="size-3.5" />
                  Connect
                </>
              )}
            </button>
          )}
        </div>
      </div>

      {/* Bottom Context: Mutual Connections or Recommendation Reason with crisp border */}
      <div className="mt-3 border-t border-base-200/60 pt-2.5">
        {mutualCount > 0 ? (
          <div className="inline-flex max-w-full items-center gap-1.5 rounded-full border border-primary/30 bg-primary/[0.03] px-2.5 py-0.5 text-xs font-semibold text-primary">
            <div className="flex shrink-0 items-center -space-x-1.5">
              {mutualUsers.slice(0, 2).map((mUser, idx) => (
                <div
                  key={mUser._id || idx}
                  className="size-4 overflow-hidden rounded-full border border-base-100 bg-primary/15 text-[8px] font-bold text-primary"
                >
                  {mUser.profilePic ? (
                    <img
                      src={mUser.profilePic}
                      alt={mUser.fullName || ""}
                      className="size-full object-cover"
                    />
                  ) : (
                    <span className="grid size-full place-items-center">
                      {(mUser.fullName || "U").charAt(0).toUpperCase()}
                    </span>
                  )}
                </div>
              ))}
            </div>
            <span className="min-w-0 truncate">
              {mutualCount === 1 ? "1 mutual connection" : `${mutualCount} mutual connections`}
            </span>
          </div>
        ) : !isSelf && reason && reason !== "This is you" ? (
          <div
            title={reason}
            className="inline-flex max-w-full items-center rounded-full border border-base-300 px-2.5 py-0.5 text-[11px] font-medium text-base-content/70"
          >
            <span className="min-w-0 truncate">{reason}</span>
          </div>
        ) : !isSelf ? (
          <div className="text-[11px] text-base-content/40">Marketplace member</div>
        ) : null}
      </div>
    </div>
  );
}

// -------------------------------------------------------------
// Component: IncomingRequestRow (matches mobile IncomingRequestCard)
// -------------------------------------------------------------
function IncomingRequestRow({ request, onAccept, onReject, busy }) {
  const sender = request?.sender || request?.actor;
  const isVerified = Boolean(sender?.isOwnerVerified);
  const role = userRole(sender);
  const location = userLocation(sender);

  return (
    <div className="flex flex-col justify-between min-w-0 w-full overflow-hidden rounded-2xl border border-base-200 bg-base-100 p-3 sm:p-3.5 box-border shadow-xs transition hover:border-primary/30">
      <div className="flex min-w-0 w-full items-center justify-between gap-2">
        <div className="flex min-w-0 flex-1 items-center gap-3">
          <div className="shrink-0">
            <UserAvatar
              src={sender?.profilePic}
              name={sender?.fullName || "User"}
              userId={sender?._id}
              sizeClass="size-11"
            />
          </div>
          <div className="min-w-0 flex-1 overflow-hidden">
            <div className="flex min-w-0 items-center gap-1">
              <Link
                to={`/users/${sender?._id}`}
                title={sender?.fullName || "User"}
                className="min-w-0 truncate text-[15px] font-bold text-base-content hover:text-primary"
              >
                {sender?.fullName || "User"}
              </Link>
              {isVerified ? (
                <BadgeCheck className="size-3.5 shrink-0 text-primary" aria-label="Verified Owner" />
              ) : null}
            </div>
            <p
              title={`${role}${location ? ` · ${location}` : ""}`}
              className="mt-0.5 min-w-0 truncate text-xs capitalize text-base-content/50"
            >
              {role}{location ? ` · ${location}` : ""}
            </p>
          </div>
        </div>
      </div>

      {request?.actualMessage ? (
        <p className="mt-2.5 min-w-0 break-words rounded-xl bg-base-200/50 px-3 py-2 text-xs italic text-base-content/70 [overflow-wrap:anywhere]">
          &ldquo;{request.actualMessage}&rdquo;
        </p>
      ) : null}

      {request?.propertyPost ? (
        <div className="mt-2 inline-flex max-w-full min-w-0 items-center gap-1.5 rounded-lg bg-base-200 px-2 py-1 text-xs text-base-content/70">
          <Building2 className="size-3 shrink-0 text-base-content/50" />
          <span
            title={request.propertyPost.title || "Property Listing"}
            className="min-w-0 truncate font-medium"
          >
            {request.propertyPost.title || "Property Listing"}
          </span>
        </div>
      ) : null}

      <div className="mt-3 flex items-center gap-2 border-t border-base-200/60 pt-2.5">
        <button
          type="button"
          onClick={onAccept}
          disabled={busy}
          className="flex min-w-0 flex-1 items-center justify-center gap-1.5 whitespace-nowrap rounded-xl bg-emerald-600 py-2 text-xs font-semibold text-white transition hover:bg-emerald-700 disabled:opacity-50"
        >
          {busy ? (
            <span className="loading loading-spinner loading-xs" />
          ) : (
            <>
              <Check className="size-3.5 shrink-0" />
              <span className="truncate">Accept</span>
            </>
          )}
        </button>

        <button
          type="button"
          onClick={onReject}
          disabled={busy}
          className="flex min-w-0 flex-1 items-center justify-center gap-1.5 whitespace-nowrap rounded-xl border border-base-300 bg-base-200/50 py-2 text-xs font-medium text-base-content/70 transition hover:bg-base-200 disabled:opacity-50"
        >
          <X className="size-3.5 shrink-0" />
          <span className="truncate">Decline</span>
        </button>
      </div>
    </div>
  );
}

// -------------------------------------------------------------
// Component: MessageRequestRow (matches mobile IncomingRequestCard)
// -------------------------------------------------------------
function MessageRequestRow({ request, onAccept, onReject, busy }) {
  const sender = request?.sender || request?.actor;
  const isVerified = Boolean(sender?.isOwnerVerified);
  const role = userRole(sender);
  const location = userLocation(sender);

  return (
    <div className="flex flex-col justify-between min-w-0 w-full overflow-hidden rounded-2xl border border-base-200 bg-base-100 p-3 sm:p-3.5 box-border shadow-xs transition hover:border-primary/30">
      <div className="flex min-w-0 w-full items-center justify-between gap-2">
        <div className="flex min-w-0 flex-1 items-center gap-3">
          <div className="shrink-0">
            <UserAvatar
              src={sender?.profilePic}
              name={sender?.fullName || "User"}
              userId={sender?._id}
              sizeClass="size-11"
            />
          </div>
          <div className="min-w-0 flex-1 overflow-hidden">
            <div className="flex min-w-0 items-center gap-1">
              <Link
                to={`/users/${sender?._id}`}
                title={sender?.fullName || "User"}
                className="min-w-0 truncate text-[15px] font-bold text-base-content hover:text-primary"
              >
                {sender?.fullName || "User"}
              </Link>
              {isVerified ? (
                <BadgeCheck className="size-3.5 shrink-0 text-primary" aria-label="Verified Owner" />
              ) : null}
            </div>
            <p
              title={`${role}${location ? ` · ${location}` : ""}`}
              className="mt-0.5 min-w-0 truncate text-xs capitalize text-base-content/50"
            >
              {role}{location ? ` · ${location}` : ""}
            </p>
          </div>
        </div>
      </div>

      {request?.actualMessage ? (
        <p className="mt-2.5 min-w-0 break-words rounded-xl bg-base-200/50 px-3 py-2 text-xs italic text-base-content/70 [overflow-wrap:anywhere]">
          &ldquo;{request.actualMessage}&rdquo;
        </p>
      ) : null}

      {request?.propertyPost ? (
        <div className="mt-2 inline-flex max-w-full min-w-0 items-center gap-1.5 rounded-lg bg-base-200 px-2 py-1 text-xs text-base-content/70">
          <Building2 className="size-3 shrink-0 text-base-content/50" />
          <span
            title={request.propertyPost.title || "Property Enquiry"}
            className="min-w-0 truncate font-medium"
          >
            {request.propertyPost.title || "Property Enquiry"}
          </span>
        </div>
      ) : null}

      <div className="mt-3 flex items-center gap-2 border-t border-base-200/60 pt-2.5">
        <button
          type="button"
          onClick={onAccept}
          disabled={busy}
          className="flex min-w-0 flex-1 items-center justify-center gap-1.5 whitespace-nowrap rounded-xl bg-emerald-600 py-2 text-xs font-semibold text-white transition hover:bg-emerald-700 disabled:opacity-50"
        >
          {busy ? (
            <span className="loading loading-spinner loading-xs" />
          ) : (
            <>
              <Check className="size-3.5 shrink-0" />
              <span className="truncate">Accept</span>
            </>
          )}
        </button>

        <button
          type="button"
          onClick={onReject}
          disabled={busy}
          className="flex min-w-0 flex-1 items-center justify-center gap-1.5 whitespace-nowrap rounded-xl border border-base-300 bg-base-200/50 py-2 text-xs font-medium text-base-content/70 transition hover:bg-base-200 disabled:opacity-50"
        >
          <X className="size-3.5 shrink-0" />
          <span className="truncate">Ignore</span>
        </button>
      </div>
    </div>
  );
}

// -------------------------------------------------------------
// Component: OutgoingRequestRow (matches mobile OutgoingRequestCard)
// -------------------------------------------------------------
function OutgoingRequestRow({ request }) {
  const receiver = request?.receiver;
  const isVerified = Boolean(receiver?.isOwnerVerified);
  const role = userRole(receiver);
  const location = userLocation(receiver);

  return (
    <div className="flex items-center justify-between gap-2.5 sm:gap-3 min-w-0 w-full overflow-hidden rounded-2xl border border-base-200 bg-base-100 p-3 sm:p-3.5 box-border shadow-xs transition hover:border-primary/30">
      <div className="flex min-w-0 flex-1 items-center gap-3">
        <div className="shrink-0">
          <UserAvatar
            src={receiver?.profilePic}
            name={receiver?.fullName || "User"}
            userId={receiver?._id}
            sizeClass="size-11"
          />
        </div>
        <div className="min-w-0 flex-1 overflow-hidden">
          <div className="flex min-w-0 items-center gap-1">
            <Link
              to={`/users/${receiver?._id}`}
              title={receiver?.fullName || "User"}
              className="min-w-0 truncate text-[15px] font-bold text-base-content hover:text-primary"
            >
              {receiver?.fullName || "User"}
            </Link>
            {isVerified ? (
              <BadgeCheck className="size-3.5 shrink-0 text-primary" aria-label="Verified Owner" />
            ) : null}
          </div>
          <p
            title={`${role}${location ? ` · ${location}` : ""}`}
            className="mt-0.5 min-w-0 truncate text-xs capitalize text-base-content/50"
          >
            {role}{location ? ` · ${location}` : ""}
          </p>
        </div>
      </div>

      <span className="flex shrink-0 items-center gap-1 rounded-full bg-amber-500/10 px-3 py-1 text-xs font-semibold text-amber-600">
        <Clock3 className="size-3 text-amber-500 shrink-0" />
        <span className="whitespace-nowrap">Pending</span>
      </span>
    </div>
  );
}

// -------------------------------------------------------------
// Component: FriendCard (matches mobile FriendCard.tsx 1:1)
// -------------------------------------------------------------
function FriendCard({ user, onOpenMessages }) {
  const isVerified = Boolean(user?.isOwnerVerified);
  const role = userRole(user);
  const location = userLocation(user);

  return (
    <div className="flex items-center justify-between gap-2.5 sm:gap-3 min-w-0 w-full overflow-hidden rounded-2xl border border-base-200 bg-base-100 p-3 sm:p-3.5 box-border shadow-xs transition duration-150 hover:border-primary/40 hover:shadow-sm">
      <div className="flex min-w-0 flex-1 items-center gap-3">
        <div className="shrink-0">
          <UserAvatar
            src={user?.profilePic}
            name={user?.fullName || "User"}
            userId={user?._id}
            sizeClass="size-11"
          />
        </div>
        <div className="min-w-0 flex-1 overflow-hidden">
          <div className="flex min-w-0 items-center gap-1">
            <Link
              to={`/users/${user?._id}`}
              title={user?.fullName || "User"}
              className="min-w-0 truncate text-[15px] font-bold text-base-content hover:text-primary"
            >
              {user?.fullName || "User"}
            </Link>
            {isVerified ? (
              <BadgeCheck className="size-3.5 shrink-0 text-primary" aria-label="Verified Owner" />
            ) : null}
          </div>
          <p
            title={`${role}${location ? ` · ${location}` : ""}`}
            className="mt-0.5 min-w-0 truncate text-xs capitalize text-base-content/50"
          >
            {role}{location ? ` · ${location}` : ""}
          </p>
        </div>
      </div>

      <button
        type="button"
        onClick={() => onOpenMessages?.(user?._id)}
        className="flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full border border-primary/20 bg-primary/10 px-3.5 py-1.5 text-xs font-semibold text-primary transition hover:bg-primary/20"
      >
        <MessageCircle className="size-3.5 shrink-0 text-primary" />
        <span>Message</span>
      </button>
    </div>
  );
}
