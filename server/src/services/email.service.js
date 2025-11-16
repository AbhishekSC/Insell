import "dotenv/config";
import { Resend } from "resend";
import { logger } from "../utils/logger.js";

// const resend = new Resend(process.env.RESEND_API || "***REMOVED-RESEND-KEY***");
const resend = new Resend("***REMOVED-RESEND-KEY***");

const sender = {
   email: process.env.RESEND_EMAIL_FROM || "onboarding@resend.dev",
  name: process.env.RESEND_EMAIL_NAME || "Team SyncSpace",
};

/**
 * Send a welcome email to a new user.
 * @param {string} email - Recipient email address
 * @param {string} name - Recipient name
 * @returns {Promise<{success: boolean, id?: string, error?: any}>}
 */
async function sendEmail(email, name) {
  if (!email || !name) {
    // logger.error("sendEmail: Missing email or name");
    return { success: false, error: "Missing email or name" };
  }

  try {
    // logger.info("Attempting to send email", { from: sender.email, to: email });

    const response = await resend.emails.send({
      // from: `${sender.name} <${sender.email}>`,
      from: `Team SyncSpace <onboarding@resend.dev>`,
      to: [email],
      subject: "Welcome to SyncSpace!",
      html: `
        <h2>Hi ${name},</h2>
        <p>Welcome to <strong>SyncSpace</strong>! 🚀</p>
        <p>Start chatting, video calling, and exploring the platform.</p>
        <p>Cheers,<br/>The SyncSpace Team</p>
      `,
    });

    if (response.error) {
      // logger.error("Resend API returned an error", { error: response.error });
      return { success: false, error: response.error };
    }

    // logger.info("Welcome email sent successfully", { email, id: response.id });
    return { success: true, id: response.id };
  } catch (error) {
    // logger.error("Failed to send email due to exception", { error });
    return { success: false, error };
  }
}

export { sendEmail };
