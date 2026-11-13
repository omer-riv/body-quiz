// The service worker, which lets the game be installed as an app and played
// offline. vite.config.ts turns this file into dist/sw.js at build time,
// putting in PRECACHE every file the built game is made of: the page, its
// scripts and styles, the icons and the 3D body (public/body/), each with a
// hash of its contents. It isn't type-checked or bundled; keep it plain JS.
//
// Everything in PRECACHE is downloaded on install and then served from the
// cache. A file is kept across versions while its hash stays the same, so a
// new version of the game doesn't download the 14 MB body again unless the
// body changed. /api/ (the high scores) always goes to the network.

/** @type {[path: string, hash: string][]} */
const PRECACHE = self.__PRECACHE__;
const CACHE = 'body-quiz';
const scope = self.registration.scope;

// A file's URL → the key it is cached under, which carries its hash.
const KEYS = new Map(PRECACHE.map(([path, hash]) => {
  const url = new URL(path, scope).href;
  return [url, `${url}?v=${hash}`];
}));
const PAGE = new URL('index.html', scope).href;

self.addEventListener('install', (event) => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE);
    await Promise.all([...KEYS].map(async ([url, key]) => {
      if (await cache.match(key)) return;
      // no-cache: revalidate with the server, so the HTTP cache can't hand back an older file.
      const res = await fetch(url, { cache: 'no-cache' });
      if (!res.ok) throw new Error(`${url}: ${res.status}`);
      await cache.put(key, res);
    }));
    await self.skipWaiting();
  })());
});

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    for (const name of await caches.keys()) if (name !== CACHE) await caches.delete(name);
    const cache = await caches.open(CACHE);
    const keep = new Set(KEYS.values());
    for (const req of await cache.keys()) if (!keep.has(req.url)) await cache.delete(req);
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  url.search = '';
  url.hash = '';
  const key = req.mode === 'navigate' ? KEYS.get(PAGE) : KEYS.get(url.href);
  if (!key) return;
  event.respondWith((async () => (await caches.match(key)) ?? fetch(req))());
});
