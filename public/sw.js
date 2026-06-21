const CACHE_NAME = 'laskad-biometric-cache-v1';
const urlsToCache = [
  '/enroll',
  '/verify',
  '/css/style.css',
  '/images/logo.png',
  '/favicon.ico',
  '/icon-192.png',
  '/icon-512.png',
  '/manifest.json'
];

self.addEventListener('install', (event) => {
  (event).waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(urlsToCache);
    })
  );
});

self.addEventListener('fetch', (event) => {
  (event).respondWith(
    caches.match((event).request).then((response) => {
      return response || fetch((event).request);
    })
  );
});
