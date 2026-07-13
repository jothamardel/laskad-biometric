/**
 * Laskad Biometric Auth — Service Worker v2
 * Strategy:
 *  - API calls (to API_BASE host or /auth/* paths): network-only, never cached
 *  - App shell & static assets: cache-first with stale-while-revalidate
 */

const CACHE_NAME = 'laskad-biometric-cache-v2';

const SHELL_URLS = [
  '/enroll',
  '/verify',
  '/images/logo.png',
  '/favicon.ico',
  '/icon-192.png',
  '/icon-512.png',
  '/manifest.json',
];

// ── Install: pre-cache app shell ──────────────────────────────────────────────
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(SHELL_URLS))
  );
  self.skipWaiting();
});

// ── Activate: remove old caches ───────────────────────────────────────────────
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

// ── Fetch ─────────────────────────────────────────────────────────────────────
self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // Network-only for all API calls — auth responses must NEVER be cached
  if (url.pathname.startsWith('/auth/') || event.request.method !== 'GET') {
    event.respondWith(fetch(event.request));
    return;
  }

  // Cross-origin requests (e.g. Google Fonts, CDNs) — pass through
  if (url.origin !== self.location.origin) {
    event.respondWith(fetch(event.request));
    return;
  }

  // Cache-first for same-origin GETs (app shell, images, fonts)
  event.respondWith(
    caches.match(event.request).then((cached) => {
      const networkFetch = fetch(event.request).then((response) => {
        if (response && response.status === 200) {
          const clone = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
        }
        return response;
      });
      return cached || networkFetch;
    })
  );
});
