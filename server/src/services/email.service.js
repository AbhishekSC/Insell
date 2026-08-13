import { sendWelcomeEmail } from "../utils/emailClient.js";

export async function sendEmail(email, name) {
  return sendWelcomeEmail({ email, name });
}
