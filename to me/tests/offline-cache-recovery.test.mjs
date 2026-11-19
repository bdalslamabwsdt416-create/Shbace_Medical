import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
import { createHash, webcrypto } from "node:crypto";

const source = readFileSync(new URL("../js/29-offline-setup.js", import.meta.url), "utf8");

function blockBetween(start, end) {
  const from = source.indexOf(start);
  assert.notEqual(from, -1, `missing source block: ${start}`);
  const to = source.indexOf(end, from + start.length);
  assert.notEqual(to, -1, `missing source boundary: ${end}`);
  return source.slice(from, to);
}

test("the READY marker is published after a versioned manifest snapshot", () => {
  const save = blockBetween("async function saveInstalled(m)", "/* Download a plan.");
  const snapshot = save.indexOf("manifestSnapshotUrl(m.version)");
  const readyMeta = save.indexOf("dbPut('meta','ready'");
  const readyCache = save.indexOf("c.put(READY_URL");
  assert.ok(snapshot >= 0, "installed manifest snapshot must be cached");
  assert.ok(readyMeta > snapshot, "IndexedDB ready metadata must follow the manifest snapshot");
  assert.ok(readyCache > readyMeta, "Cache Storage READY marker must be the final commit marker");
});

test("cache recovery requires a valid READY marker and matching manifest version", () => {
  const recovery = blockBetween("async function recoverInstalledFromCache()", "async function computePlan");
  assert.match(recovery, /c\.match\(READY_URL\)/);
  assert.match(recovery, /marker\.verified!==true/);
  assert.match(recovery, /manifestSnapshotUrl\(marker\.version\)/);
  assert.match(recovery, /validManifest\(cachedManifest\)/);
  assert.match(recovery, /String\(cachedManifest\.version\)!==String\(marker\.version\)/);
});

