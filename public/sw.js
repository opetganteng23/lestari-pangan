// Service worker: cangkang aplikasi tersedia offline. Data /api, /uploads, dan halaman konsumen TIDAK disimpan (privasi & kesegaran data).
const CACHE = 'lp-shell-v1';
const SHELL = ['/', '/css/app.css', '/js/core.js', '/js/screens-actor.js', '/js/screens-admin.js', '/js/screens-ops.js', '/js/screens-common.js', '/js/screens-farmer.js', '/js/screens-predict.js', '/js/offline.js', '/assets/img/emblem.png', '/assets/fonts/Poppins-Regular.ttf', '/assets/fonts/Poppins-Medium.ttf', '/assets/fonts/Poppins-Bold.ttf', '/assets/fonts/Poppins-Light.ttf'];
self.addEventListener('install', (e) => { e.waitUntil(caches.open(CACHE).then((c) => Promise.all(SHELL.map((u) => c.add(u).catch(() => {})))).then(() => self.skipWaiting())); });
self.addEventListener('activate', (e) => { e.waitUntil(caches.keys().then((ks) => Promise.all(ks.filter((k) => k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim())); });
self.addEventListener('fetch', (e) => {
  const r = e.request; if (r.method !== 'GET') return; const u = new URL(r.url);
  if (u.origin !== location.origin || u.pathname.startsWith('/api/') || u.pathname.startsWith('/uploads/') || u.pathname.startsWith('/t/') || u.pathname.startsWith('/qr/')) return;
  e.respondWith(fetch(r).then((res) => { if (res.ok) { const copy = res.clone(); caches.open(CACHE).then((c) => c.put(r, copy)); } return res; }).catch(() => caches.match(r).then((m) => m || (r.mode === 'navigate' ? caches.match('/') : Response.error()))));
});
