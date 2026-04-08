// HAF Projects — Service Worker
// Strategie:
// - Statics (HTML/CSS/JS/icons): stale-while-revalidate
// - API calls (ckps.hafworld.com/projects/*): network-only — sync logica in app handelt offline af
// - Chat proxy (ckps.hafworld.com/v1/messages): network-only — live Claude calls nooit cachen
const CACHE = 'haf-projects-v1';
const CORE = [
  './',
  './index.html',
  './manifest.json',
  './icons/icon-192.png',
  './icons/icon-512.png'
];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(CORE).catch(()=>{})));
  self.skipWaiting();
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then(keys => Promise.all(
      keys.filter(k => k !== CACHE).map(k => caches.delete(k))
    ))
  );
  self.clients.claim();
});

self.addEventListener('fetch', (e) => {
  const url = new URL(e.request.url);
  // Nooit API of Claude proxy cachen — alle ckps.hafworld.com en /v1/, /projects, /apps/haf-projects/bootstrap, /auth/passkey
  const isApi = url.hostname.includes('ckps.hafworld.com') &&
                (url.pathname.startsWith('/v1/') ||
                 url.pathname.startsWith('/projects') ||
                 url.pathname.startsWith('/auth/') ||
                 url.pathname.endsWith('/bootstrap'));
  if (isApi) return;
  if (e.request.method !== 'GET') return;

  e.respondWith(
    caches.match(e.request).then(cached => {
      const net = fetch(e.request).then(r => {
        if (r && r.ok) {
          const clone = r.clone();
          caches.open(CACHE).then(c => c.put(e.request, clone)).catch(()=>{});
        }
        return r;
      }).catch(() => cached);
      return cached || net;
    })
  );
});
