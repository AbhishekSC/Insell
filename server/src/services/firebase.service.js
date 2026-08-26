import { initializeApp, cert } from "firebase-admin/app";
import { getMessaging } from "firebase-admin/messaging";
import { logger } from "../utils/logger.js";

let app = null;
let warnedNotConfigured = false;

// Lazy init: only stands up the Admin SDK the first time a push is actually
// requested, and only if FIREBASE_SERVICE_ACCOUNT_JSON is set — so the
// server starts fine (and this channel just no-ops) before Firebase is
// configured, same as how the message queue degrades gracefully.
function getApp() {
  if (app) return app;

  const raw = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
  if (!raw) {
    if (!warnedNotConfigured) {
      logger.warn("FIREBASE_SERVICE_ACCOUNT_JSON not set — push notifications are disabled");
      warnedNotConfigured = true;
    }
    return null;
  }

  try {
    const serviceAccount = JSON.parse(raw);
    app = initializeApp({
      credential: cert(serviceAccount),
    });
    return app;
  } catch (error) {
    logger.error("Failed to initialize Firebase Admin SDK:", error);
    return null;
  }
}

/**
 * Send a push notification to one or more FCM device tokens.
 * Returns the list of tokens that came back invalid/expired so the caller
 * can drop them from the user's stored tokens.
 */
export async function sendPushNotification(tokens, { title, body, data = {} } = {}) {
  const tokenList = (Array.isArray(tokens) ? tokens : [tokens]).filter(Boolean);
  if (tokenList.length === 0) return { sent: 0, staleTokens: [] };

  const firebaseApp = getApp();
  if (!firebaseApp) return { sent: 0, staleTokens: [] };

  try {
    const response = await getMessaging(firebaseApp).sendEachForMulticast({
      tokens: tokenList,
      notification: { title, body },
      data: Object.fromEntries(Object.entries(data).map(([key, value]) => [key, String(value)])),
    });

    const staleTokens = [];
    response.responses.forEach((result, index) => {
      if (!result.success) {
        const code = result.error?.code;
        if (code === "messaging/invalid-registration-token" || code === "messaging/registration-token-not-registered") {
          staleTokens.push(tokenList[index]);
        } else {
          logger.warn("FCM send error (non-fatal):", { token: tokenList[index], code, message: result.error?.message });
        }
      }
    });

    return { sent: response.successCount, staleTokens };
  } catch (error) {
    logger.error("Error sending push notification:", error);
    return { sent: 0, staleTokens: [] };
  }
}
