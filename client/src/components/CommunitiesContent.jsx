import { useState } from "react";
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
  MessageSquare,
  Calendar,
  Filter,
  ChevronDown,
  ChevronRight,
  Building2,
  HardHat,
  Sofa,
  TrendingUp,
  Handshake,
  Sparkles,
  Award,
} from "lucide-react";
import toast from "react-hot-toast";
import axiosInstance from "../lib/axios";

const CATEGORY_OPTIONS = ["Real Estate", "Construction", "Investment", "Lifestyle", "General"];

const CATEGORY_STYLES = {
  "Real Estate": { icon: Building2, bg: "bg-indigo-50", text: "text-indigo-600", pill: "bg-indigo-100 text-indigo-700" },
  Construction: { icon: HardHat, bg: "bg-orange-50", text: "text-orange-600", pill: "bg-orange-100 text-orange-700" },
  Investment: { icon: TrendingUp, bg: "bg-emerald-50", text: "text-emerald-600", pill: "bg-emerald-100 text-emerald-700" },
  Lifestyle: { icon: Sofa, bg: "bg-purple-50", text: "text-purple-600", pill: "bg-purple-100 text-purple-700" },
  General: { icon: Users, bg: "bg-slate-100", text: "text-slate-600", pill: "bg-slate-100 text-slate-700" },
};

function categoryStyle(category) {
  return CATEGORY_STYLES[category] || CATEGORY_STYLES.General;
}

function formatMonthYear(dateString) {
  if (!dateString) return "—";
  const date = new Date(dateString);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleDateString(undefined, { month: "short", year: "numeric" });
}

