// Runs as a classic (non-module) service worker, outside Vite's bundler —
// can't use `import.meta.env` here, so firebase.js passes the config as
// query params when it registers this file (see enablePushNotifications).
importScripts("https://www.gstatic.com/firebasejs/12.18.0/firebase-app-compat.js");
importScripts("https://www.gstatic.com/firebasejs/12.18.0/firebase-messaging-compat.js");

const params = new URL(self.location).searchParams;

firebase.initializeApp({
  apiKey: params.get("apiKey"),
  authDomain: params.get("authDomain"),
  projectId: params.get("projectId"),
  messagingSenderId: params.get("messagingSenderId"),
  appId: params.get("appId"),
});

const messaging = firebase.messaging();

// Fires only when this tab is NOT focused/visible (closed, minimized, or
// another tab active) — the foreground case is handled separately in
// firebase.js's listenForForegroundMessages, not here.
messaging.onBackgroundMessage((payload) => {
  const { title, body } = payload.notification || {};
  const data = payload.data || {};

  // Group repeat notifications about the same target (post/circle) instead
  // of stacking a growing pile in the OS tray — a second notification with
  // the same tag replaces the first. renotify makes the replacement still
  // alert the user rather than silently swapping the content underneath them.
  const tag = data.propertyPost || data.circle || data.type || undefined;

  self.registration.showNotification(title || "NearMySpace", {
    body: body || "",
    icon: "/favicon.png",
    badge: "/favicon.png",
    tag,
    renotify: Boolean(tag),
    vibrate: [200, 100, 200],
    data,
    actions: data.url ? [{ action: "open", title: "View" }] : [],
  });
});

// Focuses an already-open tab on that URL if one exists, otherwise opens a
// new one — standard pattern since a service worker has no direct window
// reference of its own. Fires for both the "View" action button and a plain
// click anywhere else on the notification body (event.action is "" then).
self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  if (event.action && event.action !== "open") return;

  const targetUrl = event.notification.data?.url || "/";

  event.waitUntil(
    clients.matchAll({ type: "window", includeUncontrolled: true }).then((windowClients) => {
      for (const client of windowClients) {
        const clientUrl = new URL(client.url);
        if (clientUrl.pathname === targetUrl && "focus" in client) {
          return client.focus();
        }
      }
      return clients.openWindow(targetUrl);
    })
  );
});
