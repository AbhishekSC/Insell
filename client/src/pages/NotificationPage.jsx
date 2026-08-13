import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Bell,
  Check,
  CheckCircle2,
  Clock3,
  MapPin,
  RefreshCw,
  Search,
  Sparkles,
  UserRoundPlus,
  UsersRound,
  X,
} from "lucide-react";
import toast from "react-hot-toast";
import { Link } from "react-router";
import AppShell from "../components/AppShell";
import UserAvatar from "../components/UserAvatar";
import axiosInstance from "../lib/axios";

const EMPTY_LIST = [];

function entityId(entity) {
  if (!entity) {
    return "";
  }

  return String(typeof entity === "object" ? entity._id || entity.id || "" : entity);
}

function MarketProfile({ user }) {
  const preference = Array.isArray(user?.propertyTypePreferences) && user.propertyTypePreferences.length > 0
    ? user.propertyTypePreferences[0]
    : Array.isArray(user?.travelInterests) && user.travelInterests.length > 0
      ? user.travelInterests[0]
      : "";
  const role = user?.primaryRole || user?.travelStyle || "";

  return (
    <p className="mt-1.5 text-xs text-base-content/60">
      {role || "Marketplace user"} <span className="mx-1 text-primary">·</span> {preference || "Open to opportunities"}
    </p>
  );
}

function IncomingRequest({ request, onAccept, onReject, busy }) {
  const sender = request?.sender;

  return (
    <article className="notification-request-card">
      <UserAvatar src={sender?.profilePic} name={sender?.fullName || "User"} sizeClass="size-12" className="ring-2 ring-success/15" />
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-bold">{sender?.fullName || "Unknown user"}</p>
        <MarketProfile user={sender} />
        <p className="mt-1 inline-flex items-center gap-1 text-[11px] text-base-content/50"><MapPin className="size-3" />{sender?.city || sender?.homeBase || sender?.location || "City not set"}</p>
      </div>
      <div className="flex shrink-0 items-center gap-1.5">
        <button type="button" className="btn btn-ghost btn-sm btn-circle text-base-content/60" onClick={() => onReject(request._id)} disabled={busy} aria-label={`Decline ${sender?.fullName || "request"}`}><X className="size-4" /></button>
        <button type="button" className="btn btn-success btn-sm rounded-xl" onClick={() => onAccept(request._id)} disabled={busy}><Check className="size-4" />Accept</button>
      </div>
    </article>
  );
}

function RecommendationCard({ user, onSend, busy }) {
  return (
    <article className="notification-person-card">
      <div className="flex items-start gap-3">
        <UserAvatar src={user?.profilePic} name={user?.fullName || "User"} sizeClass="size-11" className="ring-2 ring-primary/10" />
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-bold">{user?.fullName || "Unknown user"}</p>
          <MarketProfile user={user} />
          <p className="mt-1 inline-flex items-center gap-1 text-[11px] text-base-content/50"><MapPin className="size-3" />{user?.city || user?.homeBase || user?.location || "City not set"}</p>
          {user?.recommendationReason && (
            <p className="mt-1.5 text-[10px] text-primary font-medium flex items-center gap-1">
              <Sparkles className="size-3" />
              {user.recommendationReason}
            </p>
          )}
        </div>
      </div>
      <button type="button" className="btn btn-primary btn-sm mt-4 w-full rounded-xl" onClick={() => onSend(user._id)} disabled={busy}><UserRoundPlus className="size-4" />Connect</button>
    </article>
  );
}

