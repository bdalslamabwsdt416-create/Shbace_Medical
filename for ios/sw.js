'use strict';

/* Keep this cache name identical to js/29-offline-setup.js. Never rotate it for a routine app release: doing so would discard the verified 28 MB package. */
const CACHE_NAME = 'shbace-medical-offline-v2';
const READY_URL = new URL('__shbace_offline_ready__', self.registration.scope).href;
const INDEX_URL = new URL('index.html', self.registration.scope).href;
const PWA_VERSION_URL = new URL('pwa-version.json', self.registration.scope).href;
const DB_NAME = 'shbace-medical-offline-state-v1';
const APP_SHELL = [
  './',
  './index.html',
  './manifest.webmanifest',
  './pwa-version.json',
  './assets/img/fc0bef7cd7ca.png',
  './offline-assets-manifest.json',
  './css/bundle-core.css',
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
    /* Fetch only missing shell files; the offline updater owns subsequent release changes. */
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
    const names = await caches.keys();
    /* Retired iOS shell caches are obsolete; never remove the verified offline package or its IndexedDB. */
    await Promise.all(names
      .filter(name => name.startsWith('shbace-to-me-chrome-offline-') ||
                      name.startsWith('shbace-medical-ios-shell-'))
      .map(name => caches.delete(name)));
    /* Refresh the release marker before deciding whether a cached navigation belongs to this package. */
    await refreshCachedPwaVersion();
    await self.clients.claim();
  })());
});

/* Read the app release version stored with the verified package record. If the database
   does not exist yet, abort the implicit upgrade so the service worker never creates an
   empty IndexedDB that could block the app's own version-1 schema setup. */
function readInstalledReleaseVersion() {
  return new Promise(resolve => {
    if (!self.indexedDB) { resolve(null); return; }
    let request;
    try { request = self.indexedDB.open(DB_NAME); }
    catch (_) { resolve(null); return; }
    request.onupgradeneeded = () => {
      try { request.transaction.abort(); } catch (_) {}
    };
    request.onsuccess = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains('meta')) {
        db.close();
        resolve(null);
        return;
      }
      let tx;
      try { tx = db.transaction('meta', 'readonly'); }
      catch (_) { db.close(); resolve(null); return; }
      const get = tx.objectStore('meta').get('installed');
      get.onsuccess = () => {
        const value = get.result && typeof get.result.releaseVersion === 'string'
          ? get.result.releaseVersion : null;
        db.close();
        resolve(value || null);
      };
      get.onerror = () => { db.close(); resolve(null); };
      tx.onabort = () => { db.close(); resolve(null); };
    };
    request.onerror = () => resolve(null);
    request.onblocked = () => resolve(null);
  });
}

async function readCachedPwaVersion(cache) {
  try {
    const response = await cache.match(PWA_VERSION_URL, { ignoreSearch: true });
    if (!response) return null;
    const json = await response.json();
    return json && typeof json.version === 'string' ? json.version : null;
  } catch (_) {
    return null;
  }
}

async function refreshCachedPwaVersion() {
  const cache = await caches.open(CACHE_NAME);
  try {
    const response = await fetch(PWA_VERSION_URL, { cache: 'reload' });
    if (response && response.ok) await cache.put(PWA_VERSION_URL, response.clone());
  } catch (_) {
    /* Offline activation keeps the last cached version marker; navigation falls back safely. */
  }
}

async function packageVersionMismatch(cache) {
  const results = await Promise.all([
    readInstalledReleaseVersion(),
    readCachedPwaVersion(cache)
  ]);
  /* Missing releaseVersion means a pre-migration installation and must be refreshed online. */
  return !results[0] || !results[1] || results[0] !== results[1];
}

async function networkFirstOnPackageMismatch(request) {
  const cache = await caches.open(CACHE_NAME);
  if (!(await packageVersionMismatch(cache))) return localFirst(request);
  try {
    const fresh = await fetch(request, { cache: 'reload' });
    if (fresh && fresh.ok) {
      const key = request.mode === 'navigate' ? INDEX_URL : request.url;
      try { await cache.put(key, fresh.clone()); } catch (_) {}
    }
    return fresh;
  } catch (_) {
    const hit = request.mode === 'navigate'
      ? await cache.match(INDEX_URL) || await cache.match(request, { ignoreSearch: true })
      : await cache.match(request, { ignoreSearch: true });
    return hit || missingOfflineResponse(request.url);
  }
}

