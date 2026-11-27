import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync, statSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";
import vm from "node:vm";

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, "..");
const project = resolve(root, "..");
const packRoot = resolve(project, "for ApK/android-content/auscultation");
const heartRoot = resolve(packRoot, "heart");
const lungRoot = resolve(packRoot, "lung");
const heartManifest = JSON.parse(readFileSync(resolve(heartRoot, "manifest.json"), "utf8"));
const heartCatalog = JSON.parse(readFileSync(resolve(heartRoot, "audio-catalog.json"), "utf8"));
const heartAudit = JSON.parse(readFileSync(resolve(heartRoot, "audit.json"), "utf8"));
const lungManifest = JSON.parse(readFileSync(resolve(lungRoot, "manifest.json"), "utf8"));
const lungCatalog = JSON.parse(readFileSync(resolve(lungRoot, "audio-catalog.json"), "utf8"));
const manager = readFileSync(resolve(project, "for ApK/native/com/shbace/medical/AuscultationPackManager.java"), "utf8");
const native = readFileSync(resolve(project, "android/app/src/main/java/com/shbace/medical/ShbaceNative.java"), "utf8");
const gitAttributes = readFileSync(resolve(project, ".gitattributes"), "utf8");
const page = readFileSync(resolve(root, "js/55-android-auscultation-library.js"), "utf8");
const drawer = readFileSync(resolve(root, "js/06-drawer-menu.js"), "utf8");
const remoteControl = readFileSync(resolve(root, "js/47-android-remote-control.js"), "utf8");
const heartAssets = readFileSync(resolve(root, "js/auscultation/heart/native-assets.js"), "utf8");
const lungAssets = readFileSync(resolve(root, "js/auscultation/lung/native-assets.js"), "utf8");
const heartRuntime = readFileSync(resolve(root, "js/auscultation/heart/auscultation-pro.js"), "utf8");
const lungRuntime = readFileSync(resolve(root, "js/auscultation/lung/auscultation-pro.js"), "utf8");
const heartScene = readFileSync(resolve(root, "js/auscultation/heart/scene.js"), "utf8");
const lungScene = readFileSync(resolve(root, "js/auscultation/lung/scene.js"), "utf8");
const integratedCss = readFileSync(resolve(root, "js/auscultation/shbace-integrated.css"), "utf8");

function assertAssembledFilesMatch(packRootPath, manifest) {
  for (const assembled of (manifest.assembledFiles ?? [])) {
    const chunks = assembled.chunkPaths.map((chunkPath) => {
      const entry = manifest.files.find((item) => item.path === chunkPath);
      assert.ok(entry, "missing chunk manifest entry: " + chunkPath);
      const bytes = readFileSync(resolve(packRootPath, chunkPath));
      assert.equal(bytes.length, entry.bytes, "chunk size mismatch: " + chunkPath);
      assert.equal(
        createHash("sha256").update(bytes).digest("hex"),
        entry.sha256,
        "chunk SHA-256 mismatch: " + chunkPath
      );
      return bytes;
    });
    const combined = Buffer.concat(chunks);
    assert.equal(combined.length, assembled.bytes, "assembled size mismatch: " + assembled.path);
    assert.equal(
      createHash("sha256").update(combined).digest("hex"),
      assembled.sha256,
      "assembled SHA-256 mismatch: " + assembled.path
    );
  }
}

test("Heart package contains exactly 77 primary recordings and 77 distinct sounds", () => {
  assert.equal(heartManifest.packageId, "auscultation-heart");
  assert.equal(heartManifest.system, "heart");
  assert.equal(heartManifest.uniqueSoundCount, 77);
  assert.equal(heartManifest.audioFileCount, 77);
  assert.equal(heartManifest.excludedDuplicateVariants, 57);
  assert.equal(heartCatalog.length, 77);
  assert.equal(new Set(heartCatalog.map((item) => item.title)).size, 77);
  assert.ok(heartCatalog.every((item) => item.system === "heart"));
  assert.equal(heartManifest.files.filter((item) => item.path.toLowerCase().endsWith(".mp3")).length, 77);
  assert.equal(heartAudit.selectedAudioFileCount, 77);
  assert.equal(heartAudit.excludedDuplicateVariantCount, 57);
  assert.equal(heartAudit.missingAudioFiles, 0);
});

