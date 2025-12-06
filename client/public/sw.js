// Service Worker for PWA - Minimal version to prevent reload loops
const CACHE_NAME = 'secure-chat-v6';

// Install event - don't skipWaiting to prevent reload loops
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(['/favicon.png', '/manifest.json']);
    })
  );
});

// Activate event - clean old caches
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames
          .filter((name) => name !== CACHE_NAME)
          .map((name) => caches.delete(name))
      );
    })
  );
});

// Fetch event - network first, no aggressive caching for HTML/JS
self.addEventListener('fetch', (event) => {
  // Skip non-GET requests
  if (event.request.method !== 'GET') return;
  
  // Skip API and WebSocket requests entirely
  if (event.request.url.includes('/api/') || event.request.url.includes('/ws')) return;
  
  // Skip navigation requests - let browser handle them directly
  if (event.request.mode === 'navigate') return;
  
  // Only cache static assets like images
  const url = new URL(event.request.url);
  if (url.pathname.match(/\.(png|jpg|jpeg|gif|svg|ico)$/)) {
    event.respondWith(
      caches.match(event.request).then((response) => {
        return response || fetch(event.request).then((fetchResponse) => {
          if (fetchResponse.status === 200) {
            const responseClone = fetchResponse.clone();
            caches.open(CACHE_NAME).then((cache) => {
              cache.put(event.request, responseClone);
            });
          }
          return fetchResponse;
        });
      })
    );
  }
});

// Handle push notifications (ADMIN ONLY - server controls who gets push)
self.addEventListener('push', (event) => {
  if (!event.data) return;
  
  try {
    const data = event.data.json();
    const options = {
      body: data.body || 'New message',
      icon: '/favicon.png',
      badge: '/favicon.png',
      tag: data.tag || 'chat-notification',
      renotify: true,
      requireInteraction: false,
      vibrate: [200, 100, 200],
      data: {
        url: data.url || '/'
      }
    };
    
    event.waitUntil(
      self.registration.showNotification(data.title || 'Secure Chat', options)
    );
  } catch (e) {
    console.error('Push notification error:', e);
  }
});

// Handle notification click
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  
  const urlToOpen = event.notification.data?.url || '/';
  
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windowClients) => {
      for (const client of windowClients) {
        if (client.url.includes(self.location.origin) && 'focus' in client) {
          return client.focus();
        }
      }
      if (clients.openWindow) {
        return clients.openWindow(urlToOpen);
      }
    })
  );
});

// Handle messages from the main app
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SHOW_NOTIFICATION') {
    const { title, body, tag } = event.data;
    self.registration.showNotification(title, {
      body,
      icon: '/favicon.png',
      badge: '/favicon.png',
      tag: tag || 'chat-notification',
      renotify: true,
      vibrate: [200, 100, 200]
    });
  }
  
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting().then(() => {
      // Notify all clients to reload
      return self.clients.matchAll().then((clients) => {
        clients.forEach((client) => {
          client.postMessage({ type: 'SW_UPDATED' });
        });
      });
    });
  }
  
  if (event.data && event.data.type === 'CHECK_VERSION') {
    // Check for new version by fetching index.html with cache-busting
    fetch('/?v=' + Date.now(), { cache: 'no-store' })
      .then((response) => response.text())
      .then((html) => {
        // Extract version from script tag in HTML
        const versionMatch = html.match(/APP_VERSION\s*=\s*["']([^"']+)["']/);
        if (versionMatch) {
          const newVersion = versionMatch[1];
          const storedVersion = event.data.currentVersion;
          if (newVersion !== storedVersion) {
            // New version detected - notify clients
            self.clients.matchAll().then((clients) => {
              clients.forEach((client) => {
                client.postMessage({ type: 'NEW_VERSION_AVAILABLE', version: newVersion });
              });
            });
          }
        }
      })
      .catch(() => {
        // Ignore errors
      });
  }
});
