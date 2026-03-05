// Service Worker for Push Notifications + deploy-safe asset caching
const SW_VERSION = new URL(self.location.href).searchParams.get("v") || "dev";
const STATIC_CACHE = `pyqmaster-static-${SW_VERSION}`;
const RUNTIME_CACHE = `pyqmaster-runtime-${SW_VERSION}`;
const CACHE_PREFIX = "pyqmaster-";
const PRECACHE_URLS = ["/", "/index.html", "/manifest.json", "/favicon.png"];
const IS_LOCALHOST =
  self.location.hostname === "localhost" ||
  self.location.hostname === "127.0.0.1";

self.addEventListener("install", (event) => {
  if (IS_LOCALHOST) {
    self.skipWaiting();
    return;
  }
  event.waitUntil(
    (async () => {
      self.skipWaiting();
      const cache = await caches.open(STATIC_CACHE);
      await cache.addAll(PRECACHE_URLS);
    })()
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(
        keys
          .filter((key) => key.startsWith(CACHE_PREFIX) && key !== STATIC_CACHE && key !== RUNTIME_CACHE)
          .map((key) => caches.delete(key))
      );
      await self.clients.claim();
    })()
  );
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;
  if (IS_LOCALHOST) {
    event.respondWith(fetch(req));
    return;
  }
  if (req.headers.has("range") || req.cache === "no-store") {
    event.respondWith(fetch(req));
    return;
  }

  const url = new URL(req.url);

  // Never cache Cloudinary upload responses or API traffic.
  if (
    url.hostname === "api.cloudinary.com" ||
    url.pathname.startsWith("/api/")
  ) {
    event.respondWith(fetch(req));
    return;
  }

  const isNavigation = req.mode === "navigate" || url.pathname === "/" || url.pathname.endsWith("/index.html");
  if (isNavigation) {
    // index.html should always be network-first to avoid stale bundles.
    event.respondWith(
      (async () => {
        try {
          const networkRes = await fetch(req);
          if (networkRes.ok) {
            const cache = await caches.open(STATIC_CACHE);
            cache.put("/index.html", networkRes.clone());
          }
          return networkRes;
        } catch (_err) {
          const cached = await caches.match("/index.html");
          return cached || new Response("Offline", { status: 503 });
        }
      })()
    );
    return;
  }

  const isStaticAsset = /\.(js|css|png|jpg|jpeg|gif|svg|webp|ico|woff2?)$/i.test(url.pathname);
  if (isStaticAsset && url.origin === self.location.origin) {
    event.respondWith(
      (async () => {
        const cached = await caches.match(req);
        if (cached) return cached;
        const networkRes = await fetch(req);
        if (networkRes.ok) {
          const cache = await caches.open(RUNTIME_CACHE);
          cache.put(req, networkRes.clone());
        }
        return networkRes;
      })()
    );
  }
});

// Handle incoming push
self.addEventListener("push", (event) => {
  let data = {};

  if (event.data) {
    try {
      data = event.data.json();
    } catch (e) {
      data = { title: "New Message", body: "You have a new message" };
    }
  }

  const title = data.title || "💬 New Message";

  const options = {
    body: data.body || "You have a new message",
    icon: data.icon || "/favicon.png",
    badge: data.badge || "/favicon.png",
    vibrate: [300, 120, 300],
    tag: data.tag || "chat-notification",
    renotify: true,
    requireInteraction: false,
    sound: "default",            // OS-level sound
    data: {
      url: data.url || "/"
    },
    actions: [
      { action: "open", title: "Open Chat" }
    ]
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

// Handle notification click
self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const urlToOpen = event.notification.data?.url || "/";

  event.waitUntil(
    clients.matchAll({ type: "window", includeUncontrolled: true }).then((clientsArr) => {
      for (const client of clientsArr) {
        if (client.url === urlToOpen && "focus" in client) {
          return client.focus();
        }
      }
      if (clients.openWindow) return clients.openWindow(urlToOpen);
    })
  );
});

// handle skip waiting
self.addEventListener("message", (event) => {
  if (event.data?.type === "SKIP_WAITING") {
    self.skipWaiting();
  }
});
