import mongoose from "mongoose";
import PropertyPost from "../../models/PropertyPost.model.js";
import * as NotificationService from "../../services/NotificationService.js";
import { NotificationChannel } from "../../services/NotificationService.js";
import { logger } from "../../utils/logger.js";
import AppError from "../../exceptions/AppError.js";
import { parseTargetPrice, toAlertDTO, toMyAlertDTO } from "./priceAlert.dto.js";
import {
  getAlert,
  upsertAlert,
  deactivateAlert,
  countActiveForPost,
  findTriggered,
  markNotified,
  listActiveForUser,
} from "./priceAlert.repository.js";

function assertValidId(id, label = "listing") {
  if (!id || !mongoose.isValidObjectId(id)) {
    throw new AppError(`This ${label} could not be found`, 404);
  }
}

async function loadOpenPost(postId) {
  const post = await PropertyPost.findById(postId)
    .select("author price status visibility isDeleted isBlocked title")
    .lean();
  if (!post || post.isDeleted || post.isBlocked || post.status !== "PUBLISHED") {
    throw new AppError("This listing is no longer available", 404);
  }
  return post;
}

export async function getMyAlert(userId, postId) {
  assertValidId(postId);
  const alert = await getAlert(userId, postId);
  const watcherCount = await countActiveForPost(postId);
  return { alert: alert && alert.active !== false ? toAlertDTO(alert) : null, watcherCount };
}

export async function setAlert(userId, postId, rawTarget) {
  assertValidId(postId);
  const targetPrice = parseTargetPrice(rawTarget);
  const post = await loadOpenPost(postId);

  if (String(post.author) === String(userId)) {
    throw new AppError("You can't set a price alert on your own listing", 400);
  }
  if (post.price > 0 && targetPrice >= post.price) {
    throw new AppError("Set a target below the current price", 400);
  }

  const alert = await upsertAlert(userId, postId, targetPrice);
  const watcherCount = await countActiveForPost(postId);
  return { alert: toAlertDTO(alert), watcherCount };
}

export async function removeAlert(userId, postId) {
  assertValidId(postId);
  await deactivateAlert(userId, postId);
  const watcherCount = await countActiveForPost(postId);
  return { watcherCount };
}

export async function listMyAlerts(userId) {
  const alerts = await listActiveForUser(userId);
  return alerts.map(toMyAlertDTO).filter(Boolean);
}

// Called from the listing price-change flow. Fires each buyer's own alert
// when the new price meets their target. Returns the set of notified user
// ids so the caller can skip them in its generic "price changed" fan-out.
export async function notifyTriggeredAlerts(post, oldPrice) {
  try {
    const newPrice = Number(post.price);
    if (!(newPrice > 0) || !(newPrice < oldPrice)) return [];

    const triggered = await findTriggered(post._id, newPrice);
    if (triggered.length === 0) return [];

    const oldFmt = `₹${Number(oldPrice).toLocaleString("en-IN")}`;
    const newFmt = `₹${newPrice.toLocaleString("en-IN")}`;

    await Promise.allSettled(
      triggered.map((alert) =>
        NotificationService.send({
          recipientId: alert.user,
          actorId: post.author,
          type: "price_alert",
          title: `Price alert: "${post.title}"`,
          message: `"${post.title}" dropped to ${newFmt} — at or below your ₹${Number(
            alert.targetPrice
          ).toLocaleString("en-IN")} target (was ${oldFmt})`,
          data: { propertyPost: post._id, priceBefore: oldPrice, priceAfter: newPrice },
          channels: [
            NotificationChannel.IN_APP,
            NotificationChannel.REALTIME,
            NotificationChannel.FIREBASE,
          ],
        })
      )
    );

    await markNotified(
      triggered.map((a) => a._id),
      newPrice
    );
    return triggered.map((a) => String(a.user));
  } catch (error) {
    logger.error("notifyTriggeredAlerts failed (non-fatal):", error);
    return [];
  }
}