export default function NotificationPage() {
  const queryClient = useQueryClient();
  const [searchQuery, setSearchQuery] = useState("");
  const [debouncedSearchQuery, setDebouncedSearchQuery] = useState("");
  const [pendingUserId, setPendingUserId] = useState("");

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearchQuery(searchQuery.trim()), 300);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  const { data: friendsData, isLoading: friendsLoading } = useQuery({
    queryKey: ["friends"],
    queryFn: async () => (await axiosInstance.get("/users/friends")).data?.data?.friends || [],
  });
  const { data: incomingData, isLoading: incomingLoading } = useQuery({
    queryKey: ["incomingRequests"],
    queryFn: async () => (await axiosInstance.get("/users/friend-requests")).data?.data?.incomingRequests || [],
    refetchInterval: 15000,
  });
  const { data: outgoingData, isLoading: outgoingLoading } = useQuery({
    queryKey: ["outgoingRequests"],
    queryFn: async () => (await axiosInstance.get("/users/outgoing-friend-requests")).data?.data?.outgoingRequests || [],
  });
  const { data: recommendedData, isLoading: recommendedLoading, isFetching: recommendedFetching } = useQuery({
    queryKey: ["discoverUsers", debouncedSearchQuery],
    queryFn: async () => {
      const params = new URLSearchParams(debouncedSearchQuery ? { q: debouncedSearchQuery, limit: "24" } : { limit: "12" });
      return (await axiosInstance.get(`/users/discover?${params.toString()}`)).data?.data || {};
    },
    placeholderData: (previousData) => previousData,
  });
  const { data: authData } = useQuery({
    queryKey: ["authUser"],
    queryFn: async () => (await axiosInstance.get("/auth/verify")).data,
    retry: false,
    staleTime: 1000 * 60 * 5,
  });

  const friends = friendsData ?? EMPTY_LIST;
  const incomingRequests = incomingData ?? EMPTY_LIST;
  const outgoingRequests = outgoingData ?? EMPTY_LIST;
  const recommendedUsers = recommendedData?.users ?? EMPTY_LIST;
  const authUser = authData?.data?.user || authData?.data || null;
  const isLoading = friendsLoading || incomingLoading || outgoingLoading || recommendedLoading;

  const refreshLists = () => {
    ["friends", "incomingRequests", "incomingRequestsCount", "outgoingRequests", "discoverUsers"].forEach((queryKey) => queryClient.invalidateQueries({ queryKey: [queryKey] }));
  };

  const { mutate: sendRequest, isPending: sending } = useMutation({
    mutationFn: async (userId) => axiosInstance.post(`/users/friend-request/${userId}`),
    onMutate: async (userId) => {
      setPendingUserId(userId);
      await queryClient.cancelQueries({ queryKey: ["outgoingRequests"] });
      const previousOutgoing = queryClient.getQueryData(["outgoingRequests"]);
      const selectedUser = recommendedUsers.find((user) => entityId(user) === entityId(userId));

      queryClient.setQueryData(["outgoingRequests"], (current = EMPTY_LIST) => {
        if (current.some((request) => entityId(request?.receiver) === entityId(userId))) {
          return current;
        }

        return [...current, { _id: `pending-${userId}`, receiver: selectedUser || { _id: userId, fullName: "Pending connection" } }];
      });

      return { previousOutgoing };
    },
    onSuccess: () => toast.success("Friend request sent"),
    onError: (error, _userId, context) => {
      queryClient.setQueryData(["outgoingRequests"], context?.previousOutgoing);
      toast.error(error?.response?.data?.message || "Could not send request");
    },
    onSettled: () => {
      setPendingUserId("");
      refreshLists();
    },
  });
  const { mutate: acceptRequest, isPending: accepting } = useMutation({
    mutationFn: async (requestId) => axiosInstance.put(`/users/friend-request/${requestId}/accept`),
    onMutate: async (requestId) => {
      await Promise.all([queryClient.cancelQueries({ queryKey: ["incomingRequests"] }), queryClient.cancelQueries({ queryKey: ["friends"] })]);
      const previousIncoming = queryClient.getQueryData(["incomingRequests"]);
      const previousFriends = queryClient.getQueryData(["friends"]);
      const request = (previousIncoming ?? EMPTY_LIST).find((item) => entityId(item) === entityId(requestId));
      queryClient.setQueryData(["incomingRequests"], (current = EMPTY_LIST) => current.filter((item) => entityId(item) !== entityId(requestId)));
      if (request?.sender) {
        queryClient.setQueryData(["friends"], (current = EMPTY_LIST) => current.some((friend) => entityId(friend) === entityId(request.sender)) ? current : [...current, request.sender]);
      }
      return { previousIncoming, previousFriends };
    },
    onSuccess: () => toast.success("Friend request accepted"),
    onError: (error, _requestId, context) => {
      queryClient.setQueryData(["incomingRequests"], context?.previousIncoming);
      queryClient.setQueryData(["friends"], context?.previousFriends);
      toast.error(error?.response?.data?.message || "Could not accept request");
    },
    onSettled: refreshLists,
  });
  const { mutate: rejectRequest, isPending: rejecting } = useMutation({
    mutationFn: async (requestId) => axiosInstance.put(`/users/friend-request/${requestId}/reject`),
    onMutate: async (requestId) => {
      await queryClient.cancelQueries({ queryKey: ["incomingRequests"] });
      const previousIncoming = queryClient.getQueryData(["incomingRequests"]);
      queryClient.setQueryData(["incomingRequests"], (current = EMPTY_LIST) => current.filter((item) => entityId(item) !== entityId(requestId)));
      return { previousIncoming };
    },
    onSuccess: () => toast.success("Friend request declined"),
    onError: (error, _requestId, context) => {
      queryClient.setQueryData(["incomingRequests"], context?.previousIncoming);
      toast.error(error?.response?.data?.message || "Could not decline request");
    },
    onSettled: refreshLists,
  });

  const visibleRecommendedUsers = useMemo(() => {
    const excludedIds = new Set([entityId(authUser)]);
    friends.forEach((user) => excludedIds.add(entityId(user)));
    incomingRequests.forEach((request) => excludedIds.add(entityId(request?.sender)));
    outgoingRequests.forEach((request) => excludedIds.add(entityId(request?.receiver)));
    if (pendingUserId) {
      excludedIds.add(entityId(pendingUserId));
    }

    return recommendedUsers.filter((user) => {
      const id = entityId(user);
      return Boolean(id) && !excludedIds.has(id);
    });
  }, [authUser, friends, incomingRequests, outgoingRequests, pendingUserId, recommendedUsers]);

  const requestConnection = (userId) => {
    if (!userId || sending || entityId(userId) === entityId(authUser)) {
      return;
    }

    sendRequest(userId);
  };

  return (
    <AppShell
      title="Connections"
      subtitle="Manage connection requests, grow your network, and find the right property counterpart."
      lockPageScroll
      actions={<button type="button" className="btn btn-ghost btn-sm rounded-xl" onClick={refreshLists}><RefreshCw className="size-4" />Refresh</button>}
    >
      {isLoading ? <div className="grid gap-4 lg:grid-cols-3"><div className="notification-skeleton lg:col-span-2" /><div className="notification-skeleton" /><div className="notification-skeleton lg:col-span-3" /></div> : (
        <div className="notification-layout xl:h-full xl:min-h-0">
          <section className="notification-inbox shell-panel xl:min-h-0 xl:overflow-y-auto">
            <div className="notification-section-heading"><div className="grid size-10 place-items-center rounded-xl bg-success/10 text-success"><Bell className="size-5" /></div><div><h2>Friend requests</h2><p>{incomingRequests.length ? `${incomingRequests.length} waiting for your response` : "You are all caught up"}</p></div><span className={`notification-count ${incomingRequests.length ? "notification-count--active" : ""}`}>{incomingRequests.length}</span></div>
            {incomingRequests.length === 0 ? <div className="notification-empty"><CheckCircle2 className="size-5 text-success" /><div><p className="font-semibold">Nothing waiting for you</p><p>New friend requests will appear here.</p></div></div> : <div className="mt-4 space-y-2">{incomingRequests.map((request) => <IncomingRequest key={request._id} request={request} onAccept={acceptRequest} onReject={rejectRequest} busy={accepting || rejecting} />)}</div>}
          </section>

          <section className="notification-discover shell-panel xl:min-h-0 xl:overflow-hidden">
            <div className="notification-section-heading"><div className="grid size-10 place-items-center rounded-xl bg-primary/10 text-primary"><Sparkles className="size-5" /></div><div><h2>Discover people</h2><p>Find buyers, sellers, brokers, tenants, and landlords</p></div></div>
            <label className="notification-search input input-bordered mt-4 flex h-11 items-center gap-2"><Search className="size-4 text-base-content/50" /><input type="text" placeholder="Name, role, property type, locality, or city" className="grow" value={searchQuery} onChange={(event) => setSearchQuery(event.target.value)} /></label>
            <div className="mt-3 flex items-center justify-between text-xs text-base-content/60"><span>{debouncedSearchQuery ? `Results for "${debouncedSearchQuery}"` : "Personalized recommendations"}</span><button type="button" className="btn btn-ghost btn-xs" onClick={() => !debouncedSearchQuery && queryClient.invalidateQueries({ queryKey: ["discoverUsers", ""] })} disabled={Boolean(debouncedSearchQuery) || recommendedFetching}><RefreshCw className={`size-3.5 ${recommendedFetching ? "animate-spin" : ""}`} />Refresh</button></div>
            <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:max-h-[calc(100%-10rem)] xl:overflow-y-auto xl:pr-1">{visibleRecommendedUsers.length ? visibleRecommendedUsers.map((user) => <RecommendationCard key={user._id} user={user} onSend={requestConnection} busy={sending && entityId(user) === entityId(pendingUserId)} />) : <div className="notification-empty sm:col-span-2"><UsersRound className="size-5 text-primary" /><div><p className="font-semibold">No matching users found</p><p>{debouncedSearchQuery ? "Try another search." : "Check back in a moment."}</p></div></div>}</div>
          </section>

          <section className="notification-network shell-panel xl:min-h-0 xl:overflow-y-auto">
            <div className="notification-section-heading"><div className="grid size-10 place-items-center rounded-xl bg-secondary/10 text-secondary"><UsersRound className="size-5" /></div><div><h2>Your network</h2><p>{friends.length} connected · {outgoingRequests.length} pending</p></div></div>
            <div className="mt-4"><p className="notification-subheading">Friends</p>{friends.length ? <div className="mt-2 space-y-1.5">{friends.map((friend) => <Link key={friend._id} to={`/friends/${friend._id}`} className="notification-network-row"><UserAvatar src={friend.profilePic} name={friend.fullName} sizeClass="size-9" /><span className="min-w-0 flex-1"><span className="block truncate text-sm font-semibold">{friend.fullName}</span><span className="block truncate text-xs text-base-content/55">{friend.location || "Language partner"}</span></span></Link>)}</div> : <p className="mt-2 text-sm text-base-content/55">Your new connections will appear here.</p>}</div>
            <div className="mt-6"><p className="notification-subheading">Pending requests</p>{outgoingRequests.length ? <div className="mt-2 space-y-1.5">{outgoingRequests.map((request) => <div key={request._id} className="notification-network-row"><UserAvatar src={request.receiver?.profilePic} name={request.receiver?.fullName || "User"} sizeClass="size-9" /><span className="min-w-0 flex-1"><span className="block truncate text-sm font-semibold">{request.receiver?.fullName || "Unknown user"}</span><span className="inline-flex items-center gap-1 text-xs text-warning"><Clock3 className="size-3" />Awaiting response</span></span></div>)}</div> : <p className="mt-2 text-sm text-base-content/55">No pending requests.</p>}</div>
          </section>
        </div>
      )}
    </AppShell>
  );
}
