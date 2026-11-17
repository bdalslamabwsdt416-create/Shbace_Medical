'use strict';

/* Runtime data always comes from the verified package. Keep these identities stable. */
const CACHE_NAME = 'shbace-medical-offline-v2';
const INDEX_URL = new URL('index.html', self.registration.scope).href;
const UPDATE_HEADER = 'X-Shbace-Update-Check';
const UPDATE_METADATA_PATHS = new Set([
  new URL('offline-assets-manifest.json', self.registration.scope).pathname,
  new URL('pwa-version.json', self.registration.scope).pathname
]);

function missingOfflineResponse(url) {
  const path = new URL(url).pathname;
  const body = '<!doctype html><html lang="en"><meta charset="utf-8">' +
    '<meta name="viewport" content="width=device-width,initial-scale=1">' +
    '<title>Offline file unavailable</title><body style="font:16px system-ui;padding:24px;background:#07131f;color:#eaf4ff">' +
    '<h1>Shbace Medical</h1><p>A required local file is missing: <code>' + path.replace(/[&<>"]/g, '') +
    '</code>.</p><p>Open Settings → App updates and choose Check for updates or Repair. Normal app startup never downloads missing files.</p></body></html>';
  return new Response(body, {
    status: 503,
    headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' }
  });
}

function isTaggedUpdateRequest(request) {
  return request.headers.get(UPDATE_HEADER) === '1';
}

async function cachedResponse(request) {
  const cache = await caches.open(CACHE_NAME);
  const canonical = new URL(request.url);
  canonical.searchParams.delete('__shbace_reload');
  canonical.searchParams.delete('__shbace_integrity');

  if (request.mode === 'navigate') {
    const hit = await cache.match(INDEX_URL) || await cache.match(request, { ignoreSearch: true });
    return hit || missingOfflineResponse(request.url);
  }

  const hit = await cache.match(canonical.href, { ignoreSearch: true }) ||
    await cache.match(request, { ignoreSearch: true });
  return hit || missingOfflineResponse(request.url);
}

async function localOnly(request) {
  try {
    return await cachedResponse(request);
  } catch (_) {
    return missingOfflineResponse(request.url);
  }
}

async function updateMetadata(request) {
  const cache = await caches.open(CACHE_NAME);
  try {
    const response = await fetch(request, { cache: 'no-store' });
    if (response && response.ok) {
      const canonical = new URL(request.url);
      canonical.search = '';
      await cache.put(canonical.href, response.clone());
    }
    return response;
  } catch (_) {
    const hit = await cache.match(request.url, { ignoreSearch: true });
    return hit || missingOfflineResponse(request.url);
  }
}

self.addEventListener('install', event => {
  /* Never download shell files during startup or worker installation. */
  event.waitUntil(self.skipWaiting());
});

self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    const names = await caches.keys();
    await Promise.all(names
      .filter(name => name.startsWith('shbace-to-me-chrome-offline-') ||
                      name.startsWith('shbace-medical-ios-shell-'))
      .map(name => caches.delete(name)));
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', event => {
  const request = event.request;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) {
    /* Remote APIs, scripts, fonts and media are not part of app runtime. */
    event.respondWith(Promise.reject(new TypeError('Shbace Medical runtime is offline-only.')));
    return;
  }

  if (request.method !== 'GET') {
    event.respondWith(Promise.reject(new TypeError('Shbace Medical runtime allows only local GET requests.')));
    return;
  }

  const tagged = isTaggedUpdateRequest(request);
  const integrityRequest = url.searchParams.has('__shbace_integrity');
  const metadataRequest = UPDATE_METADATA_PATHS.has(url.pathname) &&
    request.cache === 'no-store' && tagged;

  if (integrityRequest && tagged) {
    /* Used only after a manual/accepted update or repair action; bytes are SHA-256 verified by the updater. */
    event.respondWith(fetch(request, { cache: 'reload' }));
    return;
  }

  if (metadataRequest) {
    /* Only the manual or scheduled seven-day update checker tags these metadata requests. */
    event.respondWith(updateMetadata(request));
    return;
  }

  /* A retry query is normalized to the canonical local cache key. It never bypasses storage. */
  event.respondWith(localOnly(request));
});
