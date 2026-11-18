import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";

const read = (path) => readFileSync(new URL(path, import.meta.url), "utf8");
const sw = read("../sw.js");
const updater = read("../js/29-offline-setup.js");
const chromeBridge = read("../js/32-chrome-android.js");
const portal = read("../js/25-shb-portal-js.js");
const app = read("../js/04-app-main.js");
const index = read("../index.html");
const lateCss = read("../css/bundle-late.css");
const build = read("../scripts/build-pwa.mjs");
const pkg = JSON.parse(read("../package.json"));
const pwa = JSON.parse(read("../pwa-version.json"));

function block(source, start, end) {
  const from = source.indexOf(start);
  assert.notEqual(from, -1, "expected source block: " + start);
  const to = source.indexOf(end, from + start.length);
  assert.notEqual(to, -1, "expected end marker: " + end);
  return source.slice(from, to);
}

test("Service Worker and updater keep the existing To Me package storage identity", () => {
  const workerCache = sw.match(/const CACHE_NAME = ['"]([^'"]+)['"]/);
  const updaterCache = updater.match(/var CACHE_NAME\s*=\s*['"]([^'"]+)['"]/);
  const updaterDb = updater.match(/var DB_NAME\s*=\s*['"]([^'"]+)['"]/);

  assert.ok(workerCache, "worker cache name exists");
  assert.ok(updaterCache, "updater cache name exists");
  assert.ok(updaterDb, "IndexedDB database name exists");
  assert.equal(workerCache[1], updaterCache[1]);
  assert.equal(workerCache[1], "shbace-chrome-offline-v1.3.4");
  assert.equal(updaterDb[1], "shbace-medical-offline-state-v1");
  assert.match(updater, /var INSTALLED_KEY='installed',STAGED_KEY='staged'/);
});

test("Service Worker is local-first and caches successful fallbacks", () => {
  const local = block(sw, "async function localFirst(request)", "/* Version / manifest checks");
  assert.ok(local.indexOf("cache.match(INDEX_URL)") < local.indexOf("netFetch(request, NET_TIMEOUT)"));
  assert.ok(local.includes("cache.put(isNav ? INDEX_URL : request, fresh.clone())"));
  assert.ok(sw.includes("event.respondWith(localFirst(request))"));
  assert.ok(sw.includes("const isNav = request.mode === 'navigate'"));
});

test("Only explicit no-store manifest/version requests bypass the local-first path", () => {
  assert.ok(sw.includes("request.cache === 'no-store'"));
  assert.ok(sw.includes("netFetch(request, VERSION_TIMEOUT, { cache: 'no-store' })"));
  assert.ok(updater.includes("cache:'no-store'"));
  assert.ok(updater.includes("CHECK_EVERY=48*3600000"));
  assert.ok(sw.includes("const VERSION_FILES ="));
});

test("First installation shows Setup after the Splash completion event", () => {
  const splashWait = block(updater, "function waitForSplash()", "/* ---------- storage / network primitives ---------- */");
  const setupUi = block(updater, "function mountSetupOverlay()", "function injectCss()");
  assert.ok(splashWait.includes("document.addEventListener('spEcgDone',onEcgDone"));
  assert.ok(splashWait.includes("setTimeout(done,650)"));
  assert.ok(splashWait.includes("prefers-reduced-motion: reduce"));
  assert.ok(!splashWait.includes("splash.isConnected)return"), "Setup must not wait for app boot to remove the Splash");
  assert.ok(setupUi.includes("shbaceOfflineSetup"));
  assert.ok(setupUi.includes("Prepare Shbace for offline study"));
  assert.ok(setupUi.includes("question banks"));
  assert.ok(setupUi.includes("data-action','open"));
  assert.ok(lateCss.includes(".shb-offline-setup{"));
  assert.ok(lateCss.includes(".shb-offline-card{"));
});

