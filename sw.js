/*
 * Аслямов — офлайн-оболочка сайта.
 *
 * Задача: клиент в районе со слабой связью должен открыть страницу
 * и увидеть телефон, часы и адрес, даже если сеть не отвечает.
 *
 * Правила кэша:
 *   — HTML и переходы по странице: сеть в приоритете, кэш только как запас,
 *     поэтому правки владельца видны сразу, а не через сутки;
 *   — fonts/, img/ и иконки: из кэша сразу (cache-first);
 *   — Метрика и карта Яндекса не перехватываются вообще.
 *
 * ВАЖНО: при замене файла внутри fonts/, img/ или иконок нужно поднять
 * версию CACHE — иначе у вернувшихся посетителей останется старая картинка.
 * Для правок самой страницы этого делать не нужно: HTML идёт по сети.
 */

var CACHE = 'aslyamov-v2';

/* Чужие адреса, к которым service worker не притрагивается */
var SKIP = ['mc.yandex.ru', 'yandex.ru', 'yandex.net', 'yandex.com'];

var CORE = [
  './',
  './index.html',
  './vizitka.html',
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

  // Своё — только со своего origin; чужое и карта с Метрикой идут мимо.
  if (url.origin !== self.location.origin) return;
  if (SKIP.indexOf(url.hostname) !== -1) return;
  if (url.pathname.indexOf('/map-widget') === 0) return;

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

  // Шрифты, картинки, иконки: отдаём из кэша сразу, в сеть идём только
  // если файла там ещё нет.
  event.respondWith(
    caches.match(request).then(function (hit) {
      if (hit) return hit;
      return fetch(request).then(function (response) { return put(request, response); });
    })
  );
});
