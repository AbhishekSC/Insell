import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Heart,
  MessageSquare,
  Bookmark,
  UserPlus,
  Clock,
  Filter,
  RefreshCw,
  MapPin,
  Building2,
  IndianRupee,
} from "lucide-react";
import toast from "react-hot-toast";
import axiosInstance from "../lib/axios";
import UserAvatar from "./UserAvatar";

const EMPTY_LIST = [];

function ActivityItem({ activity, onNavigateToPost, isOwnActivity = false }) {
  const getActivityIcon = () => {
    switch (activity.type) {
      case "like":
        return <Heart className="size-4 text-red-500 fill-red-500" />;
      case "comment":
        return <MessageSquare className="size-4 text-blue-500" />;
      case "save":
        return <Bookmark className="size-4 text-indigo-500 fill-indigo-500" />;
      case "connection_request":
        return <UserPlus className="size-4 text-green-500" />;
      case "connection_accepted":
        return <UserPlus className="size-4 text-emerald-500" />;
      default:
        return <Clock className="size-4 text-slate-400" />;
    }
  };

  const getActivityText = () => {
    const actorName = activity.actor?.fullName || activity.actorName || "Someone";
    const messageText = activity.actualMessage || activity.message || activity.commentText || "";
    
    // Handle own activity (current user's actions)
    if (isOwnActivity) {
      switch (activity.type) {
        case "like":
          return "You liked this property";
        case "comment":
          if (messageText) {
            return `You commented: "${messageText.substring(0, 50)}${messageText.length > 50 ? "..." : ""}"`;
          }
          return "You commented on this property";
        case "save":
          return "You saved this property";
        case "connection_request":
          return activity.status === "accepted" ? "You accepted this connection request" : "You sent a connection request";
        case "connection_accepted":
          return "Your connection request was accepted";
        default:
          return "Your activity";
      }
    }
    
    // Handle incoming notifications (from other users)
    switch (activity.type) {
      case "property_like":
        return `${actorName} liked your property`;
      case "comment":
        if (messageText) {
          return `${actorName} commented: "${messageText.substring(0, 50)}${messageText.length > 50 ? "..." : ""}"`;
        }
        return `${actorName} commented on your property`;
      case "property_save":
        return `${actorName} saved your property`;
      case "message_request":
        return `${actorName} sent you a message about your property`;
      case "connection_request":
        return `${actorName} sent you a connection request`;
      case "connection_accepted":
        return `${actorName} accepted your connection request`;
      default:
        return activity.message || "Activity";
    }
  };

  const formatDateTime = (dateString) => {
    if (!dateString) return "Just now";
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now - date;
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return "Just now";
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    
    return date.toLocaleDateString('en-US', { 
      month: 'short', 
      day: 'numeric',
      year: date.getFullYear() !== now.getFullYear() ? 'numeric' : undefined
    });
  };

  return (
    <div 
      className="flex gap-3 px-4 py-3 hover:bg-slate-50 cursor-pointer transition"
      onClick={() => activity.postId && onNavigateToPost(activity.postId)}
    >
      <div className="flex-shrink-0 mt-1">
        {getActivityIcon()}
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0 flex-1">
            {/* Show actor avatar for incoming notifications */}
            {activity.actor && (
              <div 
                className="mb-2 flex items-center gap-2 cursor-pointer hover:underline"
                onClick={(e) => {
                  e.stopPropagation();
                  window.location.href = `/users/${activity.actor._id}`;
                }}
              >
                <UserAvatar 
                  src={activity.actor.profilePic} 
                  name={activity.actor.fullName} 
                  sizeClass="size-6" 
                  userId={activity.actor._id} 
                />
                <span className="text-xs font-medium text-slate-600">{activity.actor.fullName}</span>
              </div>
            )}
            <p className="text-sm text-slate-700">{getActivityText()}</p>
            {activity.post && (
              <div 
                className="mt-2 flex items-center gap-2 rounded-lg bg-slate-50 p-2 cursor-pointer hover:bg-slate-100 transition"
                onClick={(e) => {
                  e.stopPropagation();
                  onNavigateToPost(activity.post._id);
                }}
              >
                {activity.post.mediaUrls?.[0] && (
                  <img 
                    src={activity.post.mediaUrls[0]} 
                    alt="Post" 
                    className="size-12 rounded-lg object-cover"
                  />
                )}
                <div className="min-w-0 flex-1">
                  <p className="truncate text-xs font-semibold text-slate-800">{activity.post.title}</p>
                  <div className="flex items-center gap-1 text-xs text-slate-500">
                    <IndianRupee className="size-3" />
                    <span>{activity.post.price?.toLocaleString()}</span>
                    <span className="mx-1">·</span>
                    <MapPin className="size-3" />
                    <span>{activity.post.city}</span>
                  </div>
                </div>
              </div>
            )}
            {activity.targetUser && (
              <div className="mt-2 flex items-center gap-2 rounded-lg bg-slate-50 p-2">
                <UserAvatar 
                  src={activity.targetUser.profilePic} 
                  name={activity.targetUser.fullName} 
                  sizeClass="size-8" 
                  userId={activity.targetUser._id} 
                />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-xs font-semibold text-slate-800">{activity.targetUser.fullName}</p>
                  <p className="text-xs text-slate-500">{activity.targetUser.activeRole || "User"}</p>
                </div>
              </div>
            )}
          </div>
          <span className="flex-shrink-0 text-xs text-slate-400">
            {formatDateTime(activity.createdAt)}
          </span>
        </div>
      </div>
    </div>
  );
}

