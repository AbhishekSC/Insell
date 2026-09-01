import { Component, useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Channel, Chat, MessageComposer, MessageList, Thread, Window } from "stream-chat-react";
import { ArrowLeft, Calendar, Camera, Check, Crown, LogOut, Loader2, Menu, PhoneCall, Shield, Trash2, UserPlus, Users, Video, X } from "lucide-react";
import toast from "react-hot-toast";
import { useNavigate } from "react-router";
import axiosInstance from "../lib/axios";
import { useStreamContext } from "../context/StreamProvider";

class CommunityChatErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch() {
    // Render fallback instead of crashing the whole tab.
  }

  render() {
    if (this.state.hasError) {
      return this.props.fallback;
    }

    return this.props.children;
  }
}

export default function CommunityChat({ community, onBack }) {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [showMembers, setShowMembers] = useState(false);
  const [showAddMemberModal, setShowAddMemberModal] = useState(false);
  const [showLeaveModal, setShowLeaveModal] = useState(false);
  const [showDestroyModal, setShowDestroyModal] = useState(false);
  const [showActionsMenu, setShowActionsMenu] = useState(false);
  const [showPhotoPreview, setShowPhotoPreview] = useState(false);
  const [selectedFriendIds, setSelectedFriendIds] = useState([]);
  const [communityChannel, setCommunityChannel] = useState(null);
  const { streamClient, streamReady, videoClient, startGroupVideoCall, videoBusy } = useStreamContext();
  const authUser = queryClient.getQueryData(["authUser"])?.data?.user;
  const photoInputRef = useRef(null);

  // Fetch community detail for an up-to-date member list
  const { data: communityDetail } = useQuery({
    queryKey: ["communityDetail", community?._id],
    queryFn: async () => {
      if (!community?._id) return null;
      const res = await axiosInstance.get(`/community/circles/${community._id}`);
      return res.data?.data || null;
    },
    enabled: !!community?._id,
  });

  const circle = communityDetail?.circle || community;
  const memberIds = (circle?.members || []).map((member) => String(member._id || member));
  const memberIdsKey = memberIds.join(",");
  const communityCallRoomId = circle?._id ? `community-${circle._id}` : null;

  // Predictable room id (not a random one) is what makes this discoverable —
  // any member can independently check/join the same call by id, rather than
  // needing to have been online when it was first started.
  const { data: isCommunityCallActive = false } = useQuery({
    queryKey: ["communityCallActive", communityCallRoomId],
    queryFn: async () => {
      const call = videoClient.call("default", communityCallRoomId);
      const details = await call.get();
      const liveParticipants = details?.call?.session?.participants?.length || 0;
      return liveParticipants > 0 && !details?.call?.ended_at;
    },
    enabled: Boolean(videoClient && communityCallRoomId),
    refetchInterval: 8000,
    retry: false,
  });

  const startOrJoinCommunityCall = async () => {
    if (!circle?._id) return;
    try {
      await startGroupVideoCall({
        roomId: communityCallRoomId,
        memberIds,
        label: circle.name,
      });
      if (!isCommunityCallActive) {
        axiosInstance.post(`/community/circles/${circle._id}/call-started`).catch(() => {});
      }
      toast.success(isCommunityCallActive ? "Joined community call" : "Community call started");
      navigate("/call/live");
    } catch (error) {
      toast.error(error?.message || "Unable to start community call right now");
    }
  };
  const isCreator = Boolean(authUser?._id) && String(circle?.creator?._id || circle?.creator) === String(authUser._id);
  const isModerator = Boolean(authUser?._id) && (circle?.moderators || []).some((m) => String(m?._id || m) === String(authUser._id));
  const isMember = memberIds.includes(String(authUser?._id));
  const canReview = isCreator || isModerator;
  const memberAddRequests = useMemo(() => circle?.memberAddRequests || [], [circle?.memberAddRequests]);

  // Friends who aren't already a member or already invited — only friends can be added
  const { data: friends = [] } = useQuery({
    queryKey: ["friends"],
    queryFn: async () => {
      const res = await axiosInstance.get("/users/friends");
      return res.data?.data?.friends || [];
    },
    enabled: Boolean(authUser?._id) && showAddMemberModal,
  });

  const inviteOptions = useMemo(() => {
    const memberSet = new Set(memberIds);
    const pendingSet = new Set((circle?.pendingInvites || []).map((member) => String(member._id || member)));
    const requestedSet = new Set(memberAddRequests.map((entry) => String(entry.targetUser?._id || entry.targetUser)));
    return friends.filter(
      (friend) => !memberSet.has(String(friend._id)) && !pendingSet.has(String(friend._id)) && !requestedSet.has(String(friend._id))
    );
  }, [circle?.pendingInvites, friends, memberAddRequests, memberIds]);

  const inviteMutation = useMutation({
    mutationFn: async (memberIdsToInvite) => {
      const res = await axiosInstance.post(`/community/circles/${circle._id}/invite`, {
        memberIds: memberIdsToInvite,
      });
      return res.data?.data;
    },
    onSuccess: () => {
      toast.success("Invites sent.");
      setSelectedFriendIds([]);
      setShowAddMemberModal(false);
      queryClient.invalidateQueries({ queryKey: ["communityDetail", community?._id] });
      queryClient.invalidateQueries({ queryKey: ["communities"] });
    },
    onError: (error) => {
      toast.error(error?.response?.data?.message || "Failed to send invites");
    },
  });

  const proposeMemberMutation = useMutation({
    mutationFn: async (memberIdsToPropose) => {
      const res = await axiosInstance.post(`/community/circles/${circle._id}/member-add-request`, {
        memberIds: memberIdsToPropose,
      });
      return res.data?.data;
    },
    onSuccess: () => {
      toast.success("Request sent to admin for approval.");
      setSelectedFriendIds([]);
      setShowAddMemberModal(false);
      queryClient.invalidateQueries({ queryKey: ["communityDetail", community?._id] });
      queryClient.invalidateQueries({ queryKey: ["communities"] });
    },
    onError: (error) => {
      toast.error(error?.response?.data?.message || "Failed to send request");
    },
  });

  const respondAddRequestMutation = useMutation({
    mutationFn: async ({ targetUserId, action }) => {
      const res = await axiosInstance.post(
        `/community/circles/${circle._id}/member-add-requests/${targetUserId}/respond`,
        { action }
      );
      return res.data?.data;
    },
    onSuccess: (_, variables) => {
      toast.success(variables.action === "accept" ? "Member request approved." : "Member request declined.");
      queryClient.invalidateQueries({ queryKey: ["communityDetail", community?._id] });
      queryClient.invalidateQueries({ queryKey: ["communities"] });
    },
    onError: (error) => {
      toast.error(error?.response?.data?.message || "Failed to process request");
    },
  });

  const leaveMutation = useMutation({
    mutationFn: async () => {
      const res = await axiosInstance.post(`/community/circles/${circle._id}/leave`);
      return res.data?.data;
    },
    onSuccess: () => {
      toast.success("Left community successfully");
      setShowLeaveModal(false);
      queryClient.invalidateQueries({ queryKey: ["communities"] });
      onBack?.();
    },
    onError: (error) => {
      toast.error(error?.response?.data?.message || "Failed to leave community");
    },
  });

  const destroyMutation = useMutation({
    mutationFn: async () => {
      const res = await axiosInstance.delete(`/community/circles/${circle._id}`);
      return res.data?.data;
    },
    onSuccess: () => {
      toast.success("Community destroyed.");
      setShowDestroyModal(false);
      queryClient.invalidateQueries({ queryKey: ["communities"] });
      onBack?.();
    },
    onError: (error) => {
      toast.error(error?.response?.data?.message || "Failed to destroy community");
    },
  });

  const updatePhotoMutation = useMutation({
    mutationFn: async (file) => {
      const formData = new FormData();
      formData.append("photo", file);
      const res = await axiosInstance.patch(`/community/circles/${circle._id}/photo`, formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      return res.data?.data;
    },
    onSuccess: () => {
      toast.success("Community photo updated");
      queryClient.invalidateQueries({ queryKey: ["communityDetail", community?._id] });
      queryClient.invalidateQueries({ queryKey: ["communities"] });
    },
    onError: (error) => {
      toast.error(error?.response?.data?.message || "Failed to update community photo");
    },
  });

  function handlePhotoChange(event) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (file) updatePhotoMutation.mutate(file);
  }

  function toggleFriendSelection(id) {
    setSelectedFriendIds((prev) => (prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]));
  }

  function submitInvites() {
    if (selectedFriendIds.length === 0) return;
    if (isCreator) {
      inviteMutation.mutate(selectedFriendIds);
    } else {
      proposeMemberMutation.mutate(selectedFriendIds);
    }
  }

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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [circle?._id, circle?.name, memberIdsKey, streamClient, streamReady]);

  // Real-time: if the admin destroys this community while it's open, bounce out immediately.
  useEffect(() => {
    if (!communityChannel) {
      return;
    }

    const handleNewMessage = (event) => {
      if (event.message?.custom_type === "community_destroyed") {
        toast.error(event.message.text || "This community has been deleted by the admin.");
        queryClient.invalidateQueries({ queryKey: ["communities"] });
        onBack?.();
      }
    };

    communityChannel.on("message.new", handleNewMessage);

    return () => {
      communityChannel.off("message.new", handleNewMessage);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [communityChannel]);

  if (!community) {
    return (
      <div className="flex h-full items-center justify-center">
        <p className="text-base-content/60">Select a community to start chatting</p>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col">
      {/* Chat Header */}
      <div className="flex items-center justify-between border-b border-base-300 bg-base-100 px-4 py-3">
        <div className="flex items-center gap-3">
          <button
            onClick={onBack}
            className="rounded-lg p-2 hover:bg-base-200 transition-colors"
          >
            <ArrowLeft size={20} />
          </button>
          <button
            type="button"
            onClick={() => circle?.photo && setShowPhotoPreview(true)}
            className={`relative h-10 w-10 shrink-0 overflow-hidden rounded-full bg-gradient-to-r from-primary to-secondary text-white font-semibold ${circle?.photo ? "cursor-zoom-in" : "cursor-default"}`}
            aria-label={circle?.photo ? "View community photo" : undefined}
          >
            {circle?.photo ? (
              <img src={circle.photo} alt={community.name} className="h-full w-full object-cover" />
            ) : (
              <div className="grid h-full w-full place-items-center">{community.name?.charAt(0) || "C"}</div>
            )}
            {updatePhotoMutation.isPending ? (
              <div className="absolute inset-0 grid place-items-center bg-black/50">
                <div className="size-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
              </div>
            ) : null}
          </button>
          <div>
            <h2 className="font-semibold text-base-content">{community.name}</h2>
            <p className="text-xs text-base-content/60">
              {circle?.members?.length || 0} members
            </p>
          </div>
        </div>
        <div className="flex items-center gap-1">
          {isMember && videoClient && (
            <button
              type="button"
              onClick={startOrJoinCommunityCall}
              disabled={videoBusy}
              className={`flex items-center gap-1.5 rounded-lg px-2.5 py-2 text-sm font-medium transition-colors disabled:opacity-60 ${
                isCommunityCallActive ? "bg-success/10 text-success hover:bg-success/15" : "text-base-content/70 hover:bg-base-200"
              }`}
              title={isCommunityCallActive ? "Join the ongoing community call" : "Start a community call"}
            >
              {videoBusy ? (
                <Loader2 size={18} className="animate-spin" />
              ) : isCommunityCallActive ? (
                <PhoneCall size={18} />
              ) : (
                <Video size={18} />
              )}
              <span className="hidden sm:inline">{isCommunityCallActive ? "Join call" : "Start call"}</span>
            </button>
          )}
          <div className="relative">
            <button
              onClick={() => setShowActionsMenu((prev) => !prev)}
              className="rounded-lg p-2 hover:bg-base-200 transition-colors"
              title="Community options"
            >
              <Menu size={20} />
            </button>

          {showActionsMenu && (
            <>
              <div className="fixed inset-0 z-40" onClick={() => setShowActionsMenu(false)} />
              <div className="absolute right-0 top-full z-50 mt-2 w-56 rounded-xl border border-base-300 bg-base-100 py-1.5 shadow-lg">
                {isMember && (
                  <button
                    onClick={() => {
                      setShowAddMemberModal(true);
                      setShowActionsMenu(false);
                    }}
                    className="flex w-full items-center gap-2 px-4 py-2.5 text-left text-sm text-base-content hover:bg-base-200"
                  >
                    <UserPlus size={16} className="text-primary" />
                    {isCreator ? "Add member" : "Request to add a friend"}
                  </button>
                )}
                <button
                  onClick={() => {
                    setShowMembers(!showMembers);
                    setShowActionsMenu(false);
                  }}
                  className="flex w-full items-center gap-2 px-4 py-2.5 text-left text-sm text-base-content hover:bg-base-200"
                >
                  <Users size={16} className="text-base-content/60" />
                  {showMembers ? "Hide members" : "View members"}
                </button>
                {canReview && (
                  <button
                    onClick={() => {
                      setShowActionsMenu(false);
                      photoInputRef.current?.click();
                    }}
                    className="flex w-full items-center gap-2 px-4 py-2.5 text-left text-sm text-base-content hover:bg-base-200"
                  >
                    <Camera size={16} className="text-base-content/60" />
                    Update profile
                  </button>
                )}
                {!isCreator && (
                  <button
                    onClick={() => {
                      setShowLeaveModal(true);
                      setShowActionsMenu(false);
                    }}
                    className="flex w-full items-center gap-2 px-4 py-2.5 text-left text-sm text-error hover:bg-error/10"
                  >
                    <LogOut size={16} />
                    Leave community
                  </button>
                )}
                {isCreator && (
                  <button
                    onClick={() => {
                      setShowDestroyModal(true);
                      setShowActionsMenu(false);
                    }}
                    className="flex w-full items-center gap-2 px-4 py-2.5 text-left text-sm text-error hover:bg-error/10"
                  >
                    <Trash2 size={16} />
                    Delete community
                  </button>
                )}
              </div>
            </>
          )}
          <input
            ref={photoInputRef}
            type="file"
            accept="image/png,image/jpeg,image/webp"
            className="hidden"
            onChange={handlePhotoChange}
          />
          </div>
        </div>
      </div>

      <div className="flex flex-1 overflow-hidden">
        {/* Messages Area */}
        <div className="flex flex-1 flex-col bg-base-200">
          {!streamClient || !communityChannel ? (
            <div className="flex flex-1 items-center justify-center text-sm text-base-content/60">
              Preparing community chat...
            </div>
          ) : (
            <CommunityChatErrorBoundary
              fallback={
                <div className="flex flex-1 flex-col items-center justify-center p-6 text-center text-sm text-base-content/60">
                  <p className="font-semibold text-base-content">Community chat could not load.</p>
                </div>
              }
            >
              <div className="telegram-chat-shell flex-1 overflow-hidden">
                <Chat client={streamClient}>
                  <Channel channel={communityChannel}>
                    <Window>
                      <MessageList />
                      <MessageComposer />
                    </Window>
                    <Thread />
                  </Channel>
                </Chat>
              </div>
            </CommunityChatErrorBoundary>
          )}
        </div>

        {/* Members Sidebar — overlay on mobile so it doesn't squeeze the chat down to nothing */}
        {showMembers && (
          <div className="fixed inset-0 z-40 bg-black/30 sm:hidden" onClick={() => setShowMembers(false)} />
        )}
        {showMembers && (
          <div className="fixed inset-y-0 right-0 z-50 w-72 max-w-[85vw] border-l border-base-300 bg-base-100 overflow-y-auto sm:static sm:z-auto sm:max-w-none">
            <div className="sticky top-0 border-b border-base-300 bg-base-100 px-4 py-3">
              <div className="flex items-center justify-between">
                <h3 className="font-semibold text-base-content">Members</h3>
                <button
                  onClick={() => setShowMembers(false)}
                  className="rounded-lg p-1 hover:bg-base-200"
                >
                  <X size={18} />
                </button>
              </div>
            </div>
            <div className="p-4 space-y-3">
              {(circle?.members || []).map((member) => (
                <div
                  key={member._id}
                  className="flex items-center gap-3 rounded-lg p-2 hover:bg-base-200"
                >
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-full bg-primary/15 text-primary font-semibold">
                    {member.profilePic ? (
                      <img src={member.profilePic} alt={member.fullName} className="h-full w-full object-cover" />
                    ) : (
                      member.fullName?.charAt(0) || "U"
                    )}
                  </div>
                  <div className="flex-1">
                    <p className="font-medium text-base-content text-sm">
                      {member.fullName}
                      {member._id === circle?.creator?._id && (
                        <Crown className="inline ml-1 text-warning" size={14} />
                      )}
                      {circle?.moderators?.includes(member._id) && member._id !== circle?.creator?._id && (
                        <Shield className="inline ml-1 text-info" size={14} />
                      )}
                    </p>
                    <p className="text-xs text-base-content/60">{member.email}</p>
                  </div>
                </div>
              ))}
              {(circle?.pendingInvites || []).length > 0 && (
                <div className="mt-2 border-t border-base-200 pt-3">
                  <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-base-content/50">Pending invites</p>
                  <div className="flex flex-wrap gap-1.5">
                    {circle.pendingInvites.map((member) => (
                      <span key={member._id} className="rounded-full bg-base-200 px-2.5 py-1 text-xs text-base-content/70">
                        {member.fullName}
                      </span>
                    ))}
                  </div>
                </div>
              )}
              {canReview && memberAddRequests.length > 0 && (
                <div className="mt-2 border-t border-base-200 pt-3">
                  <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-base-content/50">
                    Member requests awaiting approval
                  </p>
                  <div className="space-y-2">
                    {memberAddRequests.map((entry) => (
                      <div key={entry.targetUser?._id || entry.targetUser} className="rounded-lg bg-base-200 p-2">
                        <p className="text-xs text-base-content">
                          <span className="font-medium">{entry.requestedBy?.fullName || "A member"}</span> wants to add{" "}
                          <span className="font-medium">{entry.targetUser?.fullName || "a friend"}</span>
                        </p>
                        <div className="mt-1.5 flex gap-1.5">
                          <button
                            onClick={() =>
                              respondAddRequestMutation.mutate({
                                targetUserId: entry.targetUser?._id || entry.targetUser,
                                action: "accept",
                              })
                            }
                            disabled={respondAddRequestMutation.isPending}
                            className="flex items-center gap-1 rounded-md bg-primary px-2 py-1 text-[11px] font-medium text-white hover:bg-primary transition-colors disabled:opacity-50"
                          >
                            <Check size={12} />
                            Approve
                          </button>
                          <button
                            onClick={() =>
                              respondAddRequestMutation.mutate({
                                targetUserId: entry.targetUser?._id || entry.targetUser,
                                action: "reject",
                              })
                            }
                            disabled={respondAddRequestMutation.isPending}
                            className="flex items-center gap-1 rounded-md border border-base-300 px-2 py-1 text-[11px] font-medium text-base-content hover:bg-base-200 transition-colors disabled:opacity-50"
                          >
                            <X size={12} />
                            Decline
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Add Member Modal */}
      {showAddMemberModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-md rounded-xl bg-base-100 p-6 shadow-xl">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-xl font-bold text-base-content">
                {isCreator ? "Add member from friends" : "Request to add a friend"}
              </h2>
              <button
                onClick={() => {
                  setShowAddMemberModal(false);
                  setSelectedFriendIds([]);
                }}
                className="rounded-lg p-1 hover:bg-base-200"
              >
                <X size={20} />
              </button>
            </div>
            <p className="mb-4 text-sm text-base-content/60">
              {isCreator
                ? "Only your friends can be added. They'll get an invite and join once they accept."
                : "Only your friends can be proposed. The admin needs to approve before they get invited."}
            </p>
            <div className="max-h-72 space-y-1 overflow-y-auto">
              {inviteOptions.length === 0 ? (
                <p className="py-6 text-center text-sm text-base-content/60">
                  No friends available to invite right now.
                </p>
              ) : (
                inviteOptions.map((friend) => {
                  const selected = selectedFriendIds.includes(friend._id);
                  return (
                    <button
                      key={friend._id}
                      type="button"
                      onClick={() => toggleFriendSelection(friend._id)}
                      className={`flex w-full items-center gap-3 rounded-lg p-2 text-left transition-colors ${
                        selected ? "bg-primary/10 ring-1 ring-primary" : "hover:bg-base-200"
                      }`}
                    >
                      <div className="flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-full bg-primary/15 text-primary text-sm font-semibold">
                        {friend.profilePic ? (
                          <img src={friend.profilePic} alt={friend.fullName} className="h-full w-full object-cover" />
                        ) : (
                          friend.fullName?.charAt(0) || "U"
                        )}
                      </div>
                      <span className="flex-1 text-sm font-medium text-base-content">{friend.fullName}</span>
                      {selected && <Check size={16} className="text-primary" />}
                    </button>
                  );
                })
              )}
            </div>
            <div className="mt-4 flex gap-3">
              <button
                type="button"
                onClick={() => {
                  setShowAddMemberModal(false);
                  setSelectedFriendIds([]);
                }}
                className="flex-1 rounded-lg border border-base-300 px-4 py-2 text-base-content hover:bg-base-200 transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={submitInvites}
                disabled={inviteMutation.isPending || proposeMemberMutation.isPending || selectedFriendIds.length === 0}
                className="flex-1 rounded-lg bg-primary px-4 py-2 text-white hover:bg-primary transition-colors disabled:opacity-50"
              >
                {inviteMutation.isPending || proposeMemberMutation.isPending
                  ? "Sending..."
                  : isCreator
                    ? `Send invite${selectedFriendIds.length > 1 ? "s" : ""}`
                    : `Request add${selectedFriendIds.length > 1 ? "s" : ""}`}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Leave Community Confirmation Modal */}
      {showLeaveModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-sm rounded-xl bg-base-100 p-6 shadow-xl">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-lg font-bold text-base-content">Leave community?</h2>
              <button
                onClick={() => setShowLeaveModal(false)}
                className="rounded-lg p-1 hover:bg-base-200"
              >
                <X size={20} />
              </button>
            </div>
            <p className="text-sm text-base-content/70">
              You'll lose access to <span className="font-medium text-base-content">{community.name}</span>'s chat and shared resources. You can rejoin later, but you'll need to request to join again.
            </p>
            <div className="mt-5 flex gap-3">
              <button
                type="button"
                onClick={() => setShowLeaveModal(false)}
                className="flex-1 rounded-lg border border-base-300 px-4 py-2 text-base-content hover:bg-base-200 transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => leaveMutation.mutate()}
                disabled={leaveMutation.isPending}
                className="flex-1 rounded-lg bg-error px-4 py-2 text-white hover:bg-error transition-colors disabled:opacity-50"
              >
                {leaveMutation.isPending ? "Leaving..." : "Leave community"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Destroy Community Confirmation Modal */}
      {showDestroyModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-sm rounded-xl bg-base-100 p-6 shadow-xl">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-lg font-bold text-base-content">Delete community?</h2>
              <button
                onClick={() => setShowDestroyModal(false)}
                className="rounded-lg p-1 hover:bg-base-200"
              >
                <X size={20} />
              </button>
            </div>
            <p className="text-sm text-base-content/70">
              This permanently deletes <span className="font-medium text-base-content">{community.name}</span>, its chat, and
              shared resources. Every member will be notified. This cannot be undone.
            </p>
            <div className="mt-5 flex gap-3">
              <button
                type="button"
                onClick={() => setShowDestroyModal(false)}
                className="flex-1 rounded-lg border border-base-300 px-4 py-2 text-base-content hover:bg-base-200 transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => destroyMutation.mutate()}
                disabled={destroyMutation.isPending}
                className="flex-1 rounded-lg bg-error px-4 py-2 text-white hover:bg-error transition-colors disabled:opacity-50"
              >
                {destroyMutation.isPending ? "Deleting..." : "Delete community"}
              </button>
            </div>
          </div>
        </div>
      )}

      {showPhotoPreview && circle?.photo && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4"
          onClick={() => setShowPhotoPreview(false)}
        >
          <button
            type="button"
            onClick={() => setShowPhotoPreview(false)}
            className="absolute right-4 top-4 grid size-10 place-items-center rounded-full bg-white/10 text-white hover:bg-white/20"
            aria-label="Close"
          >
            <X className="size-5" />
          </button>
          <div className="flex max-w-lg flex-col items-center" onClick={(event) => event.stopPropagation()}>
            <img
              src={circle.photo}
              alt={community.name}
              className="max-h-[70vh] max-w-full rounded-2xl object-contain"
            />
            <div className="mt-4 w-full rounded-2xl bg-white/10 p-4 text-center text-white backdrop-blur">
              <h3 className="text-lg font-semibold">{community.name}</h3>
              <div className="mt-2 flex items-center justify-center gap-4 text-sm text-white/80">
                <span className="inline-flex items-center gap-1.5">
                  <Users className="size-4" />
                  {circle?.members?.length || 0} members
                </span>
                {circle?.createdAt && (
                  <span className="inline-flex items-center gap-1.5">
                    <Calendar className="size-4" />
                    Created {new Date(circle.createdAt).toLocaleDateString("en-IN", { month: "short", year: "numeric" })}
                  </span>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
