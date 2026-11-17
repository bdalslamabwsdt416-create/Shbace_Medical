'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const root = path.resolve(__dirname, '..');
const read = relative => fs.readFileSync(path.join(root, relative), 'utf8');
const offline = read('js/29-offline-setup.js');
const sw = read('sw.js');
const build = read('scripts/restore-ios-packed.js');
const html = read('index.html');
const pkg = JSON.parse(read('package.json'));
const pwa = JSON.parse(read('pwa-version.json'));
const offlineManifest = JSON.parse(read('offline-assets-manifest.json'));
const drawerMenuBase = read('js/06-drawer-menu.js');
const drawerOrder = read('js/20-drawer-order-v12.js');
const drawerRuntime = read('js/07-returning-student-migration.js');
const drawerFeatures = read('js/09-app-features-v6.js');

/* Execute the real service-worker fetch listener with deterministic CacheStorage,
   IndexedDB and fetch fakes. These tests assert returned bytes and network behavior. */
function createServiceWorkerHarness(options) {
  const scope = 'https://ios.example.test/';
  const origin = new URL(scope).origin;
  const listeners = new Map();
  const entries = new Map();
  const fetchCalls = [];
  const toUrl = input => new URL(typeof input === 'string' ? input : input.url, scope);
  const cache = {
    async match(input, matchOptions) {
      const key = toUrl(input);
      if (matchOptions && matchOptions.ignoreSearch) key.search = '';
      const response = entries.get(key.href);
      return response ? response.clone() : null;
    },
    async put(input, response) {
      entries.set(toUrl(input).href, response.clone());
    },
    async keys() {
      return [...entries.keys()].map(url => ({ url }));
    }
  };
  entries.set(new URL('pwa-version.json', scope).href,
    new Response(JSON.stringify({ version: '1.4.15' }), {
      status: 200, headers: { 'Content-Type': 'application/json' }
    }));

  const indexedDB = {
    open() {
      const request = {};
      queueMicrotask(() => {
        request.result = {
          objectStoreNames: { contains: name => name === 'meta' },
          transaction() {
            return {
              objectStore() {
                return {
                  get(key) {
                    const getRequest = {};
                    queueMicrotask(() => {
                      getRequest.result = key === 'installed' ? options.installedRecord : undefined;
                      if (getRequest.onsuccess) getRequest.onsuccess();
                    });
                    return getRequest;
                  }
                };
              }
            };
          },
          close() {}
        };
        if (request.onsuccess) request.onsuccess();
      });
      return request;
    }
  };

  const self = {
    registration: { scope },
    location: { origin },
    indexedDB,
    clients: { claim: async () => {} },
    skipWaiting: async () => {},
    addEventListener(type, listener) { listeners.set(type, listener); }
  };
  const caches = {
    open: async () => cache,
    keys: async () => [],
    delete: async () => false
  };
  async function fakeFetch(input, init) {
    fetchCalls.push({
      url: typeof input === 'string' ? input : input.url,
      cache: init && init.cache
    });
    if (options.offline) throw new TypeError('Network unavailable');
    return new Response('NETWORK COPY', { status: 200 });
  }

  vm.runInNewContext(options.source, {
    self, caches, fetch: fakeFetch, URL, Response, Promise
  });

  return {
    cache,
    fetchCalls,
    async seed(relativePath, body) {
      await cache.put(new URL(relativePath, scope).href, new Response(body, { status: 200 }));
    },
    async cachedText(relativePath) {
      const response = await cache.match(new URL(relativePath, scope).href);
      return response ? response.text() : null;
    },
    async request(relativePath, mode, destination) {
      let responsePromise;
      const request = {
        url: new URL(relativePath, scope).href,
        method: 'GET',
        mode: mode || 'same-origin',
        destination: destination || '',
        cache: 'default'
      };
      const listener = listeners.get('fetch');
      assert.ok(listener, 'service worker fetch listener was registered');
      listener({
        request,
        respondWith(value) { responsePromise = Promise.resolve(value); }
      });
      assert.ok(responsePromise, 'fetch listener called respondWith');
      return responsePromise;
    }
  };
}

test('one-time migration forces a network check for an installed 1.4.10-era package', () => {
  for (const marker of [
    "var MIGRATION_KEY='shbace_ios_migrated_1_4_14'",
    'migrationNeeded=hasRecord&&lsNum(MIGRATION_KEY)!==1',
    'lsDel(CHECK_OK_KEY);lsDel(CHECK_TRY_KEY)',
    'if(navigator.onLine===false)return',
    'if(!hasRecord||migrationNeeded||checkDue())'
  ]) assert.ok(offline.includes(marker), 'missing migration marker: ' + marker);
});

