'use strict';

/* Shbace Medical — Service Worker (Offline System v2)

   Rules this worker follows:
   1. The app ALWAYS boots from the local cache. It never waits for the network when a local copy exists.
   2. Every network call has a hard timeout, so nothing can hang forever (online, offline or on a bad connection).
   3. Install never fails because of one missing file (the old addAll() made the whole worker fail).
   4. Updates are NOT done here. The page-side updater (js/29-offline-setup.js) downloads, verifies and swaps
      files atomically. This worker only serves what is in the cache.

   Keep this cache name identical to js/29-offline-setup.js. Never rotate it for a routine release:
   doing so would discard the verified offline package already stored on students' devices. */
const CACHE_NAME = 'shbace-chrome-offline-v1.3.10.37';
const SCOPE = self.registration.scope;
const INDEX_URL = new URL('index.html', SCOPE).href;
const NET_TIMEOUT = 8000;      /* runtime fetch of a file that is not cached yet */
const VERSION_TIMEOUT = 10000; /* manifest / version checks */

const APP_SHELL = [
  './',
  './index.html',
  './manifest.webmanifest',
  './pwa-version.json',
  './assets/img/shbace-pwa-192.png',
  './assets/img/shbace-pwa-512.png',
  './offline-assets-manifest.json',
  './css/bundle-core.css',
  './js/29-offline-setup.js'
];
const VERSION_FILES = ['/manifest.webmanifest', '/pwa-version.json', '/offline-assets-manifest.json'];

function offlinePage(url) {
  const path = new URL(url).pathname.replace(/[&<>"]/g, '');
  const body = '<!doctype html><html lang="en"><meta charset="utf-8">' +
    '<meta name="viewport" content="width=device-width,initial-scale=1">' +
    '<title>Offline file unavailable</title><body style="font:16px system-ui;padding:24px;background:#07131f;color:#eaf4ff">' +
    '<h1>Shbace Medical</h1><p>This part of the app is not saved on your device yet: <code>' + path + '</code></p>' +
    '<p>Connect to the internet once and open the app. It will finish saving everything in the background.</p></body></html>';
  return new Response(body, {
    status: 503,
    headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' }
  });
}
function emptyResponse(status) {
  return new Response('', { status: status, statusText: 'Offline', headers: { 'Cache-Control': 'no-store' } });
}

/* fetch() with a hard timeout (covers the time until response headers arrive). */
async function netFetch(request, ms, init) {
  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), ms);
  try {
    return await fetch(request, Object.assign({}, init || {}, { signal: ctl.signal }));
  } finally {
    clearTimeout(timer);
  }
}

self.addEventListener('install', event => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE_NAME);
    /* Each shell file is fetched on its own; one failure never blocks installation. */
    await Promise.all(APP_SHELL.map(async url => {
      try {
        if (await cache.match(url)) return;
        const res = await netFetch(new Request(url, { cache: 'reload' }), 15000);
        if (res && res.status === 200) await cache.put(url, res);
      } catch (_) { /* the page-side updater will complete the package */ }
    }));
    await self.skipWaiting();
  })());
});

self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    await self.clients.claim();
    const names = await caches.keys();
    await Promise.all(names
      .filter(name => name.startsWith('shbace-to-me-chrome-offline-'))
      .map(name => caches.delete(name)));
  })());
});

/* Local-first: cache hit returns immediately. Only a genuinely missing file goes to the network (with timeout)
   and is saved locally after a successful response. */
async function localFirst(request) {
  const cache = await caches.open(CACHE_NAME);
  const isNav = request.mode === 'navigate';
  const hit = isNav
    ? (await cache.match(INDEX_URL)) || (await cache.match(request, { ignoreSearch: true }))
    : await cache.match(request, { ignoreSearch: true });
  if (hit) return hit;
  try {
    const fresh = await netFetch(request, NET_TIMEOUT);
    if (fresh && fresh.status === 200) {
      cache.put(isNav ? INDEX_URL : request, fresh.clone()).catch(() => {});
    }
    return fresh;
  } catch (_) {
    return isNav ? offlinePage(request.url) : emptyResponse(504);
  }
}

/* Version / manifest checks marked cache:'no-store' by the updater: network first (timeout), local fallback. */
async function networkThenCache(request) {
  const cache = await caches.open(CACHE_NAME);
  try {
    const fresh = await netFetch(request, VERSION_TIMEOUT, { cache: 'no-store' });
    if (fresh && fresh.status === 200) cache.put(request, fresh.clone()).catch(() => {});
    return fresh;
  } catch (_) {
    const hit = await cache.match(request, { ignoreSearch: true });
    return hit || emptyResponse(504);
  }
}

/* Explicit boot retry: bypass a stale copy, refresh the canonical entry, fall back to the local copy. */
async function reloadRoute(request) {
  const cache = await caches.open(CACHE_NAME);
  const canonical = new URL(request.url);
  canonical.searchParams.delete('__shbace_reload');
  try {
    const fresh = await netFetch(request, NET_TIMEOUT, { cache: 'reload' });
    if (fresh && fresh.status === 200) cache.put(canonical.href, fresh.clone()).catch(() => {});
    return fresh;
  } catch (_) {
    const hit = await cache.match(canonical.href);
    return hit || offlinePage(request.url);
  }
}

self.addEventListener('fetch', event => {
  const request = event.request;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;
  if (url.pathname.endsWith('/sw.js')) return;

  /* Integrity downloads go straight to the network; hash verification belongs to the updater. */
  if (url.searchParams.has('__shbace_integrity')) return;

  if (url.searchParams.has('__shbace_reload')) {
    event.respondWith(reloadRoute(request));
    return;
  }

  if (request.cache === 'no-store' && VERSION_FILES.some(p => url.pathname.endsWith(p))) {
    event.respondWith(networkThenCache(request));
    return;
  }

  event.respondWith(localFirst(request));
});
