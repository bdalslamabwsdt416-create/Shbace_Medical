import { createHash } from "node:crypto";
import {
  cpSync,
  copyFileSync,
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  writeFileSync,
  rmSync,
  statSync
} from "node:fs";
import { join, relative } from "node:path";

const root = process.cwd();
const output = join(root, "www");
const requiredFiles = [
  "index.html",
  "manifest.webmanifest",
  "sw.js",
  "css/core.css",
  "css/late.css",
  "data/qbData.json",
  "data/qbData_reviewed_patch.json",
  "data/qbData_review_log.json",
  "data/audit/Question_Review_Log_1718.csv",
  "data/audit/Question_Review_Log_636.csv",
  "data/audit/Reviewed_Copy_Status.json",
  "js/29-reviewed-bank-controls.js",
  "pwa-version.json",
  "js/29-offline-setup.js"
];
const requiredDirs = ["css", "js", "data"];
const imageDirs = ["img", "img1", "img2"];
const optionalDirs = ["fonts", "audio", "media", "videos", "documents"];

function fail(message) {
  console.error(`PWA BUILD ERROR: ${message}`);
  process.exit(1);
}

for (const file of requiredFiles) {
  const fullPath = join(root, file);
  if (!existsSync(fullPath) || !statSync(fullPath).isFile() || statSync(fullPath).size === 0) {
    fail(`Required source file is missing or empty: ${file}`);
  }
}
for (const dir of requiredDirs) {
  if (!existsSync(join(root, dir)) || !statSync(join(root, dir)).isDirectory()) {
    fail(`Required source directory is missing: ${dir}`);
  }
}

const manifest = JSON.parse(readFileSync(join(root, "manifest.webmanifest"), "utf8"));
if (!manifest.start_url || !manifest.scope || !Array.isArray(manifest.icons) || !manifest.icons.length) {
  fail("manifest.webmanifest is missing start_url, scope, or icons");
}
const baseBank = JSON.parse(readFileSync(join(root, "data/qbData.json"), "utf8"));
const reviewedPatch = JSON.parse(readFileSync(join(root, "data/qbData_reviewed_patch.json"), "utf8"));
const reviewLog = JSON.parse(readFileSync(join(root, "data/qbData_review_log.json"), "utf8"));
const reviewStatus = JSON.parse(readFileSync(join(root, "data/audit/Reviewed_Copy_Status.json"), "utf8"));
if (!Array.isArray(baseBank.questions) || baseBank.questions.length !== 1718) {
  fail("Original question bank must remain the 1,718-question base");
}
if (reviewedPatch.schema !== "shbace-question-bank-patch-v1" ||
    reviewedPatch.baseFile !== "qbData.json" ||
    reviewedPatch.baseQuestionCount !== baseBank.questions.length ||
    reviewedPatch.changedCount !== 45 ||
    reviewedPatch.addedCount !== 0 ||
    !Array.isArray(reviewedPatch.questions) ||
    reviewedPatch.questions.length !== 45) {
  fail("Reviewed patch metadata/count is invalid; expected 45 corrections over the unchanged 1,718-question base");
}
if (reviewStatus.totalQuestions !== 1718 ||
    reviewStatus.questionRecordsModified !== 47 ||
    reviewStatus.questionContentEdits !== 45 ||
    reviewStatus.reviewNotesAddedWithoutChangingExamKey !== 2 ||
    reviewStatus.needsReviewTotal !== 110 ||
    reviewStatus.originalFileModified !== false) {
  fail("Review status mismatch: expected 47 audit records = 45 content edits + 2 review-only notes");
}
function parseCsvRows(source) {
  const rows = []; let row = [], value = "", quoted = false;
  for (let i = 0; i < source.length; i++) {
    const ch = source[i];
    if (quoted) {
      if (ch === '"' && source[i + 1] === '"') { value += '"'; i++; }
      else if (ch === '"') quoted = false;
      else value += ch;
    } else if (ch === '"') quoted = true;
    else if (ch === ',') { row.push(value); value = ""; }
    else if (ch === '\n') { row.push(value.replace(/\r$/, "")); rows.push(row); row = []; value = ""; }
    else value += ch;
  }
  if (value.length || row.length) { row.push(value.replace(/\r$/, "")); rows.push(row); }
  const headers = rows.shift() || [];
  return rows.map(cells => Object.fromEntries(headers.map((h, i) => [h, cells[i] || ""])));
}
const auditRows = parseCsvRows(readFileSync(join(root, "data/audit/Question_Review_Log_1718.csv"), "utf8"));
const changedIds = new Set(auditRows.filter(row => row.Status === "changed").map(row => row["Question ID"]));
const needsReviewIds = new Set(auditRows.filter(row => row.Status === "needs_review").map(row => row["Question ID"]));
const patchIds = reviewedPatch.questions.map(q => q && q.id);
if (auditRows.length !== 1718 || changedIds.size !== 45 ||
    patchIds.some(id => !id) || new Set(patchIds).size !== 45 ||
    patchIds.some(id => !changedIds.has(id)) ||
    [...changedIds].some(id => !patchIds.includes(id)) ||
    patchIds.some(id => needsReviewIds.has(id))) {
  fail("Patch IDs must exactly match the 45 changed audit rows; Needs Review items must stay outside the patch");
}
if (reviewLog && Array.isArray(reviewLog.entries)) {
  const logChanged = reviewLog.entries.filter(entry => entry && entry.status === "changed").length;
  const logNeedsReview = reviewLog.entries.filter(entry => entry && entry.status === "needs_review").length;
  if (logChanged !== 45 || logNeedsReview !== 110) fail("Question review JSON counts do not match the master audit");
}
const pwaVersion = JSON.parse(readFileSync(join(root, "pwa-version.json"), "utf8"));
if (pwaVersion.platform !== "Chrome Android PWA" || pwaVersion.version !== "1.3.4-chrome.3") {
  fail("pwa-version.json must declare Chrome Android PWA version 1.3.4-chrome.3");
}

