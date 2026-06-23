/* Service Worker — cache offline (app shell) */
const CACHE = 'dyck-v14';
const ASSETS = [
  './', './index.html',
  './assets/css/app.css',
  './assets/js/store.js',
  './assets/js/app.js',
  './assets/js/config.js',
  './assets/js/icons.js',
  './assets/js/sync.js',
  './assets/img/logo.jpg',
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
  // No cachear llamadas a Supabase (siempre red)
  if (request.url.includes('supabase.co')) return;
  e.respondWith(
    caches.match(request).then(cached => cached ||
      fetch(request).then(res => {
        const copy = res.clone();
        caches.open(CACHE).then(c => c.put(request, copy)).catch(()=>{});
        return res;
      }).catch(() => caches.match('./index.html')))
  );
});
