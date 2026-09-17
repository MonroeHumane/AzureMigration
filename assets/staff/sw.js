/* HSMC Staff PWA - app shell cache only; API stays network-only */
/* Bump CACHE_VERSION on every deploy that touches staff-portal.css/js or
   content-hub.css/js - the cache-first fetch handler below never
   re-checks a URL once it's cached, so the only way a device picks up
   new shell assets is by the browser detecting this file's bytes
   changed (which only happens if this constant changes) and running a
   fresh install/activate cycle. */
const CACHE_VERSION = 'hsmc-staff-v5';
const SHELL_CACHE = CACHE_VERSION + '-shell';

const PRECACHE_URLS = [
  './staff-portal.css',
  './staff-login.js',
  './staff-portal.js',
  '../admin/content-hub.css',
  '../admin/content-hub-calendar.css',
  '../admin/content-hub.js'
];

self.addEventListener('install', function (event) {
  event.waitUntil(
    caches.open(SHELL_CACHE).then(function (cache) {
      return cache.addAll(PRECACHE_URLS).catch(function () {
        /* partial precache is acceptable */
      });
    })
  );
  self.skipWaiting();
});

self.addEventListener('activate', function (event) {
  event.waitUntil(
    caches.keys().then(function (keys) {
      return Promise.all(
        keys
          .filter(function (key) {
            return key.startsWith('hsmc-staff-') && key !== SHELL_CACHE;
          })
          .map(function (key) {
            return caches.delete(key);
          })
      );
    })
  );
  self.clients.claim();
});

self.addEventListener('fetch', function (event) {
  var url = new URL(event.request.url);

  if (url.pathname.indexOf('/wp-json/') !== -1 || url.pathname.indexOf('/wp-admin/admin-ajax.php') !== -1) {
    return;
  }

  if (event.request.method !== 'GET') {
    return;
  }

  if (url.pathname.indexOf('/staff/') === -1 && url.pathname.indexOf('/assets/staff/') === -1 && url.pathname.indexOf('/assets/admin/content-hub') === -1) {
    return;
  }

  event.respondWith(
    caches.match(event.request).then(function (cached) {
      return (
        cached ||
        fetch(event.request).then(function (response) {
          if (!response || response.status !== 200 || response.type !== 'basic') {
            return response;
          }
          var copy = response.clone();
          caches.open(SHELL_CACHE).then(function (cache) {
            cache.put(event.request, copy);
          });
          return response;
        })
      );
    })
  );
});
