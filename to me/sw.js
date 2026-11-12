'use strict';

const CACHE_NAME = 'shbace-to-me-chrome-offline-v1.3.8';
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
  './css/unified-enhancements.css',
  './css/shbace-layout-refinements.css',
  './js/29-offline-setup.js',
  './js/33-unified-voice.js',
  './js/34-study-countdown.js',
  './js/35-pediatrics-collections.js',
  './js/36-exam-planner-settings-smartreview.js'
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
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(APP_SHELL))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', event => {
  // Preserve older caches; they may still contain files needed by an already-open app.
  event.waitUntil(self.clients.claim());
});

self.addEventListener('fetch', event => {
  const request = event.request;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;
  if (url.pathname.endsWith('/sw.js')) return;

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

  event.respondWith((async () => {
    const cache = await caches.open(CACHE_NAME);
    const ready = await cache.match(READY_URL);
    const cached = await cache.match(request, { ignoreSearch: true });
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
