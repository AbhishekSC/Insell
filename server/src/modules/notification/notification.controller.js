import { logger } from "../../utils/logger.js";
import * as notificationService from "./notification.service.js";

// Create a notification
export const createNotification = async (req, res) => {
  try {
    const { recipientId, type, message, propertyPostId, messageRequestId, actualMessage } = req.body;
    const actorId = req.user._id;

    if (!recipientId || !type || !message) {
      return res.status(400).json({
        success: false,
        message: "Recipient ID, type, and message are required",
      });
    }

    const notification = await notificationService.createNotification({
      recipientId,
      type,
      message,
      propertyPostId,
      messageRequestId,
      actualMessage,
      actorId,
    });

    res.status(201).json({
      success: true,
      message: "Notification created successfully",
      data: notification,
    });
  } catch (error) {
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

    const { notifications, unreadCount } = await notificationService.getNotifications({
      userId,
      unreadOnly,
      type,
    });

    res.status(200).json({
      success: true,
      data: {
        notifications,
        unreadCount,
      },
    });
  } catch (error) {
    logger.error("Error fetching notifications:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch notifications",
    });
  }
};

export const getBadgeCounts = async (req, res) => {
  try {
    const userId = req.user._id;

    const data = await notificationService.getBadgeCounts(userId);

    res.status(200).json({
      success: true,
      data,
    });
  } catch (error) {
    logger.error("Error fetching badge counts:", error);
    res.status(500).json({ success: false, message: "Failed to fetch badge counts" });
  }
};

// Mark notification as read
export const markAsRead = async (req, res) => {
  try {
    const { notificationId } = req.params;
    const userId = req.user._id;

    const result = await notificationService.markAsRead({ notificationId, userId });

    if (result.error) {
      return res.status(404).json({
        success: false,
        message: "Notification not found",
      });
    }

    res.status(200).json({
      success: true,
      message: "Notification marked as read",
      data: result.data,
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

    await notificationService.markAllAsRead(userId);

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

    const result = await notificationService.handleMessageRequest({
      notificationId,
      userId,
      action,
    });

    if (result.error) {
      return res.status(404).json({
        success: false,
        message: "Notification not found or you don't have permission to handle it",
      });
    }

    res.status(200).json({
      success: true,
      message: `Message request ${action}ed successfully`,
      data: result.data,
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

    const result = await notificationService.deleteNotification({ notificationId, userId });

    if (result.error) {
      return res.status(404).json({
        success: false,
        message: "Notification not found",
      });
    }

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
