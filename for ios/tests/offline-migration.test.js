'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const root = path.resolve(__dirname, '..');
const read = relative => fs.readFileSync(path.join(root, relative), 'utf8');
const offline = read('js/29-offline-setup.js');
const voice = read('js/33-unified-voice.js');
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
function extractFunction(source, name) {
  const start = source.indexOf('function ' + name + '(');
  assert.ok(start >= 0, name + ' exists');
  const end = source.indexOf(String.fromCharCode(10) + '}', start);
  assert.ok(end > start, name + ' has a closing brace');
  return source.slice(start, end + 2);
}

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
    new Response(JSON.stringify({ version: '1.4.16' }), {
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

function runOfflineStartup(installedRecord, options = {}) {
  const calls = [], writes = [], screens = [], pending = [], repairs = [];
  const store = Object.create(null);
  const migrationKey = 'shbace_ios_migrated_1_4_14';
  if (options.migrated) store[migrationKey] = '1';
  const scope = 'https://ios.example.test/';
  const cached = new Set((options.cachedPaths || Object.keys(installedRecord && installedRecord.files || {}))
    .map(relative => new URL(relative, scope).href));
  const cache = { async keys() { return [...cached].map(url => ({ url })); } };
  const localCaches = { async open(name) { calls.push('cache-open:' + name); return cache; } };
  const localStorage = {
    getItem(key) { return Object.prototype.hasOwnProperty.call(store, key) ? store[key] : null; },
    setItem(key, value) { store[key] = String(value); writes.push([key, String(value)]); },
    removeItem(key) { delete store[key]; writes.push([key, null]); }
  };
  const sandbox = {
    standalone: () => true,
    document: { body: {}, readyState: 'complete' },
    window: { caches: localCaches, crypto: { subtle: {} }, indexedDB: {} },
    caches: localCaches,
    crypto: { subtle: {} },
    localStorage,
    navigator: {},
    waitForSplash() { screens.push('wait-for-splash'); return Promise.resolve(); },
    showInstallHint() { screens.push('install-hint'); },
    showSetupUnavailable() { screens.push('setup-unavailable'); },
    dbGet: () => Promise.resolve(installedRecord),
    urlFor: relative => new URL(relative.split('/').map(encodeURIComponent).join('/'), scope).href,
    CACHE_NAME: 'shbace-medical-offline-v2',
    INSTALLED_KEY: 'installed',
    MIGRATION_KEY: migrationKey,
    PENDING_KEY: 'shbace_pkg_update_pending_v1',
    REPAIR_PENDING_KEY: 'shbace_pkg_repair_pending_v1',
    setPending(value) { pending.push(value); store['shbace_pkg_update_pending_v1'] = String(value); },
    setRepairPending(value) {
      repairs.push(value);
      if (value > 0) { store['shbace_pkg_repair_pending_v1'] = String(value); pending.push(value); }
      else delete store['shbace_pkg_repair_pending_v1'];
    },
    runFullCheck() { calls.push('first-install-check'); return Promise.resolve(); },
    Promise, Object, Number
  };
  const code = extractFunction(offline, 'localRepairNeeded') + String.fromCharCode(10) +
    extractFunction(offline, 'start') + String.fromCharCode(10) + 'start();';
  vm.runInNewContext(code, sandbox);
  return new Promise(resolve => setImmediate(() => resolve({
    calls, writes, screens, pending, repairs, store, localStorage
  })));
}

function runVerifiedPlanHarness(options = {}) {
  const store = Object.create(null), writes = [], events = [];
  const localStorage = {
    getItem(key) { return Object.prototype.hasOwnProperty.call(store, key) ? store[key] : null; },
    setItem(key, value) { store[key] = String(value); writes.push([key, String(value)]); },
    removeItem(key) { delete store[key]; }
  };
  const scope = 'https://ios.example.test/';
  const cache = {
    async put(url, response) { events.push('cache.put:' + url); return true; },
    async delete(url) { events.push('cache.delete:' + url); return true; }
  };
  const target = {
    async match(url) {
      events.push('staging.match:' + url);
      if (options.failCommit) throw new Error('staged commit failed');
      return { ok: true };
    }
  };
  const caches = {
    async open(name) { events.push('caches.open:' + name); return name === 'shbace-medical-offline-v2' ? cache : target; },
    async delete(name) { events.push('caches.delete:' + name); return true; }
  };
  const stageVerify = {
    querySelector() { return { textContent: '', }; },
    classList: { add() {}, remove() {} }
  };
  const ui = {
    button: { dataset: {}, disabled: false, textContent: '' },
    stage: { textContent: '' }, percent: { textContent: '' }, count: { textContent: '' },
    track: { setAttribute() {} }, bar: { style: {} }, bytes: { textContent: '' },
    stages: { querySelector() { return stageVerify; } }, foot: { textContent: '' },
    warning: { textContent: '' }, status: { textContent: '' },
    errors: { hidden: true, textContent: '' }
  };
  const sandbox = {
    started: false, migrationInProgress: true, migrationPendingAtLaunch: true,
    manifest: { version: 'v1', totalBytes: 10, files: [{ path: 'index.html', bytes: 10, sha256: 'hash', group: 'app' }] },
    plan: { mode: 'update', files: [{ path: 'index.html', bytes: 10, sha256: 'hash', group: 'app' }], removed: [], bytes: 10 },
    ui, window: { shbaceRequestAppReload() { events.push('reload-requested'); return true; } },
    localStorage, caches, navigator: { storage: null }, URL, Promise, Date, Object, Number, Math, Error,
    CACHE_NAME: 'shbace-medical-offline-v2', STAGING_NAME: 'shbace-staging-offline',
    MIGRATION_KEY: 'shbace_ios_migrated_1_4_14', CHECK_OK_KEY: 'shbace_pkg_check_ok_v1',
    REPAIR_PENDING_KEY: 'shbace_pkg_repair_pending_v1', PENDING_KEY: 'shbace_pkg_update_pending_v1',
    READY_URL: new URL('./__shbace_offline_ready__', scope).href,
    urlFor(path) { return new URL(path, scope).href; },
    ensureServiceWorker: () => Promise.resolve(),
    dbPut: () => Promise.resolve(true),
    fileValid: () => Promise.resolve(true),
    verifyAll: () => Promise.resolve(),
    cleanupPreviousCaches: () => {
      events.push('cleanupPreviousCaches');
      return options.failCleanup ? Promise.reject(new Error('cleanup failed')) : Promise.resolve();
    },
    saveInstalled: () => { events.push('saveInstalled'); return Promise.resolve(true); },
    setStatus(message) { ui.status.textContent = message; },
    setWarning(message) { ui.warning.textContent = message; },
    setErrorList(items) { ui.errors.hidden = !items.length; },
    resetCounters() {}, stageMarkup() { return {}; }, paintProgress() {}, addDone() {},
    fmtBytes(value) { return String(value) + ' B'; },
    lsSet(key, value) { localStorage.setItem(key, value); },
    lsNum(key) { return Number(localStorage.getItem(key)) || 0; },
    setPending(value) { events.push('pending:' + value); },
    setRepairPending() { events.push('repair-pending-cleared'); },
    markInstalledNow() { events.push('markInstalledNow'); },
    console
  };
  const code = extractFunction(offline, 'commitPlan') + '\n' +
    extractFunction(offline, 'finalizeVerifiedPlanCommit') + '\n' +
    extractFunction(offline, 'runPlan') + '\n' +
    '({runPlan, state:()=>({migrationInProgress,started,flag:localStorage.getItem(MIGRATION_KEY)}), events, store})';
  const api = vm.runInNewContext(code, sandbox);
  return { api, writes, events, store };
}

function manualMigrationHarness(options = {}) {
  const store = Object.create(null), writes = [], events = [];
  const localStorage = {
    getItem(key) { return Object.prototype.hasOwnProperty.call(store, key) ? store[key] : null; },
    setItem(key, value) { store[key] = String(value); writes.push([key, String(value)]); },
    removeItem(key) { delete store[key]; }
  };
  const sandbox = {
    migrationPendingAtLaunch: true,
    migrationInProgress: false,
    standalone: () => true,
    window: { caches: {}, crypto: { subtle: {} }, indexedDB: {} },
    crypto: { subtle: {} },
    navigator: { onLine: options.online !== false },
    localStorage,
    started: false,
    manifestFromNetwork: options.online !== false,
    dbGet: () => Promise.resolve({ files: { 'index.html': {} }, version: '1.4.13' }),
    decide: () => options.failCheck ? Promise.reject(new Error('network failure')) :
      Promise.resolve({ kind: 'prompt', plan: { mode: 'update', files: [{ path: 'index.html' }], bytes: 10 } }),
    fetchVersionInfo: () => Promise.resolve({ displayVersion: '1.4.20', releaseDate: '2026-11-17', notes: [] }),
    showUpdateSheet(plan) { events.push(['update-sheet', plan.mode]); },
    showPlanNeeded(plan) { events.push(['setup', plan.mode]); },
    lsSet(key, value) { localStorage.setItem(key, value); },
    lsSetJson(key, value) { localStorage.setItem(key, JSON.stringify(value)); },
    lsDel(key) { localStorage.removeItem(key); },
    lsNum(key) { return Number(localStorage.getItem(key)) || 0; },
    setPending(value) { events.push(['pending', value]); },
    rememberInstalled(info) { events.push(['installed', info && info.displayVersion]); },
    CHECK_OK_KEY: 'shbace_pkg_check_ok_v1',
    PENDING_KEY: 'shbace_pkg_update_pending_v1',
    VER_AVAIL_KEY: 'shbace_pkg_version_available_v1',
    MIGRATION_KEY: 'shbace_ios_migrated_1_4_14',
    INSTALLED_KEY: 'installed',
    REPAIR_PENDING_KEY: 'shbace_pkg_repair_pending_v1',
    Promise, Date, Number, Object
  };
  const code = 'var migrationInProgress=false;' +
    extractFunction(offline, 'manualCheck') + String.fromCharCode(10) +
    extractFunction(offline, 'finalizeVerifiedPlanCommit') + String.fromCharCode(10) +
    '({manualCheck,finalizeVerifiedPlanCommit,isMigrationInProgress:()=>migrationInProgress})';
  const api = vm.runInNewContext(code, sandbox);
  return { api, store, writes, events };
}

test('existing install with an unset migration flag stays silent and marks an update pending', async () => {
  const record = { version: '1.4.13', files: { 'index.html': {}, 'js/04-app-main.js': {} } };
  const result = await runOfflineStartup(record, { cachedPaths: ['index.html', 'js/04-app-main.js'] });
  assert.deepEqual(result.calls, ['cache-open:shbace-medical-offline-v2'],
    'only the local CacheStorage inspection may run');
  assert.deepEqual(result.screens, [], 'no startup modal, splash wait, or update screen is opened');
  assert.deepEqual(result.pending, [1], 'the legacy migration is represented as a persistent pending update');
  assert.equal(result.localStorage.getItem('shbace_ios_migrated_1_4_14'), null,
    'launch must not mark an install as migrated');
  assert.equal(result.store.shbace_pkg_update_pending_v1, '1');
});

test('existing install with missing cached files is detected locally and marked repair-pending', async () => {
  const record = { version: '1.4.20', files: { 'index.html': {}, 'js/04-app-main.js': {}, 'js/33-unified-voice.js': {} } };
  const result = await runOfflineStartup(record, {
    migrated: true,
    cachedPaths: ['index.html', 'js/04-app-main.js']
  });
  assert.deepEqual(result.calls, ['cache-open:shbace-medical-offline-v2']);
  assert.deepEqual(result.screens, []);
  assert.deepEqual(result.repairs, [1]);
  assert.equal(result.store.shbace_pkg_repair_pending_v1, '1');
  assert.equal(result.pending.at(-1), 1);
});

test('existing install with all expected cached files and migration complete does nothing', async () => {
  const record = { version: '1.4.20', files: { 'index.html': {}, 'js/04-app-main.js': {} } };
  const result = await runOfflineStartup(record, { migrated: true });
  assert.deepEqual(result.calls, ['cache-open:shbace-medical-offline-v2']);
  assert.deepEqual(result.writes, []);
  assert.deepEqual(result.pending, []);
  assert.deepEqual(result.repairs, []);
  assert.deepEqual(result.screens, []);
});

test('manual update sets migration flag only after the real verified runPlan commit and cleanup succeed', async () => {
  const result = runVerifiedPlanHarness();
  result.api.runPlan();
  await new Promise(resolve => setImmediate(resolve));
  const state = result.api.state();
  assert.equal(state.flag, '1');
  assert.equal(state.migrationInProgress, false);
  assert.ok(result.events.indexOf('saveInstalled') >= 0);
  assert.ok(result.events.indexOf('cleanupPreviousCaches') > result.events.indexOf('saveInstalled'),
    'cleanup is awaited after the installed-record commit');
  assert.ok(result.events.indexOf('reload-requested') > result.events.indexOf('cleanupPreviousCaches'),
    'safe reload is requested only after verified commit and cleanup');
});

test('failed commit or cache cleanup never sets the migration flag', async () => {
  for (const failure of [{ failCommit: true }, { failCleanup: true }]) {
    const result = runVerifiedPlanHarness(failure);
    result.api.runPlan();
    await new Promise(resolve => setImmediate(resolve));
    assert.equal(result.api.state().flag, null);
    assert.equal(result.api.state().migrationInProgress, false);
  }
});

test('offline manual update attempt leaves migration flag unset', async () => {
  const result = manualMigrationHarness({ online: false });
  assert.deepEqual(await result.api.manualCheck(), { state: 'offline' });
  assert.equal(result.store.shbace_ios_migrated_1_4_14, undefined);
  assert.equal(result.api.isMigrationInProgress(), false);
});

test('first install still performs automatic package discovery', async () => {
  const result = await runOfflineStartup(null);
  assert.ok(result.calls.includes('first-install-check'));
  assert.ok(result.screens.includes('wait-for-splash'));
  assert.equal(result.localStorage.getItem('shbace_ios_migrated_1_4_14'), null);
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
    installedRecord: { version: '1.4.16', releaseVersion: '1.4.16', files: {} }
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
  assert.ok(drawerOrder.includes("['APP & SUPPORT',['Settings','Contact & Feedback','Changelog','About','Rate this app'].map(pick).filter(Boolean)]"),
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

test('release is 1.4.20 and records the corrective startup, repair, observer and Settings parity fixes', () => {
  assert.equal(pkg.version, '1.4.20');
  assert.equal(pwa.version, '1.4.20');
  assert.equal(pwa.displayVersion, '1.4.20');
  for (const note of [
    'Prevents existing installs from opening startup update UI or making network requests; migration completes only after a manually initiated verified commit.',
    'Detects missing offline files locally and offers user-initiated Repair from Settings, with a dismissible Home fallback notice.',
    'Scopes question and Settings observers to the app viewport, coalesces callbacks and drains self-generated mutations to prevent DOM mutation loops.',
    'Aligns shared iOS Study experience controls, labels, helper text and defaults with To Me while retaining iOS-only settings.'
  ]) assert.ok(pwa.releaseNotes.includes(note), 'release notes include: ' + note);
  assert.equal(offlineManifest.fileCount, 338);
  assert.equal(offlineManifest.files.length, offlineManifest.fileCount);
  assert.ok(!offlineManifest.files.some(file => ['css/core.css', 'css/late.css'].includes(file.path)),
    'unreferenced legacy CSS must not remain in the offline manifest');
});


function serviceWorkerBootstrapFunctions(source, serviceWorker) {
  const start = source.indexOf('function waitForWorkerActivation(');
  const end = source.indexOf('function fetchAndStore(file,target)', start);
  assert.ok(start >= 0 && end > start, 'service-worker bootstrap functions are present');
  return vm.runInNewContext(
    source.slice(start, end) + '\n;({waitForWorkerActivation,ensureServiceWorker})',
    { navigator: { serviceWorker }, Promise, Error }
  );
}

test('iOS service-worker bootstrap follows To Me and removes the extra 20-second readiness race', () => {
  assert.ok(!offline.includes('WORKER_READY_TIMEOUT'));
  assert.ok(!offline.includes('waitForServiceWorkerReady'));
  assert.ok(offline.includes("return reg.update().then(function(){"));
  assert.ok(offline.includes('var candidate=reg.installing||reg.waiting'));
  assert.ok(offline.includes('return candidate?waitForWorkerActivation(candidate)'));
  assert.ok(offline.includes('return navigator.serviceWorker.ready'));
  assert.ok(sw.includes("url.searchParams.has('__shbace_integrity')"),
    'the iOS worker must let SHA-256 integrity downloads reach the network');
});

test('service-worker bootstrap reuses an active registration after the update check', async () => {
  const calls = [];
  const registration = {
    active: { state: 'activated' },
    installing: null,
    waiting: null,
    async update() { calls.push('update'); }
  };
  const serviceWorker = {
    async getRegistration(scope) { calls.push('getRegistration:' + scope); return registration; },
    async register() { calls.push('register'); throw new Error('must not register twice'); },
    get ready() { calls.push('ready'); return Promise.resolve(registration); }
  };
  const api = serviceWorkerBootstrapFunctions(offline, serviceWorker);
  const result = await api.ensureServiceWorker();
  assert.equal(result, registration);
  assert.deepEqual(calls, ['getRegistration:./', 'update', 'ready']);
});

test('service-worker bootstrap waits for an installing worker only until activation', async () => {
  let stateChange = null;
  const calls = [];
  const installing = {
    state: 'installing',
    addEventListener(type, listener) { assert.equal(type, 'statechange'); stateChange = listener; },
    removeEventListener(type, listener) { if (stateChange === listener) stateChange = null; }
  };
  const registration = {
    active: { state: 'activated' },
    installing,
    waiting: null,
    async update() { calls.push('update'); }
  };
  const serviceWorker = {
    async getRegistration() { return registration; },
    async register() { throw new Error('existing registration should be reused'); },
    get ready() { calls.push('ready'); return Promise.resolve(registration); }
  };
  const api = serviceWorkerBootstrapFunctions(offline, serviceWorker);
  const pending = api.ensureServiceWorker();
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(typeof stateChange, 'function', 'installer must be observed before readiness resolves');
  installing.state = 'activated';
  stateChange();
  assert.equal(await pending, registration);
  assert.deepEqual(calls, ['update', 'ready']);
  assert.equal(stateChange, null, 'state-change listener is removed after activation');
});

test('first install registers the worker and then waits for browser readiness', async () => {
  const calls = [];
  const registration = { active: { state: 'activated' }, installing: null, waiting: null };
  const serviceWorker = {
    async getRegistration(scope) { calls.push('getRegistration:' + scope); return null; },
    async register(path, options) {
      calls.push('register:' + path + ':' + options.scope);
      return registration;
    },
    get ready() { calls.push('ready'); return Promise.resolve(registration); }
  };
  const api = serviceWorkerBootstrapFunctions(offline, serviceWorker);
  assert.equal(await api.ensureServiceWorker(), registration);
  assert.deepEqual(calls, ['getRegistration:./', 'register:./sw.js:./', 'ready']);
});
