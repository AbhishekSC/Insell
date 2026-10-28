import { sendGenericEmail } from "../../utils/emailClient.js";
import { sendPushNotification } from "../../services/firebase.service.js";
import { pushRealtimeNotification } from "../../services/stream.service.js";
import { logger } from "../../utils/logger.js";

export async function processNotificationJob(job) {
  const { channel, payload } = job.data;

  switch (channel) {
    case "EMAIL":
      return await sendGenericEmail(payload);

    case "FIREBASE": {
      const result = await sendPushNotification(payload.tokens, payload.message);
      const staleTokens = result?.staleTokens || [];
      if (staleTokens.length > 0 && payload.recipientId) {
        const User = (await import("../../models/User.model.js")).default;
        await User.updateOne(
          { _id: payload.recipientId },
          { $pull: { fcmTokens: { token: { $in: staleTokens } } } }
        );
      }
      return result;
    }

    case "REALTIME":
      return await pushRealtimeNotification(payload.userId, payload.eventType);

    default:
      logger.warn(`Unknown notification channel: ${channel}`);
  }
}
