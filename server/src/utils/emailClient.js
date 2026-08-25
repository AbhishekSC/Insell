import axios from "axios";

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
        name: 'Insell'
      },
      subject: "Welcome to Insell!",
      htmlContent: `
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
                <p style="margin: 0 0 20px 0;">Hi ${name},</p>
                <p style="margin: 0 0 20px 0;">Welcome to <strong>Insell</strong>! Start chatting, video calling, and exploring properties on the platform.</p>
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
      `,
    };

    const response = await axios.post(BREVO_API_URL, sendSmtpEmail, {
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

export async function sendResetOTPEmail({ email, otp }) {
  if (!email || !otp) {
    return { success: false, error: "Missing email or OTP" };
  }

  try {
    const sendSmtpEmail = {
      to: [{ email }],
      sender: {
        email: process.env.BREVO_FROM_EMAIL || 'noreply@brevo.com',
        name: 'Insell'
      },
      subject: "Password Reset OTP - Insell",
      htmlContent: `
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
                <h1 style="color: white; margin: 0; font-size: 28px;">Insell</h1>
                <p style="color: rgba(255,255,255,0.9); margin: 10px 0 0 0;">Password Reset Request</p>
              </div>
              <div style="background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px;">
                <p style="margin: 0 0 20px 0;">Hi,</p>
                <p style="margin: 0 0 20px 0;">We received a request to reset your password for your Insell account. Use the code below to continue:</p>

                <div style="background: white; border: 2px dashed #667eea; padding: 20px; text-align: center; border-radius: 8px; margin: 30px 0;">
                  <span style="font-size: 32px; font-weight: bold; color: #667eea; letter-spacing: 5px;">${otp}</span>
                </div>

                <p style="margin: 0 0 10px 0;">This code will expire in <strong>10 minutes</strong>.</p>
                <p style="margin: 0 0 20px 0;">If you didn't request this password reset, you can safely ignore this email.</p>

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
      `,
    };

    const response = await axios.post(BREVO_API_URL, sendSmtpEmail, {
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
