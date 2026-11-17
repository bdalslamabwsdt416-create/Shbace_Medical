import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const sw = readFileSync(new URL("../sw.js", import.meta.url), "utf8");
const updater = readFileSync(new URL("../js/29-offline-setup.js", import.meta.url), "utf8");
const portal = readFileSync(new URL("../js/25-shb-portal-js.js", import.meta.url), "utf8");
const app = readFileSync(new URL("../js/04-app-main.js", import.meta.url), "utf8");

test("Service Worker and offline updater retain one persistent package cache", () => {
  const workerCache = sw.match(/const CACHE_NAME = ['"]([^'"]+)['"]/);
  const updaterCache = updater.match(/var CACHE_NAME\s*=\s*['"]([^'"]+)['"]/);
  assert.ok(workerCache, "worker cache name exists");
  assert.ok(updaterCache, "updater cache name exists");
  assert.equal(workerCache[1], updaterCache[1]);
  assert.equal(workerCache[1], "shbace-computer-offline-v1.3.4");
});

test("verified installations serve navigation, JavaScript and CSS strictly from local cache", () => {
  const local = sw.slice(sw.indexOf("async function localFirst"), sw.indexOf("self.addEventListener('fetch'"));
  assert.ok(local.includes("const ready = await cache.match(READY_URL)"));
  assert.ok(local.indexOf("cache.match(INDEX_URL)") < local.indexOf("fetch(request)"));
  assert.ok(local.indexOf("if (ready) return missingOfflineResponse(request.url)") < local.indexOf("fetch(request)"));
  assert.match(sw, /request\.mode === 'navigate'[\s\S]*?event\.respondWith\(localFirst\(request\)\)/);
  assert.match(sw, /request\.destination === 'script'[\s\S]*?event\.respondWith\(localFirst\(request\)\)/);
  assert.match(sw, /request\.destination === 'style'[\s\S]*?event\.respondWith\(localFirst\(request\)\)/);
  assert.ok(local.includes("return missingOfflineResponse(request.url)"));
  assert.ok(!local.includes("cache.put(cacheKey, fresh.clone())") || local.indexOf("if (ready)") < local.indexOf("cache.put(cacheKey, fresh.clone())"));
});

test("the READY marker is the boundary between online bootstrap and local-only runtime", () => {
  const local = sw.slice(sw.indexOf("async function localFirst"), sw.indexOf("self.addEventListener('fetch'"));
  assert.ok(local.indexOf("const ready = await cache.match(READY_URL)") < local.indexOf("if (ready)"));
  assert.ok(local.indexOf("if (ready) return missingOfflineResponse(request.url)") < local.indexOf("fetch(request)"));
  assert.ok(updater.includes("cache.put(READY_URL"));
  assert.ok(updater.includes("return saveInstalled(manifest.files)"));
});

test("only explicit updater no-store requests refresh the manifests and version files", () => {
  assert.ok(sw.includes("if (request.cache !== 'no-store')"));
  assert.ok(sw.includes("fetch(request, { cache: 'no-store' })"));
  assert.ok(updater.includes("cache:'no-store'"));
  assert.ok(updater.includes("CHECK_EVERY=7*24*60*60*1000"));
});

test("integrity downloads still bypass the local cache", () => {
  const i = sw.indexOf("url.searchParams.has('__shbace_integrity')");
  assert.notEqual(i, -1);
  assert.ok(sw.slice(i, i + 250).includes("fetch(request, { cache: 'reload' })"));
});

test("Splash portal transition no longer adds a multi-second wait", () => {
  const match = portal.match(/shbPortalSplash[\s\S]*?T:\{out:(\d+),hold:(\d+),in:(\d+)\}/);
  assert.ok(match, "Splash portal timing exists");
  const total = Number(match[1]) + Number(match[2]) + Number(match[3]);
  assert.ok(total <= 900, "portal phase budget should be under 0.9 seconds");
  assert.ok(!portal.includes("T:{out:1150,hold:160,in:1550}"));
});

test("app still waits for the complete script sequence before revealing Home", () => {
  const start = app.indexOf("function completeSplashOnce(overlay,instant){");
  const end = app.indexOf("function syncSplashOnForeground()", start);
  assert.ok(start >= 0 && end > start);
  assert.ok(app.slice(start, end).includes("window.__shbBooted!==true"));
  assert.ok(app.includes("if(window.__shbBooted!==true){"));
});
