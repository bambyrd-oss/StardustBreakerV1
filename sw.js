// FATBACK service worker.
// Two jobs: make the game playable with no signal, and satisfy Chrome's
// installability check (which requires a fetch handler on a real origin).
//
// The game document is served NETWORK-FIRST so a new deploy is picked up the
// next time you're online — the old cache-first worker pinned players to the
// first build they ever loaded. Static shell assets stay cache-first. Bump
// VERSION on every shipped change so activate() clears the previous cache.
const VERSION = 'v43';
const CACHE = 'fatback-' + VERSION;
const SHELL = [
  './',
  './index.html',
  './manifest.webmanifest',
  './icon-192.png',
  './icon-512.png',
];

self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE)
      .then(c => c.addAll(SHELL))
      .then(() => self.skipWaiting())
      .catch(() => self.skipWaiting())   // a missing icon shouldn't block install
  );
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

function isDocument(req) {
  if (req.mode === 'navigate') return true;
  if (req.destination === 'document') return true;
  const path = new URL(req.url).pathname;
  return path.endsWith('/') || path.endsWith('/index.html');
}

self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET') return;
  const req = e.request;

  if (isDocument(req)) {
    // Network-first: always try for the freshest build, fall back to cache offline.
    e.respondWith(
      fetch(req).then(res => {
        if (res && res.status === 200) {
          const copy = res.clone();
          caches.open(CACHE).then(c => c.put('./index.html', copy));
        }
        return res;
      }).catch(() => caches.match(req).then(hit => hit || caches.match('./index.html')))
    );
    return;
  }

  // Cache-first for the static shell (icons, manifest) — they rarely change.
  e.respondWith(
    caches.match(req).then(hit => hit || fetch(req).then(res => {
      if (res && res.status === 200 && res.type === 'basic') {
        const copy = res.clone();
        caches.open(CACHE).then(c => c.put(req, copy));
      }
      return res;
    }).catch(() => caches.match('./index.html')))
  );
});
