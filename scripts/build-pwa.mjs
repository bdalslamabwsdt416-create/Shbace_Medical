import {
  cpSync,
  copyFileSync,
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
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
  "data/qbData.json"
];
const requiredDirs = ["css", "js", "data"];
const imageDirs = ["img", "img1", "img2"];

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
JSON.parse(readFileSync(join(root, "data/qbData.json"), "utf8"));

rmSync(output, { recursive: true, force: true });
mkdirSync(output, { recursive: true });

for (const file of ["index.html", "manifest.webmanifest", "sw.js"]) {
  copyFileSync(join(root, file), join(output, file));
}
for (const dir of requiredDirs) {
  cpSync(join(root, dir), join(output, dir), { recursive: true });
}

const imageOutput = join(output, "assets", "img");
mkdirSync(imageOutput, { recursive: true });
const copiedImages = new Set();
for (const dir of imageDirs) {
  const sourceDir = join(root, dir);
  if (!existsSync(sourceDir)) continue;
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
if (!html.includes("navigator.serviceWorker.register('./sw.js'")) {
  fail("index.html does not register ./sw.js");
}

const scanFiles = [
  join(output, "index.html"),
  ...["css", "js"].flatMap(dir =>
    readdirSync(join(output, dir))
      .filter(name => name.endsWith(".css") || name.endsWith(".js"))
      .map(name => join(output, dir, name))
  )
];
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

const imageBytes = [...copiedImages].reduce((total, name) => total + statSync(join(imageOutput, name)).size, 0);
console.log("PWA build successful");
console.log(`Output: ${relative(root, output)}`);
console.log(`Images copied: ${copiedImages.size} (${(imageBytes / 1024 / 1024).toFixed(2)} MiB)`);
console.log(`Image references verified: ${referencedAssets.size}`);
console.log(`Deferred scripts verified: ${scriptRefs.length}`);
console.log(`Question bank: ${(statSync(join(output, "data/qbData.json")).size / 1024 / 1024).toFixed(2)} MiB`);
