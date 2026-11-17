import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, "..");
const offline = readFileSync(resolve(root, "js/29-offline-setup.js"), "utf8");
const index = readFileSync(resolve(root, "index.html"), "utf8");
const nativeEnhancements = readFileSync(resolve(root, "js/30-android-enhancements.js"), "utf8");
const androidGradle = readFileSync(resolve(root, "../android/app/build.gradle"), "utf8");

test("Capacitor APK skips the browser Cache Storage installer and updater", () => {
  const guard = offline.indexOf("if(window.Capacitor && typeof window.Capacitor.isNativePlatform === 'function' && window.Capacitor.isNativePlatform()) return;");
  const cacheSetup = offline.indexOf("var CACHE_NAME=");
  assert.ok(guard >= 0, "native Capacitor guard is present");
  assert.ok(cacheSetup < 0 || guard < cacheSetup, "native guard runs before the PWA cache setup");
});

test("the PWA Service Worker is not registered inside Capacitor", () => {
  assert.match(index, /if\s*\(window\.Capacitor\s*\|\|\s*!\('serviceWorker'\s+in\s+navigator\)\)\s*return/);
});

test("Android-only enhancements require the real native Capacitor bridge", () => {
  assert.match(nativeEnhancements, /c\.isNativePlatform/);
  assert.match(nativeEnhancements, /window\.ShbaceNative/);
});

test("Gradle packages the generated to-me web build, not the legacy root web app", () => {
  assert.match(androidGradle, /\.\.\/to me\/www/);
  assert.doesNotMatch(androidGradle, /from "\$\{rootDir\}\/\.\.\/www"/);
});
