'use strict';

// Must stay identical to CACHE_NAME in js/29-offline-setup.js (scripts/build-pwa.mjs checks this).
// The name is stable across releases on purpose: an app update only downloads the files that changed.
const CACHE_NAME = 'shbace-chrome-offline-v1.3.4';
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
  './css/late.css',
  './css/offline-window.css',
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
    // First install only. Once a verified package exists, its files are replaced exclusively by the
    // installer's staged update, so a new worker can never leave a half-new / half-old app behind.
    const ready = await cache.match(READY_URL);
    if (!ready) await cache.addAll(APP_SHELL);
    await self.skipWaiting();
  })());
});

self.addEventListener('activate', event => {
  // Older caches are preserved: the installed package lives in CACHE_NAME and must survive worker updates.
  event.waitUntil(self.clients.claim());
});

self.addEventListener('fetch', event => {
  const request = event.request;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;
  if (url.pathname.endsWith('/sw.js')) return;

  // Installer downloads and update checks (?__shbace_integrity=...) always go to the network,
  // never to a cache entry matched with ignoreSearch. The installer verifies size + SHA-256 itself
  // and stores the verified bytes under the canonical URL.
  if (url.searchParams.has('__shbace_integrity')) {
    event.respondWith(fetch(request, { cache: 'reload' }));
    return;
  }

  // Manifest + version file: network first, so an updated manifest/icons always reach Chrome.
  // Falls back to the cached copy when offline. The cache key ignores the query string so that
  // cache-busting requests never pile up extra entries.
  if (url.pathname.endsWith('/manifest.webmanifest') || url.pathname.endsWith('/pwa-version.json') || url.pathname.endsWith('/offline-assets-manifest.json')) {
    event.respondWith((async () => {
      const cache = await caches.open(CACHE_NAME);
      const key = new Request(url.origin + url.pathname);
      try {
        const fresh = await fetch(request, { cache: 'no-store' });
        if (fresh && fresh.ok) { try { await cache.put(key, fresh.clone()); } catch (_) {} }
        return fresh;
      } catch (_) {
        const hit = await cache.match(key);
        return hit || missingOfflineResponse(request.url);
      }
    })());
    return;
  }

  event.respondWith((async () => {
    const cache = await caches.open(CACHE_NAME);
    const ready = await cache.match(READY_URL);
    const cached = await cache.match(request, { ignoreSearch: true });
    if (cached) return cached;
    if (ready) {
      // Launching the installed app (start_url "./") must never end on an error page.
      if (request.mode === 'navigate') {
        const shell = await cache.match('./index.html');
        if (shell) return shell;
      }
      return missingOfflineResponse(request.url);
    }
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
