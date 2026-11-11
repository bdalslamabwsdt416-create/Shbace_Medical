'use strict';
// build: ios-v15 (gate-synchronized splash, onboarding renderer order, silent activation)

const CACHE_NAME = 'shbace-medical-offline-v2';
// App-shell updates are isolated from the verified offline package. Never overwrite offline resources during SW install.
const SHELL_CACHE_NAME = 'shbace-medical-ios-shell-v148';
const READY_URL = new URL('__shbace_offline_ready__', self.registration.scope).href;
const APP_SHELL = [
  './',
  './index.html',
  './manifest.webmanifest',
  './pwa-version.json',
  './offline-assets-manifest.json',
  './sw.js',
  './js/04-app-main.js',
  './js/09-app-features-v6.js',
  './js/30-ios-v5.js',
  './js/32-ios-v7.js',
  './css/core.css',
  './css/late.css',
  './css/ios-v5.css',
  './css/ios-v6.css',
  './css/ios-v7.css',
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
  event.waitUntil(
    caches.open(SHELL_CACHE_NAME)
      .then(cache => cache.addAll(APP_SHELL))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', event => {
  // Activate and claim silently. Never navigate/reload existing PWA clients from the activation handler.
  event.waitUntil((async () => {
    await self.clients.claim();
    const cache = await caches.open(CACHE_NAME);
    const migrationUrl = new URL('__shbace_silent_update_migration_148__', self.registration.scope).href;
    if (!(await cache.match(migrationUrl))) {
      await cache.put(migrationUrl, new Response('done', {
        status: 200, headers: { 'Content-Type': 'text/plain', 'Cache-Control': 'no-store' }
      }));
    }
  })());
});
self.addEventListener('fetch', event => {
  const request = event.request;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;
  if (url.pathname.endsWith('/sw.js')) return;
  // v5: the in-app update check asks for pwa-version.json?shbcheck=… and must reach the network, not the cache.
  if (url.searchParams.has('shbcheck')) return;

  event.respondWith((async () => {
    const shellCache = await caches.open(SHELL_CACHE_NAME);
    const offlineCache = await caches.open(CACHE_NAME);
    const shellCached = await shellCache.match(request, { ignoreSearch: true });
    if (shellCached) return shellCached;
    const ready = await offlineCache.match(READY_URL);
    const cached = await offlineCache.match(request, { ignoreSearch: true });
    if (cached) return cached;
    // Before verification, successful same-origin responses are cached opportunistically.
    // Once ready, any missing local asset is surfaced instead of silently falling through.
    if (ready) return missingOfflineResponse(request.url);
    try {
      const response = await fetch(request);
      if (response && response.ok) {
        try { await offlineCache.put(request, response.clone()); } catch (_) {}
      }
      return response;
    } catch (_) {
      const fallback = await shellCache.match('./index.html') || await offlineCache.match('./index.html');
      return fallback || missingOfflineResponse(request.url);
    }
  })());
});