test("recovery verifies cached file bytes and SHA-256 before rebuilding metadata", () => {
  const recovery = blockBetween("async function recoverInstalledFromCache()", "async function computePlan");
  const verify = blockBetween("async function verifyCachedFiles", "/* Recover only when IndexedDB metadata is missing.");
  assert.match(recovery, /verifyCachedFiles\(cachedManifest\.files/);
  assert.match(verify, /b\.byteLength===f\.bytes/);
  assert.match(verify, /sha256\(b\)/);
  assert.match(recovery, /fileMap\(checked\.good\)/);
  assert.match(recovery, /checked\.bad\.length===0/);
});

test("boot attempts cache recovery before showing first-install setup", () => {
  const boot = blockBetween("async function boot()", "function kick()");
  const recoveryCall = boot.indexOf("recoverInstalledFromCache()");
  const stagedUpdate = boot.indexOf("if(st&&st.ready)");
  const setupGate = boot.indexOf("if(!hasRec&&!hasReadyMarker&&!recoveredFromCache)");
  assert.ok(recoveryCall >= 0);
  assert.ok(stagedUpdate > recoveryCall, "recover the installed cache before handling a staged update");
  assert.ok(setupGate > recoveryCall);
  assert.match(boot, /recoveryNeedsRepair&&online\(\)/);
});

test("partial recovery remains marked for targeted repair on later launches", () => {
  const boot = blockBetween("async function boot()", "function kick()");
  const kick = blockBetween("function kick()", "function start()");
  assert.match(boot, /rec\.verified===false/);
  assert.match(kick, /if\(recoveryNeedsRepair\)/);
  assert.match(kick, /runFullCheck\(\{force:true\}\)/);
});


function makeBrowserHarness({ version = "offline-recovery-test-v1", missing = [], corrupt = [], online = true } = {}) {
  const baseUrl = "https://shbace.test/app/index.html";
  const manifestUrl = new URL("./offline-assets-manifest.json", baseUrl).href;
  const readyUrl = new URL("./__shbace_offline_ready__", baseUrl).href;
  const snapshotUrl = manifestUrl + "?__shbace_offline_snapshot=" + encodeURIComponent(version);
  const payloads = [
    ["index.html", "<html>offline</html>"],
    ["js/fixture.js", "window.fixture = true;"],
    ["data/questions.json", "{\"questions\":[]}"]
  ];
  const digest = value => createHash("sha256").update(value).digest("hex");
  const files = payloads.map(([path, body]) => ({
    path,
    bytes: Buffer.byteLength(body),
    sha256: digest(body)
  }));
  const manifest = {
    schema: 1,
    version,
    files,
    totalBytes: files.reduce((sum, file) => sum + file.bytes, 0)
  };

  const cacheEntries = new Map();
  const cache = {
    async match(key) {
      const url = typeof key === "string" ? key : key.url;
      const response = cacheEntries.get(url);
      return response ? response.clone() : undefined;
    },
    async put(key, response) {
      const url = typeof key === "string" ? key : key.url;
      cacheEntries.set(url, response.clone());
    },
    async delete(key) {
      const url = typeof key === "string" ? key : key.url;
      return cacheEntries.delete(url);
    },
    async keys() {
      return [...cacheEntries.keys()].map(url => new Request(url));
    }
  };
  const caches = {
    async open() { return cache; },
    async has() { return true; },
    async delete() { return true; },
    async keys() { return ["shbace-chrome-offline-v1.3.10.37"]; }
  };

  const stores = { meta: new Map(), verified: new Map() };
  const database = {
    objectStoreNames: { contains: name => Object.prototype.hasOwnProperty.call(stores, name) },
    transaction(name) {
      const tx = {};
      tx.objectStore = () => ({
        get(key) { return { result: stores[name].get(key) }; },
        put(value, key) { stores[name].set(key, value); return { result: key }; }
      });
      queueMicrotask(() => tx.oncomplete?.());
      return tx;
    }
  };
  const indexedDB = {
    open() {
      const request = {};
      queueMicrotask(() => {
        request.result = database;
        request.onsuccess?.();
      });
      return request;
    }
  };

  const missingSet = new Set(missing);
  const corruptSet = new Set(corrupt);
  cacheEntries.set(readyUrl, new Response(JSON.stringify({
    version, verified: true, completedAt: Date.now()
  }), { status: 200, headers: { "content-type": "application/json" } }));
  cacheEntries.set(snapshotUrl, new Response(JSON.stringify(manifest), {
    status: 200, headers: { "content-type": "application/json" }
  }));
  for (const [path, body] of payloads) {
    if (missingSet.has(path)) continue;
    cacheEntries.set(
      new URL(path, new URL("./", baseUrl)).href,
      new Response(corruptSet.has(path) ? "corrupted bytes" : body, { status: 200 })
    );
  }

  const localValues = new Map([["shbace_pkg_check_ok_v1", String(Date.now())]]);
  const localStorage = {
    getItem: key => localValues.has(key) ? localValues.get(key) : null,
    setItem: (key, value) => localValues.set(key, String(value)),
    removeItem: key => localValues.delete(key)
  };
  const navigator = {
    onLine: online,
    standalone: false,
    userAgent: "Chrome",
    platform: "Linux",
    maxTouchPoints: 0,
    storage: { async persisted() { return true; }, async persist() { return true; } },
    serviceWorker: {
      async getRegistration() { return { scope: "./" }; },
      async register() { return { scope: "./" }; }
    }
  };
  const document = {
    readyState: "loading",
    body: {},
    visibilityState: "visible",
    getElementById() { return null; },
    addEventListener(name, callback) {
      if (name === "DOMContentLoaded") this.startOffline = callback;
    },
    createElement() {
      throw new Error("Setup UI must not be mounted for a recoverable cached install.");
    }
  };
  const window = {
    caches,
    crypto: webcrypto,
    indexedDB,
    matchMedia: query => ({ matches: query === "(display-mode: standalone)" }),
    addEventListener() {}
  };
  const context = {
    window, document, navigator, location: { href: baseUrl, reload() {} },
    caches, indexedDB, crypto: webcrypto, localStorage,
    sessionStorage: { getItem() { return null; }, setItem() {} },
    URL, Request, Response, Headers, AbortController,
    setTimeout, clearTimeout, setInterval, clearInterval, queueMicrotask
  };
  runInNewContext(source, context, { filename: "29-offline-setup.js" });
  document.startOffline();
  return { window, stores, cache, cacheEntries, manifest, payloads, baseUrl };
}

test("recovers a complete package from Cache Storage after IndexedDB metadata loss", { timeout: 3000 }, async () => {
  const harness = makeBrowserHarness();
  await harness.window.__SHBACE_OFFLINE_BOOT_PROMISE__;
  const installed = harness.stores.meta.get("installed");
  const ready = harness.stores.meta.get("ready");
  assert.equal(installed.verified, true);
  assert.equal(installed.fileCount, harness.manifest.files.length);
  assert.equal(Object.keys(installed.files).length, harness.manifest.files.length);
  assert.equal(ready.verified, true);
});

test("keeps intact files and records targeted repair when one cached file is corrupt", { timeout: 3000 }, async () => {
  const harness = makeBrowserHarness({ corrupt: ["data/questions.json"], online: false });
  await harness.window.__SHBACE_OFFLINE_BOOT_PROMISE__;
  const installed = harness.stores.meta.get("installed");
  assert.equal(installed.verified, false);
  assert.equal(installed.fileCount, harness.manifest.files.length - 1);
  assert.equal(Object.hasOwn(installed.files, "index.html"), true);
  assert.equal(Object.hasOwn(installed.files, "js/fixture.js"), true);
  assert.equal(Object.hasOwn(installed.files, "data/questions.json"), false);
  assert.equal(harness.stores.meta.get("ready"), null);
  const corruptUrl = new URL("data/questions.json", new URL("./", harness.baseUrl)).href;
  assert.ok(await harness.cache.match(corruptUrl), "the repair plan, not recovery, replaces the damaged entry");
});
