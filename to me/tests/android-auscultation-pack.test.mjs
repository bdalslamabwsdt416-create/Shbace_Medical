import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { dirname } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";
import vm from "node:vm";

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, "..");
const packRoot = resolve(root, "../for ApK/android-content/auscultation/heart");
const manifest = JSON.parse(readFileSync(resolve(packRoot, "manifest.json"), "utf8"));
const catalog = JSON.parse(readFileSync(resolve(packRoot, "audio-catalog.json"), "utf8"));
const audit = JSON.parse(readFileSync(resolve(packRoot, "audit.json"), "utf8"));
const manager = readFileSync(resolve(root, "../for ApK/native/com/shbace/medical/AuscultationPackManager.java"), "utf8");
const native = readFileSync(resolve(root, "../android/app/src/main/java/com/shbace/medical/ShbaceNative.java"), "utf8");
const assets = readFileSync(resolve(root, "js/auscultation/heart/native-assets.js"), "utf8");
const page = readFileSync(resolve(root, "js/55-android-auscultation-library.js"), "utf8");
const drawer = readFileSync(resolve(root, "js/47-android-remote-control.js"), "utf8");
const html = readFileSync(resolve(root, "js/auscultation/heart/index.html"), "utf8");

test("Heart package contains exactly 77 distinct sounds and 77 primary MP3 files", () => {
  assert.equal(manifest.packageId, "auscultation-heart");
  assert.equal(manifest.system, "heart");
  assert.equal(manifest.uniqueSoundCount, 77);
  assert.equal(manifest.audioFileCount, 77);
  assert.equal(manifest.excludedDuplicateVariants, 57);
  assert.equal(catalog.length, 77);
  assert.equal(new Set(catalog.map((item) => item.title)).size, 77);
  assert.ok(catalog.every((item) => item.system === "heart"));
  assert.equal(manifest.files.filter((item) => item.path.toLowerCase().endsWith(".mp3")).length, 77);
  assert.equal(audit.selectedAudioFileCount, 77);
  assert.equal(audit.excludedDuplicateVariantCount, 57);
  assert.equal(audit.missingAudioFiles, 0);
});

test("Heart package retains the exact cardiac audio paths and required 3D model dependencies", () => {
  const paths = new Set(manifest.files.map((item) => item.path));
  assert.ok(catalog.every((item) => paths.has("audio-library/" + item.path)));
  for (const model of [
    "assets/models/thorax.bin",
    "assets/models/thorax.json",
    "assets/models/valve-heart.bin",
    "assets/models/valve-heart.json"
  ]) assert.ok(paths.has(model), "missing required model: " + model);
  assert.equal(manifest.files.filter((item) => /Respiratory Auscultation|lung/i.test(item.path)).length, 0);
  assert.equal(audit.excludedSystems.includes("lung"), true);
});

test("Android pack manager verifies separate package identity, limits, SHA-256 and exact 77-heart count", () => {
  assert.match(manager, /shbace-auscultation/);
  assert.match(manager, /auscultation-" \+ system/);
  assert.match(manager, /MAX_TOTAL_BYTES/);
  assert.match(manager, /MAX_READ_CHUNK_BYTES/);
  assert.match(manager, /SHA-256 or byte-count verification failed/);
  assert.match(manager, /uniqueSoundCount.*77|77.*uniqueSoundCount/);
  assert.match(manager, /safeChild/);
  assert.match(manager, /current-manifest\.json/);
});

test("Native bridge exposes bounded chunk reads and independent package download state", () => {
  for (const method of [
    "getAuscultationPackState",
    "startAuscultationPackDownload",
    "getAuscultationFileSize",
    "readAuscultationFileBase64Chunk"
  ]) {
    assert.match(native, new RegExp("@JavascriptInterface\\s+public [^\\n]+\\b" + method + "\\s*\\("));
  }
});

test("Heart media adapter reads private package files in bounded chunks, not from the APK bundle", () => {
  assert.match(assets, /CHUNK_BYTES = 256 \* 1024/);
  assert.match(assets, /readAuscultationFileBase64Chunk/);
  assert.match(assets, /getAuscultationFileSize/);
  assert.match(assets, /assets\/models\//);
  assert.match(assets, /audio-library\/Cardiac Auscultation\//);
  assert.match(assets, /__shbAuscultationFetch/);
});

test("Heart route is Android-only and opens the library only after its package is verified installed", () => {
  assert.match(page, /isNativeAndroid\(\)/);
  assert.match(page, /state\.installed/);
  assert.match(page, /js\/auscultation\/heart\/index\.html\?system=heart/);
  assert.match(page, /startAuscultationPackDownload\('heart'\)/);
  assert.match(drawer, /isAuscultationApk\(\)/);
  assert.match(drawer, /data-shb-ausc-download="heart"/);
  assert.match(html, /native-assets\.js/);
  assert.match(html, /three\.module\.js/);
  assert.doesNotMatch(html, /data-system="lung"[\\s\\S]*?aria-current="page"/);
});

test("Heart route updates Shbace's lexical appPage binding and restores the correct page on pack progress", () => {
  assert.match(page, /function currentPage\(\)/);
  assert.match(page, /function setCurrentPage\(route\)/);
  assert.match(page, /appPage = route/);
  assert.match(page, /currentPage\(\) === HEART_ROUTE/);
  assert.match(page, /__shbRegisterPage\(HEART_ROUTE, renderHeartPage, 'subjects'\)/);
});

test("Heart download arrow refreshes its installed/downloading state whenever the Android drawer opens", () => {
  assert.match(page, /refreshDrawer:refreshDrawerButton/);
  assert.match(drawer, /packUI\.refreshDrawer\(\)/);
  assert.match(drawer, /data-shb-ausc-download="heart"/);
  assert.match(page, /button\.disabled = !!state\.downloading \|\| !!state\.installed/);
});

test("Heart asset path resolver supports the catalogue's non-ASCII cardiac filename", () => {
  const record = catalog.find((item) => /[^\\x00-\\x7f]/.test(item.path));
  assert.ok(record, "the source catalogue contains a non-ASCII audio filename");
  const sandbox = {
    window: { ShbaceNative: {} },
    document: { baseURI: "https://appassets.androidplatform.net/js/auscultation/heart/index.html" },
    URL
  };
  vm.runInNewContext(assets, sandbox);
  const resolver = sandbox.window.__shbAuscultationAssets.resolvePath;
  const encoded = record.path.split("/").map(encodeURIComponent).join("/");
  const url = "https://appassets.androidplatform.net/js/auscultation/heart/audio-library/" + encoded;
  assert.equal(resolver(url), "audio-library/" + record.path);
  for (const item of catalog) {
    const safePath = item.path.split("/").map(encodeURIComponent).join("/");
    const assetUrl = "https://appassets.androidplatform.net/js/auscultation/heart/audio-library/" + safePath;
    assert.equal(resolver(assetUrl), "audio-library/" + item.path, "path resolver rejected " + item.path);
  }
  assert.equal(resolver("https://appassets.androidplatform.net/js/auscultation/heart/assets/models/thorax.bin"),
    "assets/models/thorax.bin");
});
