import axios from "axios";
import { enqueueNotification } from "../queues/notification.queue.js";
import { logger } from "./logger.js";

const BREVO_API_URL = "https://api.brevo.com/v3/smtp/email";

export async function sendWelcomeEmail({ email, name }) {
  if (!email || !name) {
    return { success: false, error: "Missing email or name" };
  }

  try {
    const sendSmtpEmail = {
      to: [{ email }],
      sender: {
        email: process.env.BREVO_FROM_EMAIL || 'noreply@brevo.com',
        name: 'NearMySpace'
      },
      subject: "Welcome to NearMySpace!",
      htmlContent: `
        <!DOCTYPE html>
        <html>
          <head>
            <meta charset="utf-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>Welcome to NearMySpace</title>
          </head>
          <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
            <div style="max-width: 600px; margin: 0 auto; padding: 20px;">
              <div style="background: linear-gradient(135deg, #10b981 0%, #059669 100%); padding: 30px; border-radius: 10px 10px 0 0; text-align: center;">
                <div style="background: white; display: inline-block; padding: 10px 18px; border-radius: 8px;">
                  <img src="https://nearmy-space.vercel.app/logo-email.png" alt="Insell" style="height: 32px; display: block;" />
                </div>
                <p style="color: rgba(255,255,255,0.9); margin: 10px 0 0 0;">Welcome Aboard! 🎉</p>
              </div>
              <div style="background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px;">
                <p style="margin: 0 0 20px 0;">Hi ${name},</p>
                <p style="margin: 0 0 20px 0;">Welcome to <strong>NearMySpace</strong>! Start chatting, video calling, and exploring properties on the platform.</p>
                <p style="margin: 30px 0 0 0; color: #666; font-size: 14px;">
                  Best regards,<br>
                  The NearMySpace Team
                </p>
              </div>
              <div style="text-align: center; padding: 20px; color: #999; font-size: 12px;">
                <p style="margin: 0;">© 2026 NearMySpace. All rights reserved.</p>
              </div>
            </div>
          </body>
        </html>
      `,
    };

    const response = await axios.post(BREVO_API_URL, sendSmtpEmail, {
      timeout: 10000,
      headers: {
        'api-key': process.env.BREVO_API_KEY,
        'Content-Type': 'application/json',
      },
    });

    return { success: true, id: response.data?.messageId };
  } catch (error) {
    return { success: false, error };
  }
}

// Generic sender for notification content that doesn't have its own fixed
// template (welcome/OTP emails above do) — used by NotificationService's
// EMAIL channel, where subject/body vary per notification type.
export async function sendGenericEmail({ email, subject, htmlContent }) {
  if (!email || !subject || !htmlContent) {
    return { success: false, error: "Missing email, subject, or htmlContent" };
  }

  try {
    const sendSmtpEmail = {
      to: [{ email }],
      sender: {
        email: process.env.BREVO_FROM_EMAIL || 'noreply@brevo.com',
        name: 'NearMySpace'
      },
      subject,
      htmlContent,
    };

    const response = await axios.post(BREVO_API_URL, sendSmtpEmail, {
      timeout: 10000,
      headers: {
        'api-key': process.env.BREVO_API_KEY,
        'Content-Type': 'application/json',
      },
    });

    return { success: true, id: response.data?.messageId };
  } catch (error) {
    logger.error("Failed to send email via Brevo:", error?.message);
    throw error;
  }
}

