'use strict';

const fs = require('fs');
const path = require('path');
const zlib = require('zlib');
const crypto = require('crypto');
const vm = require('vm');
const sharp = require('sharp');

const root = path.resolve(__dirname, '..');
const out = path.join(root, 'dist');
const manifest = { schema: 1, files: [] };

function safePath(relative) {
  if (typeof relative !== 'string' || relative.startsWith('/') || relative.split(/[\\/]/).includes('..')) {
    throw new Error('Unsafe asset path in offline manifest: ' + relative);
  }
  return path.join(out, relative);
}

function walkRuntimeDirectory(directory, output) {
  const fullDirectory = path.join(root, directory);
  if (!fs.existsSync(fullDirectory)) return;
  for (const entry of fs.readdirSync(fullDirectory, { withFileTypes: true })) {
    const relative = path.posix.join(directory, entry.name);
    if (entry.isDirectory()) walkRuntimeDirectory(relative, output);
    else if (entry.isFile()) output.push(relative);
  }
}
function runtimeFiles() {
  const files = ['index.html', 'manifest.webmanifest', 'pwa-version.json', 'sw.js', 'js/54-usage-analytics.js'];
  for (const directory of ['assets', 'css', 'data', 'js', 'fonts', 'audio', 'media', 'videos', 'documents', 'img', 'img1', 'img2']) {
    walkRuntimeDirectory(directory, files);
  }
  return [...new Set(files)].filter(relative => relative !== 'offline-assets-manifest.json' && !['css/ios-v5.css','css/ios-v6.css','css/ios-v7.css','js/30-ios-v5.js','js/31-ios-v6.js'].includes(relative)).sort((a, b) => a.localeCompare(b));
}

fs.rmSync(out, { recursive: true, force: true });
fs.mkdirSync(out, { recursive: true });

async function toInlineWebp(sourcePath, mode) {
  if (!fs.existsSync(sourcePath) || !fs.statSync(sourcePath).isFile()) {
    throw new Error('Required To Me Pediatrics image source is missing: ' + sourcePath);
  }
  let pipeline = sharp(sourcePath).rotate();
  if (mode === 'cover') {
    pipeline = pipeline.resize(256, 256, { fit: 'cover', position: 'attention', withoutEnlargement: true });
  } else {
    pipeline = pipeline.resize(256, 256, {
      fit: 'contain', withoutEnlargement: true,
      background: { r: 5, g: 16, b: 35, alpha: 0 }
    });
  }
  const buffer = await pipeline.webp({ quality: 82, effort: 5, alphaQuality: 85 }).toBuffer();
  console.log('Pediatrics image embedded: ' + path.basename(sourcePath) + ' (' + buffer.byteLength + ' bytes).');
  return 'data:image/webp;base64,' + buffer.toString('base64');
}

