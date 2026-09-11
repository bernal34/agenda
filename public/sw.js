// Service worker mínimo para que Chrome considere la app "installable".
// Estrategia: network-first sin cache agresivo — la app trabaja contra
// Supabase en tiempo real y no queremos servir datos stale.
const CACHE = 'opsboard-shell-v1';
const SHELL = ['/', '/manifest.webmanifest', '/icon.png', '/favicon.png'];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE).then((cache) => cache.addAll(SHELL)).catch(() => {})
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))),
    ),
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  const { request } = event;

  // Solo GET y mismo origen
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  // Nunca cachear API calls a Supabase ni nada con query params dinámicos
  if (url.pathname.startsWith('/rest/') || url.pathname.startsWith('/auth/')) return;

  event.respondWith(
    fetch(request)
      .then((res) => {
        // Actualizar cache del shell en background
        if (SHELL.includes(url.pathname)) {
          const clone = res.clone();
          caches.open(CACHE).then((cache) => cache.put(request, clone)).catch(() => {});
        }
        return res;
      })
      .catch(() => caches.match(request).then((m) => m ?? Response.error())),
  );
});

// ------------------------------------------------------------------
// Web Push: la edge function send-push manda { title, body, url, tag }.
// ------------------------------------------------------------------
self.addEventListener('push', (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch {
    data = { body: event.data ? event.data.text() : '' };
  }

  event.waitUntil(
    self.registration.showNotification(data.title || 'Mi Agenda', {
      body: data.body || '',
      icon: '/icon.png',
      badge: '/favicon.png',
      tag: data.tag,
      renotify: !!data.tag,
      data: { url: data.url || '/' },
    }),
  );
});

// Al tocar la notificación: enfocar una pestaña abierta de la app y
// llevarla a la tarea, o abrir una nueva si no hay ninguna.
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const target = new URL(event.notification.data?.url || '/', self.location.origin).href;

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windows) => {
      const open = windows.find((w) => w.url.startsWith(self.location.origin));
      if (open) {
        return open.focus().then((w) => (w && 'navigate' in w ? w.navigate(target) : undefined));
      }
      return self.clients.openWindow(target);
    }),
  );
});
