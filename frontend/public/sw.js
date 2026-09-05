const CACHE_NAME = 'hsmc-portal-cache-v3';

const ASSETS_TO_CACHE = [
  '/internal/',
  '/internal/pets/',
  '/internal/board/',
  '/internal/grants/',
  '/manifest.webmanifest',
  '/assets/brand-mark-paw-circle.png',
  '/placeholder.svg',
  '/tv/'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(ASSETS_TO_CACHE).catch(() => {});
    })
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName !== CACHE_NAME) {
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
  self.clients.claim();
});

/**
 * Safely cache successful responses.
 * Cache API explicitly rejects status 206 (Partial Content) with:
 * "TypeError: Failed to execute 'put' on 'Cache': Partial response (status code 206) is unsupported"
 * Only standard 200 responses are cached, with errors safely caught.
 */
function safeCachePut(cacheName, request, response) {
  if (!response || !response.ok || response.status !== 200) {
    return;
  }
  const resClone = response.clone();
  caches.open(cacheName)
    .then((cache) => {
      cache.put(request, resClone).catch(() => {});
    })
    .catch(() => {});
}

self.addEventListener('fetch', (event) => {
  // Only handle GET requests
  if (event.request.method !== 'GET') return;

  // Bypass cache for Range requests (streaming audio/video, partial byte requests)
  if (event.request.headers.has('range')) {
    return;
  }

  const url = new URL(event.request.url);

  // Directus API & CMS items - Network first with cache fallback
  if (url.origin === 'https://mchs-directus.livelyfield-d0a70609.eastus.azurecontainerapps.io') {
    event.respondWith(
      fetch(event.request)
        .then((response) => {
          safeCachePut(CACHE_NAME, event.request, response);
          return response;
        })
        .catch(() => caches.match(event.request))
    );
    return;
  }

  // HTML page navigation - Network first with fast cache fallback
  if (event.request.mode === 'navigate') {
    event.respondWith(
      fetch(event.request)
        .then((networkResponse) => {
          safeCachePut(CACHE_NAME, event.request, networkResponse);
          return networkResponse;
        })
        .catch(() => {
          return caches.match(event.request).then((cachedResponse) => {
            return cachedResponse || caches.match('/internal/');
          });
        })
    );
    return;
  }

  // Static assets (images, CSS, JS, fonts) - Stale-while-revalidate
  event.respondWith(
    caches.match(event.request).then((cachedResponse) => {
      const fetchPromise = fetch(event.request)
        .then((networkResponse) => {
          safeCachePut(CACHE_NAME, event.request, networkResponse);
          return networkResponse;
        })
        .catch(() => null);

      return cachedResponse || fetchPromise;
    })
  );
});
