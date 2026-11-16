'use strict';

/* Rotate the cache namespace with every PWA release. Keep this identical to js/29-offline-setup.js so the new worker installs a fresh shell. */
const CACHE_NAME = 'shbace-chrome-offline-v1.3.10.37';
const READY_URL = new URL('__shbace_offline_ready__', self.registration.scope).href;
const APP_SHELL = [
  './',
  './index.html',
  './manifest.webmanifest',
  './pwa-version.json',
  './assets/img/shbace-pwa-192.png',
  './assets/img/shbace-pwa-512.png',
  './offline-assets-manifest.json',
  './css/core.css',
  './js/29-offline-setup.js'
];

function missingOfflineResponse(url) {
  const path = new URL(url).pathname;
  const body = '<!doctype html><html lang="en"><meta charset="utf-8">' +
    '<meta name="viewport" content="width=device-width,initial-scale=1">' +
    '<title>Offline file unavailable</title><body style="font:16px system-ui;padding:24px;background:#07131f;color:#eaf4ff">' +
    '<h1>Shbace Medical</h1><p>A required local file is missing: <code>' + path.replace(/[&<>"]/g, '') +
    '</code>.</p><p>Reconnect to the internet, open Shbace Medical, and choose Restore on the offline setup screen.</p></body></html>';
  return new Response(body, {
    status: 503,
    headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' }
  });
}

self.addEventListener('install', event => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE_NAME);
    /* Fetch only the shell files that are not already stored; the offline updater owns every later change. */
    const missing = [];
    for (const url of APP_SHELL) {
      if (!(await cache.match(url))) missing.push(url);
    }
    if (missing.length) await cache.addAll(missing);
    await self.skipWaiting();
  })());
});

self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    await self.clients.claim();
    const names = await caches.keys();
    /* Remove only the old per-version worker caches from earlier releases. */
    await Promise.all(names
      .filter(name => name.startsWith('shbace-to-me-chrome-offline-'))
      .map(name => caches.delete(name)));
  })());
});

self.addEventListener('fetch', event => {
  const request = event.request;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;
  if (url.pathname.endsWith('/sw.js')) return;

  // Integrity downloads must reach the network; never satisfy them from a stale
  // cache entry matched with ignoreSearch. The installer stores verified bytes
  // under the canonical URL after its SHA-256 check succeeds.
  if (url.searchParams.has('__shbace_integrity')) {
    event.respondWith(fetch(request, { cache: 'reload' }));
    return;
  }
  // A bounded retry from the boot loader bypasses a stale cache entry and refreshes the canonical offline copy.
  if (url.searchParams.has('__shbace_reload')) {
    event.respondWith((async () => {
      const cache = await caches.open(CACHE_NAME);
      const canonical = new URL(request.url);
      canonical.searchParams.delete('__shbace_reload');
      try {
        const fresh = await fetch(request, { cache: 'reload' });
        if (fresh && fresh.ok) { try { await cache.put(canonical.href, fresh.clone()); } catch (_) {} }
        return fresh;
      } catch (_) {
        const hit = await cache.match(canonical.href);
        return hit || missingOfflineResponse(request.url);
      }
    })());
    return;
  }


  // Manifest + version file: network first, so an updated manifest/icons always reach Chrome.
  // Falls back to the cached copy when offline.
  if (url.pathname.endsWith('/manifest.webmanifest') || url.pathname.endsWith('/pwa-version.json') || url.pathname.endsWith('/offline-assets-manifest.json')) {
    event.respondWith((async () => {
      const cache = await caches.open(CACHE_NAME);
      try {
        const fresh = await fetch(request, { cache: 'no-store' });
        if (fresh && fresh.ok) { try { await cache.put(request, fresh.clone()); } catch (_) {} }
        return fresh;
      } catch (_) {
        const hit = await cache.match(request, { ignoreSearch: true });
        return hit || missingOfflineResponse(request.url);
      }
    })());
    return;
  }

  // Keep the application shell on one coherent release. Online, navigations and executable
  // assets are refreshed from the origin; offline, the verified current-version cache is used.
  // This avoids serving an old bank script beside a newer index.html (or vice versa).
  if (request.mode === 'navigate' || request.destination === 'script' || request.destination === 'style') {
    event.respondWith((async () => {
      const cache = await caches.open(CACHE_NAME);
      try {
        const fresh = await fetch(request, { cache: 'no-store' });
        if (fresh && fresh.ok) { try { await cache.put(request, fresh.clone()); } catch (_) {} }
        return fresh;
      } catch (_) {
        const cached = await cache.match(request, { ignoreSearch: true });
        if (cached) return cached;
        if (request.mode === 'navigate') {
          const shell = await cache.match(new URL('index.html', self.registration.scope).href);
          if (shell) return shell;
        }
        const ready = await cache.match(READY_URL);
        return ready ? missingOfflineResponse(request.url) : missingOfflineResponse(request.url);
      }
    })());
    return;
  }

  event.respondWith((async () => {
    const cache = await caches.open(CACHE_NAME);
    const ready = await cache.match(READY_URL);
    let cached = await cache.match(request, { ignoreSearch: true });
    if (!cached && request.mode === 'navigate') cached = await cache.match(new URL('index.html', self.registration.scope).href);
    if (cached) return cached;
    if (ready) return missingOfflineResponse(request.url);
    try {
      const response = await fetch(request);
      if (response && response.ok) {
        try { await cache.put(request, response.clone()); } catch (_) {}
      }
      return response;
    } catch (_) {
      const fallback = await cache.match('./index.html');
      return fallback || missingOfflineResponse(request.url);
    }
  })());
});