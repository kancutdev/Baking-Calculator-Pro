const CACHE_VERSION = 'baking-calculator-pro-v1.3.0';
const CORE_ASSETS = [
  './',
  './index.html',
  './styles.css',
  './social-links.js',
  './manifest.json',
  './assets/icon.svg',
  './assets/icon-192.png',
  './assets/icon-512.png',
  './js/utils.js',
  './js/storage.js',
  './js/ingredient-database.js',
  './js/recipe-book.js',
  './js/recipe-import.js',
  './js/recipe-scaling.js',
  './js/pan-converter.js',
  './js/hpp-calculator.js',
  './js/unit-converter.js',
  './js/history.js',
  './app.js'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_VERSION)
      .then((cache) => cache.addAll(CORE_ASSETS))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE_VERSION).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;
  const url = new URL(event.request.url);
  if (url.origin !== self.location.origin) return;

  const isNavigationOrCode =
    event.request.mode === 'navigate' ||
    url.pathname.endsWith('.html') ||
    url.pathname.endsWith('.js') ||
    url.pathname.endsWith('.css') ||
    url.pathname.endsWith('.json');

  // Network-first for HTML/JS/CSS/JSON so GitHub Pages updates always show immediately when online,
  // with full offline cache fallback.
  if (isNavigationOrCode) {
    event.respondWith(
      fetch(event.request)
        .then((response) => {
          if (response && response.ok) {
            const copy = response.clone();
            caches.open(CACHE_VERSION).then((cache) => cache.put(event.request, copy));
          }
          return response;
        })
        .catch(() => caches.match(event.request).then((cached) => cached || caches.match('./index.html')))
    );
    return;
  }

  // Cache-first for static images/icons
  event.respondWith(
    caches.match(event.request).then((cached) => {
      if (cached) return cached;
      return fetch(event.request).then((response) => {
        if (response && response.ok) {
          const copy = response.clone();
          caches.open(CACHE_VERSION).then((cache) => cache.put(event.request, copy));
        }
        return response;
      });
    })
  );
});
