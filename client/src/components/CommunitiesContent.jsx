import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Users,
  Plus,
  Search,
  MessageCircle,
  Crown,
  Shield,
  UserPlus,
  Check,
  X,
  LogOut,
  MoreVertical,
  ChevronRight,
} from "lucide-react";
import toast from "react-hot-toast";
import axiosInstance from "../lib/axios";

export default function CommunitiesContent({ onOpenChat }) {
  const queryClient = useQueryClient();
  const [searchQuery, setSearchQuery] = useState("");
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [selectedCommunity, setSelectedCommunity] = useState(null);
  const [newCommunity, setNewCommunity] = useState({ name: "", topic: "" });
  const [leaveTarget, setLeaveTarget] = useState(null);

  // Fetch communities data
  const { data: communitiesData, isLoading } = useQuery({
    queryKey: ["communities"],
    queryFn: async () => {
      const res = await axiosInstance.get("/community");
      return res.data?.data || { studyCircles: [], suggestedCircles: [] };
    },
    refetchInterval: 30000,
  });

  const communities = communitiesData?.studyCircles || [];
  const suggestedCommunities = communitiesData?.suggestedCircles || [];
  const notifications = communitiesData?.notifications || [];
  const communityInvites = notifications.filter((item) => item.type === "circle_invite");
  const communityAlerts = notifications.filter((item) => item.type !== "circle_invite");
  const authUser = queryClient.getQueryData(["authUser"])?.data?.user;

  const manageableCommunities = communities.filter((c) => {
    const isCreator = String(c.creator?._id || c.creator) === String(authUser?._id);
    const isModerator = (c.moderators || []).some((m) => String(m?._id || m) === String(authUser?._id));
    return isCreator || isModerator;
  });
  const pendingJoinRequests = manageableCommunities.flatMap((c) =>
    (c.pendingJoinRequests || []).map((user) => ({
      circleId: c._id,
      circleName: c.name,
      user,
    }))
  );
  const pendingMemberAddRequests = manageableCommunities.flatMap((c) =>
    (c.memberAddRequests || []).map((entry) => ({
      circleId: c._id,
      circleName: c.name,
      requestedBy: entry.requestedBy,
      targetUser: entry.targetUser,
    }))
  );

  // Create community mutation
  const createCommunityMutation = useMutation({
    mutationFn: async (data) => {
      const res = await axiosInstance.post("/community/circles", data);
      return res.data?.data;
    },
    onSuccess: () => {
      toast.success("Community created successfully!");
      setShowCreateModal(false);
      setNewCommunity({ name: "", topic: "" });
      queryClient.invalidateQueries({ queryKey: ["communities"] });
    },
    onError: (error) => {
      toast.error(error?.response?.data?.message || "Failed to create community");
    },
  });

  // Join community mutation
  const joinCommunityMutation = useMutation({
    mutationFn: async (circleId) => {
      const res = await axiosInstance.post(`/community/circles/${circleId}/join-request`);
      return res.data?.data;
    },
    onSuccess: () => {
      toast.success("Join request sent! Waiting for admin approval.");
      queryClient.invalidateQueries({ queryKey: ["communities"] });
    },
    onError: (error) => {
      toast.error(error?.response?.data?.message || "Failed to send join request");
    },
  });

  // Respond to join request mutation
  const respondToRequestMutation = useMutation({
    mutationFn: async ({ circleId, userId, action }) => {
      const res = await axiosInstance.post(
        `/community/circles/${circleId}/join-requests/${userId}/respond`,
        { action }
      );
      return res.data?.data;
    },
    onSuccess: () => {
      toast.success("Request processed successfully");
      queryClient.invalidateQueries({ queryKey: ["communities"] });
    },
    onError: (error) => {
      toast.error(error?.response?.data?.message || "Failed to process request");
    },
  });

  // Respond to a member-add request (a non-admin member proposed a friend)
  const respondAddRequestMutation = useMutation({
    mutationFn: async ({ circleId, targetUserId, action }) => {
      const res = await axiosInstance.post(
        `/community/circles/${circleId}/member-add-requests/${targetUserId}/respond`,
        { action }
      );
      return res.data?.data;
    },
    onSuccess: () => {
      toast.success("Request processed successfully");
      queryClient.invalidateQueries({ queryKey: ["communities"] });
    },
    onError: (error) => {
      toast.error(error?.response?.data?.message || "Failed to process request");
    },
  });

  // Respond to a community invite (accept/decline being added to a community)
  const respondToInviteMutation = useMutation({
    mutationFn: async ({ notificationId, action }) => {
      const res = await axiosInstance.post(`/community/invites/${notificationId}/respond`, { action });
      return res.data?.data;
    },
    onSuccess: (_, variables) => {
      toast.success(variables.action === "accept" ? "Joined community!" : "Invite declined");
      queryClient.invalidateQueries({ queryKey: ["communities"] });
    },
    onError: (error) => {
      toast.error(error?.response?.data?.message || "Failed to respond to invite");
    },
  });

  // Dismiss (mark read) an informational notification, e.g. a community-destroyed alert
  const markNotificationReadMutation = useMutation({
    mutationFn: async (notificationId) => {
      const res = await axiosInstance.post(`/community/notifications/${notificationId}/read`);
      return res.data?.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["communities"] });
    },
    onError: (error) => {
      toast.error(error?.response?.data?.message || "Failed to dismiss notification");
    },
  });

  // Leave community mutation
  const leaveCommunityMutation = useMutation({
    mutationFn: async (circleId) => {
      const res = await axiosInstance.post(`/community/circles/${circleId}/leave`);
      return res.data?.data;
    },
    onSuccess: () => {
      toast.success("Left community successfully");
      setLeaveTarget(null);
      queryClient.invalidateQueries({ queryKey: ["communities"] });
    },
    onError: (error) => {
      toast.error(error?.response?.data?.message || "Failed to leave community");
    },
  });

  const handleCreateCommunity = (e) => {
    e.preventDefault();
    if (!newCommunity.name.trim() || !newCommunity.topic.trim()) {
      toast.error("Please fill in all fields");
      return;
    }
    createCommunityMutation.mutate(newCommunity);
  };

  const handleJoinCommunity = (circleId) => {
    joinCommunityMutation.mutate(circleId);
  };

  const handleRespondToInvite = (notificationId, action) => {
    respondToInviteMutation.mutate({ notificationId, action });
  };

  const handleRespondToRequest = (circleId, userId, action) => {
    respondToRequestMutation.mutate({ circleId, userId, action });
  };

  const handleRespondToAddRequest = (circleId, targetUserId, action) => {
    respondAddRequestMutation.mutate({ circleId, targetUserId, action });
  };

  const handleLeaveCommunity = (community) => {
    setLeaveTarget(community);
  };

  const confirmLeaveCommunity = () => {
    if (leaveTarget) {
      leaveCommunityMutation.mutate(leaveTarget._id);
    }
  };

  const handleOpenChat = (community) => {
    if (onOpenChat) {
      onOpenChat(community);
    }
  };

  const filteredCommunities = communities.filter((community) =>
    community.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    community.topic?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const filteredSuggested = suggestedCommunities.filter((community) =>
    community.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    community.topic?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const myCommunities = filteredCommunities.filter((c) =>
    c.members?.some(m => String(m._id || m) === String(authUser?._id))
  );

  return (
    <div className="h-full">
      {/* Header */}
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Communities</h1>
          <p className="text-sm text-slate-500">Join groups and connect with people</p>
        </div>
        <button
          onClick={() => setShowCreateModal(true)}
          className="flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-white hover:bg-indigo-700 transition-colors"
        >
          <Plus size={18} />
          <span className="hidden sm:inline">Create Community</span>
        </button>
      </div>

      {/* Search */}
      <div className="mb-6">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={20} />
          <input
            type="text"
            placeholder="Search communities..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full rounded-lg border border-slate-200 pl-10 pr-4 py-2.5 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
          />
        </div>
      </div>

      {/* Invites: communities I've been added to and need to accept/decline */}
      {communityInvites.length > 0 && (
        <div className="mb-8 rounded-xl border border-indigo-200 bg-indigo-50 p-4">
          <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold text-slate-900">
            <UserPlus size={16} className="text-indigo-500" />
            You've been invited
          </h2>
          <div className="space-y-2">
            {communityInvites.map((item) => (
              <div
                key={item._id}
                className="flex items-center justify-between gap-3 rounded-lg bg-white p-3 shadow-sm"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-slate-900">
                    {item.actor?.fullName || "A friend"} added you to {item.circle?.name || "a community"}
                  </p>
                  <p className="truncate text-xs text-slate-500">{item.message}</p>
                </div>
                <div className="flex shrink-0 gap-2">
                  <button
                    onClick={() => handleRespondToInvite(item._id, "accept")}
                    disabled={respondToInviteMutation.isPending}
                    className="flex items-center gap-1 rounded-lg bg-indigo-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-indigo-700 transition-colors disabled:opacity-50"
                  >
                    <Check size={14} />
                    Join
                  </button>
                  <button
                    onClick={() => handleRespondToInvite(item._id, "reject")}
                    disabled={respondToInviteMutation.isPending}
                    className="flex items-center gap-1 rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 transition-colors disabled:opacity-50"
                  >
                    <X size={14} />
                    Decline
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Alerts: e.g. a community I was in got destroyed by its admin */}
      {communityAlerts.length > 0 && (
        <div className="mb-8 rounded-xl border border-red-200 bg-red-50 p-4">
          <div className="space-y-2">
            {communityAlerts.map((item) => (
              <div
                key={item._id}
                className="flex items-center justify-between gap-3 rounded-lg bg-white p-3 shadow-sm"
              >
                <p className="truncate text-sm font-medium text-slate-900">{item.message}</p>
                <button
                  onClick={() => markNotificationReadMutation.mutate(item._id)}
                  disabled={markNotificationReadMutation.isPending}
                  className="shrink-0 rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 transition-colors disabled:opacity-50"
                >
                  Dismiss
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Join requests awaiting my approval (admin/moderator) */}
      {pendingJoinRequests.length > 0 && (
        <div className="mb-8 rounded-xl border border-amber-200 bg-amber-50 p-4">
          <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold text-slate-900">
            <Crown size={16} className="text-amber-500" />
            Join requests awaiting your approval
          </h2>
          <div className="space-y-2">
            {pendingJoinRequests.map((item) => (
              <div
                key={`${item.circleId}-${item.user?._id || "unknown"}`}
                className="flex items-center justify-between gap-3 rounded-lg bg-white p-3 shadow-sm"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-slate-900">{item.user?.fullName || "User"}</p>
                  <p className="truncate text-xs text-slate-500">Requested to join {item.circleName}</p>
                </div>
                <div className="flex shrink-0 gap-2">
                  <button
                    onClick={() => handleRespondToRequest(item.circleId, item.user?._id, "accept")}
                    disabled={respondToRequestMutation.isPending || !item.user?._id}
                    className="flex items-center gap-1 rounded-lg bg-indigo-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-indigo-700 transition-colors disabled:opacity-50"
                  >
                    <Check size={14} />
                    Accept
                  </button>
                  <button
                    onClick={() => handleRespondToRequest(item.circleId, item.user?._id, "reject")}
                    disabled={respondToRequestMutation.isPending || !item.user?._id}
                    className="flex items-center gap-1 rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 transition-colors disabled:opacity-50"
                  >
                    <X size={14} />
                    Decline
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Member add requests awaiting my approval (admin/moderator) */}
      {pendingMemberAddRequests.length > 0 && (
        <div className="mb-8 rounded-xl border border-amber-200 bg-amber-50 p-4">
          <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold text-slate-900">
            <Crown size={16} className="text-amber-500" />
            Member requests awaiting your approval
          </h2>
          <div className="space-y-2">
            {pendingMemberAddRequests.map((item) => (
              <div
                key={`${item.circleId}-${item.targetUser?._id || "unknown"}`}
                className="flex items-center justify-between gap-3 rounded-lg bg-white p-3 shadow-sm"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-slate-900">
                    {item.requestedBy?.fullName || "A member"} wants to add {item.targetUser?.fullName || "a friend"}
                  </p>
                  <p className="truncate text-xs text-slate-500">to {item.circleName}</p>
                </div>
                <div className="flex shrink-0 gap-2">
                  <button
                    onClick={() => handleRespondToAddRequest(item.circleId, item.targetUser?._id, "accept")}
                    disabled={respondAddRequestMutation.isPending || !item.targetUser?._id}
                    className="flex items-center gap-1 rounded-lg bg-indigo-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-indigo-700 transition-colors disabled:opacity-50"
                  >
                    <Check size={14} />
                    Approve
                  </button>
                  <button
                    onClick={() => handleRespondToAddRequest(item.circleId, item.targetUser?._id, "reject")}
                    disabled={respondAddRequestMutation.isPending || !item.targetUser?._id}
                    className="flex items-center gap-1 rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 transition-colors disabled:opacity-50"
                  >
                    <X size={14} />
                    Decline
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* My Communities */}
      {myCommunities.length > 0 && (
        <div className="mb-8">
          <h2 className="mb-4 text-lg font-semibold text-slate-900">My Communities</h2>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {myCommunities.map((community) => (
              <CommunityCard
                key={community._id}
                community={community}
                onJoin={handleJoinCommunity}
                onChat={() => handleOpenChat(community)}
                onLeave={() => handleLeaveCommunity(community)}
                isMember={true}
              />
            ))}
          </div>
        </div>
      )}

      {/* Other Communities */}
      <div>
        <h2 className="mb-4 text-lg font-semibold text-slate-900">
          {myCommunities.length > 0 ? "Discover Communities" : "All Communities"}
        </h2>
        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <div className="text-slate-500">Loading communities...</div>
          </div>
        ) : filteredSuggested.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-slate-300 py-12">
            <Users className="mb-3 text-slate-400" size={48} />
            <p className="text-slate-500">No communities found</p>
            <button
              onClick={() => setShowCreateModal(true)}
              className="mt-3 text-indigo-600 hover:text-indigo-700"
            >
              Create one
            </button>
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {filteredSuggested.map((community) => (
              <CommunityCard
                key={community._id}
                community={community}
                onJoin={handleJoinCommunity}
                onChat={() => handleOpenChat(community)}
                onLeave={() => handleLeaveCommunity(community)}
                isMember={false}
              />
            ))}
          </div>
        )}
      </div>

      {/* Create Community Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-md rounded-xl bg-white p-6 shadow-xl">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-xl font-bold text-slate-900">Create Community</h2>
              <button
                onClick={() => setShowCreateModal(false)}
                className="rounded-lg p-1 hover:bg-slate-100"
              >
                <X size={20} />
              </button>
            </div>
            <form onSubmit={handleCreateCommunity} className="space-y-4">
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">Community Name</label>
                <input
                  type="text"
                  value={newCommunity.name}
                  onChange={(e) => setNewCommunity({ ...newCommunity, name: e.target.value })}
                  placeholder="e.g., Real Estate Investors"
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                  required
                />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">Topic/Description</label>
                <textarea
                  value={newCommunity.topic}
                  onChange={(e) => setNewCommunity({ ...newCommunity, topic: e.target.value })}
                  placeholder="What is this community about?"
                  rows={3}
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                  required
                />
              </div>
              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="flex-1 rounded-lg border border-slate-200 px-4 py-2 text-slate-700 hover:bg-slate-50 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={createCommunityMutation.isPending}
                  className="flex-1 rounded-lg bg-indigo-600 px-4 py-2 text-white hover:bg-indigo-700 transition-colors disabled:opacity-50"
                >
                  {createCommunityMutation.isPending ? "Creating..." : "Create"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Leave Community Confirmation Modal */}
      {leaveTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-sm rounded-xl bg-white p-6 shadow-xl">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-lg font-bold text-slate-900">Leave community?</h2>
              <button
                onClick={() => setLeaveTarget(null)}
                className="rounded-lg p-1 hover:bg-slate-100"
              >
                <X size={20} />
              </button>
            </div>
            <p className="text-sm text-slate-600">
              You'll lose access to <span className="font-medium text-slate-900">{leaveTarget.name}</span>'s chat and shared resources. You can rejoin later, but you'll need to request to join again.
            </p>
            <div className="mt-5 flex gap-3">
              <button
                type="button"
                onClick={() => setLeaveTarget(null)}
                className="flex-1 rounded-lg border border-slate-200 px-4 py-2 text-slate-700 hover:bg-slate-50 transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={confirmLeaveCommunity}
                disabled={leaveCommunityMutation.isPending}
                className="flex-1 rounded-lg bg-red-600 px-4 py-2 text-white hover:bg-red-700 transition-colors disabled:opacity-50"
              >
                {leaveCommunityMutation.isPending ? "Leaving..." : "Leave community"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function CommunityCard({ community, onJoin, onChat, onLeave, isMember }) {
  const queryClient = useQueryClient();
  const authUser = queryClient.getQueryData(["authUser"])?.data?.user;
  
  const isCreator = community.creator?._id === authUser?._id;
  const isModerator = community.moderators?.includes(authUser?._id);
  const memberCount = community.members?.length || 0;

  return (
    <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm transition-all hover:shadow-md">
      <div className="h-24 bg-gradient-to-r from-indigo-500 to-purple-600"></div>
      <div className="p-4">
        <div className="mb-3 flex items-start justify-between">
          <div className="flex-1">
            <h3 className="font-semibold text-slate-900">{community.name}</h3>
            <p className="line-clamp-2 text-sm text-slate-600">{community.topic}</p>
          </div>
          {isCreator && (
            <Crown className="text-amber-500" size={18} title="Creator" />
          )}
          {isModerator && !isCreator && (
            <Shield className="text-blue-500" size={18} title="Moderator" />
          )}
        </div>
        
        <div className="mb-3 flex items-center gap-4 text-sm text-slate-500">
          <div className="flex items-center gap-1">
            <Users size={16} />
            <span>{memberCount} members</span>
          </div>
        </div>

        <div className="flex gap-2">
          {isMember ? (
            <>
              <button
                onClick={onChat}
                className="flex flex-1 items-center justify-center gap-2 rounded-lg bg-indigo-600 px-3 py-2 text-white hover:bg-indigo-700 transition-colors"
              >
                <MessageCircle size={16} />
                <span>Chat</span>
              </button>
              {!isCreator && (
                <button
                  onClick={() => onLeave(community._id)}
                  className="rounded-lg border border-slate-200 px-3 py-2 text-slate-700 hover:bg-slate-50 transition-colors"
                  title="Leave community"
                >
                  <LogOut size={16} />
                </button>
              )}
            </>
          ) : (
 <button
              onClick={() => onJoin(community._id)}
              className="flex flex-1 items-center justify-center gap-2 rounded-lg border border-indigo-600 px-3 py-2 text-indigo-600 hover:bg-indigo-50 transition-colors"
            >
              <UserPlus size={16} />
              <span>Join</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
