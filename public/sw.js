const CACHE_NAME = 'azutool-pwa-cache-v1';
const APP_SHELL_URLS = [
  '/',
  'index.html',
  'index.tsx',
  'manifest.json',
  'https://cdn.tailwindcss.com',
  'https://fonts.googleapis.com/css2?family=VT323&family=ZCOOL+KuaiLe&display=swap',
  'https://fonts.gstatic.com/s/zcoolkuaile/v15/AДобx-23-4vj2w2t6nL8-Qws5if4Jw.woff2',
  'https://fonts.gstatic.com/s/vt323/v17/pxiKyp0ihIEF2isQFJXGdg.woff2',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      console.log('Opened cache and caching app shell');
      return cache.addAll(APP_SHELL_URLS);
    })
  );
});

self.addEventListener('activate', (event) => {
  const cacheWhitelist = [CACHE_NAME];
  event.waitUntil(
    caches.keys().then((cacheNames) =>
      Promise.all(
        cacheNames.map((cacheName) => {
          if (!cacheWhitelist.includes(cacheName)) {
            console.log('Deleting old cache:', cacheName);
            return caches.delete(cacheName);
          }
        })
      )
    )
  );
});

self.addEventListener('fetch', (event) => {
  // We only want to cache GET requests.
  if (event.request.method !== 'GET') {
    return;
  }
  
  event.respondWith(
    // First, try to find a match in the cache.
    caches.match(event.request).then((cachedResponse) => {
      // If a cached response is found, return it.
      if (cachedResponse) {
        return cachedResponse;
      }

      // If the request is not in the cache, fetch it from the network.
      return fetch(event.request).then((networkResponse) => {
        // We only cache successful responses to avoid caching errors.
        if (!networkResponse || networkResponse.status !== 200) {
          return networkResponse;
        }

        // IMPORTANT: Clone the response. A response is a stream
        // and because we want the browser to consume the response
        // as well as the cache consuming the response, we need
        // to clone it so we have two streams.
        const responseToCache = networkResponse.clone();

        caches.open(CACHE_NAME).then((cache) => {
          // Cache the new response for future use.
          cache.put(event.request, responseToCache);
        });

        return networkResponse;
      }).catch(error => {
          // This will be triggered if the network fails.
          console.error('Fetch failed:', error);
          // When a network request fails, and there is no cache, 
          // the browser will handle it as a standard network error.
      });
    })
  );
});
