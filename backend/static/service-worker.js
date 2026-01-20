const CACHE_NAME = 'weather-dashboard-v58';
const urlsToCache = [
  '/',
  '/styles.css',
  '/overview-new.css',
  '/aurora-compact.css'
];

// Don't cache JS files - always fetch fresh
const noCacheFiles = [
  'app.js',
  'overview-new.js',
  '.js'
];

// Force immediate activation
self.addEventListener('install', event => {
  console.log('Service Worker v51 installing...');
  // Skip waiting to activate immediately
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        console.log('Opened cache');
        return cache.addAll(urlsToCache);
      })
      .catch(err => {
        console.log('Cache install failed:', err);
      })
  );
});

// Fetch from cache, fallback to network
self.addEventListener('fetch', event => {
  // Skip caching for API calls - always fetch fresh data
  if (event.request.url.includes('/api/')) {
    return event.respondWith(fetch(event.request));
  }
  
  // Skip caching for JS files - always fetch fresh
  if (event.request.url.endsWith('.js')) {
    return event.respondWith(fetch(event.request));
  }

  event.respondWith(
    caches.match(event.request)
      .then(response => {
        // Cache hit - return response
        if (response) {
          return response;
        }
        // Clone the request
        const fetchRequest = event.request.clone();

        return fetch(fetchRequest).then(response => {
          // Check if valid response
          if (!response || response.status !== 200 || response.type !== 'basic') {
            return response;
          }

          // Clone the response
          const responseToCache = response.clone();

          caches.open(CACHE_NAME)
            .then(cache => {
              cache.put(event.request, responseToCache);
            });

          return response;
        });
      })
  );
});

// Clean up old caches
self.addEventListener('activate', event => {
  console.log('Service Worker v51 activating - clearing ALL old caches...');
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.map(cacheName => {
          // Delete ALL caches except current one
          if (cacheName !== CACHE_NAME) {
            console.log('Deleting old cache:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    }).then(() => {
      console.log('All old caches cleared, taking control of clients...');
      return self.clients.claim();
    })
  );
});

// Listen for messages from page to show notifications
self.addEventListener('message', (event) => {
  const data = event.data || {};
  if (data.type === 'show-notification') {
    const title = data.title || 'Notification';
    const body = data.body || '';
    self.registration.showNotification(title, {
      body,
      icon: '/icon-192.png',
      badge: '/icon-192.png',
      vibrate: [100, 50, 100],
      tag: 'weather-dashboard',
      requireInteraction: false
    });
  }
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  event.waitUntil(
    clients.matchAll({ type: 'window' }).then(clientList => {
      for (const client of clientList) {
        if ('focus' in client) return client.focus();
      }
      if (clients.openWindow) return clients.openWindow('/');
    })
  );
});

// Handle push events (background notifications)
self.addEventListener('push', (event) => {
  console.log('Push event received:', event);
  
  let data = {};
  if (event.data) {
    try {
      data = event.data.json();
    } catch (e) {
      data = {
        title: 'Weather Dashboard',
        body: event.data.text()
      };
    }
  }
  
  const title = data.title || 'Weather Dashboard';
  const options = {
    body: data.body || 'You have a new notification',
    icon: data.icon || '/icon-192.png',
    badge: '/icon-192.png',
    vibrate: [200, 100, 200],
    tag: 'weather-push',
    requireInteraction: false,
    data: {
      url: data.url || '/'
    }
  };
  
  event.waitUntil(
    self.registration.showNotification(title, options)
  );
});