export async function sendResetOTPEmail({ email, otp }) {
  if (!email || !otp) {
    return { success: false, error: "Missing email or OTP" };
  }

  const subject = "Password Reset OTP - NearMySpace";
  const htmlContent = `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Password Reset</title>
      </head>
      <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
        <div style="max-width: 600px; margin: 0 auto; padding: 20px;">
          <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 30px; border-radius: 10px 10px 0 0; text-align: center;">
            <div style="background: white; display: inline-block; padding: 10px 18px; border-radius: 8px;">
              <img src="https://nearmy-space.vercel.app/logo-email.png" alt="Insell" style="height: 32px; display: block;" />
            </div>
            <p style="color: rgba(255,255,255,0.9); margin: 10px 0 0 0;">Password Reset Request</p>
          </div>
          <div style="background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px;">
            <p style="margin: 0 0 20px 0;">Hi,</p>
            <p style="margin: 0 0 20px 0;">We received a request to reset your password for your NearMySpace account. Use the code below to continue:</p>

            <div style="background: white; border: 2px dashed #667eea; padding: 20px; text-align: center; border-radius: 8px; margin: 30px 0;">
              <span style="font-size: 32px; font-weight: bold; color: #667eea; letter-spacing: 5px;">${otp}</span>
            </div>

            <p style="margin: 0 0 10px 0;">This code will expire in <strong>10 minutes</strong>.</p>
            <p style="margin: 0 0 20px 0;">If you didn't request this password reset, you can safely ignore this email.</p>

            <p style="margin: 30px 0 0 0; color: #666; font-size: 14px;">
              Best regards,<br>
              The NearMySpace Team
            </p>
          </div>
          <div style="text-align: center; padding: 20px; color: #999; font-size: 12px;">
            <p style="margin: 0;">© 2026 NearMySpace. All rights reserved.</p>
          </div>
        </div>
      </body>
    </html>
  `;

  try {
    await enqueueNotification("EMAIL", { email, subject, htmlContent });
    return { success: true };
  } catch (error) {
    logger.warn("Failed to enqueue reset OTP email, sending directly:", error?.message);
    return await sendGenericEmail({ email, subject, htmlContent });
  }
}

export async function sendLoginOTPEmail({ email, otp }) {
  if (!email || !otp) {
    return { success: false, error: "Missing email or OTP" };
  }

  const subject = "Your Login Code - NearMySpace";
  const htmlContent = `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Login Code</title>
      </head>
      <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
        <div style="max-width: 600px; margin: 0 auto; padding: 20px;">
          <div style="background: linear-gradient(135deg, #10b981 0%, #059669 100%); padding: 30px; border-radius: 10px 10px 0 0; text-align: center;">
            <div style="background: white; display: inline-block; padding: 10px 18px; border-radius: 8px;">
              <img src="https://nearmy-space.vercel.app/logo-email.png" alt="Insell" style="height: 32px; display: block;" />
            </div>
            <p style="color: rgba(255,255,255,0.9); margin: 10px 0 0 0;">Passwordless Sign-In 🔐</p>
          </div>
          <div style="background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px;">
            <p style="margin: 0 0 20px 0;">Hi,</p>
            <p style="margin: 0 0 20px 0;">Use the 6-digit login code below to quickly access your NearMySpace account:</p>

            <div style="background: white; border: 2px dashed #10b981; padding: 20px; text-align: center; border-radius: 8px; margin: 30px 0;">
              <span style="font-size: 32px; font-weight: bold; color: #059669; letter-spacing: 5px;">${otp}</span>
            </div>

            <p style="margin: 0 0 10px 0;">This code is valid for <strong>10 minutes</strong>.</p>
            <p style="margin: 0 0 20px 0;">If you did not request this login code, you can safely ignore this email.</p>

            <p style="margin: 30px 0 0 0; color: #666; font-size: 14px;">
              Best regards,<br>
              The NearMySpace Team
            </p>
          </div>
          <div style="text-align: center; padding: 20px; color: #999; font-size: 12px;">
            <p style="margin: 0;">© 2026 NearMySpace. All rights reserved.</p>
          </div>
        </div>
      </body>
    </html>
  `;

  try {
    await enqueueNotification("EMAIL", { email, subject, htmlContent });
    return { success: true };
  } catch (error) {
    logger.warn("Failed to enqueue login OTP email, sending directly:", error?.message);
    return await sendGenericEmail({ email, subject, htmlContent });
  }
}
