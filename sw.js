/* Hairlux Vendor site: service worker.
 *  - Pages: network first, last cached copy offline, then offline.html.
 *  - Our CSS/JS: network first, cached copy when offline.
 *  - Images and fonts: stale-while-revalidate.
 *  - The Hairlux API, uploads and anything else cross-origin are never cached:
 *    applications, documents and products always go live.
 * Bump VERSION when this file changes.
 */
const VERSION = 'v4-2026-11-01';
const PRECACHE = `hxvendor-precache-${VERSION}`;
const RUNTIME = `hxvendor-runtime-${VERSION}`;
const PRECACHE_URLS = ['offline.html', 'manifest.webmanifest', 'assets/css/vendor.css', 'assets/img/pwa/icon-192.png', 'assets/img/logo-side-white.webp'];
const FONT_HOSTS = new Set(['fonts.googleapis.com', 'fonts.gstatic.com']);

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(PRECACHE).then((c) => c.addAll(PRECACHE_URLS)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k.startsWith('hxvendor-') && k !== PRECACHE && k !== RUNTIME).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

async function networkFirst(req, fallbackUrl) {
  const cache = await caches.open(RUNTIME);
  try {
    const res = await fetch(req);
    if (res && res.ok) cache.put(req, res.clone());
    return res;
  } catch (err) {
    const hit = await cache.match(req, { ignoreSearch: req.mode === 'navigate' });
    if (hit) return hit;
    if (fallbackUrl) return caches.match(fallbackUrl);
    throw err;
  }
}

async function staleWhileRevalidate(req) {
  const cache = await caches.open(RUNTIME);
  const hit = await cache.match(req);
  const network = fetch(req).then((res) => { if (res && (res.ok || res.type === 'opaque')) cache.put(req, res.clone()); return res; }).catch(() => hit);
  return hit || network;
}

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin === self.location.origin) {
    if (req.mode === 'navigate') { e.respondWith(networkFirst(req, 'offline.html')); return; }
    if (/\.(css|js)$/.test(url.pathname)) { e.respondWith(networkFirst(req)); return; }
    if (/\.(png|jpe?g|webp|svg|ico|webmanifest)$/.test(url.pathname)) { e.respondWith(staleWhileRevalidate(req)); return; }
    return;
  }
  if (FONT_HOSTS.has(url.hostname)) e.respondWith(staleWhileRevalidate(req));
  // Everything else cross-origin (the API, Paystack, uploads) goes straight to the network.
});
