import axios from "axios";
import { logger } from "../utils/logger.js";

const BREVO_API_URL = "https://api.brevo.com/v3/smtp/email";

/**
 * Send verification code email
 */
export async function sendVerificationEmail(email, code, userName) {
  const BREVO_API_KEY = process.env.BREVO_API_KEY;
  try {
    logger.info(`📧 Attempting to send verification email to ${email}`);
    logger.info(`🔑 BREVO_API_KEY configured: ${!!BREVO_API_KEY}`);
    logger.info(`📧 BREVO_FROM_EMAIL: ${process.env.BREVO_FROM_EMAIL || "not set"}`);

    const subject = "Verify your email address";
    const html = `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Email Verification</title>
        </head>
        <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
          <div style="max-width: 600px; margin: 0 auto; padding: 20px;">
            <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 30px; border-radius: 10px 10px 0 0; text-align: center;">
              <h1 style="color: white; margin: 0; font-size: 28px;">Insell</h1>
              <p style="color: rgba(255,255,255,0.9); margin: 10px 0 0 0;">Email Verification</p>
            </div>
            <div style="background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px;">
              <p style="margin: 0 0 20px 0;">Hi ${userName || 'there'},</p>
              <p style="margin: 0 0 20px 0;">Thank you for signing up for Insell! To complete your registration and get your verified badge, please use the verification code below:</p>
              
              <div style="background: white; border: 2px dashed #667eea; padding: 20px; text-align: center; border-radius: 8px; margin: 30px 0;">
                <span style="font-size: 32px; font-weight: bold; color: #667eea; letter-spacing: 5px;">${code}</span>
              </div>
              
              <p style="margin: 0 0 10px 0;">This code will expire in <strong>10 minutes</strong>.</p>
              <p style="margin: 0 0 20px 0;">If you didn't request this code, please ignore this email.</p>
              
              <p style="margin: 30px 0 0 0; color: #666; font-size: 14px;">
                Best regards,<br>
                The Insell Team
              </p>
            </div>
            <div style="text-align: center; padding: 20px; color: #999; font-size: 12px;">
              <p style="margin: 0;">© 2026 Insell. All rights reserved.</p>
            </div>
          </div>
        </body>
      </html>
    `;

    const sendSmtpEmail = {
      to: [{ email }],
      sender: { 
        email: process.env.BREVO_FROM_EMAIL || 'noreply@brevo.com',
        name: 'Insell'
      },
      subject,
      htmlContent: html,
    };

    logger.info(`📤 Sending to Brevo API: ${BREVO_API_URL}`);
    const response = await axios.post(BREVO_API_URL, sendSmtpEmail, {
      headers: {
        'api-key': process.env.BREVO_API_KEY,
        'Content-Type': 'application/json',
      },
    });

    logger.info(`✅ Verification email sent to ${email}`, { messageId: response.data?.messageId, response: response.data });
    return { success: true, messageId: response.data?.messageId };
  } catch (error) {
    logger.error(`❌ Failed to send verification email to ${email}`, { 
      error: error.message, 
      response: error.response?.data,
      status: error.response?.status 
    });
    throw new Error(`Failed to send email: ${error.message}`);
  }
}

/**
 * Send welcome email after successful verification
 */
export async function sendWelcomeEmail(email, userName) {
  try {
    const subject = "Welcome to Insell!";
    const html = `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Welcome to Insell</title>
        </head>
        <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
          <div style="max-width: 600px; margin: 0 auto; padding: 20px;">
            <div style="background: linear-gradient(135deg, #10b981 0%, #059669 100%); padding: 30px; border-radius: 10px 10px 0 0; text-align: center;">
              <h1 style="color: white; margin: 0; font-size: 28px;">Insell</h1>
              <p style="color: rgba(255,255,255,0.9); margin: 10px 0 0 0;">Welcome Aboard! 🎉</p>
            </div>
            <div style="background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px;">
              <p style="margin: 0 0 20px 0;">Hi ${userName || 'there'},</p>
              <p style="margin: 0 0 20px 0;">Congratulations! Your email has been verified successfully. You now have the verified badge on your profile.</p>
              
              <div style="background: white; padding: 20px; border-radius: 8px; margin: 30px 0; border-left: 4px solid #10b981;">
                <p style="margin: 0; font-weight: bold; color: #10b981;">✓ Your account is now verified</p>
                <p style="margin: 10px 0 0 0; color: #666;">You can now enjoy all the benefits of being a verified user on Insell.</p>
              </div>
              
              <p style="margin: 30px 0 0 0; color: #666; font-size: 14px;">
                Best regards,<br>
                The Insell Team
              </p>
            </div>
            <div style="text-align: center; padding: 20px; color: #999; font-size: 12px;">
              <p style="margin: 0;">© 2026 Insell. All rights reserved.</p>
            </div>
          </div>
        </body>
      </html>
    `;

    const sendSmtpEmail = {
      to: [{ email }],
      sender: { 
        email: process.env.BREVO_FROM_EMAIL || 'noreply@brevo.com',
        name: 'Insell'
      },
      subject,
      htmlContent: html,
    };

    const response = await axios.post(BREVO_API_URL, sendSmtpEmail, {
      headers: {
        'api-key': process.env.BREVO_API_KEY,
        'Content-Type': 'application/json',
      },
    });

    logger.info(`✅ Welcome email sent to ${email}`, { messageId: response.data?.messageId });
    return { success: true, messageId: response.data?.messageId };
  } catch (error) {
    logger.error(`❌ Failed to send welcome email to ${email}`, { error: error.message });
    throw new Error(`Failed to send email: ${error.message}`);
  }
}
