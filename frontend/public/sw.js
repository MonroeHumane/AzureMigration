const SHELL_CACHE = 'hsmc-shell-cache-v6';
const PET_DATA_CACHE = 'hsmc-pet-data-cache-v4';
const PET_PHOTO_CACHE = 'hsmc-pet-photo-cache-v4';
const KNOWN_CACHES = [SHELL_CACHE, PET_DATA_CACHE, PET_PHOTO_CACHE];

const DIRECTUS_ORIGIN = 'https://mchs-directus.livelyfield-d0a70609.eastus.azurecontainerapps.io';
const PET_PHOTO_HOST_SUFFIX = '.blob.core.windows.net';
const PET_PHOTO_CACHE_MAX_ENTRIES = 150;

const ASSETS_TO_CACHE = [
  '/',
  '/internal/',
  '/internal/pets/',
  '/internal/board/',
  '/internal/grants/',
  '/adopt/',
  '/adopt/dogs/',
  '/adopt/cats/',
  '/manifest.webmanifest',
  '/manifest-adopt.webmanifest',
  '/assets/brand-mark-paw-circle.png',
  '/placeholder.svg',
  '/tv/',
  '/games/',
  '/games/booster/index.html',
  '/games/match/match.html',
  '/games/flappy-cat/index.html',
  '/games/dex/album.html'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(SHELL_CACHE).then((cache) => {
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
          if (!KNOWN_CACHES.includes(cacheName)) {
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

/**
 * Cache a cross-origin, no-cors image response. These come back as "opaque"
 * (status 0, ok: false) since the browser can't expose cross-origin response
 * details to the SW without CORS headers — safeCachePut's ok/status check
 * would always reject them, so accept any resolved response here instead.
 */
function cacheOpaquePut(cacheName, request, response) {
  if (!response) return;
  const resClone = response.clone();
  caches.open(cacheName)
    .then((cache) => {
      cache.put(request, resClone).catch(() => {});
    })
    .catch(() => {});
}

/**
 * Bound a cache's entry count by evicting the oldest entries first (Cache
 * Storage preserves insertion order via keys()).
 */
function trimCache(cacheName, maxEntries) {
  caches.open(cacheName).then((cache) => {
    cache.keys().then((keys) => {
      if (keys.length <= maxEntries) return;
      const excess = keys.length - maxEntries;
      for (let i = 0; i < excess; i++) {
        cache.delete(keys[i]);
      }
    });
  });
}

self.addEventListener('fetch', (event) => {
  // Only handle GET requests
  if (event.request.method !== 'GET') return;

  // Bypass cache for Range requests (streaming audio/video, partial byte requests)
  if (event.request.headers.has('range')) {
    return;
  }

  const url = new URL(event.request.url);

  // Directus pet roster list - Stale-while-revalidate so syncLiveCatalog()
  // on the adopt pages has last-known data instantly, even offline.
  if (url.origin === DIRECTUS_ORIGIN && url.pathname.startsWith('/items/pets')) {
    event.respondWith(
      caches.match(event.request).then((cachedResponse) => {
        const fetchPromise = fetch(event.request)
          .then((networkResponse) => {
            safeCachePut(PET_DATA_CACHE, event.request, networkResponse);
            return networkResponse;
          })
          .catch(() => null);

        return cachedResponse || fetchPromise;
      })
    );
    return;
  }

  // Other Directus API & CMS items - Network first with cache fallback
  if (url.origin === DIRECTUS_ORIGIN) {
    event.respondWith(
      fetch(event.request)
        .then((response) => {
          safeCachePut(SHELL_CACHE, event.request, response);
          return response;
        })
        .catch(() => caches.match(event.request))
    );
    return;
  }

  // Pet photos (Azure Blob Storage) - Cache first, capped
  if (url.hostname.endsWith(PET_PHOTO_HOST_SUFFIX)) {
    event.respondWith(
      caches.match(event.request).then((cachedResponse) => {
        if (cachedResponse) return cachedResponse;
        return fetch(event.request).then((networkResponse) => {
          cacheOpaquePut(PET_PHOTO_CACHE, event.request, networkResponse);
          trimCache(PET_PHOTO_CACHE, PET_PHOTO_CACHE_MAX_ENTRIES);
          return networkResponse;
        });
      })
    );
    return;
  }

  // HTML page navigation - Network first with route-aware cache fallback
  if (event.request.mode === 'navigate') {
    event.respondWith(
      fetch(event.request)
        .then((networkResponse) => {
          safeCachePut(SHELL_CACHE, event.request, networkResponse);
          return networkResponse;
        })
        .catch(() => {
          return caches.match(event.request).then((cachedResponse) => {
            if (cachedResponse) return cachedResponse;
            if (url.pathname.startsWith('/internal')) return caches.match('/internal/');
            if (url.pathname.startsWith('/adopt')) return caches.match('/adopt/');
            if (url.pathname.startsWith('/games')) return caches.match('/games/');
            return caches.match('/');
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
          safeCachePut(SHELL_CACHE, event.request, networkResponse);
          return networkResponse;
        })
        .catch(() => null);

      return cachedResponse || fetchPromise;
    })
  );
});
