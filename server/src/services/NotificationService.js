import AppError from "../exceptions/AppError.js";
import UnauthorizedError from "../exceptions/UnauthorizedError.js";

export default class NotificationService {
  constructor({ notificationRepository }) {
    this.notificationRepository = notificationRepository;
  }

  async markNotificationRead({ notificationId, currentUserId }) {
    const notification = await this.notificationRepository.findById(notificationId);

    if (!notification) {
      throw new AppError("Notification not found", 404);
    }

    if (String(notification.recipient) !== String(currentUserId)) {
      throw new UnauthorizedError("You are not allowed to update this notification");
    }

    await this.notificationRepository.markAsRead(notification);
    return { notificationId };
  }
}
