/* Service Worker — cache offline (app shell)
   Funciona offline tras la 1ª carga online. Nota: el SW solo corre en
   https o localhost (no en file://); por eso, para offline real, hostear
   en Cloudflare Pages. Los datos igual viven en localStorage. */
const CACHE = 'dyck-v30';
const ASSETS = [
  './', './index.html',
  './assets/css/app.css',
  './assets/js/store.js',
  './assets/js/app.js',
  './assets/js/config.js',
  './assets/js/icons.js',
  './assets/js/sync.js',
  './assets/img/logo.jpg',
  './assets/img/icon-192.png',
  './assets/img/icon-512.png',
  './assets/img/icon-maskable-192.png',
  './assets/img/icon-maskable-512.png',
  './assets/img/apple-touch-icon.png',
  './assets/img/favicon-32.png',
  './manifest.webmanifest',
];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(ASSETS)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(keys =>
    Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', e => {
  const { request } = e;
  if (request.method !== 'GET') return;
  // Llamadas a Supabase (datos/auth): siempre red, nunca cache.
  if (request.url.includes('supabase.co')) return;

  // Navegación (abrir la app): red primero, cae a index.html cacheado offline.
  if (request.mode === 'navigate') {
    e.respondWith(fetch(request).catch(() => caches.match('./index.html', { ignoreSearch: true })));
    return;
  }

  // Resto: cache primero (ignorando ?v=), y si no, red + guardar copia.
  e.respondWith(
    caches.match(request, { ignoreSearch: true }).then(cached => cached ||
      fetch(request).then(res => {
        const copy = res.clone();
        caches.open(CACHE).then(c => c.put(request, copy)).catch(() => {});
        return res;
      }).catch(() => caches.match('./index.html', { ignoreSearch: true })))
  );
});
