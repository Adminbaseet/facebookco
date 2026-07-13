const CACHE = 'fbco-v2';
const URLS = ['/', '/index.html', '/script.js', '/style.css', '/manifest.json', '/icon.svg'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(URLS)));
  self.skipWaiting();
});

self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== CACHE).map(k => caches.delete(k)))));
});

self.addEventListener('fetch', e => {
  if (e.request.url.startsWith(self.location.origin) && !e.request.url.includes('/api/')) {
    e.respondWith(
      caches.match(e.request).then(r => r || fetch(e.request).then(res => {
        if (res.ok) { const r2 = res.clone(); caches.open(CACHE).then(c => c.put(e.request, r2)); }
        return res;
      }))
    );
  }
});
