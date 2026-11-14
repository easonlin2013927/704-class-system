const APP_VERSION = '0.28.1';
const CACHE_NAME = `704-class-system-${APP_VERSION}`;
const APP_SHELL = [
  './',
  './index.html',
  './src/styles.css',
  './src/themes.css',
  './src/school.css',
  './src/redesign.css',
  './src/theme-expansion.css',
  './src/responsive.css',
  './src/login-layout.css',
  './src/v025.css',
  './src/offline.css',
  './src/main.js',
  './src/connectivity.js',
  './src/cloud.js',
  './src/config.js',
  './src/broadcast.js',
  './src/mailboxes.js',
  './src/mail-test.js',
  './src/portal.js',
  './src/personalization.js',
  './src/school.js',
  './src/chat.js',
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
    event.respondWith((async () => {
      try {
        return await fetch(request, { cache: 'no-store' });
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
