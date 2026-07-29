const CACHE = 'qwb-v2';
const SHELL = ['./', './index.html', './manifest.webmanifest', './icon.png'];

self.addEventListener('install', (e) => {
  e.waitUntil(
    (async () => {
      const c = await caches.open(CACHE);
      // 单个资源失败不影响整体安装（适配不稳定的静态托管）
      await Promise.allSettled(SHELL.map(u => c.add(u).catch(() => {})));
      await self.skipWaiting();
    })()
  );
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then(ks =>
      Promise.all(ks.filter(k => k !== CACHE).map(k => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);

  // 文档 / 根路径：网络优先，保证每日更新的 index.html（含内联精选）立即可见；离线回退缓存
  if (req.mode === 'navigate' || url.pathname.endsWith('index.html') || url.pathname === '/') {
    e.respondWith(
      fetch(req).then(r => {
        const cp = r.clone();
        caches.open(CACHE).then(c => c.put(req, cp));
        return r;
      }).catch(() => caches.match(req).then(c => c || caches.match('./')))
    );
    return;
  }

  // 其余静态资源：缓存优先，离线可用
  e.respondWith(
    caches.match(req).then(cached =>
      cached || fetch(req).then(r => {
        if (url.origin === location.origin && r.status === 200) {
          const cp = r.clone();
          caches.open(CACHE).then(c => c.put(req, cp));
        }
        return r;
      }).catch(() => caches.match('./'))
    )
  );
});
