import { useState } from "react";
import { Link, useNavigate } from "react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import axiosInstance from "../lib/axios";
import { Bell, X, Check, XCircle, User, Building2, IndianRupee, MapPin, MessageCircle, Calendar, Trash2, Heart, Bookmark, TrendingUp, Star } from "lucide-react";
import { toast } from "react-hot-toast";
import ReviewModal from "./ReviewModal";

// The actor's name is embedded inside the server-built `message` sentence
// ("X made an offer of...", "X commented on..."), not a separate field, so
// making just the name clickable means splitting the string around it
// rather than restructuring how the backend sends notifications.
function NotificationMessage({ notification, onNavigate }) {
  const { message, actor } = notification;
  if (!actor?._id || !actor?.fullName || !message?.includes(actor.fullName)) {
    return message || "";
  }
  const idx = message.indexOf(actor.fullName);
  const before = message.slice(0, idx);
  const after = message.slice(idx + actor.fullName.length);
  return (
    <>
      {before}
      <Link
        to={`/users/${actor._id}`}
        onClick={(e) => {
          e.stopPropagation();
          onNavigate?.();
        }}
        className="font-semibold text-primary hover:underline"
      >
        {actor.fullName}
      </Link>
      {after}
    </>
  );
}

export default function NotificationPanel({ isOpen, onClose }) {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [filterType, setFilterType] = useState("all");
  const [reviewModal, setReviewModal] = useState(null); // { offerId, revieweeName }

  const { data: notificationsData, isLoading } = useQuery({
    queryKey: ["notifications", filterType],
    queryFn: async () => {
      const params = filterType !== "all" ? { type: filterType } : {};
      const res = await axiosInstance.get("/notifications", { params });
      return res.data.data;
    },
    enabled: isOpen,
  });

  const notifications = notificationsData?.notifications || [];
  const unreadCount = notificationsData?.unreadCount || 0;

  const markAsReadMutation = useMutation({
    mutationFn: async (notificationId) => {
      await axiosInstance.patch(`/notifications/${notificationId}/read`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries(["notifications"]);
    },
  });

  const handleRequestMutation = useMutation({
    mutationFn: async ({ notificationId, action }) => {
      await axiosInstance.patch(`/notifications/${notificationId}/handle-request`, { action });
    },
    onSuccess: () => {
      queryClient.invalidateQueries(["notifications"]);
      toast.success("Request handled successfully");
    },
    onError: () => {
      toast.error("Failed to handle request");
    },
  });

  const respondOfferMutation = useMutation({
    mutationFn: async ({ offerId, action }) => {
      await axiosInstance.patch(`/offers/${offerId}`, { action, requestId: crypto.randomUUID() });
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries(["notifications"]);
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
      queryClient.invalidateQueries(["notifications"]);
    },
    onError: (error) => {
      if (error?.response?.status === 409) {
        setReviewModal(null);
        queryClient.invalidateQueries(["notifications"]);
        return;
      }
      toast.error(error?.response?.data?.message || "Failed to submit review");
    },
  });

  const deleteNotificationMutation = useMutation({
    mutationFn: async (notificationId) => {
      await axiosInstance.delete(`/notifications/${notificationId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries(["notifications"]);
    },
  });

  const markAllAsRead = async () => {
    try {
      await axiosInstance.patch("/notifications/read-all");
      queryClient.invalidateQueries(["notifications"]);
    } catch {
      toast.error("Failed to mark all as read");
    }
  };

  const getNotificationIcon = (type) => {
    switch (type) {
      case "property_contact":
      case "message_request":
        return <MessageCircle className="size-5 text-primary" />;
      case "property_like":
        return <Heart className="size-5 text-error" />;
      case "property_save":
        return <Bookmark className="size-5 text-primary" />;
      case "comment":
        return <MessageCircle className="size-5 text-base-content/70" />;
      case "follow":
        return <User className="size-5 text-success" />;
      case "price_drop":
        return <IndianRupee className="size-5 text-success" />;
      case "offer_received":
      case "offer_countered":
        return <TrendingUp className="size-5 text-primary" />;
      case "offer_accepted":
        return <Check className="size-5 text-success" />;
      case "offer_declined":
        return <XCircle className="size-5 text-error" />;
      case "review_received":
        return <Star className="size-5 text-warning" />;
      default:
        return <Bell className="size-5 text-base-content/70" />;
    }
  };

  const getNotificationTypeLabel = (type) => {
    switch (type) {
      case "property_contact":
        return "Property Enquiry";
      case "message_request":
        return "Message Request";
      case "property_like":
        return "Property Like";
      case "property_save":
        return "Property Save";
      case "comment":
        return "Comment";
      case "follow":
        return "Follow";
      case "price_drop":
        return "Price Update";
      case "offer_received":
        return "New Offer";
      case "offer_countered":
        return "Counter-Offer";
      case "offer_accepted":
        return "Offer Accepted";
      case "offer_declined":
        return "Offer Declined";
      case "review_received":
        return "Review";
      default:
        return "Notification";
    }
  };

  // Same destination logic ActivityContent.jsx already uses — property-
  // related notifications go to that property, everything else (follow,
  // review received, etc.) goes to whoever the notification is about.
  const handleNotificationClick = (notification) => {
    if (!notification.read) markAsReadMutation.mutate(notification._id);
    if (notification.propertyPost?._id) {
      navigate(`/property/${notification.propertyPost._id}`);
      onClose();
    } else if (notification.actor?._id) {
      navigate(`/users/${notification.actor._id}`);
      onClose();
    }
  };

  if (!isOpen) return null;

  return (
    <>
    {/* Stops above the mobile bottom nav (which is xl:hidden, fixed, and
        otherwise gets fully covered by this panel's h-full backdrop) so the
        nav stays visible and usable while the panel is open. */}
    <div className="fixed inset-x-0 top-0 bottom-16 z-50 overflow-hidden bg-black/30 xl:bottom-0" onClick={onClose}>
      <div className="absolute right-0 top-0 h-full w-full max-w-md bg-base-100 shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex h-full flex-col">
          {/* Header */}
          <div className="flex items-center justify-between border-b border-base-300 px-5 py-4">
            <div className="flex items-center gap-3">
              <div className="relative">
                <Bell className="size-6 text-base-content" />
                {unreadCount > 0 && (
                  <span className="absolute -top-1 -right-1 flex size-4 items-center justify-center rounded-full bg-error text-[10px] font-bold text-white">
                    {unreadCount}
                  </span>
                )}
              </div>
              <h3 className="text-lg font-black text-base-content">Notifications</h3>
            </div>
            <button type="button" className="btn btn-sm btn-circle btn-ghost" onClick={onClose}>
              <X className="size-4" />
            </button>
          </div>

          {/* Filter Tabs */}
          <div className="flex border-b border-base-300 px-5">
            {["all", "message_request", "property_contact"].map((type) => (
              <button
                key={type}
                type="button"
                className={`px-4 py-3 text-sm font-medium transition ${
                  filterType === type
                    ? "border-b-2 border-primary text-primary"
                    : "text-base-content/60 hover:text-base-content"
                }`}
                onClick={() => setFilterType(type)}
              >
                {type === "all" ? "All" : type === "message_request" ? "Requests" : "Enquiries"}
              </button>
            ))}
          </div>

          {/* Mark all as read */}
          {unreadCount > 0 && (
            <div className="px-5 py-3 border-b border-base-200">
              <button
                type="button"
                className="text-sm font-medium text-primary hover:text-primary"
                onClick={markAllAsRead}
              >
                Mark all as read
              </button>
            </div>
          )}

          {/* Notifications List */}
          <div className="flex-1 overflow-y-auto">
            {isLoading ? (
              <div className="flex items-center justify-center p-8">
                <div className="animate-spin rounded-full border-2 border-base-300 border-t-indigo-600 size-8" />
              </div>
            ) : notifications.length === 0 ? (
              <div className="flex flex-col items-center justify-center p-8 text-center">
                <Bell className="size-12 text-base-content/40 mb-3" />
                <p className="text-base-content/60">No notifications yet</p>
              </div>
            ) : (
              <div className="divide-y divide-base-300">
                {notifications.map((notification) => (
                  <div
                    key={notification._id}
                    className={`p-4 transition hover:bg-base-200 cursor-pointer ${
                      !notification.read ? "bg-primary/10" : ""
                    }`}
                    onClick={() => handleNotificationClick(notification)}
                  >
                    <div className="flex gap-3">
                      {/* Icon */}
                      <div className="flex-shrink-0">
                        {getNotificationIcon(notification.type)}
                      </div>

                      {/* Content */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex-1">
                            <p className="text-sm text-base-content line-clamp-2">
                              <NotificationMessage notification={notification} onNavigate={onClose} />
                            </p>
                            {notification.actualMessage && (
                              <p className="mt-1 text-xs text-base-content/70 line-clamp-3 italic">"{notification.actualMessage}"</p>
                            )}
                            <p className="mt-1 text-xs text-base-content/60">
                              {getNotificationTypeLabel(notification.type)} • {new Date(notification.createdAt).toLocaleDateString()}
                            </p>
                          </div>
                          {!notification.read && (
                            <span className="flex size-2 flex-shrink-0 rounded-full bg-primary" />
                          )}
                        </div>

                        {/* Property Info */}
                        {notification.propertyPost && (
                          <div className="mt-2 rounded-lg bg-base-200 p-2">
                            <div className="flex items-center gap-2">
                              <Building2 className="size-4 text-base-content/60" />
                              <div className="flex-1 min-w-0">
                                <p className="text-xs font-medium text-base-content line-clamp-1">
                                  {notification.propertyPost.title || "Property"}
                                </p>
                                <div className="flex items-center gap-2 text-xs text-base-content/70">
                                  <span className="flex items-center gap-1">
                                    <IndianRupee className="size-3" />
                                    {notification.propertyPost.price?.toLocaleString()}
                                  </span>
                                  <span className="flex items-center gap-1">
                                    <MapPin className="size-3" />
                                    {notification.propertyPost.city}
                                  </span>
                                </div>
                              </div>
                            </div>
                          </div>
                        )}

                        {/* Message Request Actions */}
                        {notification.type === "message_request" && notification.requestStatus === "pending" && (
                          <div className="mt-3 flex gap-2">
                            <button
                              type="button"
                              className="btn btn-xs border-none bg-success text-white hover:bg-success"
                              onClick={(e) => { e.stopPropagation(); handleRequestMutation.mutate({ notificationId: notification._id, action: "accept" }); }}
                            >
                              <Check className="size-3" />
                              Accept
                            </button>
                            <button
                              type="button"
                              className="btn btn-xs border border-base-300 bg-base-100 text-base-content hover:bg-base-200"
                              onClick={(e) => { e.stopPropagation(); handleRequestMutation.mutate({ notificationId: notification._id, action: "ignore" }); }}
                            >
                              <XCircle className="size-3" />
                              Ignore
                            </button>
                          </div>
                        )}

                        {/* Offer Received/Countered Actions — gated on the
                            offer's actual current status (not just this
                            notification's fixed type), since accepting or
                            declining doesn't retroactively change the type
                            of the notification that announced it. Without
                            this check, these buttons would stay clickable
                            forever on an already-closed offer, and a second
                            click would just 400. */}
                        {(notification.type === "offer_received" || notification.type === "offer_countered") &&
                          ["pending", "countered"].includes(notification.offer?.status) && (
                          <div className="mt-3 flex gap-2">
                            <button
                              type="button"
                              className="btn btn-xs border-none bg-success text-white hover:bg-success"
                              onClick={(e) => { e.stopPropagation(); respondOfferMutation.mutate({ offerId: notification.offer._id, action: "accept" }); }}
                            >
                              <Check className="size-3" />
                              Accept
                            </button>
                            <button
                              type="button"
                              className="btn btn-xs border border-base-300 bg-base-100 text-base-content hover:bg-base-200"
                              onClick={(e) => { e.stopPropagation(); respondOfferMutation.mutate({ offerId: notification.offer._id, action: "decline" }); }}
                            >
                              <XCircle className="size-3" />
                              Decline
                            </button>
                          </div>
                        )}

                        {/* Offer Accepted — review prompt */}
                        {notification.type === "offer_accepted" && notification.offer?.status === "accepted" && !notification.offer?.reviewedByMe && (
                          <button
                            type="button"
                            className="mt-3 btn btn-xs border-none bg-primary text-white hover:bg-primary"
                            onClick={(e) => { e.stopPropagation(); setReviewModal({ offerId: notification.offer._id, revieweeName: notification.actor?.fullName }); }}
                          >
                            <Star className="size-3" />
                            Leave a review
                          </button>
                        )}

                        {/* Request Status */}
                        {notification.type === "message_request" && notification.requestStatus !== "pending" && (
                          <div className="mt-2">
                            <span className={`text-xs font-medium ${
                              notification.requestStatus === "accepted" ? "text-success" :
                              notification.requestStatus === "ignored" ? "text-base-content/60" :
                              "text-error"
                            }`}>
                              {notification.requestStatus.charAt(0).toUpperCase() + notification.requestStatus.slice(1)}
                            </span>
                          </div>
                        )}
                      </div>

                      {/* Delete */}
                      <button
                        type="button"
                        className="flex-shrink-0 text-base-content/50 hover:text-error"
                        onClick={(e) => { e.stopPropagation(); deleteNotificationMutation.mutate(notification._id); }}
                      >
                        <Trash2 className="size-4" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
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
