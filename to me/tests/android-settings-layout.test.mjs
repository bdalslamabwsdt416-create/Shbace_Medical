import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";
import vm from "node:vm";

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

test("remote content uses monotonic version policy and verified last-known-good rollback", () => {
  const manager = readFileSync(resolve(root, "../for ApK/native/com/shbace/medical/RemoteContentManager.java"), "utf8");
  const policy = readFileSync(resolve(root, "../for ApK/native/com/shbace/medical/RemoteContentPolicy.java"), "utf8");
  const native = readFileSync(resolve(root, "../android/app/src/main/java/com/shbace/medical/ShbaceNative.java"), "utf8");
  const manifest = JSON.parse(readFileSync(resolve(root, "../for ApK/android-content/manifest.json"), "utf8"));
  const catalog = JSON.parse(readFileSync(resolve(root, "../for ApK/android-content/catalog.json"), "utf8"));

  assert.equal(manifest.contentVersionCode, 5);
  assert.equal(manifest.minAppVersionCode, 19);
  assert.equal(manifest.channel, "stable");
  assert.equal(catalog.version, manifest.version);
  assert.match(policy, /candidateContentVersionCode < installedContentVersionCode/);
  assert.match(policy, /installedAppVersionCode < minimumAppVersionCode/);
  assert.match(manager, /previous-manifest\.json/);
  assert.match(manager, /packageFilesPresent\(target, true\)/);
  assert.match(manager, /RemoteContentPolicy\.validateCandidate/);
  assert.match(manager, /cleanupOldVersions\(version, previous == null \? "" : installedContentVersion\)/);
  assert.match(native, /startRemoteContentRollback\(\)/);
  assert.match(remote, /data-shb-remote-rollback/);
  assert.match(remote, /result\.status === 'rolled-back'/);
  assert.match(remote, /The manifest itself is not cryptographically signed/);
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
  assert.match(layout, /resolveReleaseApkUrl/);
  assert.match(layout, /findReleaseApkAsset/);
  assert.match(layout, /assets_url/);
  assert.match(layout, /openExternalUrl/);
  assert.match(layout, /data-shb-apk-check/);
  assert.match(layout, /shb-apk-update-card/);
});


function createReleaseAssetResolver(fetchImpl = async () => ({ ok: false, json: async () => [] })) {
  const start = layout.indexOf("  function findReleaseApkAsset");
  const end = layout.indexOf("\n  function setApkStatus", start);
  assert.ok(start >= 0 && end > start, "APK asset resolver helpers must be present");
  const context = vm.createContext({ fetch: fetchImpl });
  return vm.runInContext(
    layout.slice(start, end) + "\n({ findReleaseApkAsset, resolveReleaseApkUrl })",
    context,
    { filename: "apk-release-asset-resolver.js" }
  );
}

test("APK release resolver accepts the uploaded asset without URL constructor support", async () => {
  const resolver = createReleaseAssetResolver();
  const release = {
    id: 459991135,
    assets: [{ name: "app-release.apk", state: "uploaded", size: 22167665 }]
  };
  assert.equal(
    await resolver.resolveReleaseApkUrl(release, "android-v1.3.11"),
    "https://github.com/bdalslamabwsdt416-create/Shbace_Medical/releases/download/android-v1.3.11/app-release.apk"
  );
});

test("APK release resolver verifies assets through the release assets endpoint when summary omits them", async () => {
  const calls = [];
  const resolver = createReleaseAssetResolver(async (url) => {
    calls.push(url);
    return {
      ok: true,
      json: async () => [{ name: "app-release.apk", state: "uploaded", size: 22167665 }]
    };
  });
  const release = {
    id: 459991135,
    assets: [],
    assets_url: "https://api.github.com/repos/bdalslamabwsdt416-create/Shbace_Medical/releases/459991135/assets"
  };
  assert.equal(
    await resolver.resolveReleaseApkUrl(release, "android-v1.3.11"),
    "https://github.com/bdalslamabwsdt416-create/Shbace_Medical/releases/download/android-v1.3.11/app-release.apk"
  );
  assert.deepEqual(calls, [release.assets_url]);
});

test("APK release resolver rejects missing, incomplete or unverified release assets", async () => {
  const resolver = createReleaseAssetResolver();
  assert.equal(await resolver.resolveReleaseApkUrl({ assets: [] }, "android-v1.3.11"), "");
  assert.equal(await resolver.resolveReleaseApkUrl({
    assets: [{ name: "app-release.apk", state: "starter", size: 22167665 }]
  }, "android-v1.3.11"), "");
  assert.equal(await resolver.resolveReleaseApkUrl({
    id: 459991135,
    assets: [],
    assets_url: "https://api.github.com/repos/another-owner/another-repo/releases/459991135/assets"
  }, "android-v1.3.11"), "");
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
  assert.match(workflow, /-f make_latest=true/);
});


test("Android release automation only replaces the frozen v1.3.11 APK on the explicitly marked repair commit", () => {
  const workflow = readFileSync(resolve(root, "../.github/workflows/android-build.yml"), "utf8");
  const start = workflow.indexOf("- name: Publish signed Android APK release");
  const end = workflow.indexOf("- name: Remove temporary signing material", start);
  const step = workflow.slice(start, end);
  assert.match(step, /releases\/tags\/\$\{TAG\}/);
  assert.match(step, /Stable release \$\{TAG\} already exists/);
  assert.match(step, /COMMIT_MESSAGE/);
  assert.match(step, /VERSION_NAME.*1\.3\.11/);
  assert.match(step, /\[republish-android-v1\.3\.11\]/);
  assert.match(step, /gh release delete "\$TAG" --yes --cleanup-tag/);
  assert.ok(step.indexOf("already exists") < step.indexOf("gh release upload"));
  assert.doesNotMatch(step, /--clobber/);
  assert.match(workflow, /github\.head_ref == 'fix\/android-apk-updater-1\.3\.11'/);
});