export default function ActivityContent({ onNavigateToPost }) {
  const queryClient = useQueryClient();
  const [activeFilter, setActiveFilter] = useState("all");
  const [expandedSections, setExpandedSections] = useState({ likes: true, comments: true, saved: true, connections: true });

  // Fetch user's activity
  const { data: activityData, isLoading: activityLoading, refetch: refetchActivity } = useQuery({
    queryKey: ["userActivity"],
    queryFn: async () => {
      const response = await axiosInstance.get("/users/activity");
      return response.data?.data || { likes: [], comments: [], saved: [], connections: [] };
    },
    refetchInterval: 30000,
  });

  // Fetch incoming notifications (from other users)
  const { data: notificationsData, isLoading: notificationsLoading, refetch: refetchNotifications } = useQuery({
    queryKey: ["notifications"],
    queryFn: async () => {
      const response = await axiosInstance.get("/notifications");
      return response.data?.data?.notifications || [];
    },
    refetchInterval: 15000,
  });

  // Fetch unread notifications count
  const { data: unreadCountData } = useQuery({
    queryKey: ["notificationsCount"],
    queryFn: async () => {
      const response = await axiosInstance.get("/notifications?unreadOnly=true");
      return response.data?.data?.unreadCount || 0;
    },
    refetchInterval: 15000,
  });

  // Mark all notifications as read
  const { mutate: markAllAsRead } = useMutation({
    mutationFn: async () => {
      await axiosInstance.patch("/notifications/read-all");
    },
    onSuccess: () => {
      toast.success("All notifications marked as read");
      queryClient.invalidateQueries({ queryKey: ["notificationsCount"] });
      queryClient.invalidateQueries({ queryKey: ["notifications"] });
      queryClient.invalidateQueries({ queryKey: ["activityNotifications"] });
      queryClient.invalidateQueries({ queryKey: ["messageRequests"] });
    },
    onError: () => {
      toast.error("Failed to mark notifications as read");
    },
  });

  const activities = activityData || EMPTY_LIST;
  const likes = activities.likes || EMPTY_LIST;
  const comments = activities.comments || EMPTY_LIST;
  const saved = activities.saved || EMPTY_LIST;
  const connections = activities.connections || EMPTY_LIST;
  const notifications = notificationsData || EMPTY_LIST;
  const unreadCount = unreadCountData || 0;

  // Categorize incoming notifications by type
  const incomingLikes = notifications.filter(n => n.type === 'property_like').map(n => ({
    ...n,
    type: 'like',
    isOwnActivity: false
  }));
  
  const incomingComments = notifications.filter(n => n.type === 'comment').map(n => ({
    ...n,
    type: 'comment',
    isOwnActivity: false
  }));
  
  const incomingSaves = notifications.filter(n => n.type === 'property_save').map(n => ({
    ...n,
    type: 'save',
    isOwnActivity: false
  }));

  // Merge own activity with incoming notifications by type
  const allLikes = [
    ...likes.map(item => ({ ...item, type: "like", isOwnActivity: true })),
    ...incomingLikes
  ].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

  const allComments = [
    ...comments.map(item => ({ ...item, type: "comment", isOwnActivity: true })),
    ...incomingComments
  ].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

  const allSaved = [
    ...saved.map(item => ({ ...item, type: "save", isOwnActivity: true })),
    ...incomingSaves
  ].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

  const allConnections = connections.map(item => ({ 
    ...item, 
    type: item.status === "accepted" ? "connection_accepted" : "connection_request",
    isOwnActivity: true 
  })).sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

  // Combine all for the "All" filter and sort by time
  const allActivities = [
    ...allLikes,
    ...allComments,
    ...allSaved,
    ...allConnections,
  ].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

  const filteredActivities = activeFilter === "all" 
    ? allActivities 
    : allActivities.filter(activity => activity.type === activeFilter);

  const refreshActivity = () => {
    refetchActivity();
    queryClient.invalidateQueries({ queryKey: ["notificationsCount"] });
  };

  const toggleSection = (section) => {
    setExpandedSections(prev => ({ ...prev, [section]: !prev[section] }));
  };

  if (activityLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-center">
          <RefreshCw className="mx-auto size-8 animate-spin text-slate-400" />
          <p className="mt-2 text-sm text-slate-500">Loading activity...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="pb-6">
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">Activity</h1>
          <p className="mt-1 text-sm text-slate-500">Your recent activity and notifications</p>
        </div>
        <button 
          type="button" 
          onClick={refreshActivity}
          className="btn btn-ghost btn-sm h-9 rounded-lg text-slate-600 hover:bg-white"
        >
          <RefreshCw className="size-4" />
          Refresh
        </button>
      </div>

      {/* Notification count banner */}
      {unreadCount > 0 && (
        <div className="mb-4 rounded-xl border border-indigo-200 bg-indigo-50 p-4">
          <div className="flex items-center gap-3">
            <div className="flex size-10 items-center justify-center rounded-full bg-indigo-600 text-white">
              <span className="text-sm font-bold">{unreadCount}</span>
            </div>
            <div className="flex-1">
              <p className="text-sm font-semibold text-indigo-900">You have {unreadCount} unread notification{unreadCount > 1 ? "s" : ""}</p>
              <p className="text-xs text-indigo-700">Check your connections section for new requests</p>
            </div>
            <button
              type="button"
              className="btn btn-xs border-none bg-indigo-600 text-white hover:bg-indigo-500"
              onClick={() => markAllAsRead()}
            >
              Mark all as read
            </button>
          </div>
        </div>
      )}

      {/* Filter tabs */}
      <div className="mb-4 flex flex-wrap gap-2">
        {[
          { id: "all", label: "All", count: allActivities.length },
          { id: "like", label: "Likes", count: allLikes.length },
          { id: "comment", label: "Comments", count: allComments.length },
          { id: "save", label: "Saved", count: allSaved.length },
          { id: "connection_request", label: "Connections", count: allConnections.length },
        ].map((filter) => (
          <button
            key={filter.id}
            type="button"
            className={`btn btn-sm rounded-full border-none ${
              activeFilter === filter.id
                ? "bg-indigo-600 text-white"
                : "bg-slate-100 text-slate-700 hover:bg-slate-200"
            }`}
            onClick={() => setActiveFilter(filter.id)}
          >
            {filter.label}
            {filter.count > 0 && (
              <span className="ml-1 rounded-full bg-white/20 px-1.5 py-0.5 text-xs">
                {filter.count}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Activity sections - based on filter */}
      <div className="space-y-6">
        {/* All Activity - single chronological list */}
        {activeFilter === "all" && filteredActivities.length > 0 && (
          <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-[0_2px_10px_rgba(15,23,42,0.035)]">
            <div className="divide-y divide-slate-100">
              {filteredActivities.map((activity) => (
                <ActivityItem 
                  key={activity._id} 
                  activity={activity} 
                  onNavigateToPost={onNavigateToPost}
                  isOwnActivity={activity.isOwnActivity}
                />
              ))}
            </div>
          </div>
        )}

        {/* Individual filter views */}
        {activeFilter === "like" && allLikes.length > 0 && (
          <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-[0_2px_10px_rgba(15,23,42,0.035)]">
            <div className="divide-y divide-slate-100">
              {allLikes.map((like) => (
                <ActivityItem 
                  key={like._id} 
                  activity={like} 
                  onNavigateToPost={onNavigateToPost}
                  isOwnActivity={like.isOwnActivity}
                />
              ))}
            </div>
          </div>
        )}

        {activeFilter === "comment" && allComments.length > 0 && (
          <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-[0_2px_10px_rgba(15,23,42,0.035)]">
            <div className="divide-y divide-slate-100">
              {allComments.map((comment) => (
                <ActivityItem 
                  key={comment._id} 
                  activity={comment} 
                  onNavigateToPost={onNavigateToPost}
                  isOwnActivity={comment.isOwnActivity}
                />
              ))}
            </div>
          </div>
        )}

        {activeFilter === "save" && allSaved.length > 0 && (
          <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-[0_2px_10px_rgba(15,23,42,0.035)]">
            <div className="divide-y divide-slate-100">
              {allSaved.map((save) => (
                <ActivityItem 
                  key={save._id} 
                  activity={save} 
                  onNavigateToPost={onNavigateToPost}
                  isOwnActivity={save.isOwnActivity}
                />
              ))}
            </div>
          </div>
        )}

        {activeFilter === "connection_request" && allConnections.length > 0 && (
          <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-[0_2px_10px_rgba(15,23,42,0.035)]">
            <div className="divide-y divide-slate-100">
              {allConnections.map((connection) => (
                <ActivityItem 
                  key={connection._id} 
                  activity={connection} 
                  onNavigateToPost={onNavigateToPost}
                  isOwnActivity={connection.isOwnActivity}
                />
              ))}
            </div>
          </div>
        )}

        {/* Empty state */}
        {filteredActivities.length === 0 && (
          <div className="rounded-2xl border border-slate-200 bg-white p-8 text-center">
            <Clock className="mx-auto size-12 text-slate-300" />
            <p className="mt-3 text-sm font-semibold text-slate-800">No activity yet</p>
            <p className="mt-1 text-xs text-slate-500">Start liking, commenting, and saving posts to see your activity here</p>
          </div>
        )}
      </div>
    </div>
  );
}
