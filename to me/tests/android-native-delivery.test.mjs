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
const remoteManager = readFileSync(resolve(root, "../for ApK/native/com/shbace/medical/RemoteContentManager.java"), "utf8");
const remoteContentUi = readFileSync(resolve(root, "js/46-android-remote-ui.js"), "utf8");

test("Capacitor APK skips the browser Cache Storage installer and updater", () => {
  const guard = offline.indexOf("if(window.Capacitor&&typeof window.Capacitor.isNativePlatform==='function'&&window.Capacitor.isNativePlatform()){releaseBootGate();return;}");
  const cacheSetup = offline.indexOf("var CACHE_NAME=");
  assert.ok(guard >= 0, "native Capacitor guard is present");
  assert.ok(cacheSetup < 0 || guard < cacheSetup, "native guard runs before the PWA cache setup");
  assert.ok(offline.slice(guard, guard + 180).includes("releaseBootGate();return;"),
    "native APK boot must release the shared startup gate without running the browser installer");
});

test("the PWA Service Worker is not registered inside Capacitor", () => {
  assert.match(index, /if\s*\(window\.Capacitor\s*\|\|\s*!\('serviceWorker'\s+in\s+navigator\)\)\s*return/);
});

test("Android-only enhancements require the real native Capacitor bridge", () => {
  assert.match(nativeEnhancements, /c\.isNativePlatform/);
  assert.match(nativeEnhancements, /window\.ShbaceNative/);
});


test("Android remote content reads the production main/for ApK feed", () => {
  assert.match(remoteManager, /main\/for%20ApK\/android-content\/manifest\.json/);
  assert.match(remoteManager, /main\/for%20ApK\/android-content\//);
  assert.doesNotMatch(remoteManager, /shbace-android-content\/android-content/);
});

test("remote navigation and pages are declarative and Android-only", () => {
  assert.match(remoteContentUi, /getPlatform\(\) === 'android'/);
  assert.match(remoteContentUi, /__shbRegisterPage/);
  assert.match(remoteContentUi, /__SHBACE_REMOTE_DRAWER_CONFIG__/);
  assert.doesNotMatch(remoteContentUi, /eval\s*\(|new Function\s*\(/);
});

test("Android 1.3.12 remains an in-place update over the existing installed app", () => {
  assert.match(androidGradle, /applicationId "com\.shbace\.medical"/);
  assert.match(androidGradle, /versionCode 21/);
  assert.match(androidGradle, /versionName "1\.3\.12"/);
  assert.match(androidGradle, /sourceSets[\s\S]*for ApK\/native/);
});

test("Gradle packages the generated to-me web build, not the legacy root web app", () => {
  assert.match(androidGradle, /\.\.\/to me\/www/);
  assert.doesNotMatch(androidGradle, /from "\$\{rootDir\}\/\.\.\/www"/);
});
