'use strict';

/* Runtime data always comes from the verified package. Keep these identities stable. */
const CACHE_NAME = 'shbace-medical-offline-v2';
/* Preserve the shared database identity; this worker never opens or mutates it at startup. */
const DB_NAME = 'shbace-medical-offline-state-v1';
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
  return !!(request && request.headers && typeof request.headers.get === 'function' &&
    request.headers.get(UPDATE_HEADER) === '1');
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

/* The IndexedDB check is remembered for the life of this worker, so opening the app does not open the
   database once per file. A "verified" answer is kept 60 s, a "not verified yet" answer only 3 s so the
   first install switches to local-only quickly. Concurrent requests share one lookup. */
const verifiedMemo = { value: false, at: 0, pending: null };
async function hasVerifiedInstall() {
  const age = Date.now() - verifiedMemo.at;
  if (verifiedMemo.at && age >= 0 && age < (verifiedMemo.value ? 60000 : 3000)) return Promise.resolve(verifiedMemo.value);
  if (verifiedMemo.pending) return verifiedMemo.pending;
  verifiedMemo.pending = readVerifiedInstall().then(value => {
    verifiedMemo.value = value; verifiedMemo.at = Date.now(); verifiedMemo.pending = null; return value;
  }, () => {
    verifiedMemo.value = false; verifiedMemo.at = Date.now(); verifiedMemo.pending = null; return false;
  });
  return verifiedMemo.pending;
}

/* Only a matching verified IndexedDB pair enables strict local-only runtime. */
async function readVerifiedInstall() {
  if (!self.indexedDB) return false;
  return new Promise(resolve => {
    let done = false;
    const finish = value => { if (!done) { done = true; resolve(value); } };
    const timer = setTimeout(() => finish(false), 2500);
    let req;
    try { req = self.indexedDB.open(DB_NAME, 1); }
    catch (_) { clearTimeout(timer); finish(false); return; }
    req.onupgradeneeded = () => {
      if (!req.result.objectStoreNames.contains('meta')) req.result.createObjectStore('meta');
      if (!req.result.objectStoreNames.contains('verified')) req.result.createObjectStore('verified');
    };
    req.onerror = req.onblocked = () => { clearTimeout(timer); finish(false); };
    req.onsuccess = () => {
      const db = req.result;
      try {
        const tx = db.transaction('meta', 'readonly'), store = tx.objectStore('meta');
        const a = store.get('installed'), b = store.get('ready');
        tx.oncomplete = () => {
          const x = a.result, y = b.result, file = x && x.files && x.files['index.html'];
          const valid = !!(x && y && x.verified === true && y.verified === true &&
            x.version && x.version === y.version && file &&
            /^[a-f0-9]{64}$/.test(String(file.sha256 || '')) && Number(file.bytes) > 0 &&
            Number(x.fileCount) > 0 && Number(y.fileCount) === Number(x.fileCount));
          try { db.close(); } catch (_) {}
          clearTimeout(timer); finish(valid);
        };
        tx.onerror = tx.onabort = () => { try { db.close(); } catch (_) {} clearTimeout(timer); finish(false); };
      } catch (_) { try { db.close(); } catch (_) {} clearTimeout(timer); finish(false); }
    };
  });
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
  /* Other origins and non-GET requests are not part of the offline package: the worker does not touch them,
     so they behave normally online and simply fail offline (they no longer break because of the worker). */
  if (url.origin !== self.location.origin) return;
  if (request.method !== 'GET') return;

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

  /* Bootstrap the first install from same-origin network; verified installs stay local-only. */
  event.respondWith(hasVerifiedInstall().then(verified =>
    verified ? localOnly(request) : fetch(request)
  ).catch(() => fetch(request)));
});
