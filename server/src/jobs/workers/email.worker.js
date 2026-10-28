import { sendGenericEmail, sendWelcomeEmail } from "../../utils/emailClient.js";
import { sendEmail } from "../../services/email.service.js";
import { logger } from "../../utils/logger.js";

export async function processEmailJob(job) {
  const { type } = job.data;

  switch (type) {
    case "welcome": {
      const { email, name } = job.data;
      const result = await sendWelcomeEmail({ email, name });
      if (!result?.success) throw new Error(`Welcome email failed for ${email}`);
      return result;
    }

    case "welcome-legacy": {
      const { email, name } = job.data;
      const result = await sendEmail(email, name);
      if (!result?.success) throw new Error(`Legacy welcome email failed for ${email}`);
      return result;
    }

    case "otp-login":
    case "otp-reset": {
      const { email, otp, variant } = job.data;
      const isReset = variant === "reset";
      const subject = isReset ? "Password Reset OTP - NearMySpace" : "Your Login Code - NearMySpace";
      const gradientColor = isReset ? "#667eea 0%, #764ba2 100%" : "#10b981 0%, #059669 100%";
      const borderColor = isReset ? "#667eea" : "#10b981";
      const codeColor = isReset ? "#667eea" : "#059669";
      const heading = isReset ? "Password Reset Request" : "Passwordless Sign-In 🔐";
      const intro = isReset
        ? "We received a request to reset your password for your NearMySpace account. Use the code below to continue:"
        : "Use the 6-digit login code below to quickly access your NearMySpace account:";
      const ignoreText = isReset
        ? "If you didn't request this password reset, you can safely ignore this email."
        : "If you did not request this login code, you can safely ignore this email.";

      const htmlContent = `<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head><body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;"><div style="max-width: 600px; margin: 0 auto; padding: 20px;"><div style="background: linear-gradient(135deg, ${gradientColor}); padding: 30px; border-radius: 10px 10px 0 0; text-align: center;"><div style="background: white; display: inline-block; padding: 10px 18px; border-radius: 8px;"><img src="https://nearmy-space.vercel.app/logo-email.png" alt="Insell" style="height: 32px; display: block;" /></div><p style="color: rgba(255,255,255,0.9); margin: 10px 0 0 0;">${heading}</p></div><div style="background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px;"><p style="margin: 0 0 20px 0;">Hi,</p><p style="margin: 0 0 20px 0;">${intro}</p><div style="background: white; border: 2px dashed ${borderColor}; padding: 20px; text-align: center; border-radius: 8px; margin: 30px 0;"><span style="font-size: 32px; font-weight: bold; color: ${codeColor}; letter-spacing: 5px;">${otp}</span></div><p style="margin: 0 0 10px 0;">This code is valid for <strong>10 minutes</strong>.</p><p style="margin: 0 0 20px 0;">${ignoreText}</p><p style="margin: 30px 0 0 0; color: #666; font-size: 14px;">Best regards,<br>The NearMySpace Team</p></div><div style="text-align: center; padding: 20px; color: #999; font-size: 12px;"><p style="margin: 0;">© 2026 NearMySpace. All rights reserved.</p></div></div></body></html>`;

      return await sendGenericEmail({ email, subject, htmlContent });
    }

    case "generic": {
      const { email, subject, htmlContent } = job.data;
      return await sendGenericEmail({ email, subject, htmlContent });
    }

    case "visit-confirmation": {
      const { emails } = job.data;
      const results = await Promise.allSettled(
        emails.map((e) => sendGenericEmail(e))
      );
      const failed = results.filter((r) => r.status === "rejected");
      if (failed.length) logger.warn(`${failed.length}/${emails.length} visit confirmation emails failed`);
      return { sent: emails.length - failed.length, failed: failed.length };
    }

    default:
      logger.warn(`Unknown email job type: ${type}`);
  }
}
