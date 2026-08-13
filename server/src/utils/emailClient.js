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
        name: 'Team SyncSpace'
      },
      subject: "Welcome to SyncSpace!",
      htmlContent: `
        <h2>Hi ${name},</h2>
        <p>Welcome to <strong>SyncSpace</strong>! 🚀</p>
        <p>Start chatting, video calling, and exploring the platform.</p>
        <p>Cheers,<br/>The SyncSpace Team</p>
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
        name: 'Team SyncSpace'
      },
      subject: "Password Reset OTP - SyncSpace",
      htmlContent: `
        <h2>Password Reset Request</h2>
        <p>Hi,</p>
        <p>We received a request to reset your password for your SyncSpace account.</p>
        <p>Your One-Time Password (OTP) is:</p>
        <h3 style="background: #f0f0f0; padding: 15px; text-align: center; font-size: 24px; letter-spacing: 5px;">${otp}</h3>
        <p>This OTP will expire in 10 minutes.</p>
        <p>If you didn't request this password reset, please ignore this email.</p>
        <p>Cheers,<br/>The SyncSpace Team</p>
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
