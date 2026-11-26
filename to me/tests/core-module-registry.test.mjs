import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import vm from "node:vm";
import test from "node:test";

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, "..");
const coreSource = readFileSync(resolve(root, "js/49-app-core-v1.js"), "utf8");
const registrySource = readFileSync(resolve(root, "js/50-module-registry-v1.js"), "utf8");
const index = readFileSync(resolve(root, "index.html"), "utf8");
const gradle = readFileSync(resolve(root, "../android/app/build.gradle"), "utf8");
const manifest = JSON.parse(readFileSync(resolve(root, "modules/module-manifest.v1.json"), "utf8"));

function createRuntime(platform = "android", nativeBridge = { getDeviceInfo: () => "Version: 1.3.12 (20)" }) {
  const window = {
    Capacitor: { getPlatform: () => platform, isNativePlatform: () => platform === "android" },
    ShbaceNative: nativeBridge
  };
  const context = vm.createContext({ window, console, Date, Map, Set, Promise, Object, Array, String, Number, TypeError });
  vm.runInContext(coreSource, context, { filename: "49-app-core-v1.js" });
  vm.runInContext(registrySource, context, { filename: "50-module-registry-v1.js" });
  return { window, context };
}

test("Core and Module Registry activate only in the native Android APK", () => {
  const android = createRuntime("android");
  assert.equal(android.window.SHBACECore.platform, "android");
  assert.equal(android.window.SHBACEModuleRegistry.version, "1.0.0");
  const chrome = createRuntime("web");
  assert.equal(chrome.window.SHBACECore, undefined);
  assert.equal(chrome.window.SHBACEModuleRegistry, undefined);
});

test("Core event bus supports subscribe, once, unsubscribe and contained listener errors", () => {
  const { window } = createRuntime();
  const events = window.SHBACECore.events;
  let count = 0;
  const unsubscribe = events.on("test:event", () => { count++; });
  events.emit("test:event", {});
  assert.equal(count, 1);
  assert.equal(unsubscribe(), true);
  events.emit("test:event", {});
  assert.equal(count, 1);
  let onceCount = 0;
  events.once("test:once", () => { onceCount++; });
  events.emit("test:once", {});
  events.emit("test:once", {});
  assert.equal(onceCount, 1);
  events.on("test:error", () => { throw new Error("expected"); });
  const result = events.emit("test:error", {});
  assert.equal(result.errors, 1);
  assert.ok(window.SHBACECore.diagnostics.snapshot().some((entry) => entry.code === "EVENT_HANDLER_FAILED"));
});

test("Core service registry protects existing services unless replace is explicit", () => {
  const { window } = createRuntime();
  const services = window.SHBACECore.services;
  const original = services.get("android.native");
  assert.ok(original);
  assert.equal(services.register("android.native", { replacement: true }).reason, "already-registered");
  assert.equal(services.get("android.native"), original);
  const replacement = { replacement: true };
  assert.equal(services.register("android.native", replacement, { replace: true }).ok, true);
  assert.equal(services.get("android.native"), replacement);
  assert.equal(services.remove("android.native", original), false);
  assert.equal(services.remove("android.native", replacement), true);
});

test("Module Registry initializes dependencies before dependents", async () => {
  const registry = createRuntime().window.SHBACEModuleRegistry;
  const order = [];
  assert.equal(registry.register({
    id: "module.child", version: "1.0.0", dependencies: ["module.parent"],
    initialize: async () => { order.push("child"); }
  }).ok, true);
  assert.equal(registry.register({
    id: "module.parent", version: "1.0.0",
    initialize: async () => { order.push("parent"); }
  }).ok, true);
  const validation = registry.validate();
  assert.equal(validation.ok, true);
  assert.deepEqual(Array.from(validation.order), ["module.parent", "module.child"]);
  const initialized = await registry.initializeAll();
  assert.equal(initialized.ok, true);
  assert.deepEqual(order, ["parent", "child"]);
  assert.equal(registry.get("module.child").state, "ready");
});

test("Module Registry detects missing dependencies and dependency cycles", () => {
  const missing = createRuntime().window.SHBACEModuleRegistry;
  missing.register({ id: "module.a", version: "1.0.0", dependencies: ["module.missing"], initialize: () => {} });
  assert.equal(missing.validate().ok, false);
  assert.match(missing.validate().error, /Missing module dependency/);
  const cyclic = createRuntime().window.SHBACEModuleRegistry;
  cyclic.register({ id: "module.a", version: "1.0.0", dependencies: ["module.b"], initialize: () => {} });
  cyclic.register({ id: "module.b", version: "1.0.0", dependencies: ["module.a"], initialize: () => {} });
  assert.equal(cyclic.validate().ok, false);
  assert.match(cyclic.validate().error, /dependency cycle/i);
});

