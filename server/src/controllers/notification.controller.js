import Notification from "../models/Notification.model.js";
import { logger } from "../utils/logger.js";

// Create a notification
export const createNotification = async (req, res) => {
  try {
    const { recipientId, type, message, propertyPostId, messageRequestId, actualMessage } = req.body;
    const actorId = req.user._id;

    console.log("Creating notification:", { recipientId, type, message, actorId });

    if (!recipientId || !type || !message) {
      return res.status(400).json({
        success: false,
        message: "Recipient ID, type, and message are required",
      });
    }

    const notification = await Notification.create({
      recipient: recipientId,
      actor: actorId,
      type,
      message,
      propertyPost: propertyPostId,
      messageRequest: messageRequestId,
      actualMessage: actualMessage || message, // Store the actual message content
      requestStatus: type === "message_request" ? "pending" : undefined,
    });

    console.log("Notification created successfully:", notification._id);
    logger.info(`Notification created: ${notification._id} for recipient ${recipientId}`);

    res.status(201).json({
      success: true,
      message: "Notification created successfully",
      data: notification,
    });
  } catch (error) {
    console.error("Error creating notification:", error);
    logger.error("Error creating notification:", error);
    res.status(500).json({
      success: false,
      message: "Failed to create notification",
      error: error.message,
    });
  }
};

// Get notifications for current user
export const getNotifications = async (req, res) => {
  try {
    const userId = req.user._id;
    const { unreadOnly, type } = req.query;

    console.log("Fetching notifications for user:", userId, { unreadOnly, type });

    const filter = { recipient: userId };

    if (unreadOnly === "true") {
      filter.read = false;
    }

    // `type` accepts a single value or a comma-separated list, e.g.
    // "post_reported,post_blocked" — used by dismissible notice modals that
    // pool several related notification types into one query.
    const typeCondition = type ? { type: { $in: String(type).split(",").map((t) => t.trim()).filter(Boolean) } } : {};
    Object.assign(filter, typeCondition);

    const notifications = await Notification.find(filter)
      .populate("actor", "fullName profilePic isVerified activeRole primaryRole")
      .populate("propertyPost", "title price city listingType mediaUrls")
      .sort({ createdAt: -1 })
      .limit(50);

    // Count unread notifications based on the filter
    const unreadCount = await Notification.countDocuments({
      recipient: userId,
      read: false,
      ...typeCondition,
    });

    console.log("Notifications found:", notifications.length, "Unread count:", unreadCount);
    if (notifications.length > 0) {
      console.log("Sample notification:", notifications[0]);
      console.log("Sample notification actor:", notifications[0]?.actor);
    }

    res.status(200).json({
      success: true,
      data: {
        notifications,
        unreadCount,
      },
    });
  } catch (error) {
    console.error("Error fetching notifications:", error);
    logger.error("Error fetching notifications:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch notifications",
      error: error.message,
    });
  }
};

// Mark notification as read
export const markAsRead = async (req, res) => {
  try {
    const { notificationId } = req.params;
    const userId = req.user._id;

    const notification = await Notification.findOneAndUpdate(
      { _id: notificationId, recipient: userId },
      { read: true },
      { new: true }
    );

    if (!notification) {
      return res.status(404).json({
        success: false,
        message: "Notification not found",
      });
    }

    logger.info(`Notification marked as read: ${notificationId}`);

    res.status(200).json({
      success: true,
      message: "Notification marked as read",
      data: notification,
    });
  } catch (error) {
    logger.error("Error marking notification as read:", error);
    res.status(500).json({
      success: false,
      message: "Failed to mark notification as read",
      error: error.message,
    });
  }
};

// Mark all notifications as read
export const markAllAsRead = async (req, res) => {
  try {
    const userId = req.user._id;

    // circle_invite is excluded: it's the only notification type that also
    // doubles as the data source for the Communities tab's "You've been
    // invited" Join/Decline banner (filtered on read: false there). Marking
    // it read here — just from visiting Activity/Chat/Connections — would
    // silently make a still-pending invite disappear from that banner with
    // no way left to act on it, even though the user is still sitting in
    // the community's pendingInvites. It gets marked read on its own once
    // the user actually responds via respondToCommunityInvite.
    await Notification.updateMany(
      { recipient: userId, read: false, type: { $ne: "circle_invite" } },
      { read: true }
    );

    logger.info(`All notifications marked as read for user ${userId}`);

    res.status(200).json({
      success: true,
      message: "All notifications marked as read",
    });
  } catch (error) {
    logger.error("Error marking all notifications as read:", error);
    res.status(500).json({
      success: false,
      message: "Failed to mark all notifications as read",
      error: error.message,
    });
  }
};

// Handle message request (accept/ignore/block)
export const handleMessageRequest = async (req, res) => {
  try {
    const { notificationId } = req.params;
    const { action } = req.body; // "accept", "ignore", "block"
    const userId = req.user._id;

    if (!["accept", "ignore", "block"].includes(action)) {
      return res.status(400).json({
        success: false,
        message: "Invalid action. Must be accept, ignore, or block",
      });
    }

    logger.info(`Attempting to ${action} notification ${notificationId} for user ${userId}`);

    const notification = await Notification.findOneAndUpdate(
      { _id: notificationId, recipient: userId, type: "message_request" },
      { requestStatus: action, read: true },
      { new: true }
    );

    if (!notification) {
      logger.error(`Notification not found: ${notificationId} for user ${userId}`);
      return res.status(404).json({
        success: false,
        message: "Notification not found or you don't have permission to handle it",
      });
    }

    logger.info(`Message request ${action}ed successfully: ${notificationId}`);

    res.status(200).json({
      success: true,
      message: `Message request ${action}ed successfully`,
      data: notification,
    });
  } catch (error) {
    logger.error("Error handling message request:", error);
    res.status(500).json({
      success: false,
      message: "Failed to handle message request",
      error: error.message,
    });
  }
};

// Delete notification
export const deleteNotification = async (req, res) => {
  try {
    const { notificationId } = req.params;
    const userId = req.user._id;

    const notification = await Notification.findOneAndDelete({
      _id: notificationId,
      recipient: userId,
    });

    if (!notification) {
      return res.status(404).json({
        success: false,
        message: "Notification not found",
      });
    }

    logger.info(`Notification deleted: ${notificationId}`);

    res.status(200).json({
      success: true,
      message: "Notification deleted successfully",
    });
  } catch (error) {
    logger.error("Error deleting notification:", error);
    res.status(500).json({
      success: false,
      message: "Failed to delete notification",
      error: error.message,
    });
  }
};
