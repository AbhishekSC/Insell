import { logger } from "../../utils/logger.js";
import {
  getUnreadNotificationCount,
  decrementUnreadNotificationCount,
  clearUnreadNotificationCount,
} from "../../services/notificationCache.service.js";
import * as notificationRepository from "./notification.repository.js";

export async function createNotification({ recipientId, type, message, propertyPostId, messageRequestId, actualMessage, actorId }) {
  const notification = await notificationRepository.createNotification({
    recipient: recipientId,
    actor: actorId,
    type,
    message,
    propertyPost: propertyPostId,
    messageRequest: messageRequestId,
    actualMessage: actualMessage || message, // Store the actual message content
    requestStatus: type === "message_request" ? "pending" : undefined,
  });

  logger.info(`Notification created: ${notification._id} for recipient ${recipientId}`);
  return notification;
}

export async function getNotifications({ userId, unreadOnly, type }) {
  const filter = { recipient: userId };

  if (unreadOnly === "true") {
    filter.read = false;
  }

  // `type` accepts a single value or a comma-separated list, e.g.
  // "post_reported,post_blocked" — used by dismissible notice modals that
  // pool several related notification types into one query.
  const typeCondition = type ? { type: { $in: String(type).split(",").map((t) => t.trim()).filter(Boolean) } } : {};
  Object.assign(filter, typeCondition);

  const notifications = (await notificationRepository.findNotifications(filter)) || [];

  // Same reasoning as the offer status above — an "offer_accepted"
  // notification never changes once you've reviewed it, so a "Leave a
  // review" button gated only on notification type would stay clickable
  // forever, and a second submit would just 409.
  const acceptedOfferIds = notifications
    .filter((n) => n.type === "offer_accepted" && n.offer?._id)
    .map((n) => n.offer._id);
  const reviewedOfferIds = acceptedOfferIds.length
    ? new Set(
        ((await notificationRepository.findReviewsByOfferIds(acceptedOfferIds, userId)) || [])
          .map((r) => String(r.offer))
      )
    : new Set();
  notifications.forEach((n) => {
    if (n.offer?._id) {
      n.offer.reviewedByMe = reviewedOfferIds.has(String(n.offer._id));
    }
  });

  // Count unread notifications using high-speed Redis counter (~1ms)
  const unreadCount = Object.keys(typeCondition).length > 0
    ? await notificationRepository.countUnreadNotifications(userId, typeCondition)
    : await getUnreadNotificationCount(userId);

  return { notifications, unreadCount };
}

export async function getBadgeCounts(userId) {
  const [activityCount, messageRequestCount, friendRequestCount] = await Promise.all([
    getUnreadNotificationCount(userId),
    notificationRepository.countUnreadMessageRequests(userId),
    notificationRepository.countPendingFriendRequests(userId),
  ]);

  return { activityCount, messageRequestCount, friendRequestCount };
}

export async function markAsRead({ notificationId, userId }) {
  const notification = await notificationRepository.markNotificationAsRead(notificationId, userId);

  if (!notification) {
    return { error: { status: 404, message: "Notification not found" } };
  }

  decrementUnreadNotificationCount(userId);
  logger.info(`Notification marked as read: ${notificationId}`);

  return { data: notification };
}

export async function markAllAsRead(userId) {
  await notificationRepository.markAllNotificationsAsRead(userId);
  clearUnreadNotificationCount(userId);
  logger.info(`All notifications marked as read for user ${userId}`);
}

export async function handleMessageRequest({ notificationId, userId, action }) {
  logger.info(`Attempting to ${action} notification ${notificationId} for user ${userId}`);

  const notification = await notificationRepository.handleMessageRequestUpdate(notificationId, userId, action);

  if (!notification) {
    logger.error(`Notification not found: ${notificationId} for user ${userId}`);
    return { error: { status: 404, message: "Notification not found or you don't have permission to handle it" } };
  }

  logger.info(`Message request ${action}ed successfully: ${notificationId}`);
  return { data: notification };
}

export async function deleteNotification({ notificationId, userId }) {
  const notification = await notificationRepository.deleteNotification(notificationId, userId);

  if (!notification) {
    return { error: { status: 404, message: "Notification not found" } };
  }

  logger.info(`Notification deleted: ${notificationId}`);
  return { success: true };
}
