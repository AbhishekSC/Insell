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
  Trash2,
  Users,
  TrendingUp,
  Check,
  XCircle,
  Star,
  Video,
  Megaphone,
  ShieldAlert,
  Flag,
} from "lucide-react";
import toast from "react-hot-toast";
import axiosInstance from "../lib/axios";
import UserAvatar from "./UserAvatar";
import ReviewModal from "./ReviewModal";

const EMPTY_LIST = [];

function ActivityItem({ activity, onNavigateToPost, isOwnActivity = false, onRespondOffer, onLeaveReview }) {
  const getActivityIcon = () => {
    switch (activity.type) {
      case "like":
        return <Heart className="size-4 text-error fill-error" />;
      case "comment":
        return <MessageSquare className="size-4 text-info" />;
      case "save":
        return <Bookmark className="size-4 text-primary fill-primary" />;
      case "connection_request":
        return <UserPlus className="size-4 text-success" />;
      case "connection_accepted":
        return <UserPlus className="size-4 text-success" />;
      case "circle_invite":
        return <Users className="size-4 text-primary" />;
      case "circle_deleted":
        return <Trash2 className="size-4 text-error" />;
      case "circle_join_request_result":
      case "circle_member_add_request_result":
        return <Users className="size-4 text-success" />;
      case "circle_member_joined":
        return <UserPlus className="size-4 text-success" />;
      case "circle_member_left":
        return <Users className="size-4 text-base-content/50" />;
      case "circle_call_started":
        return <Video className="size-4 text-primary" />;
      case "message_request":
        return <MessageSquare className="size-4 text-primary" />;
      case "price_drop":
        return <IndianRupee className="size-4 text-success" />;
      case "offer_received":
      case "offer_countered":
        return <TrendingUp className="size-4 text-primary" />;
      case "offer_accepted":
        return <Check className="size-4 text-success" />;
      case "offer_declined":
        return <XCircle className="size-4 text-error" />;
      case "review_received":
        return <Star className="size-4 text-warning" />;
      case "admin_announcement":
        return <Megaphone className="size-4 text-primary" />;
      case "post_blocked":
      case "post_reported":
        return <ShieldAlert className="size-4 text-error" />;
      case "post_unblocked":
      case "post_report_resolved":
        return <Flag className="size-4 text-success" />;
      default:
        return <Clock className="size-4 text-base-content/50" />;
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
      // Everything below already has a full, ready-to-show sentence built
      // server-side (NotificationService.send's `message`), so the default
      // case covers them — these explicit cases exist only where a nicer
      // actor-aware phrasing is worth it over the raw message.
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
      className="flex gap-3 px-4 py-3 hover:bg-base-200 cursor-pointer transition"
      onClick={() => activity.post?._id && onNavigateToPost(activity.post._id)}
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
                <span className="text-xs font-medium text-base-content/70">{activity.actor.fullName}</span>
              </div>
            )}
            <p className="text-sm text-base-content">{getActivityText()}</p>
            {activity.post && (
              <div 
                className="mt-2 flex items-center gap-2 rounded-lg bg-base-200 p-2 cursor-pointer hover:bg-base-200 transition"
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
                  <p className="truncate text-xs font-semibold text-base-content">{activity.post.title}</p>
                  <div className="flex items-center gap-1 text-xs text-base-content/60">
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
              <div className="mt-2 flex items-center gap-2 rounded-lg bg-base-200 p-2">
                <UserAvatar 
                  src={activity.targetUser.profilePic} 
                  name={activity.targetUser.fullName} 
                  sizeClass="size-8" 
                  userId={activity.targetUser._id} 
                />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-xs font-semibold text-base-content">{activity.targetUser.fullName}</p>
                  <p className="text-xs text-base-content/60">{activity.targetUser.activeRole || "User"}</p>
                </div>
              </div>
            )}
            {(activity.type === "offer_received" || activity.type === "offer_countered") &&
              ["pending", "countered"].includes(activity.offer?.status) && (
              <div className="mt-3 flex gap-2">
                <button
                  type="button"
                  className="btn btn-xs border-none bg-success text-white hover:bg-success"
                  onClick={(e) => {
                    e.stopPropagation();
                    onRespondOffer?.({ offerId: activity.offer._id, action: "accept" });
                  }}
                >
                  <Check className="size-3" />
                  Accept
                </button>
                <button
                  type="button"
                  className="btn btn-xs border border-base-300 bg-base-100 text-base-content hover:bg-base-200"
                  onClick={(e) => {
                    e.stopPropagation();
                    onRespondOffer?.({ offerId: activity.offer._id, action: "decline" });
                  }}
                >
                  <XCircle className="size-3" />
                  Decline
                </button>
              </div>
            )}
            {activity.type === "offer_accepted" && activity.offer?.status === "accepted" && !activity.offer?.reviewedByMe && (
              <button
                type="button"
                className="mt-3 btn btn-xs border-none bg-primary text-white hover:bg-primary"
                onClick={(e) => {
                  e.stopPropagation();
                  onLeaveReview?.({ offerId: activity.offer._id, revieweeName: activity.actor?.fullName });
                }}
              >
                <Star className="size-3" />
                Leave a review
              </button>
            )}
          </div>
          <span className="flex-shrink-0 text-xs text-base-content/50">
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
  const [reviewModal, setReviewModal] = useState(null); // { offerId, revieweeName }

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
  const { data: notificationsData } = useQuery({
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

  const respondOfferMutation = useMutation({
    mutationFn: async ({ offerId, action }) => {
      await axiosInstance.patch(`/offers/${offerId}`, { action, requestId: crypto.randomUUID() });
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ["notifications"] });
      toast.success(variables.action === "accept" ? "Offer accepted!" : "Offer declined");
    },
    onError: (error) => {
      toast.error(error?.response?.data?.message || "Failed to respond to offer");
    },
  });

  const submitReviewMutation = useMutation({
    mutationFn: async ({ offerId, rating, comment }) => {
      await axiosInstance.post(`/reviews/offers/${offerId}/reviews`, { rating, comment });
    },
    onSuccess: () => {
      toast.success("Review submitted — thanks!");
      setReviewModal(null);
      queryClient.invalidateQueries({ queryKey: ["notifications"] });
    },
    onError: (error) => {
      if (error?.response?.status === 409) {
        setReviewModal(null);
        queryClient.invalidateQueries({ queryKey: ["notifications"] });
        return;
      }
      toast.error(error?.response?.data?.message || "Failed to submit review");
    },
  });

  const activities = activityData || EMPTY_LIST;
  const likes = activities.likes || EMPTY_LIST;
  const comments = activities.comments || EMPTY_LIST;
  const saved = activities.saved || EMPTY_LIST;
  const connections = activities.connections || EMPTY_LIST;
  // Notification docs carry the post as `propertyPost` (populated by
  // GET /notifications), but the property-preview card below reads `post` —
  // the same field name the own-activity endpoint already uses. Without this
  // normalization, every notification-derived item (comments/likes/saves
  // from others, offers, price drops, reviews) silently had no clickable
  // post attached at all.
  const notifications = (notificationsData || EMPTY_LIST).map((n) => ({
    ...n,
    post: n.propertyPost || null,
  }));
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

  const COMMUNITY_NOTIFICATION_TYPES = new Set([
    "circle_invite",
    "circle_deleted",
    "circle_join_request_result",
    "circle_member_add_request_result",
  ]);
  const incomingCommunityEvents = notifications
    .filter(n => COMMUNITY_NOTIFICATION_TYPES.has(n.type))
    .map(n => ({ ...n, isOwnActivity: false }));

  // Catch-all for every notification type not already bucketed above
  // (offers, price drops, reviews, message requests, moderation notices,
  // announcements, etc.) — without this, any new Notification type added
  // later shows up in the bell dropdown but silently never appears here,
  // which is exactly what happened before this fix: message_request had
  // render logic below but was never actually included in any list.
  const CATEGORIZED_TYPES = new Set([
    "property_like",
    "comment",
    "property_save",
    ...COMMUNITY_NOTIFICATION_TYPES,
  ]);
  const incomingOtherEvents = notifications
    .filter(n => !CATEGORIZED_TYPES.has(n.type))
    .map(n => ({ ...n, isOwnActivity: false }));

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
    ...incomingCommunityEvents,
    ...incomingOtherEvents,
  ].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

  const filteredActivities = activeFilter === "all"
    ? allActivities
    : allActivities.filter(activity => activity.type === activeFilter);

  // filteredActivities only matches a single exact `type`, which breaks for
  // tabs that bucket several types together (Communities, Updates) — used
  // just for the empty-state check below, since each tab's own visible list
  // above is already rendered from its correct source array.
  const visibleCountByFilter = {
    all: allActivities.length,
    like: allLikes.length,
    comment: allComments.length,
    save: allSaved.length,
    connection_request: allConnections.length,
    circle_invite: incomingCommunityEvents.length,
    updates: incomingOtherEvents.length,
  };
  const visibleCount = visibleCountByFilter[activeFilter] ?? filteredActivities.length;

  const refreshActivity = () => {
    refetchActivity();
    queryClient.invalidateQueries({ queryKey: ["notificationsCount"] });
  };

  if (activityLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-center">
          <RefreshCw className="mx-auto size-8 animate-spin text-base-content/50" />
          <p className="mt-2 text-sm text-base-content/60">Loading activity...</p>
        </div>
      </div>
    );
  }

  return (
    <>
    <div className="pb-6">
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-base-content">Activity</h1>
          <p className="mt-1 text-sm text-base-content/60">Your recent activity and notifications</p>
        </div>
        <button 
          type="button" 
          onClick={refreshActivity}
          className="btn btn-ghost btn-sm h-9 rounded-lg text-base-content/70 hover:bg-base-100"
        >
          <RefreshCw className="size-4" />
          Refresh
        </button>
      </div>

      {/* Notification count banner */}
      {unreadCount > 0 && (
        <div className="mb-4 rounded-xl border border-primary/30 bg-primary/10 p-4">
          <div className="flex items-center gap-3">
            <div className="flex size-10 items-center justify-center rounded-full bg-primary text-white">
              <span className="text-sm font-bold">{unreadCount}</span>
            </div>
            <div className="flex-1">
              <p className="text-sm font-semibold text-primary">You have {unreadCount} unread notification{unreadCount > 1 ? "s" : ""}</p>
              <p className="text-xs text-primary">Check your connections section for new requests</p>
            </div>
            <button
              type="button"
              className="btn btn-xs border-none bg-primary text-white hover:bg-primary"
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
          { id: "circle_invite", label: "Communities", count: incomingCommunityEvents.length },
          { id: "updates", label: "Updates", count: incomingOtherEvents.length },
        ].map((filter) => (
          <button
            key={filter.id}
            type="button"
            className={`btn btn-sm rounded-full border-none ${
              activeFilter === filter.id
                ? "bg-primary text-white"
                : "bg-base-200 text-base-content hover:bg-base-300"
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
          <div className="overflow-hidden rounded-2xl border border-base-300 bg-base-100 shadow-[0_2px_10px_rgba(15,23,42,0.035)]">
            <div className="divide-y divide-base-300">
              {filteredActivities.map((activity) => (
                <ActivityItem
                  key={activity._id}
                  activity={activity}
                  onNavigateToPost={onNavigateToPost}
                  isOwnActivity={activity.isOwnActivity}
                  onRespondOffer={respondOfferMutation.mutate}
                  onLeaveReview={setReviewModal}
                />
              ))}
            </div>
          </div>
        )}

        {/* Individual filter views */}
        {activeFilter === "like" && allLikes.length > 0 && (
          <div className="overflow-hidden rounded-2xl border border-base-300 bg-base-100 shadow-[0_2px_10px_rgba(15,23,42,0.035)]">
            <div className="divide-y divide-base-300">
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
          <div className="overflow-hidden rounded-2xl border border-base-300 bg-base-100 shadow-[0_2px_10px_rgba(15,23,42,0.035)]">
            <div className="divide-y divide-base-300">
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
          <div className="overflow-hidden rounded-2xl border border-base-300 bg-base-100 shadow-[0_2px_10px_rgba(15,23,42,0.035)]">
            <div className="divide-y divide-base-300">
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
          <div className="overflow-hidden rounded-2xl border border-base-300 bg-base-100 shadow-[0_2px_10px_rgba(15,23,42,0.035)]">
            <div className="divide-y divide-base-300">
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

        {activeFilter === "circle_invite" && incomingCommunityEvents.length > 0 && (
          <div className="overflow-hidden rounded-2xl border border-base-300 bg-base-100 shadow-[0_2px_10px_rgba(15,23,42,0.035)]">
            <div className="divide-y divide-base-300">
              {incomingCommunityEvents.map((event) => (
                <ActivityItem
                  key={event._id}
                  activity={event}
                  onNavigateToPost={onNavigateToPost}
                  isOwnActivity={event.isOwnActivity}
                />
              ))}
            </div>
          </div>
        )}

        {activeFilter === "updates" && incomingOtherEvents.length > 0 && (
          <div className="overflow-hidden rounded-2xl border border-base-300 bg-base-100 shadow-[0_2px_10px_rgba(15,23,42,0.035)]">
            <div className="divide-y divide-base-300">
              {incomingOtherEvents.map((event) => (
                <ActivityItem
                  key={event._id}
                  activity={event}
                  onNavigateToPost={onNavigateToPost}
                  isOwnActivity={event.isOwnActivity}
                  onRespondOffer={respondOfferMutation.mutate}
                  onLeaveReview={setReviewModal}
                />
              ))}
            </div>
          </div>
        )}

        {/* Empty state */}
        {visibleCount === 0 && (
          <div className="rounded-2xl border border-base-300 bg-base-100 p-8 text-center">
            <Clock className="mx-auto size-12 text-base-content/40" />
            <p className="mt-3 text-sm font-semibold text-base-content">No activity yet</p>
            <p className="mt-1 text-xs text-base-content/60">Start liking, commenting, and saving posts to see your activity here</p>
          </div>
        )}
      </div>
    </div>

    <ReviewModal
      isOpen={Boolean(reviewModal)}
      revieweeName={reviewModal?.revieweeName}
      isPending={submitReviewMutation.isPending}
      onCancel={() => setReviewModal(null)}
      onSubmit={({ rating, comment }) => submitReviewMutation.mutate({ offerId: reviewModal.offerId, rating, comment })}
    />
    </>
  );
}
