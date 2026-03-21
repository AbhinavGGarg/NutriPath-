const CACHE_NAME = 'nutripath-v30';
const APP_SHELL = [
  './',
  './index.html',
  './assessment.html',
  './results.html',
  './map.html',
  './meal-builder.html',
  './learn.html',
  './auth.html',
  './styles.css',
  './app.js',
  './data.js',
  './runtime-config.js',
  './assessment.js',
  './results.js',
  './map.js',
  './learn.js',
  './auth.js'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(CACHE_NAME)
      .then((cache) => cache.addAll(APP_SHELL))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((key) => key !== CACHE_NAME)
            .map((key) => caches.delete(key))
        )
      )
      .then(() => self.clients.claim())
  );
});

self.addEventListener('message', (event) => {
  if (event.data?.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});

async function cachePutIfOk(request, response) {
  if (!response || !response.ok) return;
  const cache = await caches.open(CACHE_NAME);
  await cache.put(request, response.clone());
}

async function networkFirst(request, fallbackUrl) {
  try {
    const fresh = await fetch(request, { cache: 'no-store' });
    cachePutIfOk(request, fresh.clone());
    return fresh;
  } catch {
    const cached = await caches.match(request);
    if (cached) return cached;
    if (fallbackUrl) {
      const fallback = await caches.match(fallbackUrl);
      if (fallback) return fallback;
    }
    throw new Error('Network and cache both unavailable');
  }
}

async function staleWhileRevalidate(request) {
  const cached = await caches.match(request);
  const networkPromise = fetch(request)
    .then((response) => {
      cachePutIfOk(request, response.clone());
      return response;
    })
    .catch(() => null);
  return cached || networkPromise;
}

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;

  const url = new URL(event.request.url);
  const isSameOrigin = url.origin === self.location.origin;

  if (event.request.mode === 'navigate') {
    event.respondWith(networkFirst(event.request, './index.html'));
    return;
  }

  if (!isSameOrigin) return;

  const destination = event.request.destination;
  if (destination === 'script' || destination === 'style' || destination === 'document') {
    event.respondWith(networkFirst(event.request));
    return;
  }

  event.respondWith(staleWhileRevalidate(event.request));
});
