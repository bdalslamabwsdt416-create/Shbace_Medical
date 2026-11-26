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
const drawer = readFileSync(resolve(root, "js/47-android-remote-control.js"), "utf8");
const heartAssets = readFileSync(resolve(root, "js/auscultation/heart/native-assets.js"), "utf8");
const lungAssets = readFileSync(resolve(root, "js/auscultation/lung/native-assets.js"), "utf8");
const heartHtml = readFileSync(resolve(root, "js/auscultation/heart/index.html"), "utf8");
const lungHtml = readFileSync(resolve(root, "js/auscultation/lung/index.html"), "utf8");
const lungRuntime = readFileSync(resolve(root, "js/auscultation/lung/auscultation-pro.js"), "utf8");
const lungScene = readFileSync(resolve(root, "js/auscultation/lung/scene.js"), "utf8");

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

test("Android pack manager uses the published feature branch and validates both independent packs", () => {
  assert.match(manager, /shbace-auscultation/);
  assert.ok(gitAttributes.includes('"for ApK/android-content/auscultation/**" -text'), "pack files must preserve exact bytes in Git");
  assert.match(manager, /feat\/medara-auscultation-library-20261126\/for%20ApK\/android-content\/auscultation/);
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

test("Heart and Lung pages are independent Android routes with their own counts and models", () => {
  assert.match(page, /isNativeAndroid\(\)/);
  assert.match(page, /ROUTES = \{ heart:'auscultationheart', lung:'auscultationlung' \}/);
  assert.match(page, /startAuscultationPackDownload\(system\)/);
  assert.match(page, /js\/auscultation\/' \+ system \+ '\/index\.html\?system='/);
  assert.match(page, /__shbRegisterPage\(ROUTES\.heart/);
  assert.match(page, /__shbRegisterPage\(ROUTES\.lung/);
  assert.match(page, /unique heart sounds|77 primary heart sounds/);
  assert.match(page, /31 distinct lung sounds/);
  assert.match(heartHtml, /77 primary heart sounds/);
  assert.match(lungHtml, /Lung Auscultation/);
  assert.match(lungHtml, /31 distinct lung sounds/);
  assert.match(lungHtml, /lung-only\.css/);
  assert.match(heartHtml, /native-assets\.js/);
  assert.match(lungHtml, /native-assets\.js/);
});

test("Sidebar exposes separate working Heart and Lung download arrows", () => {
  assert.match(drawer, /data-shb-ausc-download="heart"/);
  assert.match(drawer, /data-shb-ausc-download="lung"/);
  assert.match(page, /data-shb-ausc-download/);
  assert.match(page, /refreshDrawer:refreshDrawerButtons/);
  assert.match(page, /button\.disabled = !!state\.downloading \|\| !!state\.installed/);
  assert.match(drawer, /packUI\.refreshDrawer\(\)/);
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
  assert.match(lungScene, /base:'assets\/models\/valve-heart'/);
});
