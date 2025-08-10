const CACHE_NAME = 'file-sharer-shell-v1';
const OFFLINE_URL = '/offline.html';
const PRECACHE = [
    '/', '/index.html', '/manifest.json',
    '/offline.html',
];

self.addEventListener('install', evt => {
    evt.waitUntil(
        caches.open(CACHE_NAME)
            .then(cache => cache.addAll(PRECACHE))
            .then(() => self.skipWaiting())
    );
});

self.addEventListener('activate', evt => {
    evt.waitUntil(self.clients.claim());
});

self.addEventListener('fetch', evt => {
    const { request } = evt;

    if (request.mode === 'navigate') {
        evt.respondWith(
            fetch(request)
                .then(res => res.ok ? res : caches.match(request))
                .catch(() => caches.match(OFFLINE_URL))
        );
        return;
    }

    if (request.url.includes('/api/')) {
        evt.respondWith(
            fetch(request).catch(() => new Response(
                JSON.stringify({ error: 'offline' }),
                { headers: {'Content-Type':'application/json'} }
            ))
        );
        return;
    }

    evt.respondWith(
        caches.match(request).then(cached =>
                cached || fetch(request).then(fresh => {
                    return fresh;
                })
        )
    );
});