export default function CommunitiesContent({ onOpenChat }) {
  const queryClient = useQueryClient();
  const [searchQuery, setSearchQuery] = useState("");
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newCommunity, setNewCommunity] = useState({ name: "", topic: "", category: "General" });
  const [leaveTarget, setLeaveTarget] = useState(null);
  const [showAllMine, setShowAllMine] = useState(false);
  const [showAllDiscover, setShowAllDiscover] = useState(false);
  const [categoryFilter, setCategoryFilter] = useState("All");
  const [showFilterMenu, setShowFilterMenu] = useState(false);

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
      setNewCommunity({ name: "", topic: "", category: "General" });
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

  const filteredSuggested = suggestedCommunities.filter((community) => {
    const matchesSearch =
      community.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      community.topic?.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCategory = categoryFilter === "All" || community.category === categoryFilter;
    return matchesSearch && matchesCategory;
  });

  const myCommunities = filteredCommunities.filter((c) =>
    c.members?.some(m => String(m._id || m) === String(authUser?._id))
  );

  const visibleMyCommunities = showAllMine ? myCommunities : myCommunities.slice(0, 4);
  const visibleDiscoverCommunities = showAllDiscover ? filteredSuggested : filteredSuggested.slice(0, 8);

  return (
    <div className="h-full">
      {/* Header */}
      <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Communities</h1>
          <p className="text-sm text-slate-500">Join groups and connect with people who share your interests.</p>
        </div>
        <button
          onClick={() => setShowCreateModal(true)}
          className="flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-indigo-700 transition-colors"
        >
          <Plus size={18} />
          <span>Create Community</span>
        </button>
      </div>

      {/* Search + Filter */}
      <div className="mb-6 flex flex-col gap-2 sm:flex-row">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={20} />
          <input
            type="text"
            placeholder="Search communities..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full rounded-lg border border-slate-200 pl-10 pr-4 py-2.5 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
          />
        </div>
        <div className="relative shrink-0">
          <button
            type="button"
            onClick={() => setShowFilterMenu((prev) => !prev)}
            className="flex items-center gap-2 rounded-lg border border-slate-200 px-4 py-2.5 text-sm font-medium text-slate-600 hover:bg-slate-50 transition-colors"
          >
            <Filter size={16} />
            {categoryFilter === "All" ? "Filter" : categoryFilter}
            <ChevronDown size={14} className={showFilterMenu ? "rotate-180 transition-transform" : "transition-transform"} />
          </button>
          {showFilterMenu ? (
            <div className="absolute right-0 top-full z-20 mt-2 w-44 rounded-lg border border-slate-200 bg-white py-1 shadow-lg">
              {["All", ...CATEGORY_OPTIONS].map((option) => (
                <button
                  key={option}
                  type="button"
                  onClick={() => {
                    setCategoryFilter(option);
                    setShowFilterMenu(false);
                  }}
                  className={`flex w-full items-center px-3 py-2 text-left text-sm hover:bg-slate-50 ${
                    categoryFilter === option ? "font-semibold text-indigo-600" : "text-slate-700"
                  }`}
                >
                  {option}
                </button>
              ))}
            </div>
          ) : null}
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
        <div className="mb-10">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="flex items-center gap-2 text-lg font-semibold text-slate-900">
              My Communities
              <span className="inline-flex size-5 items-center justify-center rounded-full bg-indigo-100 text-xs font-bold text-indigo-700">
                {myCommunities.length}
              </span>
            </h2>
            {myCommunities.length > 4 ? (
              <button
                type="button"
                onClick={() => setShowAllMine((prev) => !prev)}
                className="flex items-center gap-1 text-sm font-medium text-indigo-600 hover:text-indigo-700"
              >
                {showAllMine ? "Show less" : "View all"}
                <ChevronRight size={16} className={showAllMine ? "rotate-90 transition-transform" : "transition-transform"} />
              </button>
            ) : null}
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            {visibleMyCommunities.map((community) => (
              <MyCommunityCard
                key={community._id}
                community={community}
                onChat={() => handleOpenChat(community)}
                onLeave={() => handleLeaveCommunity(community)}
              />
            ))}
          </div>
        </div>
      )}

      {/* Discover Communities */}
      <div>
        <div className="mb-1 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-slate-900">Discover Communities</h2>
          {filteredSuggested.length > 8 ? (
            <button
              type="button"
              onClick={() => setShowAllDiscover((prev) => !prev)}
              className="flex items-center gap-1 text-sm font-medium text-indigo-600 hover:text-indigo-700"
            >
              {showAllDiscover ? "Show less" : "View all"}
              <ChevronRight size={16} className={showAllDiscover ? "rotate-90 transition-transform" : "transition-transform"} />
            </button>
          ) : null}
        </div>
        <p className="mb-4 text-sm text-slate-500">Find and join communities that match your interests.</p>

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
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {visibleDiscoverCommunities.map((community) => (
              <DiscoverCommunityCard
                key={community._id}
                community={community}
                onJoin={handleJoinCommunity}
              />
            ))}
          </div>
        )}
      </div>

      {/* Info banner */}
      <div className="mt-10 grid gap-6 rounded-xl bg-slate-50 p-6 sm:grid-cols-3">
        <div className="flex items-start gap-3">
          <div className="grid size-10 shrink-0 place-items-center rounded-lg bg-indigo-100 text-indigo-600">
            <Handshake size={20} />
          </div>
          <div>
            <p className="text-sm font-semibold text-slate-900">Connect & Collaborate</p>
            <p className="text-xs text-slate-500">Build meaningful connections with like-minded people.</p>
          </div>
        </div>
        <div className="flex items-start gap-3">
          <div className="grid size-10 shrink-0 place-items-center rounded-lg bg-emerald-100 text-emerald-600">
            <Sparkles size={20} />
          </div>
          <div>
            <p className="text-sm font-semibold text-slate-900">Share Knowledge</p>
            <p className="text-xs text-slate-500">Exchange ideas and learn from community members.</p>
          </div>
        </div>
        <div className="flex items-start gap-3">
          <div className="grid size-10 shrink-0 place-items-center rounded-lg bg-amber-100 text-amber-600">
            <Award size={20} />
          </div>
          <div>
            <p className="text-sm font-semibold text-slate-900">Grow Together</p>
            <p className="text-xs text-slate-500">Help each other succeed and achieve your goals.</p>
          </div>
        </div>
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
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">Category</label>
                <select
                  value={newCommunity.category}
                  onChange={(e) => setNewCommunity({ ...newCommunity, category: e.target.value })}
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                >
                  {CATEGORY_OPTIONS.map((option) => (
                    <option key={option} value={option}>
                      {option}
                    </option>
                  ))}
                </select>
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

function CommunityAvatar({ name, className }) {
  const initial = (name || "?").trim().charAt(0).toUpperCase() || "?";
  return (
    <div
      className={`grid place-items-center rounded-2xl border-4 border-white bg-gradient-to-br from-indigo-500 to-purple-600 font-bold text-white shadow-md ${className}`}
    >
      {initial}
    </div>
  );
}

