'use strict';

const fs = require('fs');
const path = require('path');
const zlib = require('zlib');
const crypto = require('crypto');
const vm = require('vm');
const { spawnSync } = require('child_process');
const sharp = require('sharp');

const root = path.resolve(__dirname, '..');
const out = path.join(root, 'dist');
const manifest = { schema: 1, files: [] };

/* Always run the iOS offline migration regression tests, even when the hosting
   provider invokes this build file directly instead of npm run build:pwa. */
for (const relative of ['js/09-app-features-v6.js', 'js/20-drawer-order-v12.js', 'js/29-offline-setup.js', 'js/33-unified-voice.js', 'js/36-exam-planner-settings-smartreview.js']) {
  const syntax = spawnSync(process.execPath, ['--check', relative], { cwd: root, stdio: 'inherit' });
  if (syntax.error) throw syntax.error;
  if (syntax.status !== 0) throw new Error('JavaScript syntax check failed: ' + relative);
}
console.log('Changed iOS JavaScript syntax checks passed.');

const migrationTests = spawnSync(process.execPath, ['--test', 'tests/offline-migration.test.js', 'tests/exam-planner-linkage.test.mjs', 'tests/settings-bank-tools.test.mjs'], {
  cwd: root,
  stdio: 'inherit'
});
if (migrationTests.error) throw migrationTests.error;
if (migrationTests.status !== 0) {
  throw new Error('iOS offline migration regression tests failed (exit ' + migrationTests.status + ').');
}
console.log('iOS offline migration regression tests passed.');

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
  const files = ['index.html', 'manifest.webmanifest', 'pwa-version.json', 'sw.js'];
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
    const originalBytes = fs.readFileSync(path.join(root, relative));
    let bytes = originalBytes;

    if (relative === 'index.html') {
      let html = bytes.toString('utf8');
      const ajSlot = 'window.__SHBACE_AJ_PORTRAIT_DATA__="__SHBACE_AJ_PORTRAIT_DATA__";';
      const facultySlot = 'window.__SHBACE_FACULTY_LOGO_DATA__="__SHBACE_FACULTY_LOGO_DATA__";';
      if (!html.includes(ajSlot) || !html.includes(facultySlot)) {
        throw new Error('The two To Me Pediatrics image slots are missing from index.html.');
      }
      html = html.replace(ajSlot, 'window.__SHBACE_AJ_PORTRAIT_DATA__=' + JSON.stringify(ajPortraitData) + ';');
      html = html.replace(facultySlot, 'window.__SHBACE_FACULTY_LOGO_DATA__=' + JSON.stringify(facultyLogoData) + ';');
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

const drawerSource = fs.readFileSync(safePath('js/06-drawer-menu.js'), 'utf8');
const returningSource = fs.readFileSync(safePath('js/07-returning-student-migration.js'), 'utf8');
const featuresSource = fs.readFileSync(safePath('js/09-app-features-v6.js'), 'utf8');
if (!drawerSource.includes("if(n==='Settings'){appPage='settings';renderAppDemo();return}") ||
    !drawerSource.includes("['Settings','settings']") ||
    !returningSource.includes("['Settings','settings','<circle") ||
    !featuresSource.includes("window.__shbOpenSettings=function(){appPage='settings';renderAppDemo();return true}") ||
    !featuresSource.includes("window.__shbRenderSettings=function(){return settingsView()}") ||
    !featuresSource.includes("PAGES.settings=settingsView")) {
  throw new Error('The iOS Settings route must open from both the header and drawer.');
}

for (const name of ['index.html', 'manifest.webmanifest', 'pwa-version.json', 'sw.js']) {
  if (!fs.existsSync(path.join(out, name))) throw new Error('Missing PWA shell output: ' + name);
}

const html = fs.readFileSync(path.join(out, 'index.html'), 'utf8');
if (
    html.includes('window.__SHBACE_AJ_PORTRAIT_DATA__="__SHBACE_AJ_PORTRAIT_DATA__";') ||
    html.includes('window.__SHBACE_FACULTY_LOGO_DATA__="__SHBACE_FACULTY_LOGO_DATA__";') ||
    !html.includes('window.__SHBACE_AJ_PORTRAIT_DATA__="data:image/webp;base64,') ||
    !html.includes('window.__SHBACE_FACULTY_LOGO_DATA__="data:image/webp;base64,')
) {
  throw new Error('The To Me bank portrait or University of Tripoli logo was not embedded into the iOS build.');
}
const deferredRefs = [...html.matchAll(/data-src=["']([^"']+)["']/g)].map(match => match[1].split('?')[0].replace(/^\.\//, ''));
for (const relative of deferredRefs) {
  if (!fs.existsSync(safePath(relative))) throw new Error('Deferred runtime asset is missing: ' + relative);
}
/* Runtime CSS/JS must be explicitly referenced by index.html. The offline updater
   bootstrap (29-offline-setup.js) is registered separately by the app shell; SW and
   data assets are not CSS/JS runtime modules and are intentionally exempt. */
const indexRuntimeRefs = new Set();
const indexRuntimeRefPattern = /(?:src|data-src|href)\s*=\s*["'](?:\.\/|\/)?((?:css|js)\/[^"'?#]+)(?:[?#][^"']*)?["']/gi;
for (const match of html.matchAll(indexRuntimeRefPattern)) indexRuntimeRefs.add(match[1]);
const runtimeCssJs = manifest.files.filter(item =>
  /^(?:css|js)\//.test(item.path) &&
  /\.(?:css|js)$/i.test(item.path) &&
  item.path !== 'sw.js' &&
  item.path !== 'js/29-offline-setup.js'
);
const unreferencedCssJs = runtimeCssJs.filter(item => !indexRuntimeRefs.has(item.path)).map(item => item.path);
if (unreferencedCssJs.length) {
  throw new Error('Unreferenced CSS/JS files in iOS runtime inventory: ' + unreferencedCssJs.join(', '));
}
const missingCssJs = [...indexRuntimeRefs].filter(relative =>
  !manifest.files.some(item => item.path === relative));
if (missingCssJs.length) {
  throw new Error('index.html references CSS/JS files missing from the iOS runtime inventory: ' + missingCssJs.join(', '));
}
if (/js\/30-android-enhancements|js\/31-android-v13|js\/32-chrome-android/.test(html)) throw new Error('Android-only runtime module leaked into the iOS build.');
if (['js/30-ios-v5.js','js/31-ios-v6.js'].some(function (file) { return html.indexOf(file) !== -1; })) throw new Error('A retired iOS-only runtime layer is still referenced; To Me app core plus the preserved onboarding should be the only platform-specific exception.');
for (const retired of ['js/32-ios-study-tools.js','js/33-ios-exam-planner.js']) {
  if (fs.existsSync(path.join(root, retired))) throw new Error('Retired iOS runtime file must be deleted: ' + retired);
}
for (const relative of ['css/bundle-core.css','css/bundle-late.css','js/44-islamic-reminders.js']) {
  if (!fs.existsSync(safePath(relative))) throw new Error('Required iOS runtime asset is missing: ' + relative);
}
const baseBank = JSON.parse(fs.readFileSync(safePath('data/qbData.json'), 'utf8'));
if (!Array.isArray(baseBank.questions) || baseBank.questions.length !== 1718) throw new Error('The base question bank must remain at 1,718 questions.');
const pwaManifest = JSON.parse(fs.readFileSync(safePath('manifest.webmanifest'), 'utf8'));
for (const icon of pwaManifest.icons || []) {
  const iconPath = String(icon.src || '').replace(/^\.\//, '');
  if (!iconPath || !fs.existsSync(safePath(iconPath))) throw new Error('PWA icon is missing: ' + icon.src);
}
const offlineSetup = fs.readFileSync(safePath('js/29-offline-setup.js'), 'utf8');
const serviceWorker = fs.readFileSync(safePath('sw.js'), 'utf8');
const questionVoice = fs.readFileSync(safePath('js/33-unified-voice.js'), 'utf8');
const settingsOrganizer = fs.readFileSync(safePath('js/36-exam-planner-settings-smartreview.js'), 'utf8');
const toMeEnhancements = fs.readFileSync(path.resolve(root, '../to me/js/30-android-enhancements.js'), 'utf8');
const toMeDefaults = toMeEnhancements.match(/var DEFAULTS = \{[\s\S]*?\n  \};/);
if (!toMeDefaults || !/shareQuestion: true/.test(toMeDefaults[0]) ||
    !/copyQuestion: true/.test(toMeDefaults[0]) || !/readAloud: true/.test(toMeDefaults[0]) ||
    !/keepScreenOn: true/.test(toMeDefaults[0]) || !/autoTheme: true/.test(toMeDefaults[0]) ||
    !/readingSpeed: 'normal'/.test(toMeDefaults[0])) {
  throw new Error('The To Me Study experience defaults changed; review and explicitly reconcile iOS parity.');
}
for (const [label, helper] of [
  ['Share a question','Show the question-sharing action.'],
  ['Copy question text','Show the copy action for notes or AI tools.'],
  ['Read questions aloud','Show voice playback controls on questions.'],
  ['Reading speed','Applies to spoken question text.'],
  ['Keep screen awake','Prevent the display from sleeping while the Question Bank is open.'],
  ['Follow device theme','Automatically match device light or dark appearance.'],
  ['Copy app information','Send the copied details when reporting an app issue. No account or personal data is included.']
]) {
  if (!toMeEnhancements.includes(label) || !questionVoice.includes(label) || !toMeEnhancements.includes(helper) || !questionVoice.includes(helper)) {
    throw new Error('Shared To Me/iOS Study experience setting is missing or has diverged: ' + label);
  }
}
if (!questionVoice.includes("computerVoiceQuestionToolSetting('shareQuestion','Share a question','Show the question-sharing action.')") ||
    !questionVoice.includes("computerVoiceQuestionToolSetting('copyQuestion','Copy question text','Show the copy action for notes or AI tools.')") ||
    !questionVoice.includes("computerVoiceQuestionToolSetting('readAloud','Read questions aloud','Show voice playback controls on questions.')") ||
    !questionVoice.includes("iosStudyToggleMarkup('keepScreenAwake','Keep screen awake'") ||
    !questionVoice.includes("iosStudyToggleMarkup('followSystemTheme','Follow device theme'") ||
    !questionVoice.includes("followSystemTheme:true,keepScreenAwake:true") ||
    !questionVoice.includes('shbCopyAppInfo') ||
    !questionVoice.includes("reminders.id='shbStudyRemindersSettings'") ||
    !questionVoice.includes('Copy app information') ||
    questionVoice.includes('Haptic feedback') || questionVoice.includes('examCountdown')) {
  throw new Error('iOS Study experience controls/defaults do not match the shared To Me settings.');
}
if (!settingsOrganizer.includes("target('appearance').appendChild(voice)") ||
    settingsOrganizer.includes("target('appearance').appendChild(questionTools)") ||
    settingsOrganizer.includes("target('notifications').appendChild(studyReminders)") ||
    !settingsOrganizer.includes("observe(settingsHost,{childList:true})") ||
    settingsOrganizer.includes('observe(document.documentElement') ||
    !settingsOrganizer.includes('settingsObserver.takeRecords()')) {
  throw new Error('Settings organization must be scoped, guarded, and idempotent.');
}
if (!questionVoice.includes('toolbar.dataset.sig=signature') ||
    !questionVoice.includes('scheduleQuestionDecoration()') ||
    !questionVoice.includes("observe(questionHost,{childList:true})") ||
    questionVoice.includes('observe(document.body,{childList:true,subtree:true}')) {
  throw new Error('Question toolbar must be idempotent and observe only the app viewport.');
}
const featureRuntime = fs.readFileSync(safePath('js/09-app-features-v6.js'), 'utf8');
if (!offlineSetup.includes("var CACHE_NAME='shbace-medical-offline-v2'") ||
    !offlineSetup.includes("var DB_NAME='shbace-medical-offline-state-v1'") ||
    !offlineSetup.includes("var MIGRATION_KEY='shbace_ios_migrated_1_4_14'") ||
    !offlineSetup.includes('function finalizeVerifiedPlanCommit()') ||
    !offlineSetup.includes("if(migrationInProgress){lsSet(MIGRATION_KEY,'1')") ||
    !offlineSetup.includes('function localRepairNeeded(installed)') ||
    !offlineSetup.includes('function manualRepair()') ||
    !offlineSetup.includes('window.shbaceRepairOffline=manualRepair') ||
    !offlineSetup.includes('function start()') ||
    offlineSetup.includes('CHECK_TRY_KEY') ||
    offlineSetup.includes('function checkDue(') ||
    !offlineSetup.includes('if(!hasRecord){') ||
    !offlineSetup.includes("name.indexOf('shbace-medical-ios-shell-')===0") ||
    !offlineSetup.includes('window.shbaceCheckForUpdate=manualCheck') ||
    !offlineSetup.includes('MANIFEST_FETCH_TIMEOUT=30000') ||
    !offlineSetup.includes('MANIFEST_FETCH_ATTEMPTS=2') ||
    !offlineSetup.includes('function waitForWorkerActivation(worker)') ||
    !offlineSetup.includes('return reg.update().then(function(){') ||
    !offlineSetup.includes('var candidate=reg.installing||reg.waiting') ||
    !offlineSetup.includes('return candidate?waitForWorkerActivation(candidate)') ||
    !offlineSetup.includes('return navigator.serviceWorker.ready') ||
    offlineSetup.includes('WORKER_READY_TIMEOUT') ||
    offlineSetup.includes("},10000)") ||
    !serviceWorker.includes("const CACHE_NAME = 'shbace-medical-offline-v2'") ||
    !serviceWorker.includes("const DB_NAME = 'shbace-medical-offline-state-v1'") ||
    !serviceWorker.includes("name.startsWith('shbace-medical-ios-shell-')") ||
    !serviceWorker.includes('readInstalledReleaseVersion') ||
    !serviceWorker.includes('networkFirstOnPackageMismatch(request)') ||
    !serviceWorker.includes("url.searchParams.has('__shbace_integrity')") ||
    !featureRuntime.includes('onclick="shbaceSettingsCheckForUpdates(this)"') ||
    !featureRuntime.includes('window.shbaceCheckForUpdate()')) {
  throw new Error('The manual-only iOS updater, first-install setup, cache cleanup, or version-aware service worker invariant failed.');
}
const onboardingMain = fs.readFileSync(safePath('js/04-app-main.js'), 'utf8');
if (!onboardingMain.includes('function gradeScreen()') || !onboardingMain.includes('function finishScreen()')) throw new Error('The final two onboarding screens are missing from the app core.');

const drawerRuntime = fs.readFileSync(safePath('js/07-returning-student-migration.js'), 'utf8');
const drawerOrder = fs.readFileSync(safePath('js/20-drawer-order-v12.js'), 'utf8');
const drawerMenuBase = fs.readFileSync(safePath('js/06-drawer-menu.js'), 'utf8');
const drawerFeatures = fs.readFileSync(safePath('js/09-app-features-v6.js'), 'utf8');
for (const marker of ['dr-top2','dr2-flag','class="dr-body"','class="dr-foot"']) {
  if (!drawerRuntime.includes(marker)) throw new Error('The latest To Me side drawer is incomplete: ' + marker);
}
if (!drawerMenuBase.includes("hdrTap('Notifications')") ||
    drawerOrder.includes("['Updates'") ||
    !drawerOrder.includes("['APP & SUPPORT',['Settings','Contact & Feedback','Changelog','About','Rate this app'].map(pick).filter(Boolean)]")) {
  throw new Error('The iOS drawer must match the latest To Me App & support grouping, without a separate Updates section.');
}
if (!drawerFeatures.includes('id="shbAppUpdates"') ||
    !drawerFeatures.includes('onclick="shbaceSettingsCheckForUpdates(this)"') ||
    !drawerFeatures.includes('window.shbaceCheckForUpdate()') ||
    !drawerFeatures.includes('function shbaceSettingsUpdateMeta()') ||
    !drawerFeatures.includes('window.shbaceVersionInfo&&window.shbaceVersionInfo()') ||
    !drawerFeatures.includes('window.shbaceLastUpdateCheck&&window.shbaceLastUpdateCheck()') ||
    !drawerFeatures.includes('window.shbaceUpdatePending&&window.shbaceUpdatePending()')) {
  throw new Error('The iOS App updates card or its version/check/pending-file metadata is incomplete.');
}
if (!drawerOrder.includes("['Exam goal planner','examplanner'") ||
    !drawerOrder.includes("['YOUR PROGRESS'") || !drawerOrder.includes("['APP & SUPPORT'")) {
  throw new Error('The iOS drawer is missing the Exam Planner or final To Me section order.');
}
if (drawerFeatures.includes('DR2[1][1][2][3]=') ||
    drawerFeatures.includes("id==='review'&&dueList().length?")) {
  throw new Error('A Smart Review count badge is still being written to the drawer or bottom navigation.');
}
if (!drawerFeatures.includes('id="shbAppUpdates"') ||
    !drawerFeatures.includes('onclick="shbaceSettingsCheckForUpdates(this)"') ||
    !drawerFeatures.includes('window.shbaceCheckForUpdate()') ||
    !drawerFeatures.includes('function shbaceSettingsUpdateMeta()') ||
    !drawerFeatures.includes('window.shbaceVersionInfo&&window.shbaceVersionInfo()') ||
    !drawerFeatures.includes('window.shbaceLastUpdateCheck&&window.shbaceLastUpdateCheck()') ||
    !drawerFeatures.includes('window.shbaceUpdatePending&&window.shbaceUpdatePending()')) {
  throw new Error('The iOS App updates card or its version/check/pending-file metadata is incomplete.');
}
if (!drawerOrder.includes("['Exam goal planner','examplanner'") ||
    !drawerOrder.includes("['YOUR PROGRESS'") || !drawerOrder.includes("['APP & SUPPORT'")) {
  throw new Error('The iOS drawer is missing the Exam Planner or final To Me section order.');
}
if (drawerFeatures.includes('DR2[1][1][2][3]=') ||
    drawerFeatures.includes("id==='review'&&dueList().length?")) {
  throw new Error('A Smart Review count badge is still being written to the drawer or bottom navigation.');
}
for (const marker of ['PAGES.notifs=notifsView','PAGES.timer=timerView','PAGES.weak=weakView','window.__shbNavTap']) {
  if (!drawerFeatures.includes(marker)) throw new Error('An iOS side-menu destination or navigation handler is missing: ' + marker);
}
if (!onboardingMain.includes('Which grade are you in?') ||
    !onboardingMain.includes('THE MEDICAL JOURNEY') ||
    !onboardingMain.includes('cp-finish-layout')) {
  throw new Error('The original iOS final onboarding screens have changed unexpectedly.');
}
const pwaVersion = JSON.parse(fs.readFileSync(safePath('pwa-version.json'), 'utf8'));
const packageMetadata = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));
if (packageMetadata.version !== '1.4.20' || pwaVersion.version !== '1.4.20' || pwaVersion.displayVersion !== '1.4.20' ||
    !Array.isArray(pwaVersion.releaseNotes) ||
    !pwaVersion.releaseNotes.includes('Prevents existing installs from opening startup update UI or making network requests; migration completes only after a manually initiated verified commit.') ||
    !pwaVersion.releaseNotes.includes('Detects missing offline files locally and offers user-initiated Repair from Settings.') ||
    !pwaVersion.releaseNotes.includes('Scopes question and Settings observers to the app viewport and coalesces callbacks to prevent DOM mutation loops.') ||
    !pwaVersion.releaseNotes.includes('Aligns shared iOS Study experience controls, labels, helper text and defaults with To Me.')) {
  throw new Error('The iOS 1.4.20 release metadata is missing or inconsistent.');
}

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
manifest.releaseVersion = pwaVersion.version;
// Keep the offline package version tied to the release version and exact deployed file inventory/hashes.
manifest.version = crypto.createHash('sha256')
  .update('release:' + manifest.releaseVersion + '\n' +
    manifest.files.slice().sort(function (a, b) { return a.path.localeCompare(b.path); })
      .map(function (item) { return item.path + ':' + item.sha256; }).join('\n'))
  .digest('hex');
manifest.generatedAt = new Date().toISOString();
fs.writeFileSync(path.join(out, 'offline-assets-manifest.json'), JSON.stringify(manifest, null, 2) + '\n');

console.log('Shbace Medical iOS PWA build successful');
console.log('Shared To Me offline updater and Settings control verified.');
console.log('Base question bank: '+baseBank.questions.length);
console.log('Deferred runtime assets verified: '+deferredRefs.length);
console.log('Offline inventory: '+manifest.fileCount+' files ('+(manifest.totalBytes/1024/1024).toFixed(2)+' MiB).');
}

buildPwa().catch(function(error) {
  console.error('Shbace Medical iOS PWA build failed:', error);
  process.exitCode = 1;
});
