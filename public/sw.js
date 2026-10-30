// Service worker de Severa en la web (29-10-2026, Y4 de docs/Pendientes.md).
// Guarda la app en el teléfono para que abra sin internet:
// - la página: primero la red; sin señal, la última guardada;
// - el código, las fuentes y las imágenes (llevan hash en el nombre): se guardan la primera vez;
// - lo que se lee de Supabase: primero la red; sin señal, lo último que se vio (anotar sigue pidiendo internet).
// Al cerrar sesión, la app borra lo guardado de Supabase (caché «severa-data»).
const SHELL = 'severa-shell-v1';
const STATIC = 'severa-static-v1';
const DATA = 'severa-data';
const BASE = new URL(self.registration.scope).pathname; // «/app/»

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(SHELL)
      .then((cache) => cache.add(BASE))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener('activate', (event) => {
  const keep = [SHELL, STATIC, DATA];
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k.startsWith('severa-') && !keep.includes(k)).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

function save(cacheName, key, response) {
  if (response.ok && !response.redirected && (response.type === 'basic' || response.type === 'cors')) {
    const copy = response.clone();
    caches.open(cacheName).then((cache) => cache.put(key, copy));
  }
  return response;
}

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);

  if (url.origin === self.location.origin) {
    // La página de la app (todas las rutas son la misma página).
    if (req.mode === 'navigate' && url.pathname.startsWith(BASE)) {
      event.respondWith(
        fetch(req)
          .then((res) => save(SHELL, BASE, res))
          .catch(() => caches.match(BASE, { cacheName: SHELL })),
      );
      return;
    }
    // Archivos con hash.
    if (url.pathname.startsWith(BASE + '_expo/') || url.pathname.startsWith(BASE + 'assets/')) {
      event.respondWith(caches.match(req, { cacheName: STATIC }).then((hit) => hit || fetch(req).then((res) => save(STATIC, req, res))));
    }
    return;
  }

  // Lecturas de Supabase.
  if (url.hostname.endsWith('.supabase.co') && url.pathname.startsWith('/rest/v1/')) {
    event.respondWith(
      fetch(req)
        .then((res) => save(DATA, req, res))
        .catch(() => caches.match(req, { cacheName: DATA }).then((hit) => hit || Response.error())),
    );
  }
});