function MyCommunityCard({ community, onChat, onLeave }) {
  const queryClient = useQueryClient();
  const authUser = queryClient.getQueryData(["authUser"])?.data?.user;
  const [showMenu, setShowMenu] = useState(false);

  const isCreator = String(community.creator?._id || community.creator) === String(authUser?._id);
  const isModerator = (community.moderators || []).some((m) => String(m?._id || m) === String(authUser?._id));
  const memberCount = community.members?.length || 0;

  return (
    <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm transition-all hover:shadow-md">
      <div className="relative h-20 bg-gradient-to-r from-indigo-500 to-purple-600">
        <div className="absolute right-3 top-3">
          <button
            type="button"
            onClick={() => setShowMenu((prev) => !prev)}
            className="rounded-full p-1 text-white/90 hover:bg-white/20"
            aria-label="Community options"
          >
            <MoreVertical size={18} />
          </button>
          {showMenu ? (
            <div className="absolute right-0 top-full z-20 mt-1 w-40 rounded-lg border border-slate-200 bg-white py-1 shadow-lg">
              <button
                type="button"
                onClick={() => {
                  setShowMenu(false);
                  onChat();
                }}
                className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-slate-700 hover:bg-slate-50"
              >
                <MessageCircle size={14} />
                Open chat
              </button>
              {!isCreator && (
                <button
                  type="button"
                  onClick={() => {
                    setShowMenu(false);
                    onLeave();
                  }}
                  className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-red-600 hover:bg-red-50"
                >
                  <LogOut size={14} />
                  Leave community
                </button>
              )}
            </div>
          ) : null}
        </div>
      </div>

      <div className="px-4 pb-4">
        <div className="-mt-8 mb-2 flex items-end gap-3">
          <CommunityAvatar name={community.name} className="size-16 text-xl" />
          {isCreator ? (
            <Crown className="mb-1 text-amber-500" size={18} aria-label="Creator" />
          ) : isModerator ? (
            <Shield className="mb-1 text-blue-500" size={18} aria-label="Moderator" />
          ) : null}
        </div>

        <h3 className="truncate font-semibold text-slate-900">{community.name}</h3>
        <p className="mt-0.5 line-clamp-1 text-sm text-slate-500">{community.topic}</p>

        <div className="mt-3 flex items-center gap-4 text-xs text-slate-500">
          <div className="flex items-center gap-1">
            <Users size={14} />
            <span>{memberCount} Members</span>
          </div>
          <div className="flex items-center gap-1">
            <MessageSquare size={14} />
            <span>{community.messageCount || 0} Messages</span>
          </div>
          <div className="flex items-center gap-1">
            <Calendar size={14} />
            <span>Created {formatMonthYear(community.createdAt)}</span>
          </div>
        </div>

        <button
          onClick={onChat}
          className="mt-4 flex w-full items-center justify-center gap-2 rounded-lg border border-indigo-600 px-3 py-2 text-sm font-semibold text-indigo-600 hover:bg-indigo-50 transition-colors"
        >
          <MessageCircle size={16} />
          Chat Now
        </button>
      </div>
    </div>
  );
}

function DiscoverCommunityCard({ community, onJoin }) {
  const style = categoryStyle(community.category);
  const Icon = style.icon;
  const memberCount = community.memberCount ?? community.members?.length ?? 0;

  return (
    <div className="flex flex-col rounded-xl border border-slate-200 bg-white p-4 shadow-sm transition-all hover:shadow-md">
      <div className={`mb-3 grid size-12 place-items-center rounded-xl ${style.bg} ${style.text}`}>
        <Icon size={22} />
      </div>
      <h3 className="font-semibold text-slate-900">{community.name}</h3>
      <p className="mt-0.5 line-clamp-2 text-sm text-slate-500">{community.topic}</p>

      <p className="mt-3 text-xs text-slate-500">{memberCount} members</p>
      <span className={`mt-2 inline-block w-fit rounded-full px-2.5 py-1 text-[11px] font-semibold ${style.pill}`}>
        {community.category || "General"}
      </span>

      <button
        onClick={() => onJoin(community._id)}
        className="mt-4 flex items-center justify-center gap-2 rounded-lg border border-indigo-600 px-3 py-2 text-sm font-semibold text-indigo-600 hover:bg-indigo-50 transition-colors"
      >
        <UserPlus size={16} />
        Join Community
      </button>
    </div>
  );
}
