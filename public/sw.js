const CACHE_NAME = 'georide-v2';
const ASSETS = [
  '/',
  '/index.html',
  '/favicon.png',
  '/manifest.json'
];

self.addEventListener('install', (e) => {
  self.skipWaiting();
  e.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return Promise.allSettled(
        ASSETS.map(asset => {
          return cache.add(asset).catch(err => {
            console.warn(`[SW] Initial cache skipped for: ${asset}`);
          });
        })
      );
    })
  );
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(keys.filter(key => key !== CACHE_NAME).map(key => caches.delete(key)));
    })
  );
});

self.addEventListener('fetch', (e) => {
  // 1. Ignoriši sve što nije GET (Mapbox eventi su POST)
  // 2. Ignoriši Mapbox events API direktno
  if (e.request.method !== 'GET' || e.request.url.includes('events.mapbox.com')) {
    return;
  }

  e.respondWith(
    fetch(e.request)
      .then((response) => {
        if (response && response.status === 200 && response.type === 'basic') {
          const responseToCache = response.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(e.request, responseToCache);
          });
        }
        return response;
      })
      .catch(() => {
        return caches.match(e.request).then(match => match || fetch(e.request));
      })
  );
});
