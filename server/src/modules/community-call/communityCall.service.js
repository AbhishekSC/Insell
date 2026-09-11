import AppError from "../../exceptions/AppError.js";
import * as NotificationService from "../../services/NotificationService.js";
import { NotificationChannel } from "../../services/NotificationService.js";
import { logger } from "../../utils/logger.js";
import { toScheduledCallDTO } from "./communityCall.dto.js";
import {
  findCircle,
  findMemberNames,
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
const SITE_ORIGIN = (process.env.CLIENT_URL || "https://insell-fe.vercel.app").replace(/\/$/, "");
const BRAND_PRIMARY = "#2f6fed";

function isMemberOf(circle, userId) {
  return (circle.members || []).some((memberId) => String(memberId) === String(userId));
}

function isOrganizerOrModerator(circle, call, userId) {
  const id = String(userId);
  if (String(call.scheduledBy) === id) return true;
  if (String(circle.creator) === id) return true;
  return (circle.moderators || []).some((modId) => String(modId) === id);
}

// Relative in-app path (used for the notification's `data.url`, which the
// client resolves against its own origin) vs. the absolute link an email or
// push notification needs, which must work from outside the app entirely.
function callPath(circleId, callId) {
  const params = new URLSearchParams({ section: "communities", circle: String(circleId), joinCall: "1" });
  if (callId) params.set("callId", String(callId));
  return `/marketplace?${params.toString()}`;
}

export function callUrl(circleId, callId) {
  return `${SITE_ORIGIN}${callPath(circleId, callId)}`;
}

function escapeHtml(s) {
  return String(s || "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}

// A short, readable "who's invited" line for the reminder email — names,
// not a bare member count, per the ask for "more details ... members name".
export function memberNamesLabel(names, excludeUserId) {
  const list = names
    .filter((n) => String(n._id) !== String(excludeUserId))
    .map((n) => n.fullName || "Member");
  if (list.length === 0) return "Just you";
  const MAX_SHOWN = 6;
  if (list.length <= MAX_SHOWN) return list.join(", ");
  return `${list.slice(0, MAX_SHOWN).join(", ")} and ${list.length - MAX_SHOWN} more`;
}

export function buildReminderEmailHtml({ title, circleName, whenLabel, membersLabel, joinLink }) {
  const topic = escapeHtml(title || "Community call");
  return `
  <div style="font-family:-apple-system,'Segoe UI',Roboto,sans-serif;max-width:480px;margin:0 auto;background:#f8fafc;">
    <div style="background:${BRAND_PRIMARY};padding:20px 24px;border-radius:12px 12px 0 0;">
      <p style="margin:0;color:#e0eafd;font-size:12px;font-weight:600;letter-spacing:0.06em;text-transform:uppercase;">NearMySpace</p>
      <p style="margin:8px 0 0;color:#ffffff;font-size:20px;font-weight:700;">📞 Call starting in 10 minutes</p>
    </div>
    <div style="background:#ffffff;border:1px solid #dbe4ff;border-top:none;border-radius:0 0 12px 12px;padding:24px;">
      <p style="margin:0 0 18px;font-size:15px;line-height:1.5;color:#1f2937;">
        <strong>${topic}</strong> in <strong>${escapeHtml(circleName)}</strong> is about to start.
      </p>
      <table role="presentation" style="width:100%;border-collapse:collapse;font-size:14px;">
        <tr>
          <td style="padding:7px 0;color:#6b7280;border-top:1px solid #eef2ff;">Topic</td>
          <td style="padding:7px 0;text-align:right;font-weight:600;color:#1f2937;border-top:1px solid #eef2ff;">${topic}</td>
        </tr>
        <tr>
          <td style="padding:7px 0;color:#6b7280;border-top:1px solid #eef2ff;">When</td>
          <td style="padding:7px 0;text-align:right;font-weight:600;color:#1f2937;border-top:1px solid #eef2ff;">${escapeHtml(whenLabel)}</td>
        </tr>
        <tr>
          <td style="padding:7px 0;color:#6b7280;border-top:1px solid #eef2ff;vertical-align:top;">Members</td>
          <td style="padding:7px 0;text-align:right;font-weight:600;color:#1f2937;border-top:1px solid #eef2ff;">${escapeHtml(membersLabel)}</td>
        </tr>
      </table>
      <div style="text-align:center;margin-top:26px;">
        <a href="${joinLink}" style="display:inline-block;background:${BRAND_PRIMARY};color:#ffffff;text-decoration:none;font-weight:700;font-size:15px;padding:13px 32px;border-radius:8px;">
          Join the call →
        </a>
      </div>
      <p style="margin-top:18px;font-size:12px;color:#9ca3af;text-align:center;word-break:break-all;">
        Button not working? <a href="${joinLink}" style="color:${BRAND_PRIMARY};">${joinLink}</a>
      </p>
    </div>
  </div>`;
}

async function notifyMembers(circle, excludeUserId, { type, title, message, pushBody, emailSubject, emailHtml, channels }) {
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
        pushBody,
        emailSubject,
        emailHtml,
        data: { circle: String(circle._id), url: callPath(circle._id) },
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
  const whenLabel = new Date(call.scheduledAt).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" });
  const memberNames = await findMemberNames(circle.members || []).catch(() => []);
  const joinLink = callUrl(circle._id, call._id);

  const notified = await notifyMembers(circle, null, {
    type: "circle_call_reminder",
    title: "📞 Call starting soon",
    message: `${label} in ${circle.name} starts in 10 minutes`,
    pushBody: `${label} starts in 10 minutes — tap to join`,
    emailSubject: `📞 ${call.title || "Your call"} starts in 10 minutes`,
    emailHtml: buildReminderEmailHtml({
      title: call.title,
      circleName: circle.name,
      whenLabel,
      membersLabel: memberNamesLabel(memberNames, null),
      joinLink,
    }),
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