test('migration applies the verified update automatically without the Later sheet', () => {
  const start = offline.indexOf('if(migrationInProgress&&manifestFromNetwork&&res.plan)');
  const end = offline.indexOf("if(res.kind==='prompt')", start);
  assert.ok(start >= 0 && end > start, 'migration branch must precede the ordinary prompt');
  const migrationBranch = offline.slice(start, end);
  assert.ok(migrationBranch.includes('showPlanNeeded(res.plan);runPlan()'));
  assert.ok(!migrationBranch.includes('showUpdateSheet') && !migrationBranch.includes('shbUpdLater'));
});

test('migration flag is set only after a successful online check or verified commit', () => {
  const networkSuccess = offline.indexOf('if(manifestFromNetwork){');
  const networkFlag = offline.indexOf("lsSet(MIGRATION_KEY,'1')", networkSuccess);
  assert.ok(networkSuccess >= 0 && networkFlag > networkSuccess);
  const commit = offline.indexOf('return commitPlan(target)');
  const cleanup = offline.indexOf('return cleanupPreviousCaches()', commit);
  const commitFlag = offline.indexOf("lsSet(MIGRATION_KEY,'1')", commit);
  assert.ok(commit >= 0 && cleanup > commit && commitFlag > cleanup);
});

test('only retired iOS shell caches are deleted; offline package and student database identities remain stable', () => {
  for (const marker of [
    "var CACHE_NAME='shbace-medical-offline-v2'",
    "var DB_NAME='shbace-medical-offline-state-v1'",
    "name.indexOf('shbace-medical-ios-shell-')===0"
  ]) assert.ok(offline.includes(marker), 'missing offline setup marker: ' + marker);
  for (const marker of [
    "const CACHE_NAME = 'shbace-medical-offline-v2'",
    "const DB_NAME = 'shbace-medical-offline-state-v1'",
    "name.startsWith('shbace-medical-ios-shell-')"
  ]) assert.ok(sw.includes(marker), 'missing service worker marker: ' + marker);
  assert.ok(!offline.includes('indexedDB.deleteDatabase'));
  assert.ok(!sw.includes('indexedDB.deleteDatabase'));
  assert.ok(!offline.includes('caches.delete(CACHE_NAME)'));
  assert.ok(!sw.includes('caches.delete(CACHE_NAME)'));
});

test('service worker compares IndexedDB releaseVersion with cached pwa-version and network-firsts stale navigation', () => {
  for (const marker of [
    'readInstalledReleaseVersion',
    'indexedDB.open(DB_NAME)',
    'readCachedPwaVersion',
    'results[0] !== results[1]',
    'await refreshCachedPwaVersion()',
    "request.mode === 'navigate' ||",
    "request.destination === 'script' ||",
    "request.destination === 'style'",
    'networkFirstOnPackageMismatch(request)',
    'cache.match(INDEX_URL)'
  ]) assert.ok(sw.includes(marker), 'missing service worker marker: ' + marker);
});


test('behavior: old installed record without releaseVersion returns network js/04-app-main.js, not the stale cache copy', async () => {
  const harness = createServiceWorkerHarness({
    source: sw,
    installedRecord: { version: '1.4.14', files: { 'js/04-app-main.js': { sha256: 'old' } } }
  });
  await harness.seed('js/04-app-main.js', 'OLD CACHED COPY');
  const response = await harness.request('js/04-app-main.js', 'same-origin', 'script');
  assert.equal(await response.text(), 'NETWORK COPY');
  assert.equal(harness.fetchCalls.length, 1);
  assert.equal(harness.fetchCalls[0].cache, 'reload');
  assert.equal(await harness.cachedText('js/04-app-main.js'), 'NETWORK COPY');
});

test('behavior: matching installed and cached releaseVersion keeps the cached js/04-app-main.js copy', async () => {
  const harness = createServiceWorkerHarness({
    source: sw,
    installedRecord: { version: '1.4.15', releaseVersion: '1.4.15', files: {} }
  });
  await harness.seed('js/04-app-main.js', 'VERIFIED CACHED COPY');
  const response = await harness.request('js/04-app-main.js', 'same-origin', 'script');
  assert.equal(await response.text(), 'VERIFIED CACHED COPY');
  assert.equal(harness.fetchCalls.length, 0);
});