test("Module Registry blocks dependents after an initialization failure", async () => {
  const registry = createRuntime().window.SHBACEModuleRegistry;
  let childStarted = false;
  registry.register({ id: "module.parent", version: "1.0.0", initialize: () => { throw new Error("parent failed"); } });
  registry.register({
    id: "module.child", version: "1.0.0", dependencies: ["module.parent"],
    initialize: () => { childStarted = true; }
  });
  const result = await registry.initializeAll();
  assert.equal(result.ok, false);
  assert.equal(childStarted, false);
  assert.equal(registry.get("module.child").state, "registered");
});

test("Module Registry cleans modules in reverse initialization order", async () => {
  const registry = createRuntime().window.SHBACEModuleRegistry;
  const order = [];
  registry.register({
    id: "module.first", version: "1.0.0",
    initialize: () => () => { order.push("first"); }
  });
  registry.register({
    id: "module.second", version: "1.0.0", dependencies: ["module.first"],
    initialize: () => ({ dispose: () => { order.push("second"); } })
  });
  assert.equal((await registry.initializeAll()).ok, true);
  const disposed = await registry.disposeAll();
  assert.equal(disposed.ok, true);
  assert.deepEqual(order, ["second", "first"]);
  assert.equal(registry.get("module.first").state, "disposed");
});

test("Module Registry rejects duplicates and unregistering active dependencies", async () => {
  const registry = createRuntime().window.SHBACEModuleRegistry;
  const definition = { id: "module.base", version: "1.0.0", initialize: () => {} };
  assert.equal(registry.register(definition).ok, true);
  assert.equal(registry.register(definition).reason, "duplicate-module");
  registry.register({
    id: "module.feature", version: "1.0.0", dependencies: ["module.base"], initialize: () => {}
  });
  assert.equal(registry.unregister("module.base").reason, "has-dependents");
  await registry.initializeAll();
  assert.equal(registry.unregister("module.feature").reason, "module-active");
});

test("loader order places Core and Module Registry after the existing Android modules", () => {
  const settings = index.indexOf('data-src="js/48-android-settings-layout.js"');
  const core = index.indexOf('data-src="js/49-app-core-v1.js"');
  const registry = index.indexOf('data-src="js/50-module-registry-v1.js"');
  assert.ok(settings >= 0 && core > settings && registry > core);
});

test("Android release metadata matches v1.3.12 / versionCode 21", () => {
  assert.match(gradle, /versionCode\s+21/);
  assert.match(gradle, /versionName\s+"1\.3\.12"/);
  assert.equal(manifest.frozenAndroidRelease.versionName, "1.3.12");
  assert.equal(manifest.frozenAndroidRelease.versionCode, 21);
});

test("module manifest covers the blueprint without overstating unfinished engines", () => {
  const ids = new Set(manifest.modules.map((module) => module.id));
  for (const id of [
    "core", "module-registry", "navigation", "ui", "page-builder", "workflow", "theme",
    "quiz", "smart-review", "flashcards", "medical-bank", "statistics", "media",
    "search", "data", "sync", "offline", "notifications", "ai", "security", "updates",
    "analytics", "admin-console", "accounts", "gamification"
  ]) assert.ok(ids.has(id), "Missing module inventory entry: " + id);
  const workflow = manifest.modules.find((module) => module.id === "workflow");
  assert.equal(workflow.status, "partial");
  assert.ok(workflow.capabilities.includes("allow-listed-navigation-triggers"));
  assert.ok(workflow.capabilities.includes("allow-listed-navigation-actions"));
  assert.equal(manifest.modules.find((module) => module.id === "admin-console").status, "planned");
});

test("new architecture modules do not rewrite student stores or execute remote code", () => {
  assert.doesNotMatch(coreSource + registrySource, /localStorage\.|indexedDB\.|eval\s*\(|new Function\s*\(/);
});


test("module manifest has unique IDs, supported states and complete dependency references", () => {
  const allowed = new Set(["implemented", "partial", "planned"]);
  const ids = manifest.modules.map((module) => module.id);
  assert.equal(new Set(ids).size, ids.length, "module IDs must be unique");
  for (const module of manifest.modules) {
    assert.match(module.id, /^[a-z][a-z0-9]*(?:[.-][a-z0-9]+)*$/);
    assert.ok(allowed.has(module.status), "unknown status for " + module.id);
    for (const dependency of module.dependencies || []) {
      assert.ok(ids.includes(dependency), "missing manifest dependency " + dependency);
    }
  }
  const registryModule = manifest.modules.find((module) => module.id === "module-registry");
  assert.deepEqual(registryModule.dependencies, ["core"]);
});

test("Module Registry binds returned dispose methods to their owning object", async () => {
  const registry = createRuntime().window.SHBACEModuleRegistry;
  const calls = [];
  registry.register({
    id: "module.bound-cleanup", version: "1.0.0",
    initialize: () => ({ name: "owner", dispose: function () { calls.push(this.name); } })
  });
  assert.equal((await registry.initializeAll()).ok, true);
  assert.equal((await registry.disposeAll()).ok, true);
  assert.deepEqual(calls, ["owner"]);
});
