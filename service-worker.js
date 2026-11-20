const APP_VERSION = '0.29.0';
const CACHE_NAME = `704-class-system-${APP_VERSION}`;
const APP_SHELL = [
  './',
  './index.html',
  './student/',
  './teacher/',
  './admin/',
  './assets/app-0.29.0.css',
  './assets/app-0.29.0.js',
  './src/logo.svg',
  './src/icon-192.png',
  './src/icon-512.png',
  './src/student.webmanifest',
  './src/teacher.webmanifest',
];

self.addEventListener('install', event => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE_NAME);
    await cache.addAll(APP_SHELL);
    await self.skipWaiting();
  })());
});

self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter(key => key !== CACHE_NAME).map(key => caches.delete(key)));
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', event => {
  const request = event.request;
  if (request.method !== 'GET') return;

  if (request.mode === 'navigate') {
    const url = new URL(request.url);
    const entryMatch = url.pathname.match(/\/(student|teacher|admin)\/?$/);
    const entry = entryMatch ? `./${entryMatch[1]}/` : './index.html';
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000);
    const network = fetch(request, { cache: 'no-store', signal: controller.signal }).then(async response => {
      if (response.ok) {
        const cache = await caches.open(CACHE_NAME);
        await cache.put(entry, response.clone());
      }
      return response;
    }).finally(() => clearTimeout(timeout));
    event.waitUntil(network.then(() => undefined).catch(() => undefined));
    event.respondWith((async () => {
      const cached = await caches.match(entry, { ignoreSearch: true });
      if (cached) return cached;
      try {
        return await network;
      } catch {
        return await caches.match('./index.html', { ignoreSearch: true });
      }
    })());
    return;
  }

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;
  event.respondWith((async () => {
    const cached = await caches.match(request, { ignoreSearch: true });
    if (cached) return cached;
    const response = await fetch(request);
    if (response.ok) {
      const cache = await caches.open(CACHE_NAME);
      cache.put(request, response.clone());
    }
    return response;
  })());
});

self.addEventListener('push', event => {
  let data = {};
  try { data = event.data?.json() || {}; } catch {}
  event.waitUntil(self.registration.showNotification(data.title || '704班級系統', {
    body: data.body || '你有一則新的班級通知',
    icon: './src/icon-192.png',
    badge: './src/icon-192.png',
    data: { url: data.url || './', version: APP_VERSION }
  }));
});

self.addEventListener('notificationclick', event => {
  event.notification.close();
  event.waitUntil(self.clients.openWindow(new URL(event.notification.data?.url || './', self.location.href).href));
});
