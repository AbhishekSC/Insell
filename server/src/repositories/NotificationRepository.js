import Notification from "../models/Notification.model.js";

export default class NotificationRepository {
  findById(notificationId) {
    return Notification.findById(notificationId);
  }

  markAsRead(notification) {
    notification.read = true;
    return notification.save();
  }
}
