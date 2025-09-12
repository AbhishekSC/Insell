import { Resend } from "resend";
import { logger } from "../utils/logger.js";
import "dotenv/config";

const resend = new Resend(process.env.RESEND_API);

const sender = {
  email: process.env.RESEND_EMAIL_FROM,
  name: process.env.RESEND_EMAIL_NAME,
};

async function sendEmail(email, name) {
  try {
    // Log sender and recipient info for debugging
    logger.info(
      `Attempting to send email from: ${sender.name} <${sender.email}> to: ${email}`
    );

    const response = await resend.emails.send({
      from: `${sender.name} <${sender.email}>`,
      to: [email],
      subject: "Welcome to SyncSpace!",
      html: `<strong>Hi ${name}: works!</strong>`,
    });

    // Log the full response for debugging
    logger.info(`Resend API response: ${JSON.stringify(response)}`);

    if (response.error) {
      logger.error(`Resend API error: ${JSON.stringify(response.error.message)}`);
    }

    logger.info(`Welcome email sent to ${email}`);
    return response;
  } catch (error) {
    logger.error("Error sending email:", error.error);
  }
}

export { sendEmail };
