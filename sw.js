
const CACHE = 'goods-v3';
const ASSETS = ['manifest.webmanifest', 'icon-192.png', 'icon-512.png', 'apple-touch-icon.png'];
self.addEventListener('install', function (e) {
  e.waitUntil(caches.open(CACHE).then(function (c) {
    return c.addAll(ASSETS);
  }).then(function () { return self.skipWaiting(); }).catch(function () {}));
});
self.addEventListener('activate', function (e) {
  e.waitUntil(caches.keys().then(function (keys) {
    return Promise.all(keys.filter(function (k) { return k !== CACHE; }).map(function (k) { return caches.delete(k); }));
  }).then(function () { return self.clients.claim(); }));
});
self.addEventListener('fetch', function (e) {
  if (e.request.method !== 'GET') return;
  var url = new URL(e.request.url);
  var isAppShell = e.request.mode === 'navigate'
                || url.pathname.endsWith('index.html')
                || url.pathname === '/' || url.pathname === '';
  if (isAppShell) {
    // 网络优先：始终获取最新 index.html（含同步修复），离线时回退缓存
    // 加 cache: 'no-store' 防止手机浏览器 HTTP 缓存挡住新版 index.html
    e.respondWith(
      fetch(e.request, { cache: 'no-store' }).then(function (resp) {
        var cp = resp.clone();
        caches.open(CACHE).then(function (c) { c.put(e.request, cp); });
        return resp;
      }).catch(function () {
        return caches.match(e.request).then(function (h) { return h || caches.match('index.html'); });
      })
    );
    return;
  }
  // 静态资源（图标/清单）缓存优先
  e.respondWith(
    caches.match(e.request).then(function (hit) {
      if (hit) return hit;
      return fetch(e.request).then(function (resp) {
        if (resp && resp.ok) {
          var cp = resp.clone();
          caches.open(CACHE).then(function (c) { c.put(e.request, cp); });
        }
        return resp;
      }).catch(function () { return caches.match('index.html'); });
    })
  );
});
