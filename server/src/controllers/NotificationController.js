import { sendSuccessResponse } from "../utils/responseHandler.js";
import { toMarkNotificationReadDTO } from "../dto/notification/MarkNotificationReadDto.js";

export default class NotificationController {
  constructor({ notificationService }) {
    this.notificationService = notificationService;
    this.markRead = this.markRead.bind(this);
  }

  async markRead(req, res, next) {
    try {
      const dto = toMarkNotificationReadDTO({
        notificationId: req.params.notificationId,
      });
      const data = await this.notificationService.markNotificationRead({
        ...dto,
        currentUserId: req.user?._id,
      });

      return sendSuccessResponse(res, 200, "Notification marked as read", data);
    } catch (error) {
      return next(error);
    }
  }
}
