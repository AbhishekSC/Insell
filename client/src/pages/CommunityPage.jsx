import { useState } from "react";
import { Link } from "react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Bell, Crown, MessageSquare, Plus, Search, ShieldCheck, Users, Video } from "lucide-react";
import toast from "react-hot-toast";
import AppShell from "../components/AppShell";
import axiosInstance from "../lib/axios";
import { useStreamContext } from "../context/StreamProvider";

function formatDateTime(value) {
  if (!value) return "Unknown";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Unknown";
  return new Intl.DateTimeFormat("en", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

export default function CommunityPage() {
  const queryClient = useQueryClient();
  const { data: authData } = useQuery({
    queryKey: ["authUser"],
    queryFn: async () => {
      const response = await axiosInstance.get("/auth/verify", { skipErrorToast: true });
      return response.data;
    },
    staleTime: 1000 * 60 * 5,
    retry: false,
  });
  const authUser = authData?.data?.user || authData?.data || null;
  const { streamClient, currentUserId } = useStreamContext();

  const { data: friends = [] } = useQuery({
    queryKey: ["friends"],
    queryFn: async () => {
      const response = await axiosInstance.get("/users/friends");
      return response.data?.data?.friends || [];
    },
    enabled: Boolean(authUser?._id),
  });

  const { data: communityData } = useQuery({
    queryKey: ["communityData"],
    queryFn: async () => {
      const response = await axiosInstance.get("/community");
      return response.data?.data || {};
    },
    enabled: Boolean(authUser?._id),
    refetchInterval: 30000,
    refetchIntervalInBackground: true,
  });

  const { data: communityUnreadMap = {} } = useQuery({
    queryKey: ["communityUnreadMap", currentUserId],
    enabled: Boolean(streamClient && currentUserId),
    refetchInterval: 15000,
    queryFn: async () => {
      if (!streamClient || !currentUserId) {
        return {};
      }

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
        .reduce((accumulator, channel) => {
          const id = String(channel.id || "").replace(/^community-/, "");
          accumulator[id] = Number(channel.countUnread() || 0);
          return accumulator;
        }, {});
    },
  });

  const [circleForm, setCircleForm] = useState({
    name: "",
    topic: "Travel Spanish",
    memberIds: [],
  });
  const [searchTerm, setSearchTerm] = useState("");
  const [showCreateModal, setShowCreateModal] = useState(false);

  const studyCircles = communityData?.studyCircles || [];
  const notifications = communityData?.notifications || [];
  const suggestedCircles = communityData?.suggestedCircles || [];

  const circleMutation = useMutation({
    mutationFn: async (payload) => {
      const response = await axiosInstance.post("/community/circles", payload);
      return response.data?.data?.circle;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["communityData"] });
      setCircleForm({ name: "", topic: "Travel Spanish", memberIds: [] });
      setShowCreateModal(false);
      toast.success("Community created. You are the admin.");
    },
    onError: (error) => {
      toast.error(error?.response?.data?.message || "Failed to create community");
    },
  });

  const inviteResponseMutation = useMutation({
    mutationFn: async ({ notificationId, action }) => {
      const response = await axiosInstance.post(`/community/invites/${notificationId}/respond`, { action });
      return response.data?.data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["communityData"] });
      toast.success(variables.action === "accept" ? "Joined community." : "Invite declined.");
    },
    onError: (error) => {
      toast.error(error?.response?.data?.message || "Failed to respond to invite");
    },
  });

  const markReadMutation = useMutation({
    mutationFn: async (notificationId) => {
      const response = await axiosInstance.post(`/community/notifications/${notificationId}/read`);
      return response.data?.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["communityData"] });
    },
    onError: (error) => {
      toast.error(error?.response?.data?.message || "Failed to mark notification as read");
    },
  });

  const requestJoinMutation = useMutation({
    mutationFn: async (circleId) => {
      const response = await axiosInstance.post(`/community/circles/${circleId}/join-request`);
      return response.data?.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["communityData"] });
      toast.success("Join request sent to admin.");
    },
    onError: (error) => {
      toast.error(error?.response?.data?.message || "Failed to send join request");
    },
  });

  const respondJoinRequestMutation = useMutation({
    mutationFn: async ({ circleId, userId, action }) => {
      const response = await axiosInstance.post(`/community/circles/${circleId}/join-requests/${userId}/respond`, { action });
      return response.data?.data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["communityData"] });
      toast.success(variables.action === "accept" ? "Join request accepted." : "Join request declined.");
    },
    onError: (error) => {
      toast.error(error?.response?.data?.message || "Failed to update join request");
    },
  });

  const adminCommunities = studyCircles.filter(
    (circle) => Boolean(authUser?._id) && String(circle.creator?._id || circle.creator) === String(authUser._id)
  );
  const manageableCommunities = studyCircles.filter((circle) => {
    const isCreator = Boolean(authUser?._id) && String(circle.creator?._id || circle.creator) === String(authUser._id);
    const isModerator = Boolean(authUser?._id) && (circle.moderators || []).some((user) => String(user?._id || user) === String(authUser._id));
    return isCreator || isModerator;
  });
  const joinedCommunities = studyCircles.filter(
    (circle) => !authUser?._id || String(circle.creator?._id || circle.creator) !== String(authUser._id)
  );
  const normalizedSearch = searchTerm.trim().toLowerCase();
  const matchesSearch = (circle) => {
    if (!normalizedSearch) return true;
    const name = String(circle.name || "").toLowerCase();
    const topic = String(circle.topic || "").toLowerCase();
    return name.includes(normalizedSearch) || topic.includes(normalizedSearch);
  };
  const visibleAdminCommunities = adminCommunities.filter(matchesSearch);
  const visibleJoinedCommunities = joinedCommunities.filter(matchesSearch);
  const totalUnreadMessages = Object.values(communityUnreadMap).reduce((sum, value) => sum + Number(value || 0), 0);
  const pendingJoinRequests = manageableCommunities.flatMap((circle) =>
    (circle.pendingJoinRequests || []).map((user) => ({
      circleId: circle._id,
      circleName: circle.name,
      isCreator: Boolean(authUser?._id) && String(circle.creator?._id || circle.creator) === String(authUser._id),
      user,
    }))
  );

  function toggleCircleMember(id) {
    setCircleForm((prev) => ({
      ...prev,
      memberIds: prev.memberIds.includes(id)
        ? prev.memberIds.filter((item) => item !== id)
        : [...prev.memberIds, id],
    }));
  }

  function submitCircle(event) {
    event.preventDefault();
    if (!circleForm.name.trim()) {
      toast.error("Please enter a community name.");
      return;
    }

    circleMutation.mutate(circleForm);
  }

  return (
    <AppShell
      title="Communities"
      subtitle="Create private travel communities, invite friends, and keep every group conversation in one place."
      actions={
        <>
          <Link to="/chat" className="btn btn-ghost btn-sm">
            <MessageSquare className="size-4" />
            Open chats
          </Link>
          <Link to="/marketplace?section=call" className="btn btn-primary btn-sm">
            <Video className="size-4" />
            Start travel call
          </Link>
          <button type="button" className="btn btn-secondary btn-sm" onClick={() => setShowCreateModal(true)}>
            <Plus className="size-4" />
            Create community
          </button>
        </>
      }
    >
      <div className="grid gap-5 xl:grid-cols-12">
        <section className="space-y-5 xl:col-span-8">
          <section className="shell-panel overflow-hidden">
            <div className="p-6">
              <div className="rounded-2xl border border-base-300/70 bg-gradient-to-br from-primary/12 via-info/8 to-success/10 p-4">
                <p className="text-xs font-semibold uppercase tracking-wide text-base-content/65">Community overview</p>
                <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
                  <article className="rounded-xl border border-base-300/70 bg-base-100/85 p-3">
                    <p className="text-xs text-base-content/60">Communities I manage</p>
                    <p className="mt-1 text-2xl font-black leading-none">{adminCommunities.length}</p>
                  </article>
                  <article className="rounded-xl border border-base-300/70 bg-base-100/85 p-3">
                    <p className="text-xs text-base-content/60">Communities I joined</p>
                    <p className="mt-1 text-2xl font-black leading-none">{joinedCommunities.length}</p>
                  </article>
                  <article className="rounded-xl border border-base-300/70 bg-base-100/85 p-3">
                    <p className="text-xs text-base-content/60">Notifications</p>
                    <p className="mt-1 text-2xl font-black leading-none">{notifications.length}</p>
                  </article>
                  <article className="rounded-xl border border-base-300/70 bg-base-100/85 p-3">
                    <p className="text-xs text-base-content/60">Unread community messages</p>
                    <p className="mt-1 text-2xl font-black leading-none">{totalUnreadMessages}</p>
                  </article>
                </div>
              </div>

              <label className="input input-bordered mt-4 flex items-center gap-2">
                <Search className="size-4 text-base-content/55" />
                <input
                  type="text"
                  className="grow"
                  placeholder="Search communities by name or topic"
                  value={searchTerm}
                  onChange={(event) => setSearchTerm(event.target.value)}
                />
              </label>
            </div>
          </section>

          <section className="shell-panel">
            <div className="p-6">
              <p className="inline-flex items-center gap-2 rounded-full border border-warning/30 bg-warning/10 px-3 py-1 text-xs font-semibold">
                <Crown className="size-3.5" /> Communities I manage
              </p>
              <p className="mt-2 text-xs text-base-content/65">
                {visibleAdminCommunities.length} shown{normalizedSearch ? ` for "${searchTerm.trim()}"` : ""}
              </p>
              <div className="mt-4 grid gap-3 md:grid-cols-2">
                {visibleAdminCommunities.length === 0 ? (
                  <div className="rounded-2xl border border-dashed border-base-300/70 bg-base-100/70 p-4 text-sm text-base-content/65">
                    {normalizedSearch ? "No managed communities match your search." : "You have not created a community yet."}
                  </div>
                ) : null}
                {visibleAdminCommunities.map((circle) => (
                  <Link
                    key={circle._id}
                    to={`/community/${circle._id}`}
                    className="rounded-xl border border-base-300/70 bg-base-100/85 p-3 transition hover:-translate-y-0.5 hover:border-primary/30 hover:shadow-sm"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div>
                        <p className="text-sm font-semibold leading-tight">{circle.name}</p>
                        <p className="mt-0.5 text-[11px] text-base-content/60 line-clamp-1">{circle.topic}</p>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="badge badge-primary badge-sm">Admin</span>
                        {Boolean(authUser?._id) && (circle.moderators || []).some((user) => String(user?._id || user) === String(authUser._id)) ? (
                          <span className="badge badge-info badge-sm">Mod</span>
                        ) : null}
                        {(circle.pendingJoinRequests || []).length > 0 ? (
                          <span className="badge badge-info badge-sm">{(circle.pendingJoinRequests || []).length} requests</span>
                        ) : null}
                        {communityUnreadMap[circle._id] > 0 ? <span className="badge badge-warning badge-sm">{communityUnreadMap[circle._id]}</span> : null}
                      </div>
                    </div>
                    <div className="mt-2 flex items-center justify-between text-[11px] text-base-content/70">
                      <span className="uppercase tracking-wide">Created</span>
                      <span className="font-medium">{formatDateTime(circle.createdAt)}</span>
                    </div>
                  </Link>
                ))}
              </div>
            </div>
          </section>
        </section>

        <aside className="space-y-5 xl:col-span-4">
          <section className="shell-panel">
            <div className="p-6">
              <p className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-base-content/65">
                <Plus className="size-3.5 text-info" /> Suggested communities
              </p>
              <p className="mt-2 text-xs text-base-content/65">Discover groups and send request. Admin approval is required.</p>
              <div className="mt-3 space-y-2">
                {suggestedCircles.length === 0 ? (
                  <div className="rounded-xl border border-dashed border-base-300/70 bg-base-100/70 p-3 text-sm text-base-content/65">
                    No suggestions right now.
                  </div>
                ) : null}
                {suggestedCircles.slice(0, 6).map((circle) => (
                  <article key={circle._id} className="rounded-xl border border-base-300/70 bg-base-100/85 p-3">
                    <p className="text-sm font-semibold">{circle.name}</p>
                    <p className="mt-0.5 text-xs text-base-content/65 line-clamp-1">{circle.topic}</p>
                    <p className="mt-1 text-[11px] text-base-content/55">
                      Admin: {circle.creator?.fullName || "Community admin"} · Members: {circle.memberCount || 0}
                    </p>
                    <button
                      type="button"
                      className="btn btn-xs btn-info mt-2"
                      onClick={() => requestJoinMutation.mutate(circle._id)}
                      disabled={requestJoinMutation.isPending}
                    >
                      Request to join
                    </button>
                  </article>
                ))}
              </div>
            </div>
          </section>

          <section className="shell-panel">
            <div className="p-6">
              <p className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-base-content/65">
                <Crown className="size-3.5 text-warning" /> Join requests (admin or moderator)
              </p>
              <div className="mt-3 space-y-2">
                {pendingJoinRequests.length === 0 ? (
                  <div className="rounded-xl border border-dashed border-base-300/70 bg-base-100/70 p-3 text-sm text-base-content/65">
                    No pending join requests.
                  </div>
                ) : null}
                {pendingJoinRequests.slice(0, 8).map((item) => (
                  <article key={`${item.circleId}-${item.user?._id || "unknown"}`} className="rounded-xl border border-base-300/70 bg-base-100/85 p-3">
                    <p className="text-sm font-semibold">{item.user?.fullName || "User"}</p>
                    <p className="mt-1 text-xs text-base-content/70">Requested to join {item.circleName}</p>
                    <p className="mt-1 text-[11px] text-base-content/60">Role: {item.isCreator ? "Admin" : "Moderator"}</p>
                    <div className="mt-2 flex gap-2">
                      <button
                        type="button"
                        className="btn btn-xs btn-primary"
                        onClick={() =>
                          respondJoinRequestMutation.mutate({
                            circleId: item.circleId,
                            userId: item.user?._id,
                            action: "accept",
                          })
                        }
                        disabled={respondJoinRequestMutation.isPending || !item.user?._id}
                      >
                        Accept
                      </button>
                      <button
                        type="button"
                        className="btn btn-xs btn-outline"
                        onClick={() =>
                          respondJoinRequestMutation.mutate({
                            circleId: item.circleId,
                            userId: item.user?._id,
                            action: "reject",
                          })
                        }
                        disabled={respondJoinRequestMutation.isPending || !item.user?._id}
                      >
                        Decline
                      </button>
                    </div>
                  </article>
                ))}
              </div>
            </div>
          </section>

          <section className="shell-panel">
            <div className="p-6">
              <p className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-base-content/65">
                <Bell className="size-3.5 text-primary" /> Notifications
              </p>
              <div className="mt-3 space-y-2">
                {notifications.length === 0 ? (
                  <div className="rounded-xl border border-dashed border-base-300/70 bg-base-100/70 p-3 text-sm text-base-content/65">
                    No new notifications.
                  </div>
                ) : null}
                {notifications.slice(0, 5).map((item) =>
                  item.type !== "circle_invite" ? (
                    <article key={item._id} className="rounded-xl border border-error/30 bg-error/5 p-3">
                      <p className="text-sm font-semibold">{item.message}</p>
                      <div className="mt-3 flex gap-2">
                        <button
                          type="button"
                          className="btn btn-xs btn-ghost"
                          onClick={() => markReadMutation.mutate(item._id)}
                          disabled={markReadMutation.isPending}
                        >
                          Dismiss
                        </button>
                      </div>
                    </article>
                  ) : (
                    <article key={item._id} className="rounded-xl border border-base-300/70 bg-base-100/85 p-3">
                      <p className="text-sm font-semibold">{item.actor?.fullName || "Friend"}</p>
                      <p className="mt-1 text-xs text-base-content/70">{item.message}</p>
                      {item.circle ? <p className="mt-2 text-xs font-semibold text-base-content/60">{item.circle.name}</p> : null}
                      <div className="mt-3 flex gap-2">
                        <button
                          type="button"
                          className="btn btn-xs btn-primary"
                          onClick={() => inviteResponseMutation.mutate({ notificationId: item._id, action: "accept" })}
                          disabled={inviteResponseMutation.isPending}
                        >
                          Join
                        </button>
                        <button
                          type="button"
                          className="btn btn-xs btn-outline"
                          onClick={() => inviteResponseMutation.mutate({ notificationId: item._id, action: "reject" })}
                          disabled={inviteResponseMutation.isPending}
                        >
                          Decline
                        </button>
                        <button
                          type="button"
                          className="btn btn-xs btn-ghost"
                          onClick={() => markReadMutation.mutate(item._id)}
                          disabled={markReadMutation.isPending}
                        >
                          Mark read
                        </button>
                      </div>
                    </article>
                  )
                )}
              </div>
            </div>
          </section>

          <section className="shell-panel">
            <div className="p-6">
              <p className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-base-content/65">
                <ShieldCheck className="size-3.5 text-success" /> Joined communities
              </p>
              <p className="mt-2 text-xs text-base-content/65">
                {visibleJoinedCommunities.length} shown{normalizedSearch ? ` for "${searchTerm.trim()}"` : ""}
              </p>
              <div className="mt-3 space-y-2">
                {visibleJoinedCommunities.length === 0 ? (
                  <div className="rounded-xl border border-dashed border-base-300/70 bg-base-100/70 p-3 text-sm text-base-content/65">
                    {normalizedSearch ? "No joined communities match your search." : "You have not joined any community yet."}
                  </div>
                ) : null}
                {visibleJoinedCommunities.map((circle) => (
                  <Link
                    key={circle._id}
                    to={`/community/${circle._id}`}
                    className="rounded-2xl border border-base-300/70 bg-gradient-to-br from-base-100 via-base-100 to-success/5 p-3.5 transition hover:-translate-y-0.5 hover:border-success/35 hover:shadow-md"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-semibold leading-tight">{circle.name}</p>
                        <p className="mt-1 text-xs text-base-content/65 line-clamp-2">{circle.topic}</p>
                      </div>
                      <div className="flex shrink-0 flex-wrap items-center justify-end gap-1.5">
                        <span className="badge badge-success badge-sm">Joined</span>
                        {communityUnreadMap[circle._id] > 0 ? <span className="badge badge-warning badge-sm">{communityUnreadMap[circle._id]}</span> : null}
                      </div>
                    </div>

                    <div className="mt-3 grid gap-1 text-[11px] text-base-content/60 sm:grid-cols-[auto,1fr] sm:items-center sm:gap-3">
                      <span className="inline-flex items-center gap-1">
                        <Users className="size-3" />
                        {Array.isArray(circle.members) ? circle.members.length : circle.memberCount || 0} members
                      </span>
                      <span className="truncate text-left font-medium text-base-content/70 sm:text-right">Admin: {circle.creator?.fullName || "Community admin"}</span>
                    </div>
                  </Link>
                ))}
              </div>
            </div>
          </section>
        </aside>
      </div>

      <dialog className={`modal ${showCreateModal ? "modal-open" : ""}`}>
        <div className="modal-box max-w-2xl">
          <h3 className="text-2xl font-black tracking-tight">Create a new community</h3>
          <p className="mt-1 text-sm text-base-content/70">
            Build a private space, invite members, and start planning trips together.
          </p>

          <form className="mt-4 rounded-2xl border border-base-300/70 bg-base-100/85 p-4" onSubmit={submitCircle}>
            <div className="grid gap-2 md:grid-cols-2">
              <input
                className="input input-bordered w-full"
                value={circleForm.name}
                onChange={(event) => setCircleForm((prev) => ({ ...prev, name: event.target.value }))}
                placeholder="Community name"
              />
              <input
                className="input input-bordered w-full"
                value={circleForm.topic}
                onChange={(event) => setCircleForm((prev) => ({ ...prev, topic: event.target.value }))}
                placeholder="Community topic"
              />
            </div>
            <div className="mt-3 rounded-xl border border-base-300/70 bg-base-100 p-3">
              <div className="flex items-center justify-between gap-3">
                <p className="text-xs font-semibold uppercase tracking-wide text-base-content/60">Add members</p>
                <span className="badge badge-outline badge-sm">{circleForm.memberIds.length} selected</span>
              </div>
              <div className="mt-2 flex flex-wrap gap-2">
                {friends.length === 0 ? (
                  <p className="text-xs text-base-content/60">No friends available yet. Add friends first to invite them.</p>
                ) : null}
                {friends.slice(0, 12).map((friend) => {
                  const selected = circleForm.memberIds.includes(friend._id);
                  return (
                    <button
                      key={friend._id}
                      type="button"
                      className={`btn btn-xs ${selected ? "btn-primary" : "btn-outline"}`}
                      onClick={() => toggleCircleMember(friend._id)}
                    >
                      {friend.fullName}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="mt-4 flex items-center justify-end gap-2">
              <button type="button" className="btn btn-ghost btn-sm" onClick={() => setShowCreateModal(false)}>
                Cancel
              </button>
              <button type="submit" className="btn btn-primary btn-sm" disabled={circleMutation.isPending}>
                {circleMutation.isPending ? "Creating..." : "Create community"}
              </button>
            </div>
          </form>
        </div>

        <form method="dialog" className="modal-backdrop">
          <button type="button" onClick={() => setShowCreateModal(false)}>
            close
          </button>
        </form>
      </dialog>
    </AppShell>
  );
}
