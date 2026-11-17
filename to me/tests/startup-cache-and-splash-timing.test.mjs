import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

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
  assert.equal(workerCache[1], "shbace-chrome-offline-v1.3.10.37");
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
  assert.ok(index.includes("caches.open('shbace-chrome-offline-v1.3.10.37')"));
  assert.ok(index.includes("new URL(url,document.baseURI).href"));
});

test("First-install Service Worker registration cannot race the package download", () => {
  const start = block(updater, "function start()", "if(document.readyState");
  const firstInstall = block(updater, "if(mode==='install'){", "}else announceReady();");
  assert.ok(!start.includes("registerSW();"), "do not register a shell-caching worker before Setup");
  assert.ok(firstInstall.includes("registerSW();"), "register only after the complete package is committed");
  assert.ok(firstInstall.indexOf("saveInstalled(manifest)") < firstInstall.indexOf("registerSW();"));
  assert.ok(updater.includes("if(await cache.match(url)) return;"), "worker install must reuse files already downloaded by Setup");
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
  assert.ok(!checkFlow.includes("showSheetLater(res.plan,info)\n   return"), "automatic checks must not open a modal");
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
  assert.ok(updater.includes("sha256(buf)"));
  assert.ok(updater.includes("await isVerified(f,tname,target)"));
  assert.ok(updater.includes("await markVerified(f,tname)"));
});

test("The build manifest covers the complete copied package and validates the bootstrap script", () => {
  assert.ok(build.includes("const inventoryFiles = listOutputFiles(output)"));
  assert.ok(build.includes("sha256: createHash('sha256')"));
  assert.ok(build.includes("fileCount: offlineFiles.length"));
  assert.ok(build.includes("/(?:data-src|src)="), "parser-loaded Setup script must be syntax-checked by the build");
  assert.equal(pkg.version, pwa.version);
  assert.equal(pwa.version, "1.3.10-to-me.47");
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
