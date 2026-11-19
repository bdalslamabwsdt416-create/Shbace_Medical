import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, "..");
const layout = readFileSync(resolve(root, "js/48-android-settings-layout.js"), "utf8");
const remote = readFileSync(resolve(root, "js/45-android-remote-content.js"), "utf8");
const index = readFileSync(resolve(root, "index.html"), "utf8");

test("settings layout is restricted to the real native Android APK", () => {
  assert.match(layout, /getPlatform\(\) === 'android'/);
  assert.match(layout, /isNativePlatform\(\)/);
  assert.match(layout, /window\.ShbaceNative/);
  assert.match(layout, /if \(!isAndroidNative\(\)\) return/);
});

test("settings layout keeps every existing setting family and unknown cards", () => {
  for (const key of ["appearance", "notifications", "study", "reminders", "experience", "data", "progress", "other", "updates"]) {
    assert.ok(layout.includes("id: '" + key + "'"), "missing settings section " + key);
  }
  assert.match(layout, /return 'other'/);
  assert.match(layout, /collectItems\(root, state\.order\)/);
  assert.match(layout, /target\.appendChild\(item\)/);
  assert.match(layout, /id === 'bkFile'/);
  assert.match(layout, /id === 'shbAndroidSettings'/);
  assert.match(layout, /id === 'shbUnifiedVoiceSettings'/);
  assert.match(layout, /classList\.contains\('u10-settings-card'\)/);
  assert.match(layout, /classList\.contains\('shb-remote-settings'\)/);
});

test("the update checker is the final settings section and invokes the native content updater", () => {
  assert.ok(layout.indexOf("id: 'updates'") > layout.indexOf("id: 'other'"));
  assert.match(remote, /data-shb-remote-check>Check for update<\/button>/);
  assert.match(remote, /window\.shbaceCheckRemoteContent/);
  assert.match(remote, /does not install a new APK/i);
});

test("the Android settings layout loads after the existing Android remote engines", () => {
  const content = index.indexOf('data-src="js/45-android-remote-content.js"');
  const ui = index.indexOf('data-src="js/47-android-remote-control.js"');
  const settings = index.indexOf('data-src="js/48-android-settings-layout.js"');
  assert.ok(content >= 0 && ui > content && settings > ui);
});


test("APK release checker compares the installed APK to the public latest release", () => {
  assert.match(layout, /api\.github\.com\/repos\/bdalslamabwsdt416-create\/Shbace_Medical\/releases\/latest/);
  assert.match(layout, /installedApkVersion/);
  assert.match(layout, /compareVersions/);
  assert.match(layout, /safeReleaseAssetUrl/);
  assert.match(layout, /openExternalUrl/);
  assert.match(layout, /data-shb-apk-check/);
  assert.match(layout, /shb-apk-update-card/);
});

test("native external-browser bridge only permits HTTPS GitHub URLs", () => {
  const native = readFileSync(resolve(root, "../android/app/src/main/java/com/shbace/medical/ShbaceNative.java"), "utf8");
  assert.match(native, /public boolean openExternalUrl\(String rawUrl\)/);
  assert.match(native, /"https"\.equalsIgnoreCase\(scheme\)/);
  assert.match(native, /"github.com"\.equalsIgnoreCase\(host\)/);
});

test("main Android release pipeline publishes a signed APK and checksum", () => {
  const workflow = readFileSync(resolve(root, "../.github/workflows/android-build.yml"), "utf8");
  assert.match(workflow, /Publish signed Android APK release/);
  assert.match(workflow, /github\.ref == 'refs\/heads\/main'/);
  assert.match(workflow, /gh release upload/);
  assert.match(workflow, /sha256sum/);
  assert.match(workflow, /make_latest=true/);
});