rmSync(output, { recursive: true, force: true });
mkdirSync(output, { recursive: true });

for (const file of ["index.html", "manifest.webmanifest", "sw.js", "pwa-version.json"]) {
  copyFileSync(join(root, file), join(output, file));
}
for (const dir of requiredDirs) {
  cpSync(join(root, dir), join(output, dir), { recursive: true });
}

for (const dir of optionalDirs) {
  const source = join(root, dir);
  if (existsSync(source) && statSync(source).isDirectory()) {
    cpSync(source, join(output, dir), { recursive: true });
  }
}

const assetsSource = join(root, "assets");
if (!existsSync(assetsSource) || !statSync(assetsSource).isDirectory()) {
  fail("The source assets directory is missing");
}
cpSync(assetsSource, join(output, "assets"), { recursive: true });
const imageOutput = join(output, "assets", "img");
if (!existsSync(imageOutput) || !statSync(imageOutput).isDirectory()) {
  fail("The source assets/img directory is missing");
}
const existing512Icon = join(root, "branding", "play-store-icon-512.png");
if (!existsSync(existing512Icon) || !statSync(existing512Icon).isFile()) {
  fail("The existing 512px SHBACE brand icon is missing");
}
copyFileSync(existing512Icon, join(imageOutput, "shbace-pwa-512.png"));
const copiedImages = new Set(
  readdirSync(imageOutput).filter(name => statSync(join(imageOutput, name)).isFile() &&
    /\.(?:png|jpe?g|webp|gif|svg)$/i.test(name))
);
for (const dir of imageDirs) {
  const sourceDir = join(root, dir);
  if (!existsSync(sourceDir) || !statSync(sourceDir).isDirectory()) continue;
  for (const name of readdirSync(sourceDir)) {
    const source = join(sourceDir, name);
    if (!statSync(source).isFile()) continue;
    if (copiedImages.has(name)) fail(`Duplicate image filename across image folders: ${name}`);
    copiedImages.add(name);
    copyFileSync(source, join(imageOutput, name));
  }
}
if (!copiedImages.has("fc0bef7cd7ca.png")) {
  fail("The app icon assets/img/fc0bef7cd7ca.png was not staged");
}

for (const icon of manifest.icons) {
  const iconPath = join(output, String(icon.src).replace(/^\.\//, ""));
  if (!existsSync(iconPath)) fail(`Manifest icon does not exist in the PWA output: ${icon.src}`);
}

const html = readFileSync(join(output, "index.html"), "utf8");
if (!html.includes("navigator.serviceWorker.register('./sw.js'") || !html.includes("js/29-offline-setup.js") || !html.includes("js/29-reviewed-bank-controls.js") || !html.includes("qbData_reviewed_patch.json")) {
  fail("index.html does not register ./sw.js");
}

function listOutputFiles(dir) {
  const found = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) found.push(...listOutputFiles(full));
    else if (entry.isFile()) found.push(full);
  }
  return found;
}

