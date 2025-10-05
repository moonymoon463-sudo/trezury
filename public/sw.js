const CACHE_NAME = 'trezury-v7';
const STATIC_CACHE = 'trezury-static-v7';
const DYNAMIC_CACHE = 'trezury-dynamic-v7';

const urlsToCache = [
  '/',
  '/manifest.json',
  '/icon-192.png',
  '/icon-512.png',
  '/favicon.png',
  '/screenshot-mobile.png',
  '/screenshot-desktop.png'
];

// Files that should always be fetched from network first
const NETWORK_FIRST = [
  '/api/',
  '/supabase/',
  '/auth/'
];

// Files that can be cached for longer periods
const CACHE_FIRST = [
  '.js',
  '.css',
  '.woff2',
  '.woff',
  '.ttf',
  '.png',
  '.jpg',
  '.jpeg',
  '.svg',
  '.ico'
];

self.addEventListener('install', (event) => {
  console.log('Service Worker installing...');
  event.waitUntil(
    caches.open(STATIC_CACHE)
      .then((cache) => {
        console.log('Caching static assets...');
        return cache.addAll(urlsToCache);
      })
      .then(() => {
        console.log('Static assets cached successfully');
        self.skipWaiting();
      })
      .catch((error) => {
        console.error('Failed to cache static assets:', error);
      })
  );
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Skip cross-origin requests
  if (url.origin !== location.origin) {
    return;
  }

  // Skip dev-time assets (Vite dev server paths)
  if (url.pathname.startsWith('/src/')) {
    return;
  }

  // Handle different caching strategies
  if (NETWORK_FIRST.some(path => url.pathname.startsWith(path))) {
    // Network first for API calls
    event.respondWith(networkFirst(request));
  } else if (CACHE_FIRST.some(ext => url.pathname.endsWith(ext))) {
    // Stale while revalidate for images to prevent stale brand assets
    if (['.png', '.jpg', '.jpeg', '.svg'].some(ext => url.pathname.endsWith(ext))) {
      event.respondWith(staleWhileRevalidate(request));
    } else {
      // Cache first for other static assets (fonts, css, js)
      event.respondWith(cacheFirst(request));
    }
  } else {
    // Stale while revalidate for HTML pages
    event.respondWith(staleWhileRevalidate(request));
  }
});

// Network first strategy
async function networkFirst(request) {
  try {
    const networkResponse = await fetch(request);
    if (networkResponse.ok) {
      const cache = await caches.open(DYNAMIC_CACHE);
      cache.put(request, networkResponse.clone());
    }
    return networkResponse;
  } catch (error) {
    const cachedResponse = await caches.match(request);
    return cachedResponse || new Response('Offline', { status: 503 });
  }
}

// Cache first strategy
async function cacheFirst(request) {
  const cachedResponse = await caches.match(request);
  if (cachedResponse) {
    return cachedResponse;
  }
  
  try {
    const networkResponse = await fetch(request);
    if (networkResponse.ok) {
      const cache = await caches.open(STATIC_CACHE);
      cache.put(request, networkResponse.clone());
    }
    return networkResponse;
  } catch (error) {
    return new Response('Asset not available', { status: 404 });
  }
}

// Stale while revalidate strategy
async function staleWhileRevalidate(request) {
  const cachedResponse = await caches.match(request);
  
  const networkResponsePromise = fetch(request).then(networkResponse => {
    if (networkResponse.ok) {
      const cache = caches.open(DYNAMIC_CACHE);
      cache.then(c => c.put(request, networkResponse.clone()));
    }
    return networkResponse;
  }).catch(() => null);

  return cachedResponse || networkResponsePromise || new Response('Page not available', { status: 404 });
}

self.addEventListener('activate', (event) => {
  console.log('Service Worker activating...');
  event.waitUntil(
    Promise.all([
      // Clean up old caches
      caches.keys().then((cacheNames) => {
        return Promise.all(
          cacheNames.map((cacheName) => {
            if (![STATIC_CACHE, DYNAMIC_CACHE].includes(cacheName)) {
              console.log('Deleting old cache:', cacheName);
              return caches.delete(cacheName);
            }
          })
        );
      }),
      // Take control of all clients
      self.clients.claim()
    ])
  );
  
  // Notify clients about the update
  self.clients.matchAll().then(clients => {
    clients.forEach(client => {
      client.postMessage({ type: 'SW_ACTIVATED' });
    });
  });
});

// Handle messages from clients
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});

// Notify clients when an update is available
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'CHECK_UPDATE') {
    event.ports[0].postMessage({ hasUpdate: self.registration.waiting !== null });
  }
});