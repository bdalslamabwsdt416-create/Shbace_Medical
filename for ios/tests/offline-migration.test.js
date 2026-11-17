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
  const calls = [], writes = [], screens = [], notifications = [], networkCalls = [], pending = [], repairs = [];
  const store = Object.create(null);
  const migrationKey = 'shbace_ios_migrated_1_4_14';
  const pendingKey = 'shbace_pkg_update_pending_v1';
  const repairKey = 'shbace_pkg_repair_pending_v1';
  if (options.migrated) store[migrationKey] = '1';
  if (options.pending) store[pendingKey] = String(options.pending);
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
    window: {
      caches: localCaches, crypto: { subtle: {} }, indexedDB: {},
      shbAddNotif(id, title, body, target) { notifications.push({ id, title, body, target }); },
      shbRemoveNotif(id) { notifications.push({ id, removed: true }); }
    },
    caches: localCaches,
    crypto: { subtle: {} },
    navigator: {},
    localStorage,
    fetch(url) { networkCalls.push(String(url)); return Promise.reject(new Error('Unexpected startup network request')); },
    waitForSplash() { screens.push('wait-for-splash'); return Promise.resolve(); },
    showInstallHint() { screens.push('install-hint'); },
    showSetupUnavailable() { screens.push('setup-unavailable'); },
    dbGet: () => Promise.resolve(installedRecord),
    urlFor: relative => new URL(relative.split('/').map(encodeURIComponent).join('/'), scope).href,
    CACHE_NAME: 'shbace-medical-offline-v2',
    INSTALLED_KEY: 'installed',
    MIGRATION_KEY: migrationKey,
    PENDING_KEY: pendingKey,
    REPAIR_PENDING_KEY: repairKey,
    NOTIF_ID: 'update-available',
    lsNum(key) { return Number(localStorage.getItem(key)) || 0; },
    setPending(value) {
      pending.push(value);
      if(value>0)store[pendingKey]=String(value);else delete store[pendingKey];
      notifications.push(value>0?{id:'update-available',title:'A new update is available'}:{id:'update-available',removed:true});
    },
    setRepairPending(value) {
      repairs.push(value);
      if(value>0)store[repairKey]=String(value);else delete store[repairKey];
      notifications.push(value>0?{id:'update-available',title:'Some offline files are missing'}:{id:'update-available',removed:true});
    },
    migrationPendingAtLaunch: false,
    cache: null,
    runFullCheck() { calls.push('first-install-check'); networkCalls.push('first-install-check'); return Promise.resolve(); },
    scheduleCheckDue() {},
    Promise, Object, Number, Math
  };
  const code = [
    extractFunction(offline, 'localRepairNeeded'),
    extractFunction(offline, 'start'),
    'start();'
  ].join(String.fromCharCode(10));
  vm.runInNewContext(code, sandbox);
  return new Promise(resolve => setImmediate(() => resolve({
    calls, writes, screens, notifications, networkCalls, pending, repairs, store, localStorage
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

function manualRepairHarness(options = {}) {
  const events = [];
  const sandbox = {
    standalone: () => true,
    window: { caches: {}, crypto: { subtle: {} }, indexedDB: {} },
    navigator: { onLine: options.online !== false },
    started: false,
    migrationInProgress: false,
    manifestFromNetwork: options.online !== false,
    decide: () => { events.push('decide'); return Promise.resolve(options.result || { kind: 'setup', plan: { mode: 'restore' } }); },
    showPlanNeeded(plan) { events.push('showPlanNeeded:' + plan.mode); },
    runPlan() { events.push('runPlan'); },
    showUpdateSheet(plan) { events.push('showUpdateSheet:' + plan.mode); },
    setRepairPending(value) { events.push('setRepairPending:' + value); },
    Promise
  };
  const code = 'var migrationInProgress=false;' + String.fromCharCode(10) +
    extractFunction(offline, 'manualRepair') + String.fromCharCode(10) +
    '({manualRepair,isMigrationInProgress:()=>migrationInProgress})';
  return { api: vm.runInNewContext(code, sandbox), events };
}


test('Settings exposes a non-modal Repair notice only while repair is pending', () => {
  const source = drawerFeatures;
  const fn = extractFunction(source, 'shbaceSettingsRepairMarkup');
  const markup = vm.runInNewContext(fn + String.fromCharCode(10) + 'shbaceSettingsRepairMarkup()', {
    window: {
      shbaceRepairPending: () => 2,
      shbaceUpdatePending: () => 1
    }
  });
  assert.match(markup, /Some offline files are missing - Repair/);
  assert.match(markup, /id="shbaceSettingsRepairButton"/);
  assert.match(markup, /onclick="shbaceSettingsRepairOffline\(this\)"/);
  assert.match(markup, /UPDATE PENDING/);
  assert.doesNotMatch(markup, /role="dialog"|aria-modal/);
});

test('Home fallback is dismissible inline and offers explicit Repair without a modal', () => {
  const marker = 'window.shbaceOfflineRepairHomeNotice=function(){';
  const start = offline.indexOf(marker);
  const end = offline.indexOf('window.shbaceDismissRepairNotice=function', start);
  assert.ok(start >= 0 && end > start, 'the Home fallback export exists');
  const declaration = offline.slice(start, end).replace(/;\s*$/, '');
  const markup = vm.runInNewContext(declaration + String.fromCharCode(10) + 'window.shbaceOfflineRepairHomeNotice()', {
    window: {},
    lsNum: key => key === 'shbace_pkg_repair_pending_v1' ? 2 : 0,
    sessionStorage: { getItem: () => null }
  });
  assert.match(markup, /Some offline files are missing\./);
  assert.match(markup, /onclick="shbaceRepairOffline\(\)"/);
  assert.match(markup, /shbaceDismissRepairNotice/);
  assert.match(markup, /role="status"/);
  assert.doesNotMatch(markup, /role="dialog"|aria-modal/);
});

function runScheduledCheckHarness(options = {}) {
  const store = Object.create(null), writes = [], networkCalls = [], pending = [], uiCalls = [];
  const now = Date.now();
  const last = options.recent ? now - (7 * 24 * 60 * 60 * 1000) + 1000 :
    (options.lastCheck === undefined ? now - (7 * 24 * 60 * 60 * 1000) - 1000 : options.lastCheck);
  if (last !== null) store.shbace_pkg_check_ok_v1 = String(last);
  const localStorage = {
    getItem(key) { return Object.prototype.hasOwnProperty.call(store, key) ? store[key] : null; },
    setItem(key, value) { store[key] = String(value); writes.push([key, String(value)]); },
    removeItem(key) { delete store[key]; }
  };
  const cache = {};
  const sandbox = {
    CHECK_OK_KEY: 'shbace_pkg_check_ok_v1',
    CHECK_EVERY: 7 * 24 * 60 * 60 * 1000,
    CACHE_NAME: 'shbace-medical-offline-v2',
    MIGRATION_KEY: 'shbace_ios_migrated_1_4_14',
    migrationInProgress: false,
    scheduledCheckInProgress: false,
    manifestFromNetwork: options.network !== false,
    navigator: { onLine: options.online !== false },
    localStorage, Date, Promise, Number, Math, Object, Array,
    lsNum(key) { return Number(localStorage.getItem(key)) || 0; },
    lsSet(key, value) { localStorage.setItem(key, value); },
    loadManifest() {
      networkCalls.push('manifest');
      return options.fail ? Promise.reject(new Error('network failed')) :
        Promise.resolve({ version: '1.4.20', files: [{ path: 'index.html' }] });
    },
    caches: { open(name) { networkCalls.push('cache-open:' + name); return Promise.resolve(cache); } },
    dbGet() { return Promise.resolve({ files: { 'index.html': { sha256: 'old' } } }); },
    computePlan() {
      return Promise.resolve(options.update
        ? { files: [{ path: 'index.html' }], changed: 1, removed: [] }
        : { files: [], changed: 0, removed: [] });
    },
    setPending(value) { pending.push(value); },
    mount() { uiCalls.push('mount'); },
    showUpdateSheet() { uiCalls.push('update-sheet'); },
    showPlanNeeded() { uiCalls.push('plan-needed'); },
    runPlan() { uiCalls.push('run-plan'); },
    fetchAndStore() { uiCalls.push('download'); }
  };
  const promise = vm.runInNewContext(extractFunction(offline, 'checkDue') + '\ncheckDue();', sandbox);
  return promise.then(state => ({
    state, store, writes, networkCalls, pending, uiCalls,
    migrationInProgress: sandbox.migrationInProgress,
    scheduledCheckInProgress: sandbox.scheduledCheckInProgress,
    migrationFlag: store.shbace_ios_migrated_1_4_14 || null,
    initialTimestamp: last
  }));
}

test('silent seven-day check runs when the last successful check is older than seven days', async () => {
  const result = await runScheduledCheckHarness();
  assert.deepEqual(result.state, { state: 'current' });
  assert.ok(result.networkCalls.includes('manifest'));
  assert.ok(Number(result.store.shbace_pkg_check_ok_v1) > result.initialTimestamp);
  assert.deepEqual(result.uiCalls, []);
  assert.equal(result.migrationFlag, null);
  assert.equal(result.migrationInProgress, false);
  assert.equal(result.scheduledCheckInProgress, false);
});

test('silent seven-day check is skipped when the last successful check is less than seven days old', async () => {
  const result = await runScheduledCheckHarness({ recent: true });
  assert.deepEqual(result.state, { state: 'not-due' });
  assert.deepEqual(result.networkCalls, []);
  assert.equal(result.store.shbace_pkg_check_ok_v1, String(result.initialTimestamp));
  assert.deepEqual(result.uiCalls, []);
});

test('silent scheduled check stays silent and does not advance its timestamp offline or after failure', async () => {
  for (const options of [{ online: false }, { fail: true }, { network: false }]) {
    const result = await runScheduledCheckHarness(options);
    assert.deepEqual(result.state, { state: 'offline' });
    assert.equal(result.store.shbace_pkg_check_ok_v1, String(result.initialTimestamp));
    assert.deepEqual(result.uiCalls, []);
    assert.deepEqual(result.pending, []);
    assert.equal(result.migrationFlag, null);
    assert.equal(result.migrationInProgress, false);
    assert.equal(result.scheduledCheckInProgress, false);
  }
});

test('silent scheduled update only marks pending and never opens UI, downloads or arms migration', async () => {
  const result = await runScheduledCheckHarness({ update: true });
  assert.deepEqual(result.state, { state: 'update-pending' });
  assert.deepEqual(result.pending, [1]);
  assert.deepEqual(result.uiCalls, []);
  assert.equal(result.migrationFlag, null);
  assert.equal(result.migrationInProgress, false);
  assert.equal(result.scheduledCheckInProgress, false);
  assert.ok(Number(result.store.shbace_pkg_check_ok_v1) > result.initialTimestamp);
});

test('silent scheduled update reaches the real bell notification and Settings App updates badge', () => {
  const store = Object.create(null);
  const notifications = [];
  const localStorage = {
    getItem(key) { return Object.prototype.hasOwnProperty.call(store, key) ? store[key] : null; },
    setItem(key, value) { store[key] = String(value); },
    removeItem(key) { delete store[key]; }
  };
  const sandbox = {
    PENDING_KEY: 'shbace_pkg_update_pending_v1',
    REPAIR_PENDING_KEY: 'shbace_pkg_repair_pending_v1',
    NOTIF_ID: 'update-available',
    localStorage,
    lsNum(key) { return Number(localStorage.getItem(key)) || 0; },
    lsSet(key, value) { localStorage.setItem(key, value); },
    lsDel(key) { localStorage.removeItem(key); },
    window: {
      shbAddNotif(id, title, body, target) { notifications.push({ id, title, body, target }); },
      shbRemoveNotif(id) { notifications.push({ id, removed: true }); }
    }
  };
  const code = [
    extractFunction(offline, 'syncPendingNotice'),
    extractFunction(offline, 'setPending'),
    extractFunction(drawerFeatures, 'shbaceSettingsRepairMarkup'),
    'setPending(1);',
    '({ markup: shbaceSettingsRepairMarkup(), pending: lsNum(PENDING_KEY) })'
  ].join(String.fromCharCode(10));
  const result = vm.runInNewContext(code, sandbox);
  assert.equal(result.pending, 1, 'the real pending store is updated');
  assert.equal(notifications.length, 1, 'the real pending sync creates one notification');
  assert.equal(notifications[0].id, 'update-available');
  assert.equal(notifications[0].title, 'A new update is available');
  assert.equal(notifications[0].target, 'settings', 'the bell notification routes to Settings');
  assert.match(result.markup, /UPDATE PENDING/, 'Settings -> App updates renders its pending badge');
  assert.doesNotMatch(result.markup, /role="dialog"|aria-modal/, 'the pending state does not open a modal');
});

test('existing install with an unset migration flag stays silent and marks an update pending', async () => {
  const record = { version: '1.4.13', files: { 'index.html': {}, 'js/04-app-main.js': {} } };
  const result = await runOfflineStartup(record, { cachedPaths: ['index.html', 'js/04-app-main.js'] });
  assert.deepEqual(result.calls, ['cache-open:shbace-medical-offline-v2'],
    'only the local CacheStorage inspection may run');
  assert.deepEqual(result.networkCalls, [], 'launch must not make a network request for an existing install');
  assert.deepEqual(result.screens, [], 'no startup modal, splash wait, or update screen is opened');
  assert.equal(result.networkCalls.length, 0);
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
  assert.deepEqual(result.networkCalls, [], 'cache repair detection is local-only');
  assert.deepEqual(result.screens, []);
  assert.deepEqual(result.repairs, [1]);
  assert.equal(result.store.shbace_pkg_repair_pending_v1, '1');
  assert.deepEqual(result.pending, [], 'repair-only state does not masquerade as an update pending badge');
});

test('migration-pending and repair-pending states coexist independently on an older install', async () => {
  const record = { version: '1.4.13', files: { 'index.html': {}, 'js/04-app-main.js': {}, 'js/33-unified-voice.js': {} } };
  const result = await runOfflineStartup(record, { cachedPaths: ['index.html'] });
  assert.deepEqual(result.pending, [1], 'legacy migration remains pending');
  assert.deepEqual(result.repairs, [2], 'two evicted files are tracked independently');
  assert.equal(result.store.shbace_pkg_update_pending_v1, '1');
  assert.equal(result.store.shbace_pkg_repair_pending_v1, '2');
  assert.equal(result.localStorage.getItem('shbace_ios_migrated_1_4_14'), null);
});

test('existing install with all expected cached files and migration complete does nothing', async () => {
  const record = { version: '1.4.20', files: { 'index.html': {}, 'js/04-app-main.js': {} } };
  const result = await runOfflineStartup(record, { migrated: true });
  assert.deepEqual(result.calls, ['cache-open:shbace-medical-offline-v2']);
  assert.deepEqual(result.writes, []);
  assert.deepEqual(result.pending, []);
  assert.deepEqual(result.repairs, []);
  assert.deepEqual(result.screens, []);
  assert.deepEqual(result.networkCalls, [], 'a healthy existing install makes no startup request');
});

test('a manual Settings check arms migration only in memory before an update is committed', async () => {
  const result = manualMigrationHarness({ online: true });
  assert.deepEqual(await result.api.manualCheck(), { state: 'update' });
  assert.equal(result.api.isMigrationInProgress(), true,
    'the user-initiated Settings check arms the migration transaction');
  assert.equal(result.store.shbace_ios_migrated_1_4_14, undefined,
    'the persistent migration flag is not written by the check or prompt');
});

test('Repair is user-initiated and refuses to run while offline', async () => {
  const offlineRepair = manualRepairHarness({ online: false });
  assert.deepEqual(await offlineRepair.api.manualRepair(), { state: 'offline' });
  assert.deepEqual(offlineRepair.events, [], 'an offline tap does not start the repair plan');

  const onlineRepair = manualRepairHarness({ online: true });
  assert.deepEqual(await onlineRepair.api.manualRepair(), { state: 'repair' });
  assert.deepEqual(onlineRepair.events, ['decide', 'showPlanNeeded:restore', 'runPlan']);
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
    assert.equal(result.api.state().migrationInProgress, true,
      'the explicit manual retry remains armed in memory, but the persistent flag stays unset');
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

test('build guards the migration commit, local-only launch detector and manual repair entry point', () => {
  assert.ok(build.includes('function finalizeVerifiedPlanCommit()'));
  assert.ok(build.includes("if(migrationInProgress){lsSet(MIGRATION_KEY,'1')"));
  assert.ok(build.includes('function localRepairNeeded(installed)'));
  assert.ok(build.includes('function manualRepair()'));
  assert.ok(build.includes('window.shbaceRepairOffline=manualRepair'));
  assert.ok(build.includes('function syncPendingNotice()'));
  assert.ok(build.includes('Some offline files are missing - Repair'));
  assert.ok(build.includes('shbaceSettingsRepairOffline'));
  assert.ok(!offline.includes('CHECK_TRY_KEY'));
  assert.ok(!offline.includes('CHECK_RETRY'));
  assert.ok(offline.includes('function checkDue()'));
  assert.ok(offline.includes('function scheduleCheckDue()'));
  const scheduled = offline.slice(offline.indexOf('function checkDue()'), offline.indexOf('function scheduleCheckDue()'));
  const scheduledTimer = offline.slice(offline.indexOf('function scheduleCheckDue()'), offline.indexOf('function manualCheck()'));
  assert.ok(!scheduled.includes('MIGRATION_KEY'));
  assert.ok(!scheduled.includes('migrationInProgress'));
  assert.ok(!scheduled.includes('mount(') && !scheduled.includes('showUpdateSheet(') && !scheduled.includes('showPlanNeeded('));
  assert.ok(!scheduled.includes('runPlan(') && !scheduled.includes('fetchAndStore('));
  assert.ok(scheduled.includes('setPending('));
  assert.ok(scheduled.includes('CHECK_OK_KEY') && scheduled.includes('CHECK_EVERY') && scheduled.includes('Date.now()'));
  assert.ok(!scheduled.includes('document.') && !scheduled.includes('ui.'));
  assert.ok(scheduledTimer.includes('setTimeout(') && scheduledTimer.includes('1200') && scheduledTimer.includes('requestIdleCallback'));
  assert.ok(offline.includes('function localRepairNeeded(installed)'));
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

test('release remains 1.4.20 and records the safe startup migration and local repair fixes', () => {
  assert.equal(pkg.version, '1.4.20');
  assert.equal(pwa.version, '1.4.20');
  assert.equal(pwa.displayVersion, '1.4.20');
  for (const note of [
    'Keeps existing iOS installs silent at launch; a legacy migration remains pending until a user-started update is verified, committed and cleaned up.',
    'Checks the installed offline file inventory locally at launch and offers an explicit online-only Repair action in Settings, with a dismissible Home fallback.',
    'Removes the unused startup retry marker while preserving automatic package discovery for first installs and the manual Settings update action.'
  ]) assert.ok(pwa.releaseNotes.includes(note), 'release notes include: ' + note);
  assert.equal(offlineManifest.fileCount, 338,
    'Step 3 modifies existing runtime assets only; the package inventory remains 338 files');
  assert.equal(offlineManifest.files.length, offlineManifest.fileCount);
  assert.ok(!offlineManifest.files.some(file => ['css/core.css', 'css/late.css'].includes(file.path)),
    'unreferenced legacy CSS must not remain in the offline manifest');
  assert.ok(build.includes('manifest.fileCount = manifest.files.length'),
    'the normal PWA build computes fileCount from the generated runtime inventory');
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
