/* MANEXA service worker — Web Push receiver.
   Shows a notification even when the app/tab is closed, and focuses (or opens)
   the right page on click. Kept dependency-free so it stays tiny and cacheable. */

self.addEventListener("push", (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch (e) {
    data = { title: "MANEXA", body: event.data ? event.data.text() : "" };
  }
  const title = data.title || "MANEXA";
  const options = {
    body: data.body || "",
    icon: "/manexa-mark.svg",
    badge: "/manexa-mark.svg",
    tag: data.tag || undefined,
    data: { url: data.href || "/notifications" },
    renotify: Boolean(data.tag),
  };
  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = (event.notification.data && event.notification.data.url) || "/notifications";
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if ("focus" in client && client.url.includes(url)) return client.focus();
      }
      // Otherwise focus any open window and navigate, or open a fresh one.
      for (const client of clientList) {
        if ("focus" in client && "navigate" in client) {
          client.focus();
          return client.navigate(url);
        }
      }
      if (self.clients.openWindow) return self.clients.openWindow(url);
    })
  );
});

// Activate immediately so a freshly-registered SW can receive pushes.
self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (event) => event.waitUntil(self.clients.claim()));
