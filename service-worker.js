/* ============================================================
   SERVICE WORKER - Agentic AI Code Editor PWA
   Handles caching, offline support, and asset management
============================================================ */

const CACHE_NAME = 'agentic-ai-v1';
const OFFLINE_URL = '/Editor.html';

// Assets to cache on install
const STATIC_ASSETS = [
  '/Editor.html',
  '/manifest.json',
  '/service-worker.js'
];

// Install event - cache static assets
self.addEventListener('install', (event) => {
  console.log('[SW] Installing service worker...');
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      console.log('[SW] Caching static assets');
      return cache.addAll(STATIC_ASSETS).catch((err) => {
        console.warn('[SW] Error caching assets:', err);
        // Continue even if some assets fail to cache
      });
    })
  );
  self.skipWaiting();
});

// Activate event - clean up old caches
self.addEventListener('activate', (event) => {
  console.log('[SW] Activating service worker...');
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName !== CACHE_NAME) {
            console.log('[SW] Deleting old cache:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
  self.clients.claim();
});

// Fetch event - serve from cache, fallback to network
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Skip API requests to Google Gemini (let them go to network)
  if (url.hostname === 'generativelanguage.googleapis.com') {
    event.respondWith(
      fetch(request)
        .catch(() => {
          // Return a proper error response instead of offline
          return new Response(
            JSON.stringify({
              error: 'API request failed. Check your connection or API key.',
              type: 'api_error'
            }),
            {
              status: 503,
              statusText: 'Service Unavailable',
              headers: { 'Content-Type': 'application/json' }
            }
          );
        })
    );
    return;
  }

  // For HTML navigation requests
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then((response) => {
          // Cache successful HTML responses
          if (response.status === 200) {
            const responseToCache = response.clone();
            caches.open(CACHE_NAME).then((cache) => {
              cache.put(request, responseToCache);
            });
          }
          return response;
        })
        .catch(() => {
          // Serve cached version or offline page
          return caches.match(request).then((cachedResponse) => {
            if (cachedResponse) {
              return cachedResponse;
            }
            // Return offline page
            return caches.match(OFFLINE_URL);
          });
        })
    );
    return;
  }

  // For all other requests, use cache-first strategy
  event.respondWith(
    caches.match(request).then((cachedResponse) => {
      if (cachedResponse) {
        console.log('[SW] Serving from cache:', request.url);
        return cachedResponse;
      }

      return fetch(request)
        .then((response) => {
          // Only cache successful responses
          if (response.status === 200) {
            const responseToCache = response.clone();
            caches.open(CACHE_NAME).then((cache) => {
              cache.put(request, responseToCache);
            });
          }
          return response;
        })
        .catch((err) => {
          console.warn('[SW] Fetch failed:', request.url, err);
          // Return a generic offline response
          return new Response(
            'Offline - Unable to fetch resource',
            { status: 503, statusText: 'Service Unavailable' }
          );
        });
    })
  );
});

// Handle messages from clients
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});
