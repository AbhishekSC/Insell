import * as NotificationService from "../../services/NotificationService.js";
import { logger } from "../../utils/logger.js";
import * as repo from "./visitRequest.repository.js";
import { ALL_CHANNELS } from "./visitRequest.constants.js";

export function parseSlots(raw) {
  if (!Array.isArray(raw)) return [];
  const now = Date.now();
  return raw
    .map((s) => new Date(s))
    .filter((d) => d instanceof Date && !Number.isNaN(d.getTime()) && d.getTime() > now)
    .slice(0, 3);
}

export function fmtSlot(d) {
  return new Date(d).toLocaleString("en-IN", { weekday: "short", day: "numeric", month: "short", hour: "numeric", minute: "2-digit" });
}

export function findReplay(visit, requestId) {
  if (!requestId || !visit?.history?.length) return null;
  return visit.history.find((h) => h.requestId === requestId) || null;
}

export async function refundVisitUsage(user, dateBucket) {
  try {
    await repo.refundDailyUsage(user, dateBucket);
  } catch (e) {
    logger.error("visit usage refund failed (non-fatal):", e);
  }
}

export function visitEmailHtml({ heading, greeting, body, when, mode, property }) {
  const modeLabel = mode === "VIDEO" ? "Video call" : "In-person visit";
  return `
  <!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"><title>${heading}</title></head>
  <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
    <div style="max-width: 600px; margin: 0 auto; padding: 20px;">
      <div style="background: linear-gradient(135deg, #10b981 0%, #059669 100%); padding: 30px; border-radius: 10px 10px 0 0; text-align: center;">
        <div style="background: white; display: inline-block; padding: 10px 18px; border-radius: 8px;">
          <img src="https://insell-fe.vercel.app/logo-email.png" alt="NearMySpace" style="height: 32px; display: block;" />
        </div>
        <p style="color: rgba(255,255,255,0.9); margin: 10px 0 0 0;">${heading}</p>
      </div>
      <div style="background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px;">
        <p style="margin: 0 0 20px 0;">${greeting}</p>
        <p style="margin: 0 0 20px 0;">${body}</p>
        <div style="background: white; border: 2px dashed #10b981; padding: 20px; border-radius: 8px; margin: 24px 0;">
          <p style="margin: 0 0 6px 0;"><strong>Property:</strong> ${property}</p>
          <p style="margin: 0 0 6px 0;"><strong>When:</strong> ${when}</p>
          <p style="margin: 0;"><strong>Type:</strong> ${modeLabel}</p>
        </div>
        <p style="margin: 30px 0 0 0; color: #666; font-size: 14px;">Best regards,<br>The NearMySpace Team</p>
      </div>
      <div style="text-align: center; padding: 20px; color: #999; font-size: 12px;">
        <p style="margin: 0;">© 2026 NearMySpace. All rights reserved.</p>
      </div>
    </div>
  </body></html>`;
}

export async function sendVisitConfirmationEmails(visit, slot) {
  if (process.env.NODE_ENV === "test") return;
  const [requester, owner] = await Promise.all([
    repo.findUserById(visit.requester),
    repo.findUserById(visit.owner),
  ]);
  const property = visit.post?.title || "the property";
  const when = fmtSlot(slot);
  const emails = [];
  if (requester?.email) {
    emails.push({
      email: requester.email,
      subject: `Visit confirmed — ${property}`,
      htmlContent: visitEmailHtml({
        heading: "Your visit is confirmed",
        greeting: `Hi ${requester.fullName || "there"},`,
        body: `Your visit for <strong>${property}</strong> is confirmed. The owner is expecting you at the time below.`,
        when, mode: visit.mode, property,
      }),
    });
  }
  if (owner?.email) {
    emails.push({
      email: owner.email,
      subject: `Visit confirmed — ${property}`,
      htmlContent: visitEmailHtml({
        heading: "A visit is confirmed",
        greeting: `Hi ${owner.fullName || "there"},`,
        body: `${requester?.fullName || "A buyer"} will visit <strong>${property}</strong> at the time below.`,
        when, mode: visit.mode, property,
      }),
    });
  }
  if (emails.length) {
    const { enqueueVisitConfirmationEmail } = await import("../../jobs/producers/email.producer.js");
    await enqueueVisitConfirmationEmail(emails);
  }
}

export async function notify(recipientId, actorId, type, title, msg, visit, actorName) {
  await NotificationService.send({
    recipientId, actorId, type, title, message: msg,
    pushBody: actorName ? `${actorName}: ${title}` : title,
    data: { propertyPost: visit.post._id || visit.post, visitRequest: visit._id },
    channels: ALL_CHANNELS,
  }).catch((e) => logger.error("visit notify failed (non-fatal):", e));
}
