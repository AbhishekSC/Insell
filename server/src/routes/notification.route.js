import express from "express";
import {
  createNotification,
  getNotifications,
  markAsRead,
  markAllAsRead,
  handleMessageRequest,
  deleteNotification,
} from "../controllers/notification.controller.js";
import { verifyUser, requireVerified } from "../middlewares/auth.middleware.js";

const router = express.Router();

router.use(verifyUser);
router.use(requireVerified);

// Create notification
router.post("/", createNotification);

// Get notifications for current user
router.get("/", getNotifications);

// Mark notification as read
router.patch("/:notificationId/read", markAsRead);

// Mark all notifications as read
router.patch("/read-all", markAllAsRead);

// Handle message request
router.patch("/:notificationId/handle-request", handleMessageRequest);

// Delete notification
router.delete("/:notificationId", deleteNotification);

export default router;