async function buildPwa() {
  const [ajPortraitData, facultyLogoData] = await Promise.all([
    toInlineWebp(path.join(root, 'scripts/source-assets/pediatrics-dr-aljoaki-source.png'), 'cover'),
    toInlineWebp(path.join(root, 'scripts/source-assets/faculty-of-medicine-tripoli-source.png'), 'contain')
  ]);

  for (const relative of runtimeFiles()) {
    /* Consume the canonical To Me analytics client; do not maintain a fork in this PWA. */
    const sourcePath = relative === 'js/54-usage-analytics.js'
      ? path.resolve(root, '../to me/js/54-usage-analytics.js')
      : path.join(root, relative);
    if (!fs.existsSync(sourcePath)) throw new Error('Required shared analytics client is missing: ' + sourcePath);
    const originalBytes = fs.readFileSync(sourcePath);
    let bytes = originalBytes;

    if (relative === 'index.html') {
      let html = bytes.toString('utf8');
      const ajSlot = 'window.__SHBACE_AJ_PORTRAIT_DATA__="__SHBACE_AJ_PORTRAIT_DATA__";';
      const facultySlot = 'window.__SHBACE_FACULTY_LOGO_DATA__="__SHBACE_FACULTY_LOGO_DATA__";';
      const analyticsApiSlot = 'window.SHBACE_ANALYTICS_API_BASE_URL="__SHBACE_ANALYTICS_API_BASE_URL__";';
      if (!html.includes(ajSlot) || !html.includes(facultySlot) || !html.includes(analyticsApiSlot)) {
        throw new Error('A required Pediatrics or analytics API configuration slot is missing from index.html.');
      }
      html = html.replace(ajSlot, 'window.__SHBACE_AJ_PORTRAIT_DATA__=' + JSON.stringify(ajPortraitData) + ';');
      html = html.replace(facultySlot, 'window.__SHBACE_FACULTY_LOGO_DATA__=' + JSON.stringify(facultyLogoData) + ';');
      const configuredAnalyticsOrigin = String(process.env.SHBACE_ANALYTICS_API_BASE_URL || '').trim();
      let analyticsOrigin = '';
      if (configuredAnalyticsOrigin) {
        const parsedAnalyticsOrigin = new URL(configuredAnalyticsOrigin);
        if (parsedAnalyticsOrigin.protocol !== 'https:' || parsedAnalyticsOrigin.username || parsedAnalyticsOrigin.password ||
            parsedAnalyticsOrigin.pathname !== '/' || parsedAnalyticsOrigin.search || parsedAnalyticsOrigin.hash) {
          throw new Error('SHBACE_ANALYTICS_API_BASE_URL must be an HTTPS origin without credentials, path, query or fragment.');
        }
        analyticsOrigin = parsedAnalyticsOrigin.origin;
      }
      html = html.replace(analyticsApiSlot, 'window.SHBACE_ANALYTICS_API_BASE_URL=' + JSON.stringify(analyticsOrigin) + ';');
      bytes = Buffer.from(html, 'utf8');
    }

    const digest = crypto.createHash('sha256').update(bytes).digest('hex');
    if (relative.endsWith('.js')) new vm.Script(bytes.toString('utf8'), { filename: relative });

    const destination = safePath(relative);
    fs.mkdirSync(path.dirname(destination), { recursive: true });
    fs.writeFileSync(destination, bytes);
    const group = relative.startsWith('assets/img/') ? 'images' :
      relative.startsWith('data/') ? 'data' :
      (relative.startsWith('css/') || relative.startsWith('js/') ||
       relative === 'index.html' || relative === 'manifest.webmanifest' ||
       relative === 'sw.js') ? 'app' : 'other';
    manifest.files.push({ path: relative, bytes: bytes.length, sha256: digest, group });
  }

for (const name of ['index.html', 'manifest.webmanifest', 'pwa-version.json', 'sw.js']) {
  if (!fs.existsSync(path.join(out, name))) throw new Error('Missing PWA shell output: ' + name);
}

const html = fs.readFileSync(path.join(out, 'index.html'), 'utf8');
if (
    html.includes('window.__SHBACE_AJ_PORTRAIT_DATA__="__SHBACE_AJ_PORTRAIT_DATA__";') ||
    html.includes('window.__SHBACE_FACULTY_LOGO_DATA__="__SHBACE_FACULTY_LOGO_DATA__";') ||
    !html.includes('window.__SHBACE_AJ_PORTRAIT_DATA__="data:image/webp;base64,') ||
    !html.includes('window.__SHBACE_FACULTY_LOGO_DATA__="data:image/webp;base64,') ||
    html.includes('__SHBACE_ANALYTICS_API_BASE_URL__')
) {
  throw new Error('The To Me bank portrait or University of Tripoli logo was not embedded into the iOS build.');
}
const deferredRefs = [...html.matchAll(/data-src=["']([^"']+)["']/g)].map(match => match[1].split('?')[0].replace(/^\.\//, ''));
for (const relative of deferredRefs) {
  if (!fs.existsSync(safePath(relative))) throw new Error('Deferred runtime asset is missing: ' + relative);
}
const requiredIosTools = ['js/32-ios-study-tools.js','js/33-ios-exam-planner.js','js/54-usage-analytics.js'];
for (const relative of requiredIosTools) {
  if (deferredRefs.filter(file => file === relative).length !== 1) throw new Error('Required iOS feature runtime must be loaded exactly once: ' + relative);
}
const runtimePosition = relative => deferredRefs.indexOf(relative);
if (!(runtimePosition('js/09-app-features-v6.js') < runtimePosition('js/36-exam-planner-settings-smartreview.js') &&
      runtimePosition('js/36-exam-planner-settings-smartreview.js') < runtimePosition('js/32-ios-study-tools.js') &&
      runtimePosition('js/32-ios-study-tools.js') < runtimePosition('js/33-ios-exam-planner.js') &&
      runtimePosition('js/33-ios-exam-planner.js') < runtimePosition('js/54-usage-analytics.js'))) {
  throw new Error('iOS feature runtime order is invalid; app core and Smart Review must load before study tools, followed by the iOS Exam Planner navigation layer.');
}
if (/js\/30-android-enhancements|js\/31-android-v13|js\/32-chrome-android/.test(html)) throw new Error('Android-only runtime module leaked into the iOS build.');
if (['js/30-ios-v5.js','js/31-ios-v6.js'].some(function (file) { return html.indexOf(file) !== -1; })) throw new Error('An iOS-only runtime layer is still referenced; To Me app core plus the preserved onboarding should be the only platform-specific exception.');
for (const relative of ['css/bundle-core.css','css/bundle-late.css','js/44-islamic-reminders.js']) {
  if (!fs.existsSync(safePath(relative))) throw new Error('Required iOS runtime asset is missing: ' + relative);
}
const onboardingCss = fs.readFileSync(safePath('css/bundle-late.css'), 'utf8');
const onboardingStyleRequirements = [
  '#phoneContent[data-ob="5"]>.screen:has(#gradeStage){overflow:visible!important}',
  '#phoneContent[data-ob="5"]>.screen:has(#gradeStage) #gradeStage.gx{width:calc(100% + 40px)!important;max-width:none!important;margin-left:-20px!important;margin-right:-20px!important}',
  '#phoneContent[data-ob-final]>.screen.cp-screen{overflow:visible!important}',
  '#phoneContent[data-ob-final] .cp-art-frame{aspect-ratio:1/1.17!important}',
  '#phoneContent[data-ob-final] .cp-screen .cp-welcome{margin-top:-4px!important}',
  '#phoneContent[data-ob-final] .cp-screen .cp-welcome .hero-sub{display:none!important}',
  '#phoneContent[data-ob-final] .cp-screen .cp-grade-badge{display:none!important}'
];
const missingOnboardingStyles = onboardingStyleRequirements.filter(function (rule) {
  return !onboardingCss.includes(rule);
});
if (missingOnboardingStyles.length) {
  throw new Error('The original final two onboarding screen layouts are missing: ' + missingOnboardingStyles.join('; '));
}
const baseBank = JSON.parse(fs.readFileSync(safePath('data/qbData.json'), 'utf8'));
if (!Array.isArray(baseBank.questions) || baseBank.questions.length !== 1718) throw new Error('The base question bank must remain at 1,718 questions.');
const pwaManifest = JSON.parse(fs.readFileSync(safePath('manifest.webmanifest'), 'utf8'));
for (const icon of pwaManifest.icons || []) {
  const iconPath = String(icon.src || '').replace(/^\.\//, '');
  if (!iconPath || !fs.existsSync(safePath(iconPath))) throw new Error('PWA icon is missing: ' + icon.src);
}
/* IndexedDB compatibility is owned by the page-side updater; the Service Worker intentionally remains cache/network only. */
const offlineSetup = fs.readFileSync(safePath('js/29-offline-setup.js'), 'utf8');
const serviceWorker = fs.readFileSync(safePath('sw.js'), 'utf8');
const featureRuntime = fs.readFileSync(safePath('js/09-app-features-v6.js'), 'utf8');
const installerRequirements = [
  "var CACHE_NAME='shbace-medical-offline-v2'",
  "var DB_NAME='shbace-medical-offline-state-v1'",
  'CHECK_EVERY=2*DAY',
  'CONCURRENCY=3',
  'window.__SHBACE_OFFLINE_SETUP_GATE__=setupGatePromise',
  'function mountInitialSetup()',
  'function paintSetup()',
  'function finishInitialSetupPackage()',
  'async function commitStaged(st)',
  'window.shbaceCheckForUpdate=manualCheck'
];
const installerMissing = installerRequirements.filter(function (token) {
  return !offlineSetup.includes(token);
});
const bootMatch = html.match(/<script id="shb-boot-v1">([\s\S]*?)<\/script>/);
const bootRuntime = bootMatch ? bootMatch[1] : '';
const bootRequirements = [
  'function startQuestionBankFetch()',
  'window.__SHBACE_OFFLINE_SETUP_GATE__',
  "o.id==='shbace-offline-setup'",
  'prefetchDeferredScripts(list.slice(i))'
];
const bootMissing = bootRequirements.filter(function (token) {
  return !bootRuntime.includes(token);
});
const staticScriptPreloads = html.match(/<link\b(?=[^>]*\brel=["']preload["'])(?=[^>]*\bas=["']script["'])[^>]*>/gi) || [];
const workerRequirements = [
  "const CACHE_NAME = 'shbace-medical-offline-v2'",
  'const APP_SHELL = [',
  'async function localFirst(request)',
  'async function networkThenCache(request)',
  "self.addEventListener('fetch'"
];
const workerMissing = workerRequirements.filter(function (token) {
  return !serviceWorker.includes(token);
});
if (installerMissing.length || bootMissing.length || staticScriptPreloads.length || workerMissing.length ||
    !serviceWorker.includes("'./assets/img/fc0bef7cd7ca.png'") ||
    !featureRuntime.includes('onclick="shbaceSettingsCheckForUpdates(this)"') ||
    !featureRuntime.includes('window.shbaceCheckForUpdate()')) {
  throw new Error(
    'The first-install Setup gate, 48-hour background updater or iOS settings integration is invalid. ' +
    'Installer missing: ' + installerMissing.join(', ') + '; ' +
    'boot gate missing: ' + bootMissing.join(', ') + '; ' +
    'static app-script preloads: ' + staticScriptPreloads.length + '; ' +
    'worker missing: ' + workerMissing.join(', ')
  );
}
const onboardingMain = fs.readFileSync(safePath('js/04-app-main.js'), 'utf8');
if (!onboardingMain.includes('function gradeScreen()') || !onboardingMain.includes('function finishScreen()')) throw new Error('The final two onboarding screens are missing from the app core.');

if (manifest.files.some(item => ['css/ios-v5.css','css/ios-v6.css','css/ios-v7.css','js/32-ios-v7.js'].includes(item.path))) throw new Error('A retired iOS visual layer is still included in the offline runtime inventory.');
const scanFiles = manifest.files.filter(item => /\.(?:html|css|js|json|webmanifest)$/i.test(item.path));
const missingImages = new Set();
for (const item of scanFiles) {
  const source = fs.readFileSync(safePath(item.path), 'utf8');
  for (const match of source.matchAll(/\/?assets\/img\/([^"'()\\s?#]+)/g)) {
    const imagePath = 'assets/img/' + match[1];
    if (!fs.existsSync(safePath(imagePath))) missingImages.add(imagePath);
  }
}
if (missingImages.size) throw new Error('Missing referenced images: ' + [...missingImages].join(', '));

manifest.fileCount = manifest.files.length;
manifest.totalBytes = manifest.files.reduce(function (sum, item) { return sum + item.bytes; }, 0);
// Keep the offline package version tied to the exact deployed file inventory and hashes.
manifest.version = crypto.createHash('sha256')
  .update(manifest.files.slice().sort(function (a, b) { return a.path.localeCompare(b.path); })
    .map(function (item) { return item.path + ':' + item.sha256; }).join('\n'))
  .digest('hex');
manifest.generatedAt = new Date().toISOString();
fs.writeFileSync(path.join(out, 'offline-assets-manifest.json'), JSON.stringify(manifest, null, 2) + '\n');

console.log('Shbace Medical iOS PWA build successful');
console.log('First-install Setup gate, deferred onboarding load, 48-hour updater, iOS local-first Service Worker, Settings control and shared Basic Usage Analytics client verified.');
console.log('Base question bank: '+baseBank.questions.length);
console.log('Deferred runtime assets verified: '+deferredRefs.length);
console.log('Offline inventory: '+manifest.fileCount+' files ('+(manifest.totalBytes/1024/1024).toFixed(2)+' MiB).');
}

buildPwa().catch(function(error) {
  console.error('Shbace Medical iOS PWA build failed:', error);
  process.exitCode = 1;
});