test("Installer gate blocks question-bank fetching and module preloads until Setup succeeds", () => {
  assert.ok(index.includes('<script src="js/29-offline-setup.js"></script>'));
  assert.ok(!index.includes('id="shbace-offline-setup"'), "installer must not also be a deferred module");
  const loader = block(index, '<script id="shb-boot-v1">', "</script>");
  const go = block(loader, "function go()", "function markPainted()");
  assert.ok(loader.includes("window.__SHBACE_OFFLINE_BOOT_PROMISE__"));
  assert.ok(go.indexOf("bootGate.then") < go.indexOf("loadQuestionBank();"));
  assert.ok(go.indexOf("loadQuestionBank();") < go.indexOf("dataText=null;run()"));
  assert.ok(loader.includes("function prefetchDeferredScripts(list)"));
  assert.ok(loader.includes("prefetchDeferredScripts(list);"));
  assert.ok(!loader.includes("var dataFetch=(function(){"), "question bank must not fetch eagerly");
  const earlyScriptPreloads = [...index.matchAll(/<link\\b[^>]*>/gi)].filter(([tag]) => /\\brel=["']preload["']/i.test(tag) && /\\bas=["']script["']/i.test(tag));
  assert.equal(earlyScriptPreloads.length, 0,
    "deferred app scripts must not start downloading before the first-install Setup gate");
  assert.ok(go.includes("bootGate.then(function(){return loadQuestionBank();})"));
  assert.ok(index.includes("prefetchDeferredScripts(list);"), "deferred modules are prefetched only by the gated boot loader");
  assert.ok(index.includes("caches.open('shbace-chrome-offline-v1.3.4')"));
  assert.ok(index.includes("new URL(url,document.baseURI).href"));
});

test("First-install Service Worker registration cannot race the package download", () => {
  const start = block(updater, "function start()", "if(document.readyState");
  const firstInstall = block(updater, "await saveInstalled(manifest);", "}else announceReady();");
  assert.ok(!start.includes("registerSW();"), "do not register a shell-caching worker before Setup");
  assert.ok(firstInstall.includes("registerSW();"), "register only after the complete package is committed");
  assert.ok(firstInstall.indexOf("saveInstalled(manifest)") < firstInstall.indexOf("registerSW();"));
  assert.ok(sw.includes("if (await cache.match(url)) return;"), "worker install must reuse files already downloaded by Setup");
  assert.ok(!sw.includes("'./',"), "Service Worker must not fetch the root document a second time after Setup");
});

test("Returning installs release the gate locally and use one 48-hour updater", () => {
  const boot = block(updater, "async function boot()", "function kick()");
  const checkFlow = block(updater, "async function runFullCheck(opts)", "/* Re-verify saved files");
  assert.ok(boot.includes("setState('ready')"));
  assert.ok(boot.includes("releaseBootGate()"));
  assert.ok(boot.includes("if(online()&&checkDue())runFullCheck({force:true}).catch(noop)"));
  assert.ok(!boot.includes("verifyCachedFiles("), "no full-package hash scan at startup");
  assert.ok(!boot.includes("localRepairNeeded"), "no daily file-list scan at startup");
  assert.ok(!updater.includes("async function heal()"), "no recurring whole-package repair hash");
  assert.ok(!updater.includes("HEAL_EVERY"));
  assert.ok(checkFlow.includes("if(opts.manual){showSheetLater(res.plan,info)}"));
  assert.ok(checkFlow.includes("else if(autoAllowed()&&!examSoon()){next={plan:res.plan,mode:'update'}}"));
  assert.equal((checkFlow.match(/showSheetLater\(res\.plan,info\)/g) || []).length, 1,
    "only a manual check may open the update sheet");
});

test("Chrome Settings keeps the manual action but has no duplicate version polling", () => {
  assert.ok(chromeBridge.includes("window.shbaceCheckForUpdate()"));
  assert.ok(chromeBridge.includes("window.shbaceRequestAppReload=function()"));
  assert.ok(!chromeBridge.includes("function checkVersion()"));
  assert.ok(!chromeBridge.includes("function scheduledCheck()"));
  assert.ok(!chromeBridge.includes("VCHECK_EVERY"));
  assert.ok(!chromeBridge.includes("setInterval(function(){"));
  assert.ok(chromeBridge.includes("every 48 hours"));
});

test("Integrity downloads bypass Service Worker cache and are verified by the installer", () => {
  const i = sw.indexOf("if (url.searchParams.has('__shbace_integrity'))");
  assert.notEqual(i, -1);
  assert.ok(sw.slice(i, i + 100).includes("return;"));
  assert.match(updater, /function sha256\(buf\)/);
  assert.ok(updater.includes("await isVerified(f,tname,target)"));
  assert.ok(updater.includes("await markVerified(f,tname)"));
});

test("The build manifest covers the complete copied package and validates the bootstrap script", () => {
  assert.ok(build.includes("const inventoryFiles = listOutputFiles(output)"));
  assert.match(build, /sha256:\s*createHash\(["']sha256["']\)/);
  assert.ok(build.includes("fileCount: offlineFiles.length"));
  assert.ok(build.includes("/(?:data-src|src)="), "parser-loaded Setup script must be syntax-checked by the build");
  assert.equal(pkg.version, pwa.version);
  assert.equal(pwa.version, "1.3.10-chrome.4");
});

test("Splash portal transition remains short and app rendering waits for all scripts", () => {
  const match = portal.match(/shbPortalSplash[\s\S]*?T:\{out:(\d+),hold:(\d+),in:(\d+)\}/);
  assert.ok(match, "Splash portal timing exists");
  const total = Number(match[1]) + Number(match[2]) + Number(match[3]);
  assert.ok(total <= 900, "portal phase budget should be under 0.9 seconds");
  assert.ok(!portal.includes("T:{out:1150,hold:160,in:1550}"));

  const complete = block(app, "function completeSplashOnce(overlay,instant){", "function syncSplashOnForeground()");
  assert.ok(complete.includes("window.__shbBooted!==true"));
  assert.ok(app.includes("if(window.__shbBooted!==true){"));
});


test("Offline recovery reuses intact Cache Storage files when IndexedDB verification records are missing", () => {
  const verification = block(updater, "async function isVerified(f,tname,target)", "async function downloadFile(");
  assert.ok(verification.includes("await target.match(urlFor(f.path))"));
  assert.ok(verification.includes("await response.arrayBuffer()"));
  assert.ok(verification.includes("bytes.byteLength!==Number(f.bytes)"));
  assert.ok(verification.includes("await sha256(bytes)"));
  assert.ok(verification.includes("await markVerified(f,tname)"));
  assert.ok(!verification.includes("dbGet('verified'"),
    "the cached response, not the possibly-evicted IndexedDB marker, is the source of truth");
});

test("Installer requests persistent origin storage before reading install state", () => {
  assert.ok(updater.includes("async function requestPersistentStorage()"));
  assert.ok(updater.includes("await navigator.storage.persisted()"));
  assert.ok(updater.includes("return await navigator.storage.persist()"));
  const boot = block(updater, "async function boot()", "function kick()");
  assert.ok(boot.indexOf("await requestPersistentStorage();") < boot.indexOf("var rec="));
});

function makeIndexedDbHarness(options = {}) {
  let openCount = 0;
  let transactionCount = 0;
  const connections = [];
  const indexedDB = {
    open() {
      openCount++;
      const connection = {
        objectStoreNames: { contains: () => true },
        close() { this.closed = true; },
        transaction() {
          transactionCount++;
          if (options.failFirstTransaction && transactionCount === 1) {
            const error = new Error("Failed to execute 'transaction' on 'IDBDatabase': The database connection is closing.");
            error.name = "InvalidStateError";
            throw error;
          }
          const tx = {
            objectStore() {
              return {
                get() { return { result: "preserved-student-data" }; },
                put() { return { result: "saved" }; }
              };
            }
          };
          Object.defineProperty(tx, "oncomplete", {
            set(callback) { queueMicrotask(() => callback()); }
          });
          return tx;
        }
      };
      connections.push(connection);
      const request = {};
      queueMicrotask(() => {
        request.result = connection;
        request.onupgradeneeded?.();
        request.onsuccess?.();
      });
      return request;
    }
  };
  const start = updater.indexOf("/* ---------- IndexedDB (same database and stores as before) ---------- */");
  const end = updater.indexOf("/* ---------- state machine + UI ----------", start);
  assert.notEqual(start, -1, "IndexedDB implementation exists");
  assert.notEqual(end, -1, "IndexedDB implementation has an end marker");
  const context = { window: { indexedDB }, indexedDB, DB_NAME: "test-offline-state-v1" };
  runInNewContext(updater.slice(start, end), context);
  return {
    context,
    connections,
    get openCount() { return openCount; },
    get transactionCount() { return transactionCount; }
  };
}

test("IndexedDB updater reopens and retries once when a transaction uses a closing connection", async () => {
  const h = makeIndexedDbHarness({ failFirstTransaction: true });
  const result = await h.context.dbGet("meta", "installed");
  assert.equal(result, "preserved-student-data");
  assert.equal(h.openCount, 2, "a fresh database connection is opened for the retry");
  assert.equal(h.transactionCount, 2, "only one retry is made");
});

test("IndexedDB updater discards connections on versionchange and unexpected close", async () => {
  const h = makeIndexedDbHarness();
  assert.equal(await h.context.dbGet("meta", "installed"), "preserved-student-data");
  const first = h.connections[0];
  assert.equal(typeof first.onversionchange, "function");
  first.onversionchange();
  assert.equal(first.closed, true, "old connection is closed after versionchange");
  assert.equal(await h.context.dbGet("meta", "installed"), "preserved-student-data");
  assert.equal(h.openCount, 2, "versionchange forces a fresh connection");

  const second = h.connections[1];
  second.onclose?.();
  assert.equal(await h.context.dbGet("meta", "installed"), "preserved-student-data");
  assert.equal(h.openCount, 3, "unexpected close also invalidates the cached connection");
});
