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
  self.registration.showNotification(title || "NearMySpace", {
    body: body || "",
    icon: "/favicon.png",
    data: payload.data || {},
  });
});

// Focuses an already-open tab on that URL if one exists, otherwise opens a
// new one — standard pattern since a service worker has no direct window
// reference of its own.
self.addEventListener("notificationclick", (event) => {
  event.notification.close();
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
