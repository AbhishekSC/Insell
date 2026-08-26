import { initializeApp } from "firebase/app";
import { getMessaging, getToken, isSupported, onMessage } from "firebase/messaging";
import axiosInstance from "./axios";

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_PROJECT_ID ? `${import.meta.env.VITE_FIREBASE_PROJECT_ID}.firebaseapp.com` : undefined,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
};

const vapidKey = import.meta.env.VITE_FIREBASE_VAPID_KEY;
const STORED_TOKEN_KEY = "nearmyspace_fcm_token";

// Every VITE_FIREBASE_* var is unset until the Firebase project is actually
// created — this file has to load fine either way, so every export below
// checks this before touching the SDK.
const isConfigured = Boolean(firebaseConfig.apiKey && firebaseConfig.projectId && firebaseConfig.appId && vapidKey);

/**
 * Current browser permission state — "default" (never asked), "granted",
 * "denied", or "unsupported" (no Notification API / not configured at all).
 * Lets the UI show the right state without needing its own tracking.
 */
export function getNotificationPermissionState() {
  if (!isConfigured || typeof Notification === "undefined") return "unsupported";
  return Notification.permission;
}

/**
 * Whether THIS browser currently has a token registered with our backend.
 * Distinct from browser permission: permission can be "granted" while we
 * still have no token (getToken failed, or it was granted outside our flow
 * and never registered), and permission can't be un-granted via JS at all —
 * so this, not Notification.permission, is what should drive "is push
 * actually on" in the UI.
 */
export function hasRegisteredPushToken() {
  return Boolean(localStorage.getItem(STORED_TOKEN_KEY));
}

let messagingPromise = null;

async function getMessagingInstance() {
  if (!isConfigured) return null;
  if (!messagingPromise) {
    messagingPromise = (async () => {
      if (!(await isSupported())) return null; // Safari/older browsers, private mode, etc.
      const app = initializeApp(firebaseConfig);
      return getMessaging(app);
    })();
  }
  return messagingPromise;
}

/**
 * Requests browser notification permission (must be called from a real user
 * gesture, e.g. a button click — browsers ignore/ block silent auto-prompts)
 * and, if granted, registers this device for push and saves its token.
 * Safe to call even when Firebase isn't configured yet — just resolves false.
 */
export async function enablePushNotifications() {
  if (!isConfigured) {
    console.warn("Firebase push notifications are not configured yet");
    return false;
  }

  try {
    const permission = await Notification.requestPermission();
    if (permission !== "granted") return false;

    const messaging = await getMessagingInstance();
    if (!messaging) return false;

    const swParams = new URLSearchParams({
      apiKey: firebaseConfig.apiKey,
      authDomain: firebaseConfig.authDomain,
      projectId: firebaseConfig.projectId,
      messagingSenderId: firebaseConfig.messagingSenderId,
      appId: firebaseConfig.appId,
    });
    const registration = await navigator.serviceWorker.register(`/firebase-messaging-sw.js?${swParams.toString()}`);
    const token = await getToken(messaging, { vapidKey, serviceWorkerRegistration: registration });
    if (!token) return false;

    await axiosInstance.post("/users/fcm-token", { token });
    localStorage.setItem(STORED_TOKEN_KEY, token);
    return true;
  } catch (error) {
    console.error("Failed to enable push notifications:", error);
    return false;
  }
}

/**
 * Stops this device's token from receiving pushes (unregisters it
 * server-side). Note: this can't revoke the browser's notification
 * *permission* itself — only the user can do that via browser/site settings.
 * "Disabling" here means our backend simply won't have a token to push to.
 */
export async function disablePushNotifications() {
  const token = localStorage.getItem(STORED_TOKEN_KEY);
  if (!token) return true;

  try {
    await axiosInstance.delete("/users/fcm-token", { data: { token } });
    localStorage.removeItem(STORED_TOKEN_KEY);
    return true;
  } catch (error) {
    console.error("Failed to disable push notifications:", error);
    return false;
  }
}

/**
 * Shows an in-app toast when a push arrives while this tab is focused —
 * background pushes (tab unfocused/minimized/closed) are handled by the
 * service worker instead and don't go through this.
 */
export async function listenForForegroundMessages(onMessageReceived) {
  const messaging = await getMessagingInstance();
  if (!messaging) return () => {};
  return onMessage(messaging, onMessageReceived);
}

export { isConfigured as isPushNotificationsConfigured };
