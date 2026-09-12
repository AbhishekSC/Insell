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

// The cron only guarantees "due within the next 10 minutes, not yet
// reminded" — it can genuinely fire anywhere from ~10 minutes out down to
// just over 0 (cron timing, or a call scheduled with only a couple of
// minutes' notice triggering the immediate-send path). The reminder text
// must reflect the real remaining time, not a hardcoded "10 minutes".
export function minutesUntilLabel(msRemaining) {
  const mins = Math.round(msRemaining / 60000);
  if (mins <= 0) return "less than a minute";
  if (mins === 1) return "1 minute";
  return `${mins} minutes`;
}

// A short, readable "who's invited" line for the reminder email — names,
// not a bare member count, per the ask for "more details ... members name".
// Dot-separated (Slack/Calendly convention), not a comma list.
export function memberNamesLabel(names, excludeUserId) {
  const list = names
    .filter((n) => String(n._id) !== String(excludeUserId))
    .map((n) => n.fullName || "Member");
  if (list.length === 0) return "Just you";
  const MAX_SHOWN = 6;
  if (list.length <= MAX_SHOWN) return list.join(" · ");
  return `${list.slice(0, MAX_SHOWN).join(" · ")} and ${list.length - MAX_SHOWN} more`;
}

// Same participants line, but as a safe HTML fragment with whoever
// scheduled the call bolded and tagged "(Organizer)" — so it reads like a
// real calendar invite ("Host: X") rather than an undifferentiated name
// dump. The organizer is sorted to the front first so truncation (past 6
// names) never drops them.
export function buildParticipantsHtml(names, organizerId) {
  const entries = names.map((n) => ({
    id: String(n._id),
    label: escapeHtml(n.fullName || "Member"),
    isOrganizer: organizerId ? String(n._id) === String(organizerId) : false,
  }));
  entries.sort((a, b) => Number(b.isOrganizer) - Number(a.isOrganizer));
  if (entries.length === 0) return "Just you";

  const MAX_SHOWN = 6;
  const shown = entries.slice(0, MAX_SHOWN);
  const extra = entries.length - shown.length;
  const parts = shown.map((p) =>
    p.isOrganizer
      ? `<strong>${p.label}</strong> <span style="color:#9ca3af;font-weight:400;">(Organizer)</span>`
      : p.label
  );
  const joined = parts.join(" · ");
  return extra > 0 ? `${joined} and ${extra} more` : joined;
}

// Date and time as two separate lines — "11 September 2026" / "7:40 PM" —
// the way a calendar invite reads, rather than one run-together sentence.
export function formatCallDateParts(date) {
  const d = new Date(date);
  const dateLabel = d.toLocaleDateString("en-US", { day: "numeric", month: "long", year: "numeric" });
  const timeLabel = d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", hour12: true }).replace(/am|pm/i, (m) => m.toUpperCase());
  return { dateLabel, timeLabel };
}

// A calm, calendar-invite-style email (Calendly/Zoom/Slack, not a system
// log line): the wordmark, one clear headline, the event details, a single
// CTA. No emoji, no raw tracking-looking URL, no comma-dumped member list.
export function buildReminderEmailHtml({ title, circleName, dateLabel, timeLabel, participantsHtml, joinLink }) {
  const topic = escapeHtml(title || `Community call in ${circleName}`);
  const year = new Date().getFullYear();
  return `
  <div style="font-family:-apple-system,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;max-width:480px;margin:0 auto;background:#ffffff;color:#1f2937;">
    <div style="padding:32px 32px 0;">
      <p style="margin:0 0 24px;font-size:15px;font-weight:700;color:${BRAND_PRIMARY};letter-spacing:0.01em;">NearMySpace</p>
      <hr style="border:none;border-top:1px solid #e5e7eb;margin:0 0 28px;" />
      <p style="margin:0 0 20px;font-size:22px;font-weight:700;color:#111827;">You're invited to join a call</p>
      <p style="margin:0 0 22px;font-size:18px;font-weight:600;color:#111827;">${topic}</p>

      <table role="presentation" style="width:100%;border-collapse:collapse;margin-bottom:22px;">
        <tr>
          <td style="padding:0 0 4px;font-size:16px;font-weight:600;color:#111827;">${escapeHtml(dateLabel)}</td>
        </tr>
        <tr>
          <td style="padding:0;font-size:15px;color:#6b7280;">${escapeHtml(timeLabel)}</td>
        </tr>
      </table>

      <p style="margin:0 0 6px;font-size:12px;font-weight:600;letter-spacing:0.04em;text-transform:uppercase;color:#9ca3af;">Participants</p>
      <p style="margin:0 0 30px;font-size:14px;color:#374151;line-height:1.6;">${participantsHtml}</p>

      <div style="text-align:center;margin-bottom:30px;">
        <a href="${joinLink}" style="display:inline-block;background:${BRAND_PRIMARY};color:#ffffff;text-decoration:none;font-weight:600;font-size:15px;padding:13px 40px;border-radius:8px;">
          Join Call
        </a>
      </div>

      <p style="margin:0 0 4px;font-size:14px;color:#374151;">We look forward to seeing you there.</p>
      <p style="margin:0 0 28px;font-size:14px;color:#374151;">— The NearMySpace Team</p>

      <p style="margin:0 0 28px;font-size:12px;color:#9ca3af;">
        Having trouble joining? <a href="${joinLink}" style="color:${BRAND_PRIMARY};text-decoration:underline;">Open the meeting from your NearMySpace account</a>.
      </p>
    </div>
    <div style="padding:16px 32px;border-top:1px solid #e5e7eb;">
      <p style="margin:0;font-size:11px;color:#9ca3af;">© ${year} NearMySpace</p>
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
  const { dateLabel, timeLabel } = formatCallDateParts(call.scheduledAt);
  const memberNames = await findMemberNames(circle.members || []).catch(() => []);
  const joinLink = callUrl(circle._id, call._id);
  const organizerId = call.scheduledBy?._id || call.scheduledBy;
  // The cron only guarantees "due within the next 10 minutes" — it can
  // genuinely fire anywhere from ~10 minutes out down to a minute or two,
  // so the push/in-app copy has to reflect the *actual* remaining time, not
  // a fixed "10 minutes" (that was the bug: every reminder said 10 minutes
  // flat, even one that fired 2 minutes before a call scheduled with short
  // notice). The email itself reads as a calendar invite and doesn't lean
  // on a countdown at all — see buildReminderEmailHtml.
  const minutesLabel = minutesUntilLabel(new Date(call.scheduledAt).getTime() - Date.now());

  const notified = await notifyMembers(circle, null, {
    type: "circle_call_reminder",
    title: "Call starting soon",
    message: `${label} in ${circle.name} starts in ${minutesLabel}`,
    pushBody: `${label} starts in ${minutesLabel} — tap to join`,
    emailSubject: "You're invited to join a call | NearMySpace",
    emailHtml: buildReminderEmailHtml({
      title: call.title,
      circleName: circle.name,
      dateLabel,
      timeLabel,
      participantsHtml: buildParticipantsHtml(memberNames, organizerId),
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
