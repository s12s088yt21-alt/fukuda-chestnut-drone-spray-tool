const CACHE_NAME = 'fukuda-spray-tool-v24';
const APP_FILES = ['./', './index.html', './records.html', './manifest.webmanifest',
  './records.css', './records-core.js', './records.js', './workflow-core.js',
  './workflow.js', './workflow.css', './workflow-data.js', './mobile.js',
  './icon-180.png', './icon-192.png', './icon-512.png'];
const APP_URLS = new Set(APP_FILES.map(path => new URL(path, self.registration.scope).href));
self.addEventListener('install', event => {
  event.waitUntil(caches.open(CACHE_NAME).then(cache => cache.addAll(APP_FILES)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', event => {
  event.waitUntil(caches.keys().then(keys => Promise.all(keys
    .filter(key => key.startsWith('fukuda-spray-tool-') && key !== CACHE_NAME)
    .map(key => caches.delete(key)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET') return;
  const url = new URL(event.request.url); url.search = ''; url.hash = '';
  if (!APP_URLS.has(url.href)) return;
  // インストール時に一式そろえた版を配信し、圏外でも同じ画面を開く。
  event.respondWith(caches.open(CACHE_NAME).then(async cache => {
    const cached = await cache.match(url.href);
    return cached || fetch(event.request);
  }));
});
