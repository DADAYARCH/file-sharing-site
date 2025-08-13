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
    const req = evt.request;

    if (req.mode === 'navigate') {
        evt.respondWith((async () => {
            try {
                const net = await fetch(req);
                if (net.ok) return net;
                const cached = await caches.match(OFFLINE_URL);
                return cached || new Response('Offline', { status: 503 });
            } catch {
                const cached = await caches.match(OFFLINE_URL);
                return cached || new Response('Offline', { status: 503 });
            }
        })());
        return;
    }

    if (req.url.includes('/api/')) {
        evt.respondWith((async () => {
            try {
                return await fetch(req);
            } catch {
                return new Response(JSON.stringify({ error: 'offline' }), {
                    headers: { 'Content-Type': 'application/json' }
                });
            }
        })());
        return;
    }

    evt.respondWith((async () => {
        const cached = await caches.match(req);
        if (cached) return cached;

        try {
            const net = await fetch(req);
            return net;
        } catch {
            if (req.destination === 'document') {
                const offline = await caches.match(OFFLINE_URL);
                return offline || new Response('Offline', { status: 503 });
            }
            return new Response('', { status: 504, statusText: 'Offline' });
        }
    })());
});
