import redisClient from "../config/redisClient.config.js";
import Notification from "../models/Notification.model.js";
import { logger } from "../utils/logger.js";

const NOTIF_COUNT_TTL = 7 * 24 * 60 * 60; // 7 days

/**
 * Reads unread notification count in ~1ms from Redis.
 * Falls back to MongoDB and warms Redis on cold start.
 */
export async function getUnreadNotificationCount(userId) {
  if (!userId) return 0;
  const key = `user:${userId}:unread_notifs`;

  try {
    const cached = await redisClient.get(key);
    if (cached !== null && cached !== undefined) {
      return Math.max(0, parseInt(cached, 10) || 0);
    }

    // Cold start fallback: scan MongoDB once
    const count = await Notification.countDocuments({
      recipient: userId,
      read: false,
      type: { $ne: "circle_invite" },
    });

    await redisClient.set(key, String(count), { EX: NOTIF_COUNT_TTL });
    return count;
  } catch (error) {
    logger.warn(`Failed to read unread notification count from Redis for ${userId}:`, error?.message);
    try {
      return await Notification.countDocuments({
        recipient: userId,
        read: false,
        type: { $ne: "circle_invite" },
      });
    } catch {
      return 0;
    }
  }
}

/**
 * High-speed atomic increment when an in-app notification is created (~0.2ms).
 */
export async function incrementUnreadNotificationCount(userId) {
  if (!userId) return;
  const key = `user:${userId}:unread_notifs`;

  try {
    const exists = await redisClient.exists(key);
    if (!exists) {
      // Lazy seed from Mongo (sets key with current count)
      await getUnreadNotificationCount(userId);
    }

    // Always increment so newly arriving notification is accounted for
    await redisClient.incr(key);
    await redisClient.expire(key, NOTIF_COUNT_TTL);
  } catch (error) {
    logger.warn(`Failed to increment unread notification count for ${userId}:`, error?.message);
  }
}

/**
 * Decrements unread count when a single notification is marked as read (~0.2ms).
 */
export async function decrementUnreadNotificationCount(userId) {
  if (!userId) return;
  const key = `user:${userId}:unread_notifs`;

  try {
    const exists = await redisClient.exists(key);
    if (!exists) return;

    const current = await redisClient.decr(key);
    if (current < 0) {
      await redisClient.set(key, "0", { EX: NOTIF_COUNT_TTL });
    }
  } catch (error) {
    logger.warn(`Failed to decrement unread notification count for ${userId}:`, error?.message);
  }
}

/**
 * Resets unread counter to 0 when "markAllAsRead" is triggered (~0.2ms).
 */
export async function clearUnreadNotificationCount(userId) {
  if (!userId) return;
  const key = `user:${userId}:unread_notifs`;

  try {
    await redisClient.set(key, "0", { EX: NOTIF_COUNT_TTL });
  } catch (error) {
    logger.warn(`Failed to clear unread notification count for ${userId}:`, error?.message);
  }
}
