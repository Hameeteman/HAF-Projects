// HAF Projects — Service Worker v5
// Strategie:
// - HTML: network-first (altijd nieuwste versie, fallback naar cache bij offline)
// - API calls (/projects/*, /v1/*, /auth/*): network-only (nooit cachen)
// - Statics (icons, manifest): cache-first (verandert zelden)
const CACHE = 'haf-projects-v5';

self.addEventListener('install', (e) => {
  self.skipWaiting(); // direct activeren
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
  if (e.request.method !== 'GET') return;

  // API calls: NOOIT cachen (ongeacht hostname)
  if (url.pathname.startsWith('/projects') ||
      url.pathname.startsWith('/v1/') ||
      url.pathname.startsWith('/auth/') ||
      url.pathname.startsWith('/health') ||
      url.pathname.startsWith('/admin/') ||
      url.pathname.endsWith('/bootstrap')) {
    return; // laat browser z'n gang gaan
  }

  // HTML: network-first (altijd proberen verse versie te halen)
  if (url.pathname.endsWith('.html') || url.pathname.endsWith('/')) {
    e.respondWith(
      fetch(e.request).then(r => {
        if (r && r.ok) {
          const clone = r.clone();
          caches.open(CACHE).then(c => c.put(e.request, clone)).catch(()=>{});
        }
        return r;
      }).catch(() => caches.match(e.request)) // offline: fallback naar cache
    );
    return;
  }

  // Statics (icons, manifest, fonts): cache-first
  e.respondWith(
    caches.match(e.request).then(cached => {
      if (cached) return cached;
      return fetch(e.request).then(r => {
        if (r && r.ok) {
          const clone = r.clone();
          caches.open(CACHE).then(c => c.put(e.request, clone)).catch(()=>{});
        }
        return r;
      });
    })
  );
});
