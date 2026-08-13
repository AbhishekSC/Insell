import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import axiosInstance from "../lib/axios";
import { Bell, X, Check, XCircle, User, Building2, IndianRupee, MapPin, MessageCircle, Calendar, Trash2 } from "lucide-react";
import { toast } from "react-hot-toast";

export default function NotificationPanel({ isOpen, onClose }) {
  const queryClient = useQueryClient();
  const [filterType, setFilterType] = useState("all");

  const { data: notificationsData, isLoading } = useQuery({
    queryKey: ["notifications", filterType],
    queryFn: async () => {
      const params = filterType !== "all" ? { type: filterType } : {};
      const res = await axiosInstance.get("/api/notifications", { params });
      return res.data.data;
    },
    enabled: isOpen,
  });

  const notifications = notificationsData?.notifications || [];
  const unreadCount = notificationsData?.unreadCount || 0;

  const markAsReadMutation = useMutation({
    mutationFn: async (notificationId) => {
      await axiosInstance.patch(`/api/notifications/${notificationId}/read`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries(["notifications"]);
    },
  });

  const handleRequestMutation = useMutation({
    mutationFn: async ({ notificationId, action }) => {
      await axiosInstance.patch(`/api/notifications/${notificationId}/handle-request`, { action });
    },
    onSuccess: () => {
      queryClient.invalidateQueries(["notifications"]);
      toast.success("Request handled successfully");
    },
    onError: () => {
      toast.error("Failed to handle request");
    },
  });

  const deleteNotificationMutation = useMutation({
    mutationFn: async (notificationId) => {
      await axiosInstance.delete(`/api/notifications/${notificationId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries(["notifications"]);
    },
  });

  const markAllAsRead = async () => {
    try {
      await axiosInstance.patch("/api/notifications/read-all");
      queryClient.invalidateQueries(["notifications"]);
    } catch (error) {
      toast.error("Failed to mark all as read");
    }
  };

  const getNotificationIcon = (type) => {
    switch (type) {
      case "property_contact":
      case "message_request":
        return <MessageCircle className="size-5 text-indigo-600" />;
      case "property_like":
        return <Heart className="size-5 text-red-500" />;
      case "property_save":
        return <Bookmark className="size-5 text-indigo-600" />;
      case "comment":
        return <MessageCircle className="size-5 text-slate-600" />;
      case "follow":
        return <User className="size-5 text-emerald-600" />;
      default:
        return <Bell className="size-5 text-slate-600" />;
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
      default:
        return "Notification";
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/30" onClick={onClose}>
      <div className="absolute right-0 top-0 h-full w-full max-w-md bg-white shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex h-full flex-col">
          {/* Header */}
          <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
            <div className="flex items-center gap-3">
              <div className="relative">
                <Bell className="size-6 text-slate-700" />
                {unreadCount > 0 && (
                  <span className="absolute -top-1 -right-1 flex size-4 items-center justify-center rounded-full bg-red-500 text-[10px] font-bold text-white">
                    {unreadCount}
                  </span>
                )}
              </div>
              <h3 className="text-lg font-black text-slate-800">Notifications</h3>
            </div>
            <button type="button" className="btn btn-sm btn-circle btn-ghost" onClick={onClose}>
              <X className="size-4" />
            </button>
          </div>

          {/* Filter Tabs */}
          <div className="flex border-b border-slate-200 px-5">
            {["all", "message_request", "property_contact"].map((type) => (
              <button
                key={type}
                type="button"
                className={`px-4 py-3 text-sm font-medium transition ${
                  filterType === type
                    ? "border-b-2 border-indigo-600 text-indigo-600"
                    : "text-slate-500 hover:text-slate-700"
                }`}
                onClick={() => setFilterType(type)}
              >
                {type === "all" ? "All" : type === "message_request" ? "Requests" : "Enquiries"}
              </button>
            ))}
          </div>

          {/* Mark all as read */}
          {unreadCount > 0 && (
            <div className="px-5 py-3 border-b border-slate-100">
              <button
                type="button"
                className="text-sm font-medium text-indigo-600 hover:text-indigo-700"
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
                <div className="animate-spin rounded-full border-2 border-slate-200 border-t-indigo-600 size-8" />
              </div>
            ) : notifications.length === 0 ? (
              <div className="flex flex-col items-center justify-center p-8 text-center">
                <Bell className="size-12 text-slate-300 mb-3" />
                <p className="text-slate-500">No notifications yet</p>
              </div>
            ) : (
              <div className="divide-y divide-slate-100">
                {notifications.map((notification) => (
                  <div
                    key={notification._id}
                    className={`p-4 transition hover:bg-slate-50 ${
                      !notification.read ? "bg-indigo-50/50" : ""
                    }`}
                    onClick={() => !notification.read && markAsReadMutation.mutate(notification._id)}
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
                            <p className="text-sm text-slate-700 line-clamp-2">{notification.message}</p>
                            {notification.actualMessage && (
                              <p className="mt-1 text-xs text-slate-600 line-clamp-3 italic">"{notification.actualMessage}"</p>
                            )}
                            <p className="mt-1 text-xs text-slate-500">
                              {getNotificationTypeLabel(notification.type)} • {new Date(notification.createdAt).toLocaleDateString()}
                            </p>
                          </div>
                          {!notification.read && (
                            <span className="flex size-2 flex-shrink-0 rounded-full bg-indigo-600" />
                          )}
                        </div>

                        {/* Property Info */}
                        {notification.propertyPost && (
                          <div className="mt-2 rounded-lg bg-slate-100 p-2">
                            <div className="flex items-center gap-2">
                              <Building2 className="size-4 text-slate-500" />
                              <div className="flex-1 min-w-0">
                                <p className="text-xs font-medium text-slate-800 line-clamp-1">
                                  {notification.propertyPost.title || "Property"}
                                </p>
                                <div className="flex items-center gap-2 text-xs text-slate-600">
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
                              className="btn btn-xs border-none bg-emerald-600 text-white hover:bg-emerald-500"
                              onClick={() => handleRequestMutation.mutate({ notificationId: notification._id, action: "accept" })}
                            >
                              <Check className="size-3" />
                              Accept
                            </button>
                            <button
                              type="button"
                              className="btn btn-xs border border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
                              onClick={() => handleRequestMutation.mutate({ notificationId: notification._id, action: "ignore" })}
                            >
                              <XCircle className="size-3" />
                              Ignore
                            </button>
                          </div>
                        )}

                        {/* Request Status */}
                        {notification.type === "message_request" && notification.requestStatus !== "pending" && (
                          <div className="mt-2">
                            <span className={`text-xs font-medium ${
                              notification.requestStatus === "accepted" ? "text-emerald-600" :
                              notification.requestStatus === "ignored" ? "text-slate-500" :
                              "text-red-600"
                            }`}>
                              {notification.requestStatus.charAt(0).toUpperCase() + notification.requestStatus.slice(1)}
                            </span>
                          </div>
                        )}
                      </div>

                      {/* Delete */}
                      <button
                        type="button"
                        className="flex-shrink-0 text-slate-400 hover:text-red-500"
                        onClick={() => deleteNotificationMutation.mutate(notification._id)}
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
  );
}
