// Bishop Service Worker — Phase 1 (stub)
// Satisfies PWA install requirements. Offline caching added in Phase 2.

self.addEventListener('install', function(e) {
    self.skipWaiting();
});

self.addEventListener('activate', function(e) {
    self.clients.claim();
});

self.addEventListener('fetch', function(e) {
    // Pass-through — all requests go to the network as normal
});
