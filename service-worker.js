const CACHE = 'fincontrol-v4';
const STATIC = ['./manifest.json', './icon.svg'];
const HTML   = ['./fincontrol-mobile', './fincontrol-dashboard', './fincontrol-mobile.html', './fincontrol-dashboard.html'];

self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE).then(c => c.addAll(STATIC)).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET') return;
  const url = new URL(e.request.url);
  const isHtml = HTML.some(p => url.pathname.endsWith(p.replace('./', ''))) || url.pathname === '/fincontrol/';

  if (isHtml) {
    // Network first para HTMLs — sempre pega versão nova, usa cache só offline
    e.respondWith(
      fetch(e.request).then(resp => {
        const clone = resp.clone();
        caches.open(CACHE).then(c => c.put(e.request, clone));
        return resp;
      }).catch(() => caches.match(e.request))
    );
  } else {
    // Cache first para assets estáticos (ícones, manifest)
    e.respondWith(
      caches.match(e.request).then(cached => {
        if (cached) return cached;
        return fetch(e.request).then(resp => {
          if (!resp || resp.status !== 200 || resp.type === 'opaque') return resp;
          caches.open(CACHE).then(c => c.put(e.request, resp.clone()));
          return resp;
        });
      })
    );
  }
});

self.addEventListener('message', e => {
  if (e.data === 'skipWaiting') self.skipWaiting();
});
