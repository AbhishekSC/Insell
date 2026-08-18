import { Component, useEffect, useMemo, useState } from "react";
import { Link, Navigate, useNavigate, useParams } from "react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Channel, Chat, MessageComposer, MessageList, Thread, Window } from "stream-chat-react";
import { Crown, FolderOpen, MessageSquare, Paperclip, Send, Users, Video, X } from "lucide-react";
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

function getResourceTypeLabel(resource) {
  const baseType = String(resource?.type || "").toLowerCase();
  const url = String(resource?.url || "").toLowerCase();

  if (baseType === "file") {
    if (/\.(png|jpe?g|gif|webp|svg|bmp|heic)(\?|$)/.test(url)) {
      return "Image";
    }
    return "File";
  }

  if (baseType === "link") {
    return "Link";
  }

  return "Note";
}

class CommunityChatErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch() {
    // Render fallback instead of crashing the whole page.
  }

  render() {
    if (this.state.hasError) {
      return this.props.fallback;
    }

    return this.props.children;
  }
}

export default function CommunityDetailPage() {
  const { communityId } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { data: authData, isLoading: authLoading } = useQuery({
    queryKey: ["authUser"],
    queryFn: async () => {
      const response = await axiosInstance.get("/auth/verify");
      return response.data;
    },
    staleTime: 1000 * 60 * 5,
    retry: false,
  });
  const authUser = authData?.data?.user || authData?.data || null;
  const { startGroupVideoCall, videoBusy, streamClient, streamReady } = useStreamContext();

  const [inviteMemberIds, setInviteMemberIds] = useState([]);
  const [newOwnerId, setNewOwnerId] = useState("");
  const [showTransferConfirm, setShowTransferConfirm] = useState(false);
  const [resourceForm, setResourceForm] = useState({ description: "" });
  const [resourceFile, setResourceFile] = useState(null);
  const [resourceFileKey, setResourceFileKey] = useState(0);
  const [communityChannel, setCommunityChannel] = useState(null);
  const [showDestroyModal, setShowDestroyModal] = useState(false);

  const { data: friends = [] } = useQuery({
    queryKey: ["friends"],
    queryFn: async () => {
      const response = await axiosInstance.get("/users/friends");
      return response.data?.data?.friends || [];
    },
    enabled: Boolean(authUser?._id),
  });

  const { data: communityDetail, isLoading } = useQuery({
    queryKey: ["communityDetail", communityId],
    queryFn: async () => {
      const response = await axiosInstance.get(`/community/circles/${communityId}`);
      return response.data?.data || {};
    },
    enabled: Boolean(authUser?._id && communityId),
  });

  const circle = communityDetail?.circle || null;
  const resources = communityDetail?.resources || [];
  const permissions = communityDetail?.permissions || {
    isCreator: false,
    canInvite: false,
    canProposeMembers: false,
    canTransferOwnership: false,
    canDestroy: false,
    canReviewJoinRequests: false,
  };
  const memberIds = useMemo(
    () => (circle?.members || []).map((member) => String(member._id || member)),
    [circle?.members]
  );
  const memberIdsKey = memberIds.join(",");

  useEffect(() => {
    if (!streamClient || !streamReady || !circle?._id || memberIds.length === 0) {
      return;
    }

    let isMounted = true;

    const connectCommunityChannel = async () => {
      try {
        const channel = streamClient.channel("messaging", `community-${circle._id}`, {
          name: circle.name,
          members: memberIds,
        });
        await channel.watch();
        await channel.markRead();
        if (isMounted) {
          setCommunityChannel(channel);
        }
      } catch {
        toast.error("Failed to open community chat");
      }
    };

    connectCommunityChannel();

    return () => {
      isMounted = false;
      setCommunityChannel(null);
    };
  }, [circle?._id, circle?.name, memberIdsKey, streamClient, streamReady]);

  // Real-time: if the admin destroys this community while it's open, bounce out immediately.
  useEffect(() => {
    if (!communityChannel) {
      return;
    }

    const handleNewMessage = (event) => {
      if (event.message?.custom_type === "community_destroyed") {
        toast.error(event.message.text || "This community has been deleted by the admin.");
        queryClient.invalidateQueries({ queryKey: ["communityData"] });
        navigate("/community");
      }
    };

    communityChannel.on("message.new", handleNewMessage);

    return () => {
      communityChannel.off("message.new", handleNewMessage);
    };
  }, [communityChannel, navigate, queryClient]);

  const inviteMutation = useMutation({
    mutationFn: async (payload) => {
      const response = await axiosInstance.post(`/community/circles/${communityId}/invite`, payload);
      return response.data?.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["communityDetail", communityId] });
      queryClient.invalidateQueries({ queryKey: ["communityData"] });
      setInviteMemberIds([]);
      toast.success("Invites sent.");
    },
    onError: (error) => {
      toast.error(error?.response?.data?.message || "Failed to invite members");
    },
  });

  const proposeMemberMutation = useMutation({
    mutationFn: async (payload) => {
      const response = await axiosInstance.post(`/community/circles/${communityId}/member-add-request`, payload);
      return response.data?.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["communityDetail", communityId] });
      queryClient.invalidateQueries({ queryKey: ["communityData"] });
      setInviteMemberIds([]);
      toast.success("Request sent to admin for approval.");
    },
    onError: (error) => {
      toast.error(error?.response?.data?.message || "Failed to send request");
    },
  });

  const respondAddRequestMutation = useMutation({
    mutationFn: async ({ targetUserId, action }) => {
      const response = await axiosInstance.post(
        `/community/circles/${communityId}/member-add-requests/${targetUserId}/respond`,
        { action }
      );
      return response.data?.data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["communityDetail", communityId] });
      queryClient.invalidateQueries({ queryKey: ["communityData"] });
      toast.success(variables.action === "accept" ? "Member request approved." : "Member request declined.");
    },
    onError: (error) => {
      toast.error(error?.response?.data?.message || "Failed to process request");
    },
  });

  const leaveMutation = useMutation({
    mutationFn: async () => {
      const response = await axiosInstance.post(`/community/circles/${communityId}/leave`);
      return response.data?.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["communityData"] });
      toast.success("You left the community.");
      navigate("/community");
    },
    onError: (error) => {
      toast.error(error?.response?.data?.message || "Failed to leave community");
    },
  });

  const removeMemberMutation = useMutation({
    mutationFn: async (memberId) => {
      const response = await axiosInstance.delete(`/community/circles/${communityId}/members/${memberId}`);
      return response.data?.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["communityDetail", communityId] });
      queryClient.invalidateQueries({ queryKey: ["communityData"] });
      toast.success("Member removed.");
    },
    onError: (error) => {
      toast.error(error?.response?.data?.message || "Failed to remove member");
    },
  });

  const transferOwnerMutation = useMutation({
    mutationFn: async (payload) => {
      const response = await axiosInstance.post(`/community/circles/${communityId}/transfer-ownership`, payload);
      return response.data?.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["communityDetail", communityId] });
      queryClient.invalidateQueries({ queryKey: ["communityData"] });
      setNewOwnerId("");
      setShowTransferConfirm(false);
      toast.success("Ownership transferred.");
    },
    onError: (error) => {
      toast.error(error?.response?.data?.message || "Failed to transfer ownership");
    },
  });

  const resourceMutation = useMutation({
    mutationFn: async (payload) => {
      const response = await axiosInstance.post(`/community/circles/${communityId}/resources`, payload, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      return response.data?.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["communityDetail", communityId] });
      setResourceForm({ description: "" });
      setResourceFile(null);
      setResourceFileKey((prev) => prev + 1);
      toast.success("Resource added.");
    },
    onError: (error) => {
      toast.error(error?.response?.data?.message || "Failed to add resource");
    },
  });

  const destroyMutation = useMutation({
    mutationFn: async () => {
      const response = await axiosInstance.delete(`/community/circles/${communityId}`);
      return response.data?.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["communityData"] });
      setShowDestroyModal(false);
      toast.success("Community destroyed.");
      navigate("/community");
    },
    onError: (error) => {
      toast.error(error?.response?.data?.message || "Failed to destroy community");
    },
  });

  const memberAddRequests = circle?.memberAddRequests || [];

  const inviteOptions = useMemo(() => {
    const memberIds = new Set((circle?.members || []).map((member) => String(member._id || member)));
    const pendingIds = new Set((circle?.pendingInvites || []).map((member) => String(member._id || member)));
    const requestedIds = new Set(
      (circle?.memberAddRequests || []).map((entry) => String(entry.targetUser?._id || entry.targetUser))
    );

    return friends.filter(
      (friend) => !memberIds.has(String(friend._id)) && !pendingIds.has(String(friend._id)) && !requestedIds.has(String(friend._id))
    );
  }, [circle?.members, circle?.memberAddRequests, circle?.pendingInvites, friends]);

  const ownershipOptions = useMemo(
    () => (circle?.members || []).filter((member) => String(member._id) !== String(circle?.creator?._id)),
    [circle?.creator?._id, circle?.members]
  );

  if (authLoading || isLoading) {
    return (
      <AppShell title="Community" subtitle="Loading community details...">
        <div className="grid min-h-[320px] place-items-center rounded-2xl border border-base-300/70 bg-base-100/80 p-6 text-sm text-base-content/70">
          Loading community details...
        </div>
      </AppShell>
    );
  }

  if (!circle) {
    return <Navigate to="/community" replace />;
  }

  async function startCommunityCall() {
    if (!circle) {
      return;
    }

    const memberIds = (circle.members || []).map((member) => String(member._id || member));
    try {
      await startGroupVideoCall({
        roomId: `community-${circle._id}`,
        memberIds,
        label: circle.name,
      });
      toast.success("Community call started");
      navigate("/call/live");
    } catch (error) {
      console.error("Failed to start community call:", error);
      toast.error(error?.message || "Unable to start community call right now");
    }
  }

  function submitInvites(event) {
    event.preventDefault();
    if (inviteMemberIds.length === 0) {
      return;
    }

    if (permissions.canInvite) {
      inviteMutation.mutate({ memberIds: inviteMemberIds });
    } else {
      proposeMemberMutation.mutate({ memberIds: inviteMemberIds });
    }
  }

  function toggleInvite(id) {
    setInviteMemberIds((prev) => (prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]));
  }

  function submitTransferOwnership(event) {
    event.preventDefault();
    if (!newOwnerId) {
      return;
    }
    setShowTransferConfirm(true);
  }

  function submitResource(event) {
    event.preventDefault();
    const description = String(resourceForm.description || "").trim();
    if (!description && !resourceFile) {
      toast.error("Add a description or attach a file.");
      return;
    }

    const generatedTitle = description.split(/\s+/).slice(0, 6).join(" ").slice(0, 50) || resourceFile?.name || "Community update";

    const formData = new FormData();
    formData.append("title", generatedTitle);
    formData.append("type", resourceFile ? "file" : "note");
    formData.append("url", "");
    formData.append("description", description);
    if (resourceFile) {
      formData.append("file", resourceFile);
    }

    resourceMutation.mutate(formData);
  }

  return (
    <AppShell
      title={circle?.name || "Community"}
      subtitle={circle?.topic || "Private community"}
      actions={
        <div className="ml-auto flex w-full flex-wrap items-center justify-end gap-2 sm:w-auto">
          <Link to="/community" className="btn btn-ghost btn-sm">
            <Users className="size-3.5" />
            Back
          </Link>
          <button type="button" className="btn btn-primary btn-sm" onClick={startCommunityCall} disabled={videoBusy}>
            <Video className="size-3.5" />
            {videoBusy ? "Starting..." : "Start call"}
          </button>
          {!permissions.isCreator ? (
            <button type="button" className="btn btn-outline btn-sm" onClick={() => leaveMutation.mutate()} disabled={leaveMutation.isPending}>
              <Users className="size-3.5" />
              {leaveMutation.isPending ? "Leaving..." : "Leave"}
            </button>
          ) : null}
        </div>
      }
      lockPageScroll
    >
      <div className="grid gap-3 xl:grid-cols-12 xl:h-full xl:min-h-0">
        <section className="space-y-3 xl:col-span-8 xl:flex xl:min-h-0 xl:flex-col">
          <section className="shell-panel">
            <div className="p-3 sm:p-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="inline-flex items-center gap-1.5 rounded-full border border-warning/30 bg-warning/10 px-2 py-0.5 text-[11px] font-semibold">
                    <Crown className="size-3.5" />
                    {permissions.isCreator ? "You are admin" : `Admin: ${circle?.creator?.fullName || "Community admin"}`}
                  </p>
                  <h2 className="mt-1.5 text-xl font-black tracking-tight">Community room</h2>
                </div>
                <div className="flex flex-wrap items-center justify-end gap-1.5">
                  <span className="badge badge-outline badge-sm">Members: {circle?.members?.length || 0}</span>
                  <span className="badge badge-ghost badge-sm">Created: {formatDateTime(circle?.createdAt)}</span>
                </div>
              </div>
            </div>
          </section>

          <section className="shell-panel xl:flex-1 xl:min-h-0 xl:overflow-hidden">
            <div className="p-3 sm:p-4 xl:flex xl:h-full xl:min-h-0 xl:flex-col">
              <p className="inline-flex items-center gap-1.5 rounded-full border border-primary/30 bg-primary/10 px-2 py-0.5 text-[11px] font-semibold">
                <MessageSquare className="size-3.5" /> Realtime group chat
              </p>
              <div className="mt-2 xl:flex-1 xl:min-h-0 xl:overflow-hidden rounded-xl border border-base-300/70 bg-base-100/85">
                {!streamClient || !communityChannel ? (
                  <div className="grid h-full min-h-[320px] place-items-center p-6 text-sm text-base-content/65">
                    Preparing community chat...
                  </div>
                ) : (
                  <CommunityChatErrorBoundary
                    fallback={
                      <div className="grid h-full min-h-[320px] place-items-center p-6 text-center text-sm text-base-content/70">
                        <div>
                          <p className="font-semibold">Community chat could not load.</p>
                          <p className="mt-1">The rest of the community page is still available.</p>
                        </div>
                      </div>
                    }
                  >
                    <Chat client={streamClient}>
                      <Channel channel={communityChannel}>
                        <Window>
                          <MessageList />
                          <MessageComposer />
                        </Window>
                        <Thread />
                      </Channel>
                    </Chat>
                  </CommunityChatErrorBoundary>
                )}
              </div>
            </div>
          </section>
        </section>

        <aside className="space-y-5 xl:col-span-4 xl:min-h-0 xl:overflow-y-auto">
          <section className="shell-panel">
            <div className="p-6">
              <p className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-base-content/65">
                <Users className="size-3.5 text-secondary" /> Members
              </p>
              <div className="mt-3 space-y-2">
                {(circle?.members || []).map((member) => (
                  <div key={member._id} className="flex items-center justify-between rounded-xl border border-base-300/70 bg-base-100/85 p-3">
                    <div className="min-w-0 flex-1 pr-2">
                      <p className="truncate text-sm font-semibold">{member.fullName}</p>
                      <p className="truncate text-xs text-base-content/60">{member.travelStyle || member.homeBase || member.learningLanguage || member.email || "Community member"}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      {String(member._id) === String(circle?.creator?._id) ? <span className="badge badge-primary">Admin</span> : null}
                      {permissions.isCreator && String(member._id) !== String(circle?.creator?._id) ? (
                        <button
                          type="button"
                          className="btn btn-xs btn-outline"
                          onClick={() => removeMemberMutation.mutate(member._id)}
                          disabled={removeMemberMutation.isPending}
                        >
                          Remove
                        </button>
                      ) : null}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </section>

          {permissions.canInvite || permissions.canProposeMembers ? (
            <section className="shell-panel">
              <div className="p-6">
                <p className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-base-content/65">
                  <Users className="size-3.5 text-primary" /> {permissions.canInvite ? "Invite members" : "Request to add a friend"}
                </p>
                {!permissions.canInvite ? (
                  <p className="mt-1 text-[11px] text-base-content/60">
                    Only your friends can be proposed. The admin needs to approve before they get invited.
                  </p>
                ) : null}
                <form className="mt-3" onSubmit={submitInvites}>
                  <div className="flex flex-wrap gap-2">
                    {inviteOptions.length === 0 ? <p className="text-sm text-base-content/65">No more friends available to invite.</p> : null}
                    {inviteOptions.map((friend) => {
                      const selected = inviteMemberIds.includes(friend._id);
                      return (
                        <button
                          key={friend._id}
                          type="button"
                          className={`btn btn-xs ${selected ? "btn-primary" : "btn-outline"}`}
                          onClick={() => toggleInvite(friend._id)}
                        >
                          {friend.fullName}
                        </button>
                      );
                    })}
                  </div>
                  <button
                    type="submit"
                    className="btn btn-primary btn-sm mt-3"
                    disabled={inviteMutation.isPending || proposeMemberMutation.isPending || inviteMemberIds.length === 0}
                  >
                    {inviteMutation.isPending || proposeMemberMutation.isPending
                      ? "Sending..."
                      : permissions.canInvite
                        ? "Send invites"
                        : "Send request"}
                  </button>
                </form>

                {(circle?.pendingInvites || []).length > 0 ? (
                  <div className="mt-4 rounded-xl border border-base-300/70 bg-base-100/80 p-3">
                    <p className="text-xs font-semibold uppercase tracking-wide text-base-content/60">Pending invites</p>
                    <div className="mt-2 flex flex-wrap gap-2">
                      {circle.pendingInvites.map((member) => (
                        <span key={member._id} className="badge badge-outline">
                          {member.fullName}
                        </span>
                      ))}
                    </div>
                  </div>
                ) : null}
              </div>
            </section>
          ) : null}

          {permissions.canReviewJoinRequests && memberAddRequests.length > 0 ? (
            <section className="shell-panel">
              <div className="p-6">
                <p className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-base-content/65">
                  <Users className="size-3.5 text-info" /> Member requests awaiting approval
                </p>
                <div className="mt-3 space-y-2">
                  {memberAddRequests.map((entry) => (
                    <div key={entry.targetUser?._id || entry.targetUser} className="rounded-xl border border-base-300/70 bg-base-100/85 p-3">
                      <p className="text-sm">
                        <span className="font-semibold">{entry.requestedBy?.fullName || "A member"}</span> wants to add{" "}
                        <span className="font-semibold">{entry.targetUser?.fullName || "a friend"}</span>
                      </p>
                      <div className="mt-2 flex gap-2">
                        <button
                          type="button"
                          className="btn btn-xs btn-primary"
                          onClick={() =>
                            respondAddRequestMutation.mutate({
                              targetUserId: entry.targetUser?._id || entry.targetUser,
                              action: "accept",
                            })
                          }
                          disabled={respondAddRequestMutation.isPending}
                        >
                          Approve
                        </button>
                        <button
                          type="button"
                          className="btn btn-xs btn-outline"
                          onClick={() =>
                            respondAddRequestMutation.mutate({
                              targetUserId: entry.targetUser?._id || entry.targetUser,
                              action: "reject",
                            })
                          }
                          disabled={respondAddRequestMutation.isPending}
                        >
                          Decline
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </section>
          ) : null}

          {permissions.canTransferOwnership ? (
            <section className="shell-panel">
              <div className="p-6">
                <p className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-base-content/65">
                  <Crown className="size-3.5 text-warning" /> Transfer ownership
                </p>
                <form className="mt-3" onSubmit={submitTransferOwnership}>
                  <select className="select select-bordered w-full" value={newOwnerId} onChange={(event) => setNewOwnerId(event.target.value)}>
                    <option value="">Choose new admin</option>
                    {ownershipOptions.map((member) => (
                      <option key={member._id} value={member._id}>
                        {member.fullName}
                      </option>
                    ))}
                  </select>
                  <button type="submit" className="btn btn-warning btn-sm mt-3 w-full" disabled={transferOwnerMutation.isPending || !newOwnerId}>
                    {transferOwnerMutation.isPending ? "Transferring..." : "Review transfer"}
                  </button>
                </form>
                {showTransferConfirm ? (
                  <div className="mt-4 rounded-xl border border-warning/40 bg-warning/10 p-4">
                    <p className="text-sm font-semibold">Confirm ownership transfer</p>
                    <p className="mt-1 text-sm text-base-content/75">
                      After transfer, you will lose admin permissions for this community.
                    </p>
                    <div className="mt-3 flex gap-2">
                      <button
                        type="button"
                        className="btn btn-warning btn-sm"
                        onClick={() => transferOwnerMutation.mutate({ newOwnerId })}
                        disabled={transferOwnerMutation.isPending}
                      >
                        Confirm transfer
                      </button>
                      <button
                        type="button"
                        className="btn btn-ghost btn-sm"
                        onClick={() => setShowTransferConfirm(false)}
                        disabled={transferOwnerMutation.isPending}
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                ) : null}
              </div>
            </section>
          ) : null}

          {permissions.canDestroy ? (
            <section className="shell-panel">
              <div className="p-6">
                <p className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-base-content/65">
                  <Users className="size-3.5 text-error" /> Delete community
                </p>
                <p className="mt-2 text-sm text-base-content/70">
                  This permanently deletes the community, its chat, and shared resources. All members will be notified.
                </p>
                <button
                  type="button"
                  className="btn btn-error btn-sm mt-3 w-full"
                  onClick={() => setShowDestroyModal(true)}
                >
                  Delete community
                </button>
              </div>
            </section>
          ) : null}

          <section className="shell-panel">
            <div className="p-6">
              <p className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-base-content/65">
                <FolderOpen className="size-3.5 text-secondary" /> Shared resources
              </p>
              <p className="mt-1 text-[11px] text-base-content/60">Add a short description so members quickly understand this resource.</p>
              <form className="mt-3" onSubmit={submitResource}>
                <label className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-base-content/60">Description</label>
                <textarea
                  className="textarea textarea-bordered h-20 w-full"
                  value={resourceForm.description}
                  onChange={(event) => setResourceForm((prev) => ({ ...prev, description: event.target.value }))}
                  placeholder="Describe this resource in one or two lines..."
                ></textarea>
                <div className="mt-2 rounded-lg border border-base-300/70 bg-base-100/70 px-2 py-2">
                  <div className="flex items-center justify-between gap-2">
                    <p className="inline-flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-base-content/60">
                      <Paperclip className="size-3.5" /> Attach file (optional)
                    </p>
                    {resourceFile ? (
                      <button
                        type="button"
                        className="btn btn-ghost btn-xs"
                        onClick={() => {
                          setResourceFile(null);
                          setResourceFileKey((prev) => prev + 1);
                        }}
                      >
                        <X className="size-3" /> Remove
                      </button>
                    ) : null}
                  </div>
                  <input
                    key={resourceFileKey}
                    type="file"
                    className="file-input file-input-bordered file-input-xs mt-2 w-full"
                    onChange={(event) => setResourceFile(event.target.files?.[0] || null)}
                  />
                  {resourceFile ? <p className="mt-1 truncate text-[11px] text-base-content/65">{resourceFile.name}</p> : null}
                </div>
                <button type="submit" className="btn btn-secondary btn-sm mt-2 w-full" disabled={resourceMutation.isPending}>
                  <Send className="size-4" /> {resourceMutation.isPending ? "Posting..." : "Post update"}
                </button>
              </form>

              <div className="mt-4 space-y-2">
                {resources.length === 0 ? <p className="text-sm text-base-content/65">No shared resources yet.</p> : null}
                {resources.map((resource) => (
                  <article key={resource._id} className="rounded-xl border border-base-300/70 bg-base-100/85 p-3">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <p className="text-sm font-semibold">{resource.author?.fullName || "Member"}</p>
                        <p className="mt-1 text-xs text-base-content/60">{formatDateTime(resource.createdAt)}</p>
                      </div>
                      <span className="badge badge-outline badge-sm">{getResourceTypeLabel(resource)}</span>
                    </div>
                    {resource.url ? (
                      <a href={resource.url} target="_blank" rel="noreferrer" className="mt-2 inline-flex break-all text-xs text-primary underline">
                        Open attachment
                      </a>
                    ) : null}
                    {resource.description ? (
                      <div className="mt-2 rounded-lg bg-base-200/70 px-3 py-2">
                        <p className="text-sm text-base-content/75">{resource.description}</p>
                      </div>
                    ) : null}
                  </article>
                ))}
              </div>
            </div>
          </section>
        </aside>
      </div>

      <dialog className={`modal ${showDestroyModal ? "modal-open" : ""}`}>
        <div className="modal-box max-w-md">
          <h3 className="text-xl font-black tracking-tight">Destroy this community?</h3>
          <p className="mt-2 text-sm text-base-content/70">
            This permanently deletes <span className="font-semibold">{circle?.name}</span>, its chat history, and shared
            resources. Every member will be notified that the community was destroyed. This cannot be undone.
          </p>
          <div className="mt-5 flex justify-end gap-2">
            <button
              type="button"
              className="btn btn-ghost btn-sm"
              onClick={() => setShowDestroyModal(false)}
              disabled={destroyMutation.isPending}
            >
              Cancel
            </button>
            <button
              type="button"
              className="btn btn-error btn-sm"
              onClick={() => destroyMutation.mutate()}
              disabled={destroyMutation.isPending}
            >
              {destroyMutation.isPending ? "Destroying..." : "Destroy community"}
            </button>
          </div>
        </div>
        <form method="dialog" className="modal-backdrop">
          <button type="button" onClick={() => setShowDestroyModal(false)}>
            close
          </button>
        </form>
      </dialog>
    </AppShell>
  );
}