test('behavior: offline with a version mismatch falls back to the cached script instead of rejecting', async () => {
  const harness = createServiceWorkerHarness({
    source: sw,
    installedRecord: { version: '1.4.14', files: {} },
    offline: true
  });
  await harness.seed('js/04-app-main.js', 'OFFLINE CACHED COPY');
  const response = await harness.request('js/04-app-main.js', 'same-origin', 'script');
  assert.equal(await response.text(), 'OFFLINE CACHED COPY');
  assert.equal(harness.fetchCalls.length, 1);
  assert.equal(harness.fetchCalls[0].cache, 'reload');
});

test('behavior: mismatch applies network-first to every script, style and navigation request', async () => {
  const cases = [
    { path: 'js/04-app-main.js', mode: 'same-origin', destination: 'script' },
    { path: 'css/bundle-core.css', mode: 'same-origin', destination: 'style' },
    { path: 'index.html', mode: 'navigate', destination: 'document' }
  ];
  for (const item of cases) {
    const harness = createServiceWorkerHarness({
      source: sw,
      installedRecord: { version: '1.4.14' }
    });
    await harness.seed(item.path, 'OLD ' + item.destination.toUpperCase());
    const response = await harness.request(item.path, item.mode, item.destination);
    assert.equal(await response.text(), 'NETWORK COPY', item.path + ' must return network bytes');
    assert.equal(harness.fetchCalls.length, 1, item.path + ' must fetch network');
    assert.equal(harness.fetchCalls[0].cache, 'reload', item.path + ' must bypass stale HTTP cache');
  }
});

test('iOS copies the latest To Me drawer and settings while retaining the iOS manual update control', () => {
  assert.ok(!drawerOrder.includes("['Updates'"), 'the separate Updates section must be absent like To Me');
  assert.ok(drawerOrder.includes("['App & support',['Settings','Contact & Feedback','Changelog','About','Rate this app'].map(pick).filter(Boolean)]"),
    'App & support grouping must match To Me');
  assert.ok(drawerRuntime.includes('dr-top2') && drawerRuntime.includes('dr-body') && drawerRuntime.includes('dr-foot'),
    'the copied To Me side drawer must be present');
  assert.ok(!drawerRuntime.includes('dr-x dr2-x'), 'the copied To Me drawer must not add the retired close button');
  assert.ok(drawerMenuBase.includes("hdrTap('Notifications')") && drawerFeatures.includes('PAGES.notifs=notifsView'),
    'the notification header route must remain available');
  assert.ok(drawerFeatures.includes('id="shbAppUpdates"'), 'the iOS App updates settings card must remain visible');
  assert.ok(drawerFeatures.includes('onclick="shbaceSettingsCheckForUpdates(this)"'), 'manual update action must remain wired');
  assert.ok(drawerFeatures.includes('window.shbaceCheckForUpdate()'), 'manual update checker must remain connected');
});

test('manifest build embeds releaseVersion and protects the migration/cache invariants', () => {
  for (const marker of [
    'manifest.releaseVersion = pwaVersion.version',
    "MIGRATION_KEY='shbace_ios_migrated_1_4_14'",
    'shbace-medical-ios-shell-',
    'networkFirstOnPackageMismatch',
    'indexRuntimeRefPattern',
    'Unreferenced CSS/JS files in iOS runtime inventory',
    'Retired iOS runtime file must be deleted'
  ]) assert.ok(build.includes(marker), 'missing build guard: ' + marker);
});

test('retired iOS modules are absent and are not referenced by the live HTML', () => {
  for (const relative of ['js/32-ios-study-tools.js', 'js/33-ios-exam-planner.js']) {
    assert.equal(fs.existsSync(path.join(root, relative)), false, relative + ' must be deleted');
    assert.equal(html.includes(relative), false, relative + ' must not be loaded');
  }
});

test('release remains 1.4.15 and records the mixed-cache repair note', () => {
  assert.equal(pkg.version, '1.4.15');
  assert.equal(pwa.version, '1.4.15');
  assert.equal(pwa.displayVersion, '1.4.15');
  assert.ok(pwa.releaseNotes.includes('Fixes mixed old/new files after updating from 1.4.10; cleans old caches'));
  assert.equal(offlineManifest.releaseVersion, '1.4.15');
  assert.equal(offlineManifest.fileCount, 338);
  assert.equal(offlineManifest.files.length, offlineManifest.fileCount);
  assert.ok(!offlineManifest.files.some(file => ['css/core.css', 'css/late.css'].includes(file.path)),
    'unreferenced legacy CSS must not remain in the offline manifest');
});