test("Heart package preserves cardiac model dependencies and excludes respiratory recordings", () => {
  const paths = new Set([...heartManifest.files.map((item) => item.path), ...(heartManifest.assembledFiles ?? []).map((item) => item.path)]);
  assert.ok(heartCatalog.every((item) => paths.has("audio-library/" + item.path)));
  for (const model of [
    "assets/models/thorax.bin",
    "assets/models/thorax.json",
    "assets/models/valve-heart.bin",
    "assets/models/valve-heart.json"
  ]) assert.ok(paths.has(model), "missing required model: " + model);
  assert.equal(heartManifest.files.filter((item) => /Respiratory Auscultation|lung/i.test(item.path)).length, 0);
  assert.equal(heartAudit.excludedSystems.includes("lung"), true);
  for (const item of heartManifest.files) {
    const path = resolve(heartRoot, item.path);
    assert.equal(statSync(path).size, item.bytes, "size mismatch: " + item.path);
    const digest = createHash("sha256").update(readFileSync(path)).digest("hex");
    assert.equal(digest, item.sha256, "SHA-256 mismatch: " + item.path);
  }
  assertAssembledFilesMatch(heartRoot, heartManifest);
});

test("Lung package contains 31 distinct sounds and retains all 73 Medara MP3 variants", () => {
  assert.equal(lungManifest.packageId, "auscultation-lung");
  assert.equal(lungManifest.system, "lung");
  assert.equal(lungManifest.uniqueSoundCount, 31);
  assert.equal(lungManifest.audioFileCount, 73);
  assert.equal(lungManifest.audioCatalogEntryCount, 73);
  assert.equal(lungCatalog.length, 73);
  assert.equal(new Set(lungCatalog.map((item) => item.title)).size, 31);
  assert.ok(lungCatalog.every((item) => item.system === "lung"));
  assert.ok(lungCatalog.every((item) => item.variant && item.sourcePath));
  assert.equal(lungManifest.files.filter((item) => item.path.toLowerCase().endsWith(".mp3")).length, 73);
  assert.equal(lungManifest.files.length, lungManifest.fileCount);
  assert.ok(lungManifest.totalBytes < 40 * 1024 * 1024);
  assert.ok(!lungManifest.files.some((item) => /valve-heart/i.test(item.path)));
  assert.ok(!lungCatalog.some((item) => /Patient 02 - Rhonchi|Medical Doctor/i.test(item.title + " " + item.path)));
});

test("Lung pack manifest paths, sizes, and SHA-256 hashes match every packaged file", () => {
  for (const item of lungManifest.files) {
    const path = resolve(lungRoot, item.path);
    assert.equal(statSync(path).size, item.bytes, "size mismatch: " + item.path);
    const digest = createHash("sha256").update(readFileSync(path)).digest("hex");
    assert.equal(digest, item.sha256, "SHA-256 mismatch: " + item.path);
  }
  const listed = new Set(lungManifest.files.map((item) => item.path));
  assert.ok(lungCatalog.every((item) => listed.has("audio-library/" + item.path)));
  assert.ok((lungManifest.assembledFiles ?? []).some((item) => item.path === "assets/models/thorax.bin"));
  assertAssembledFilesMatch(lungRoot, lungManifest);
  assert.ok(listed.has("assets/models/thorax.json"));
});

