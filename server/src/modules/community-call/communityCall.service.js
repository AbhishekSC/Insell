import AppError from "../../exceptions/AppError.js";
import * as NotificationService from "../../services/NotificationService.js";
import { NotificationChannel } from "../../services/NotificationService.js";
import { logger } from "../../utils/logger.js";
import { toScheduledCallDTO } from "./communityCall.dto.js";
import {
  findCircle,
  create,
  findById,
  listUpcomingForCircle,
  cancel,
  markReminded,
  markStarted as markStartedRepo,
  findDueForReminder,
} from "./communityCall.repository.js";

const MAX_ADVANCE_DAYS = 30;
const REMINDER_WINDOW_MS = 10 * 60 * 1000; // "starts in 10 minutes"

function isMemberOf(circle, userId) {
  return (circle.members || []).some((memberId) => String(memberId) === String(userId));
}

function isOrganizerOrModerator(circle, call, userId) {
  const id = String(userId);
  if (String(call.scheduledBy) === id) return true;
  if (String(circle.creator) === id) return true;
  return (circle.moderators || []).some((modId) => String(modId) === id);
}

function callUrl(circleId) {
  return `/marketplace?section=communities&circle=${circleId}`;
}

async function notifyMembers(circle, excludeUserId, { type, title, message, channels }) {
  const recipientIds = (circle.members || [])
    .map((memberId) => String(memberId))
    .filter((memberId) => memberId !== String(excludeUserId));

  await Promise.allSettled(
    recipientIds.map((recipientId) =>
      NotificationService.send({
        recipientId,
        actorId: excludeUserId,
        type,
        title,
        message,
        data: { circle: String(circle._id), url: callUrl(circle._id) },
        channels,
      })
    )
  );
  return recipientIds.length;
}

export async function scheduleCall(userId, circleId, { title, scheduledAt }) {
  const circle = await findCircle(circleId);
  if (!circle) throw new AppError("Community not found", 404);
  if (!isMemberOf(circle, userId)) throw new AppError("Only community members can schedule a call", 403);

  const when = new Date(scheduledAt);
  if (Number.isNaN(when.getTime())) throw new AppError("Choose a valid date and time", 400);
  const now = Date.now();
  if (when.getTime() <= now) throw new AppError("Pick a time in the future", 400);
  if (when.getTime() - now > MAX_ADVANCE_DAYS * 24 * 60 * 60 * 1000) {
    throw new AppError(`Calls can only be scheduled up to ${MAX_ADVANCE_DAYS} days in advance`, 400);
  }

  const call = await create({
    circleId,
    scheduledBy: userId,
    title: (title || "").trim().slice(0, 120),
    scheduledAt: when,
  });

  const whenLabel = when.toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" });
  const label = call.title ? `"${call.title}"` : "A call";
  await notifyMembers(circle, userId, {
    type: "circle_call_scheduled",
    title: "Call scheduled",
    message: `${label} was scheduled in ${circle.name} for ${whenLabel}`,
    channels: [NotificationChannel.IN_APP, NotificationChannel.REALTIME],
  }).catch((err) => logger.warn(`[SCHEDULED CALL] scheduled-notify failed: ${err.message}`));

  // Scheduled with less than 10 minutes' notice — the cron's next sweep
  // might not catch it in time (or at all, if it's under 5 min out), so
  // send the "starts soon" reminder immediately instead of waiting.
  if (when.getTime() - now <= REMINDER_WINDOW_MS) {
    try {
      await sendReminderFor(call, circle);
      // sendReminderFor persisted the update via markReminded() — reflect
      // it on this in-memory document too, since that's what we return.
      call.status = "REMINDED";
      call.reminderSentAt = new Date();
    } catch (err) {
      logger.warn(`[SCHEDULED CALL] immediate reminder failed: ${err.message}`);
    }
  }

  await call.populate("scheduledBy", "fullName profilePic");
  return toScheduledCallDTO(call);
}

export async function listUpcoming(userId, circleId) {
  const circle = await findCircle(circleId);
  if (!circle) throw new AppError("Community not found", 404);
  if (!isMemberOf(circle, userId)) throw new AppError("Only community members can view this", 403);

  const calls = await listUpcomingForCircle(circleId);
  return calls.map(toScheduledCallDTO);
}

export async function cancelCall(userId, circleId, callId) {
  const circle = await findCircle(circleId);
  if (!circle) throw new AppError("Community not found", 404);

  const call = await findById(callId);
  if (!call || String(call.circle) !== String(circleId)) throw new AppError("Scheduled call not found", 404);
  if (call.status === "CANCELLED") throw new AppError("This call was already cancelled", 409);
  if (!isOrganizerOrModerator(circle, call, userId)) {
    throw new AppError("Only the organizer or a community moderator can cancel this call", 403);
  }

  const cancelled = await cancel(callId, userId);
  return toScheduledCallDTO(cancelled);
}

export async function markCallStarted(userId, circleId, callId) {
  const circle = await findCircle(circleId);
  if (!circle) throw new AppError("Community not found", 404);
  if (!isMemberOf(circle, userId)) throw new AppError("Only community members can do this", 403);

  const updated = await markStartedRepo(callId);
  return updated ? toScheduledCallDTO(updated) : null;
}

async function sendReminderFor(call, circle) {
  const label = call.title ? `"${call.title}"` : "Your community call";
  const notified = await notifyMembers(circle, null, {
    type: "circle_call_reminder",
    title: "📞 Call starting soon",
    message: `${label} in ${circle.name} starts in 10 minutes`,
    channels: [NotificationChannel.IN_APP, NotificationChannel.REALTIME, NotificationChannel.FIREBASE, NotificationChannel.EMAIL],
  });
  await markReminded(call._id);
  return notified;
}

// The cron sweep: every call due within the reminder window that hasn't
// been reminded yet. Idempotent by construction — markReminded() flips
// reminderSentAt, so a call is never matched by this query twice.
export async function sendDueReminders() {
  const due = await findDueForReminder(REMINDER_WINDOW_MS);
  let remindedCount = 0;
  let notifiedCount = 0;

  for (const call of due) {
    if (!call.circle) continue; // community was deleted after the call was scheduled
    try {
      notifiedCount += await sendReminderFor(call, call.circle);
      remindedCount += 1;
    } catch (err) {
      logger.warn(`[SCHEDULED CALL CRON] reminder failed for ${call._id}: ${err.message}`);
    }
  }

  return { remindedCount, notifiedCount, dueCount: due.length };
}
