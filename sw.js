/*
 * Аслямов — офлайн-оболочка сайта.
 *
 * Задача: клиент в районе со слабой связью должен открыть страницу
 * и увидеть телефон, часы и адрес, даже если сеть не отвечает.
 *
 * Правила кэша выбраны так, чтобы владелец никогда не застрял на старой
 * версии сайта:
 *   — HTML и переходы по странице: сеть в приоритете, кэш только как запас;
 *   — картинки и шрифты: из кэша, но с тихим обновлением в фоне;
 *   — всё чужое (Метрика, карта Яндекса) не трогаем вообще.
 */

var CACHE = 'aslyamov-v1';

var CORE = [
  './',
  './index.html',
  './fonts/fonts.css',
  './fonts/fira-sans-condensed-800-cyrillic.woff2',
  './fonts/golos-text-400-cyrillic.woff2',
  './favicon.svg',
  './icon-192.png',
  './icon-512.png'
];

self.addEventListener('install', function (event) {
  event.waitUntil(
    caches.open(CACHE).then(function (cache) {
      // Кладём по одному: если один файл не отдался, установка не рушится.
      return Promise.all(CORE.map(function (url) {
        return cache.add(url).catch(function () { /* пропускаем недоступное */ });
      }));
    }).then(function () { return self.skipWaiting(); })
  );
});

self.addEventListener('activate', function (event) {
  event.waitUntil(
    caches.keys().then(function (keys) {
      return Promise.all(keys.map(function (key) {
        return key === CACHE ? null : caches.delete(key);
      }));
    }).then(function () { return self.clients.claim(); })
  );
});

function put(request, response) {
  if (!response || !response.ok || response.type !== 'basic') return response;
  var copy = response.clone();
  caches.open(CACHE).then(function (cache) { cache.put(request, copy); }).catch(function () {});
  return response;
}

self.addEventListener('fetch', function (event) {
  var request = event.request;

  if (request.method !== 'GET') return;

  var url;
  try { url = new URL(request.url); } catch (e) { return; }
  if (url.origin !== self.location.origin) return;

  // Переход по странице: сначала сеть, иначе — то, что лежит в кэше.
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then(function (response) { return put(request, response); })
        .catch(function () {
          return caches.match(request).then(function (hit) {
            return hit || caches.match('./index.html');
          });
        })
    );
    return;
  }

  // Остальное своё: отдаём из кэша сразу, обновляем в фоне.
  event.respondWith(
    caches.match(request).then(function (hit) {
      var fromNetwork = fetch(request)
        .then(function (response) { return put(request, response); })
        .catch(function () { return hit; });
      return hit || fromNetwork;
    })
  );
});