const scanFiles = listOutputFiles(output).filter(file => /\.(?:html|css|js|json|webmanifest)$/i.test(file));
const missingAssets = new Set();
const referencedAssets = new Set();
for (const file of scanFiles) {
  const content = readFileSync(file, "utf8");
  for (const match of content.matchAll(/\/?assets\/img\/([^"'()\s?#]+)/g)) {
    const name = match[1];
    referencedAssets.add(name);
    if (!existsSync(join(imageOutput, name))) missingAssets.add(name);
  }
}
if (missingAssets.size) {
  fail(`Missing referenced image assets: ${[...missingAssets].join(", ")}`);
}

const scriptRefs = [...html.matchAll(/data-src=["']([^"']+\.js)["']/g)].map(m => m[1]);
for (const script of scriptRefs) {
  if (!existsSync(join(output, script))) fail(`Deferred application script is missing: ${script}`);
}
if (!existsSync(join(output, "data/qbData.json"))) fail("Question bank JSON was not copied");

const inventoryFiles = listOutputFiles(output)
  .map(full => ({
    path: relative(output, full).replace(/\\/g, "/"),
    full
  }))
  .filter(file => file.path !== "offline-assets-manifest.json")
  .sort((a, b) => a.path.localeCompare(b.path));

const offlineFiles = inventoryFiles.map(file => {
  const bytes = readFileSync(file.full);
  const path = file.path;
  const group = path.startsWith("assets/img/") ? "images" :
    path.startsWith("data/") ? "data" :
    (path.startsWith("css/") || path.startsWith("js/") ||
     path === "index.html" || path === "manifest.webmanifest" || path === "sw.js") ? "app" : "other";
  return {
    path,
    bytes: bytes.byteLength,
    sha256: createHash("sha256").update(bytes).digest("hex"),
    group
  };
});
const offlineVersion = createHash("sha256")
  .update(offlineFiles.map(file => file.path + ":" + file.sha256).join("\n"))
  .digest("hex");
const offlineManifest = {
  schema: 1,
  version: offlineVersion,
  generatedAt: new Date().toISOString(),
  fileCount: offlineFiles.length,
  totalBytes: offlineFiles.reduce((sum, file) => sum + file.bytes, 0),
  files: offlineFiles
};
writeFileSync(join(output, "offline-assets-manifest.json"), JSON.stringify(offlineManifest, null, 2));
const writtenManifest = JSON.parse(readFileSync(join(output, "offline-assets-manifest.json"), "utf8"));
if (writtenManifest.files.length !== offlineFiles.length ||
    writtenManifest.totalBytes !== offlineManifest.totalBytes ||
    writtenManifest.version !== offlineVersion) {
  fail("Generated offline asset manifest did not pass its self-check");
}

const externalPatterns = [
  /<(?:script|link|img|audio|video|source)\b[^>]*(?:src|href)\s*=\s*["']https?:\/\//gi,
  /@import\s+(?:url\(\s*)?["']?https?:\/\//gi,
  /url\(\s*["']?https?:\/\//gi,
  /\bfetch\s*\(\s*["']https?:\/\//gi,
  /\b(?:new\s+)?(?:Worker|SharedWorker)\s*\(\s*["']https?:\/\//gi,
  /\bimportScripts\s*\(\s*["']https?:\/\//gi
];
const externalReferences = [];
for (const file of scanFiles) {
  const source = readFileSync(file, "utf8");
  for (const pattern of externalPatterns) {
    pattern.lastIndex = 0;
    for (const match of source.matchAll(pattern)) {
      externalReferences.push(relative(output, file) + ": " + match[0].slice(0, 180));
      if (externalReferences.length >= 100) break;
    }
    if (externalReferences.length >= 100) break;
  }
  if (externalReferences.length >= 100) break;
}

const imageBytes = [...copiedImages].reduce((total, name) => total + statSync(join(imageOutput, name)).size, 0);
console.log("PWA build successful");
console.log("PWA release: " + pwaVersion.displayVersion + " (" + pwaVersion.version + ")");
console.log(`Output: ${relative(root, output)}`);
console.log(`Images copied: ${copiedImages.size} (${(imageBytes / 1024 / 1024).toFixed(2)} MiB)`);
console.log(`Image references verified: ${referencedAssets.size}`);
console.log(`Deferred scripts verified: ${scriptRefs.length}`);
console.log(`Question bank: ${(statSync(join(output, "data/qbData.json")).size / 1024 / 1024).toFixed(2)} MiB`);
console.log("Offline inventory: " + offlineManifest.fileCount + " files (" + (offlineManifest.totalBytes / 1024 / 1024).toFixed(2) + " MiB)");
console.log("Offline manifest version: " + offlineVersion.slice(0, 16));
console.log("External runtime references for manual review: " + externalReferences.length);
externalReferences.slice(0, 20).forEach(item => console.log("  REVIEW: " + item));