/* Local-first: after the updater verifies and stores the package, startup uses those local bytes.
   A genuinely missing file gets one network fallback and is saved locally after a successful response. */
async function localFirst(request) {
  const cache = await caches.open(CACHE_NAME);
  let hit = null;
  if (request.mode === 'navigate') {
    /* The updater stores the canonical index.html path. Do not serve an older cached './' entry first. */
    hit = await cache.match(INDEX_URL) || await cache.match(request, { ignoreSearch: true });
  } else {
    hit = await cache.match(request, { ignoreSearch: true });
  }
  if (hit) return hit;
  try {
    const fresh = await fetch(request);
    if (fresh && fresh.ok) {
      try {
        const cacheKey = request.mode === 'navigate' ? INDEX_URL : request;
        await cache.put(cacheKey, fresh.clone());
      } catch (_) {}
    }
    return fresh;
  } catch (_) {
    return missingOfflineResponse(request.url);
  }
}

self.addEventListener('fetch', event => {
  const request = event.request;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;
  if (url.pathname.endsWith('/sw.js')) return;

  /* Integrity downloads must reach the network; hash verification belongs to the updater. */
  if (url.searchParams.has('__shbace_integrity')) {
    event.respondWith(fetch(request, { cache: 'reload' }));
    return;
  }

  /* Explicit boot retry bypasses a stale cached copy, then refreshes its canonical cache entry. */
  if (url.searchParams.has('__shbace_reload')) {
    event.respondWith((async () => {
      const cache = await caches.open(CACHE_NAME);
      const canonical = new URL(request.url);
      canonical.searchParams.delete('__shbace_reload');
      try {
        const fresh = await fetch(request, { cache: 'reload' });
        if (fresh && fresh.ok) {
          try { await cache.put(canonical.href, fresh.clone()); } catch (_) {}
        }
        return fresh;
      } catch (_) {
        const hit = await cache.match(canonical.href);
        return hit || missingOfflineResponse(request.url);
      }
    })());
    return;
  }

  /* The updater marks version/manifest checks with cache:'no-store'. Only those checks go to the network. */
  if (url.pathname.endsWith('/manifest.webmanifest') ||
      url.pathname.endsWith('/pwa-version.json') ||
      url.pathname.endsWith('/offline-assets-manifest.json')) {
    if (request.cache !== 'no-store') {
      event.respondWith(localFirst(request));
      return;
    }
    event.respondWith((async () => {
      const cache = await caches.open(CACHE_NAME);
      try {
        const fresh = await fetch(request, { cache: 'no-store' });
        if (fresh && fresh.ok) {
          try { await cache.put(request, fresh.clone()); } catch (_) {}
        }
        return fresh;
      } catch (_) {
        const hit = await cache.match(request, { ignoreSearch: true });
        return hit || missingOfflineResponse(request.url);
      }
    })());
    return;
  }

  /* A mismatched installed release must not reopen a stale cached HTML shell. The bootstrap
     updater script is also refreshed so its one-time migration logic can run immediately. */
  if (request.mode === 'navigate' ||
      (request.destination === 'script' && url.pathname.endsWith('/js/29-offline-setup.js'))) {
    event.respondWith(networkFirstOnPackageMismatch(request));
    return;
  }

  /* Other JavaScript and CSS remain local-first; the verified updater replaces changed assets. */
  if (request.destination === 'script' || request.destination === 'style') {
    event.respondWith(localFirst(request));
    return;
  }

  /* Other same-origin resources: prefer the verified package, then fetch/cache a missing resource. */
  event.respondWith((async () => {
    const cache = await caches.open(CACHE_NAME);
    const ready = await cache.match(READY_URL);
    let cached = await cache.match(request, { ignoreSearch: true });
    if (!cached && request.mode === 'navigate') cached = await cache.match(INDEX_URL);
    if (cached) return cached;
    if (ready) return missingOfflineResponse(request.url);
    try {
      const response = await fetch(request);
      if (response && response.ok) {
        try { await cache.put(request, response.clone()); } catch (_) {}
      }
      return response;
    } catch (_) {
      return missingOfflineResponse(request.url);
    }
  })());
});
