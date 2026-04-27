// EngHub Service Worker — T1: PWA / Offline mode
// Strategy: Cache-first for static assets, Network-first for API

const CACHE_NAME = 'enghub-v1';
const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/static/js/main.chunk.js',
  '/static/js/bundle.js',
];

// Install — cache static assets
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(STATIC_ASSETS).catch(() => {}))
  );
  self.skipWaiting();
});

// Activate — clean old caches
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
    )
  );
  self.clients.claim();
});

// Fetch
self.addEventListener('fetch', event => {
  const { request } = event;
  const url = new URL(request.url);

  // Skip non-GET, chrome-extension, Supabase API, Anthropic API
  if (request.method !== 'GET') return;
  if (url.origin !== self.location.origin) return;
  if (url.pathname.startsWith('/api/')) return;

  // Network-first for HTML navigation
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request).then(response => {
        const clone = response.clone();
        caches.open(CACHE_NAME).then(cache => cache.put(request, clone));
        return response;
      }).catch(() => caches.match('/index.html'))
    );
    return;
  }

  // Cache-first for JS/CSS/fonts
  if (/\.(js|css|woff2?|ttf|png|svg|ico)$/.test(url.pathname)) {
    event.respondWith(
      caches.match(request).then(cached => {
        if (cached) return cached;
        return fetch(request).then(response => {
          const clone = response.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(request, clone));
          return response;
        });
      })
    );
  }
});

// Background sync — queue failed POST requests for retry
self.addEventListener('sync', event => {
  if (event.tag === 'enghub-sync') {
    event.waitUntil(syncOfflineQueue());
  }
});

async function syncOfflineQueue() {
  // Open IndexedDB offline queue and replay
  try {
    const db = await openDB();
    const tx = db.transaction('offline_queue', 'readwrite');
    const store = tx.objectStore('offline_queue');
    const items = await getAllFromStore(store);
    for (const item of items) {
      try {
        await fetch(item.url, { method: item.method, headers: item.headers, body: item.body });
        await deleteFromStore(store, item.id);
      } catch {}
    }
  } catch {}
}

function openDB() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open('enghub_offline', 1);
    req.onupgradeneeded = e => {
      e.target.result.createObjectStore('offline_queue', { keyPath: 'id', autoIncrement: true });
    };
    req.onsuccess = e => resolve(e.target.result);
    req.onerror = reject;
  });
}
function getAllFromStore(store) {
  return new Promise((resolve, reject) => {
    const req = store.getAll();
    req.onsuccess = e => resolve(e.target.result);
    req.onerror = reject;
  });
}
function deleteFromStore(store, id) {
  return new Promise((resolve, reject) => {
    const req = store.delete(id);
    req.onsuccess = resolve;
    req.onerror = reject;
  });
}
