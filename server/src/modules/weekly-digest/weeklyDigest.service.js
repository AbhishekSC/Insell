import { logger } from "../../utils/logger.js";
import * as NotificationService from "../../services/NotificationService.js";
import { NotificationChannel } from "../../services/NotificationService.js";
import { recentDigestCountsByRecipient, eligibleRecipients } from "./weeklyDigest.repository.js";

const LABEL = {
  saved_search_match: "new listing match",
  price_drop: "price drop",
};

function pluralize(n, word) {
  return `${n} ${word}${n === 1 ? "" : "s"}`;
}

function buildEmailHtml(fullName, byType, total) {
  const lines = byType
    .filter((t) => t.count > 0)
    .map((t) => `<li>${pluralize(t.count, LABEL[t.type] || t.type)}</li>`)
    .join("");
  return `
    <div style="font-family: -apple-system, sans-serif; color: #1a1a1a; max-width: 480px;">
      <p>Hi ${fullName || "there"},</p>
      <p>Here's what happened on <strong>NearMySpace</strong> this week — ${pluralize(total, "update")} you might have missed:</p>
      <ul>${lines}</ul>
      <p><a href="${process.env.CLIENT_URL || "https://nearmyspace.app"}/marketplace" style="color:#4f46e5;">Open NearMySpace →</a></p>
      <p style="color:#888; font-size:12px; margin-top:24px;">
        You're getting this because you have saved searches or price alerts active.
        <a href="${process.env.CLIENT_URL || "https://nearmyspace.app"}/profile?digest=off">Turn off this weekly email</a>.
      </p>
    </div>
  `;
}

// Runs weekly (see the cron-gated controller). For every user who had at
// least one saved-search-match or price-drop notification in the last 7
// days, sends one summary email — a recap, not a new computation.
export async function sendWeeklyDigest({ days = 7 } = {}) {
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
  const grouped = await recentDigestCountsByRecipient(since);
  if (grouped.length === 0) return { candidates: 0, sent: 0 };

  const recipients = await eligibleRecipients(grouped.map((g) => g._id));
  const byId = new Map(recipients.map((u) => [String(u._id), u]));

  let sent = 0;
  await Promise.allSettled(
    grouped.map(async (g) => {
      const user = byId.get(String(g._id));
      if (!user?.email || !g.total) return;

      const html = buildEmailHtml(user.fullName, g.byType, g.total);
      await NotificationService.send({
        recipientId: g._id,
        actorId: null,
        type: "saved_search_match", // reuses an existing enum value — this is a summary of that same category, not a new notification type
        message: `Your weekly NearMySpace digest — ${pluralize(g.total, "update")}`,
        emailSubject: `${pluralize(g.total, "update")} on NearMySpace this week`,
        emailHtml: html,
        channels: [NotificationChannel.EMAIL],
      });
      sent += 1;
    })
  );

  logger.info(`📬 [WEEKLY DIGEST] ${sent}/${grouped.length} emails sent`);
  return { candidates: grouped.length, sent };
}
