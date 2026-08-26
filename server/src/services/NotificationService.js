import Notification from "../models/Notification.model.js";
import User from "../models/User.model.js";
import { logger } from "../utils/logger.js";
import { pushRealtimeNotification } from "./stream.service.js";
import { sendPushNotification } from "./firebase.service.js";
import { sendGenericEmail } from "../utils/emailClient.js";

export const NotificationChannel = {
  IN_APP: "IN_APP",       // persistent record in Mongo, shown in the /activity feed
  REALTIME: "REALTIME",   // live nudge to an already-open tab, via GetStream
  FIREBASE: "FIREBASE",   // OS-level push, reaches the user even with no tab open
  EMAIL: "EMAIL",
};

/**
 * Dispatch a notification across one or more channels. Each channel fails
 * independently (Promise.allSettled) — a bad FCM token or a down email
 * provider never blocks the in-app record from being created.
 *
 * @param {Object} input
 * @param {string} input.recipientId
 * @param {string} [input.actorId]
 * @param {string} input.type - must match Notification.model.js's `type` enum
 * @param {string} input.message - shown in-app; also the default push/email body
 * @param {Object} [input.data] - extra Notification fields (propertyPost, circle, etc.)
 * @param {string} [input.title] - push notification title (defaults to message)
 * @param {string} [input.pushBody] - push/foreground-toast body override —
 *   use when the in-app `message` (generic, e.g. "X commented on your
 *   property: Y") shouldn't be what shows in the actual push, e.g. showing
 *   the real comment text instead. Defaults to `message`.
 * @param {string} [input.emailSubject]
 * @param {string} [input.emailHtml]
 * @param {string} [input.realtimeEventType] - GetStream custom event type for
 *   the REALTIME channel; defaults to `type`. Override when existing client
 *   code already listens for a specific shared event string (e.g. moderation
 *   notices all send "post_moderation_notice" regardless of the specific
 *   Notification `type`, since StreamProvider.jsx's handler matches on that
 *   exact string) — using `type` there instead would silently stop the
 *   client from reacting to it.
 * @param {string[]} [input.channels] - defaults to [IN_APP]
 */
export async function send({
  recipientId,
  actorId,
  type,
  message,
  data = {},
  title,
  pushBody,
  emailSubject,
  emailHtml,
  realtimeEventType,
  channels = [NotificationChannel.IN_APP],
}) {
  if (!recipientId || !type || !message) {
    logger.warn("NotificationService.send called with missing required fields", { recipientId, type });
    return { results: [] };
  }

  const uniqueChannels = [...new Set(channels)];
  const needsUserLookup = uniqueChannels.includes(NotificationChannel.FIREBASE) || uniqueChannels.includes(NotificationChannel.EMAIL);
  const recipient = needsUserLookup
    ? await User.findById(recipientId).select("email fcmTokens").lean()
    : null;

  const tasks = uniqueChannels.map((channel) => {
    switch (channel) {
      case NotificationChannel.IN_APP:
        return Notification.create({ recipient: recipientId, actor: actorId, type, message, ...data });

      case NotificationChannel.REALTIME:
        return pushRealtimeNotification(recipientId, realtimeEventType || type);

      case NotificationChannel.FIREBASE:
        if (!recipient?.fcmTokens?.length) return Promise.resolve(null);
        return sendPushNotification(recipient.fcmTokens, { title: title || message, body: pushBody || message, data }).then(
          async ({ staleTokens }) => {
            if (staleTokens.length > 0) {
              await User.updateOne({ _id: recipientId }, { $pullAll: { fcmTokens: staleTokens } });
            }
          }
        );

      case NotificationChannel.EMAIL:
        if (!recipient?.email) return Promise.resolve(null);
        return sendGenericEmail({
          email: recipient.email,
          subject: emailSubject || title || message,
          htmlContent: emailHtml || `<p>${message}</p>`,
        });

      default:
        logger.warn(`Unknown notification channel: ${channel}`);
        return Promise.resolve(null);
    }
  });

  const results = await Promise.allSettled(tasks);
  results.forEach((result, index) => {
    if (result.status === "rejected") {
      logger.error(`NotificationService channel ${uniqueChannels[index]} failed:`, result.reason);
    }
  });

  return { results };
}
