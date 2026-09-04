const CACHE_NAME = 'georide-v5';
const ASSETS = ['/', '/index.html', '/play.html', '/favicon.png', '/manifest.json'];

self.addEventListener('install', (e) => {
    self.skipWaiting();
    e.waitUntil(
        caches.open(CACHE_NAME).then((cache) => {
            return Promise.allSettled(
                ASSETS.map((asset) => {
                    return cache.add(asset).catch((err) => {
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
            return Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key)));
        })
    );
});

self.addEventListener('fetch', (e) => {
    const url = e.request.url;
    const isLocal = url.startsWith(self.location.origin);

    // ONLY cache local GET requests
    if (e.request.method !== 'GET' || !isLocal) {
        return;
    }

    const isNavigation =
        e.request.mode === 'navigate' ||
        (e.request.headers.get('accept') && e.request.headers.get('accept').includes('text/html')) ||
        url.endsWith('.html') ||
        url.endsWith('/');

    if (isNavigation) {
        // Network-First for HTML/navigation to honour Cache-Control: max-age=0, must-revalidate
        e.respondWith(
            fetch(e.request)
                .then((response) => {
                    if (response && response.status === 200) {
                        const responseToCache = response.clone();
                        caches.open(CACHE_NAME).then((cache) => {
                            cache.put(e.request, responseToCache);
                        });
                    }
                    return response;
                })
                .catch(() => {
                    // Fallback to cache when offline
                    return caches.match(e.request).then((cachedResponse) => {
                        if (cachedResponse) return cachedResponse;
                        if (url.includes('play')) {
                            return caches.match('/play.html');
                        }
                        return caches.match('/index.html') || caches.match('/');
                    });
                })
        );
        return;
    }

    // Cache-First for static assets
    e.respondWith(
        caches.match(e.request).then((cachedResponse) => {
            if (cachedResponse) return cachedResponse;

            return fetch(e.request)
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
                    return undefined;
                });
        })
    );
});
