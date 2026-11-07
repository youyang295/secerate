/* 绂荤嚎缂撳瓨锛氭暣涓?app 鍙湁鍑犱釜闈欐€佹枃浠讹紝瑁呬竴娆″氨鑳芥柇缃戠敤 */
/* 鏀逛簡浠讳綍鏂囦欢锛屾妸涓嬮潰鐨勭増鏈彿鍔?1锛屼笉鐒舵墜鏈轰笂杩樻槸鏃х紦瀛?*/

const CACHE = 'vault-v7';

const ASSETS = [
  './',
  './index.html',
  './style.css',
  './app.js',
  './vault.js',
  './manifest.json',
  './icons/icon-192.png',
  './icons/icon-512.png',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE).then((cache) => cache.addAll(ASSETS)).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;

  event.respondWith(
    caches.match(request).then((cached) => {
      if (cached) return cached;
      return fetch(request)
        .then((res) => {
          if (res.ok && new URL(request.url).origin === location.origin) {
            const copy = res.clone();
            caches.open(CACHE).then((cache) => cache.put(request, copy));
          }
          return res;
        })
        .catch(() => caches.match('./index.html'));
    })
  );
});