test("Android pack manager uses the published main content feed and validates both independent packs", () => {
  assert.match(manager, /shbace-auscultation/);
  assert.ok(gitAttributes.includes('"for ApK/android-content/auscultation/**" -text'), "pack files must preserve exact bytes in Git");
  assert.match(manager, /main\/for%20ApK\/android-content\/auscultation/);
  assert.doesNotMatch(manager, /feat\/medara-auscultation-library-20261126/);
  assert.match(manager, /auscultation-" \+ system/);
  assert.match(manager, /MAX_TOTAL_BYTES/);
  assert.match(manager, /MAX_READ_CHUNK_BYTES/);
  assert.match(manager, /SHA-256 or byte-count verification failed/);
  assert.ok(manager.indexOf("assembleChunkedFiles(staging, manifest);") < manager.indexOf("verifyStagedPackage(system, staging, manifest);"), "chunk assembly must happen before staged verification");
  assert.match(manager, /uniqueSoundCount.*77|77.*uniqueSoundCount/);
  assert.match(manager, /uniqueSoundCount.*31|31.*uniqueSoundCount/);
  assert.match(manager, /audioFileCount.*73|73.*audioFileCount/);
  assert.match(manager, /Distinct sound title count does not match/);
  assert.match(manager, /expectedAudioFiles/);
  assert.match(manager, /safeChild/);
  assert.equal((manager.match(/findPackageFile\(manifest, relativePath\)/g) || []).length, 2,
    "both metadata and byte reads must resolve assembled model files");
  assert.match(manager, /private static JSONObject findPackageFile/);
  assert.match(manager, /manifest\.optJSONArray\("assembledFiles"\)/);
  assert.match(manager, /current-manifest\.json/);
});

test("Native bridge exposes bounded chunk reads and independent package state/download methods", () => {
  for (const method of [
    "getAuscultationPackState",
    "startAuscultationPackDownload",
    "getAuscultationFileSize",
    "readAuscultationFileBase64Chunk"
  ]) {
    assert.match(native, new RegExp("@JavascriptInterface\\s+public [^\\n]+\\b" + method + "\\s*\\("));
  }
});

test("Heart and Lung adapters read separate private packs in bounded chunks", () => {
  for (const [system, assets] of [["heart", heartAssets], ["lung", lungAssets]]) {
    assert.match(assets, /CHUNK_BYTES = 256 \* 1024/);
    assert.match(assets, /readAuscultationFileBase64Chunk/);
    assert.match(assets, /getAuscultationFileSize/);
    assert.match(assets, /assets\/models\//);
    assert.match(assets, new RegExp("getAuscultationFileSize\\('" + system + "'"));
    assert.match(assets, new RegExp("readAuscultationFileBase64Chunk\\('" + system + "'"));
    assert.match(assets, /__shbAuscultationFetch/);
  }
  assert.match(heartAssets, /audio-library\/Cardiac Auscultation\//);
  assert.match(lungAssets, /audio-library\//);
  assert.match(lungAssets, /\/js\/auscultation\/lung\//);
});

test("Heart and Lung catalogue is read from the installed pack before bundled fallback", async () => {
  assert.ok(heartManifest.files.some((file) => file.path === "audio-catalog.json"));
  assert.ok(lungManifest.files.some((file) => file.path === "audio-catalog.json"));
  for (const [system, assets, runtime] of [
    ["heart", heartAssets, heartRuntime],
    ["lung", lungAssets, lungRuntime]
  ]) {
    const catalogueBytes = Buffer.from(JSON.stringify([
      { system, title: "Pack catalogue test", path: "test.mp3" }
    ]), "utf8");
    const bridgeCalls = [];
    const context = {
      window: {
        ShbaceNative: {
          getAuscultationFileSize(requestedSystem, path) {
            bridgeCalls.push(["size", requestedSystem, path]);
            return requestedSystem === system && path === "audio-catalog.json"
              ? catalogueBytes.length : -1;
          },
          readAuscultationFileBase64Chunk(requestedSystem, path, offset, length) {
            bridgeCalls.push(["read", requestedSystem, path, offset, length]);
            return catalogueBytes.subarray(offset, offset + length).toString("base64");
          }
        }
      },
      document: { baseURI: "file:///android_asset/public/index.html" },
      URL,
      Uint8Array,
      Response,
      DOMException,
      atob,
      fetch: async () => { throw new Error("Unexpected bundled fallback fetch"); }
    };
    vm.runInNewContext(assets, context);
    const catalogueUrl = new URL(
      "audio-catalog.json",
      "file:///android_asset/public/js/auscultation/" + system + "/auscultation-pro.js"
    );
    assert.equal(
      context.window.__shbAuscultationAssets.resolvePath(catalogueUrl),
      "audio-catalog.json",
      system + " adapter must allow the package catalogue path"
    );
    const response = await context.window.__shbAuscultationFetch(catalogueUrl, { cache: "no-store" });
    assert.equal(response.status, 200);
    const parsed = await response.json();
    assert.equal(parsed[0].system, system);
    assert.ok(bridgeCalls.some((call) =>
      call[0] === "size" && call[1] === system && call[2] === "audio-catalog.json"
    ));
    assert.ok(bridgeCalls.some((call) =>
      call[0] === "read" && call[1] === system && call[2] === "audio-catalog.json"
    ));
    assert.match(runtime, /window\.__shbAuscultationFetch/);
    assert.match(runtime, /packFetch\(catalogUrl/);
    assert.match(runtime, /if\(!response\)/);
    assert.match(runtime, /fetch\(catalogUrl,\{cache:'no-store'\}\)/);
    assert.match(runtime, /installed pack:/);
    assert.match(runtime, /bundled copy:/);
    assert.match(runtime, /3D anatomy unavailable/);
  }
});

test("Heart and Lung render natively inside Shbace without a Medara page iframe", () => {
  assert.match(page, /isNativeAndroid\(\)/);
  assert.match(page, /ROUTES = \{ heart:'auscultationheart', lung:'auscultationlung' \}/);
  assert.match(page, /startAuscultationPackDownload\(system\)/);
  assert.match(page, /__shbRegisterPage\(ROUTES\.heart/);
  assert.match(page, /__shbRegisterPage\(ROUTES\.lung/);
  assert.match(page, /data-shb-ausc-host/);
  assert.match(page, /attachShadow\(\{ mode: 'open' \}\)/);
  assert.match(page, /mountAuscultation\(root, system\)/);
  assert.match(page, /native-assets\.js/);
  assert.doesNotMatch(page, /<iframe|pack-frame/);
  assert.match(page, /77 primary heart sounds/);
  assert.match(page, /31 distinct lung sounds/);
  for (const runtime of [heartRuntime, lungRuntime]) {
    assert.match(runtime, /export function mountAuscultation\(root,systemOverride=/);
    assert.match(runtime, /root\.querySelector/);
    assert.doesNotMatch(runtime, /document\.querySelector|document\.addEventListener|location\.reload|history\.replaceState/);
    assert.match(runtime, /new URL\('audio-catalog\.json',import\.meta\.url\)/);
    assert.match(runtime, /return function dispose\(\)/);
  }
  for (const scene of [heartScene, lungScene]) {
    assert.match(scene, /this\.options\.detailBase\|\|'assets\/models\/valve-heart'/);
    assert.doesNotMatch(scene, /new THREE\.TubeGeometry|updateTube|makeStethoscope/);
  }
  assert.match(integratedCss, /library-workspace[^\n]*border:0!important[^\n]*background:transparent!important/);
  assert.match(integratedCss, /--sa-cyan:#29d8ff/);
  assert.match(integratedCss, /@media\(min-width:900px\)/);
  assert.match(integratedCss, /selected-callout/);
});

test("Sidebar creates and recovers the Heart/Lung entry in the native Android drawer", () => {
  assert.match(drawer, /function drawerIsNativeAndroid/);
  assert.match(drawer, /window\.ShbaceNative/);
  assert.match(drawer, /getAuscultationPackState/);
  assert.match(drawer, /function drawerAuscultationMarkup/);
  assert.match(drawer, /function ensureDrawerAuscultation/);
  assert.match(drawer, /ensureDrawerAuscultation\(d\)/,
    "Native drawer detection must be rechecked for an already-created drawer");
  assert.match(drawer, /brand\.insertAdjacentHTML\('afterend',markup\)/,
    "A stale drawer must recover the missing native entry beneath its brand");
  assert.match(drawer, /data-shb-auscultation-menu/);
  assert.match(drawer, /data-shb-ausc-toggle/);
  assert.match(drawer, /\$\{drawerAuscultationMarkup\(\)\}/,
    "Auscultation markup remains part of the original drawer HTML when native detection is ready");
  assert.match(drawer, /data-shb-ausc-open="heart"/);
  assert.match(drawer, /data-shb-ausc-open="lung"/);
  assert.match(drawer, /data-shb-ausc-download="heart"/);
  assert.match(drawer, /data-shb-ausc-download="lung"/);
  assert.match(drawer, /shb-ausc-total">108 sounds/);
  assert.match(drawer, /shb-ausc-child-count">77/);
  assert.match(drawer, /shb-ausc-child-count">31/);
  assert.match(drawer, /children\.hidden=expanded/);
  assert.doesNotMatch(remoteControl, /installAuscultationDrawerMenu|previousToggleDrawer/,
    "the old post-open injection must not compete with the native drawer");
  assert.match(page, /facts:\[\['77','distinct sounds'\]/);
  assert.match(page, /facts:\[\['31','distinct sounds'\]/);
  assert.doesNotMatch(page, /\['73','recordings'\]/);
  assert.match(page, /data-shb-ausc-download/);
  assert.match(page, /refreshDrawer:refreshDrawerButtons/);
  assert.match(page, /button\.disabled = !!state\.downloading \|\| !!state\.installed/);
});
test("Late-loaded Auscultation script repairs the final Android drawer override", () => {
  assert.match(page, /typeof bridge\.getAuscultationPackState !== 'function'/);
  assert.match(page, /typeof bridge\.startAuscultationPackDownload !== 'function'/);
  assert.match(page, /function drawerAuscultationMarkup\(\)/);
  assert.match(page, /data-shb-auscultation-menu/);
  assert.match(page, /data-shb-ausc-open="heart"/);
  assert.match(page, /data-shb-ausc-open="lung"/);
  assert.match(page, /function ensureAuscultationDrawerEntry\(drawer\)/);
  assert.match(page, /drawer\.querySelector\('\.dr-body'\)/);
  assert.match(page, /body\.insertAdjacentHTML\('afterbegin', drawerAuscultationMarkup\(\)\)/);
  assert.match(page, /function installDrawerToggleRecovery\(\)/);
  assert.match(page, /var previousToggleDrawer = window\.toggleDrawer/);
  assert.match(page, /previousToggleDrawer\.apply\(this, arguments\)/);
  assert.match(page, /window\.toggleDrawer = recoveredToggleDrawer/);
  assert.match(page, /installDrawerToggleRecovery\(\);/);
  assert.match(page, /recoveredToggleDrawer\.__shbAuscultationDrawerRecovery = true/);
});

test("Lung runtime preserves Normal, Slow, half-speed, patient and teaching variants", () => {
  assert.match(lungRuntime, /if\(state\.system==='lung'\)return false/);
  assert.match(lungRuntime, /return 'Half speed'/);
  assert.match(lungRuntime, /return 'Slow speed'/);
  assert.match(lungRuntime, /function buildLungTree/);
});

test("Lung 3D loads the shared thorax but skips the Heart-only valve model", () => {
  assert.match(lungScene, /base:this\.options\.base\|\|'assets\/models\/thorax'/);
  assert.match(lungScene, /if\(this\.system==='heart'\)\s*\{/);
  assert.match(lungScene, /base:this\.options\.detailBase\|\|'assets\/models\/valve-heart'/);
});
