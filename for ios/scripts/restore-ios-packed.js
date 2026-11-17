'use strict';

const fs = require('fs');
const path = require('path');
const zlib = require('zlib');
const crypto = require('crypto');
const vm = require('vm');

const root = path.resolve(__dirname, '..');
const out = path.join(root, 'dist');
const manifest = { schema: 1, files: [] };

const packed = {
  'js/30-ios-v5.js': ['v5-01.b64', 'v5-02.b64', 'v5-03.b64', 'v5-04.b64'],
  'js/31-ios-v6.js': ['v6-01.b64', 'v6-02.b64', 'v6-03.b64']
};

const expected = {
  'js/30-ios-v5.js': { bytes: 31301, sha256: '12f7876ebdcfa8f6dd6b1f1e2b87e82a1d00335d919b24704dac0c238ac56a87' },
  'js/31-ios-v6.js': { bytes: 14188, sha256: '1c0669c83d403b641a9fc300056201df230deca4918a5f1993c819c21ad865f5' }
};

function safePath(relative) {
  if (typeof relative !== 'string' || relative.startsWith('/') || relative.split(/[\\/]/).includes('..')) {
    throw new Error('Unsafe asset path in offline manifest: ' + relative);
  }
  return path.join(out, relative);
}

function readAsset(relative) {
  if (packed[relative]) {
    const base64 = packed[relative].map(function (name) {
      return fs.readFileSync(path.join(root, 'packed', name), 'utf8').trim();
    }).join('');
    return zlib.gunzipSync(Buffer.from(base64, 'base64'));
  }
  return fs.readFileSync(path.join(root, relative));
}

function verify(relative, bytes, sha256) {
  const expectedSource = expected[relative];
  if (expectedSource && (bytes.length !== expectedSource.bytes || sha256 !== expectedSource.sha256)) {
    throw new Error('Packed iOS bundle failed source integrity check: ' + relative);
  }
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
  files.push(...Object.keys(packed));
  return [...new Set(files)].filter(relative => relative !== 'offline-assets-manifest.json' && !/^css\\/ios-v[567]\\.css$/.test(relative)).sort((a, b) => a.localeCompare(b));
}

fs.rmSync(out, { recursive: true, force: true });
fs.mkdirSync(out, { recursive: true });

function patchPackedAsset(relative, originalBytes) {
  if (!packed[relative]) return originalBytes;
  let source = originalBytes.toString('utf8');
  if (relative === 'js/30-ios-v5.js') {
    const flag = 'updateBanner:true,';
    if (!source.includes(flag)) throw new Error('Expected iOS update-banner flag was not found.');
    source = source.replace(flag, 'updateBanner:false,\\n autoUpdate:true,');
    source = source.replace("lang:'ar',", "lang:'en',");
    for (const name of ['landscape','haptics','badge','keyboard','speak','progressCard','swipe','shareQuestion','inputHints']) {
      const pattern = new RegExp('('+name+':)true,');
      if (!pattern.test(source)) throw new Error('Expected iOS feature flag was not found: '+name);
      source = source.replace(pattern, '$1false,');
    }
    const offlineTimer = 'if(good)offT=setTimeout(hideBar,2200);';
    if (!source.includes(offlineTimer)) throw new Error('Expected persistent offline notification timer was not found.');
    source = source.replace(offlineTimer, 'offT=setTimeout(hideBar,2000);');
    const startMarker = '/* ---------- 8. new version available ---------- */';
    const endMarker = '/* ---------- 9. weekly backup reminder';
    const start = source.indexOf(startMarker), end = source.indexOf(endMarker, start);
    if (start < 0 || end < 0) throw new Error('Could not locate the legacy iOS update-banner block.');
    const silentUpdates = `/* ---------- 8. silent automatic PWA updates during the startup Splash ---------- */
var VER_KEY='shbace_v5_seen_version';
function swReady(){return 'serviceWorker' in navigator}
if(V5.autoUpdate&&swReady()){
 var lastCheck=0;
 function checkUpdates(force){
  var now=Date.now();
  if(!force&&now-lastCheck<30*60*1000)return;
  lastCheck=now;
  if(navigator.onLine===false)return;
  navigator.serviceWorker.getRegistration('./').then(function(reg){if(reg)return reg.update().catch(function(){});}).catch(function(){});
  fetch('pwa-version.json?shbcheck='+Date.now(),{cache:'no-store'}).then(function(r){return r.ok?r.json():null}).then(function(v){if(v&&v.version)lsSet(VER_KEY,v.version)}).catch(function(){});
 }
 setTimeout(function(){checkUpdates(true)},400);
 setInterval(function(){checkUpdates(false)},30*60*1000);
 document.addEventListener('visibilitychange',function(){if(!document.hidden)setTimeout(function(){checkUpdates(true)},1200)});
 addEventListener('online',function(){setTimeout(function(){checkUpdates(true)},1200)});
}`;
    source = source.slice(0, start) + silentUpdates + source.slice(end);
    const guideStart = source.indexOf('/* Extend the About > How to Use guide with every shipped iPhone/iPad addition (v5-v7). */');
    const finalClose = source.lastIndexOf('})();');
    if (guideStart < 0 || finalClose < guideStart) throw new Error('Could not locate legacy iOS guide section.');
    source = source.slice(0, guideStart) + '\\n})();\\n';
  }
  if (relative === 'js/31-ios-v6.js') {
    source = source.replace("lang:'ar',", "lang:'en',");
    for (const name of ['touchPolish','keyboardFix','titleToTop']) {
      const pattern = new RegExp('('+name+':)true,');
      if (!pattern.test(source)) throw new Error('Expected iOS feature flag was not found: '+name);
      source = source.replace(pattern, '$1false,');
    }
    source = source.replace("oH:'iPhone / iPad options',oSub:'Turn on only what you need.'","oH:'Local storage & backups',oSub:'Storage protection, saved data, backup and repair.'");
    const settingsStart = source.indexOf("  var rate=Number(ls('shbace_v6_rate'))||.95;");
    const settingsEnd = source.indexOf("  rs.appendChild(d);", settingsStart);
    if (settingsStart < 0 || settingsEnd < 0) throw new Error('Could not locate iOS Settings insertion block.');
    const storageOnlyCard = `  var d=document.createElement('div');d.className='card setcard v6-card';d.dir=DIR;
  d.innerHTML='<h3>'+L.oH+'</h3><p class="meta">'+L.oSub+'</p>'+
   '<div class="setrow"><b>'+L.storeH+'</b><small class="v6-store">…</small></div>'+
   '<button type="button" class="btn block v6-sharebk" style="margin-top:10px">'+L.shareBk+'</button>'+
   '<button type="button" class="btn danger block v6-repair" style="margin-top:10px">'+L.repair+'</button>';
`;
    source = source.slice(0, settingsStart) + storageOnlyCard + source.slice(settingsEnd);
    const themeStart = source.indexOf('/* ---------- 28. theme follows the device (off by default) ---------- */');
    const repairStart = source.indexOf('/* ---------- 32. repair: clear saved app files and download them again (student data is not touched) ---------- */');
    if (themeStart < 0 || repairStart < 0 || repairStart <= themeStart) throw new Error('Could not locate legacy iOS theme override.');
    source = source.slice(0, themeStart) + source.slice(repairStart);
  }
  return Buffer.from(source, 'utf8');
}

for (const relative of runtimeFiles()) {
  const originalBytes = readAsset(relative);
  const originalDigest = crypto.createHash('sha256').update(originalBytes).digest('hex');
  verify(relative, originalBytes, originalDigest);

  const bytes = patchPackedAsset(relative, originalBytes);
  const digest = crypto.createHash('sha256').update(bytes).digest('hex');
  if (relative.endsWith('.js')) new vm.Script(bytes.toString('utf8'), { filename: relative });

  const destination = safePath(relative);
  fs.mkdirSync(path.dirname(destination), { recursive: true });
  fs.writeFileSync(destination, bytes);
  const group = relative.startsWith('assets/img/') ? 'images' :
    relative.startsWith('data/') ? 'data' :
    (relative.startsWith('css/') || relative.startsWith('js/') ||
     relative === 'index.html' || relative === 'manifest.webmanifest' || relative === 'sw.js') ? 'app' : 'other';
  manifest.files.push({ path: relative, bytes: bytes.length, sha256: digest, group });
}

for (const name of ['index.html', 'manifest.webmanifest', 'pwa-version.json', 'sw.js']) {
  if (!fs.existsSync(path.join(out, name))) throw new Error('Missing PWA shell output: ' + name);
}

const html = fs.readFileSync(path.join(out, 'index.html'), 'utf8');
const deferredRefs = [...html.matchAll(/data-src=["']([^"']+)["']/g)].map(match => match[1].split('?')[0].replace(/^\.\//, ''));
for (const relative of deferredRefs) {
  if (!fs.existsSync(safePath(relative))) throw new Error('Deferred runtime asset is missing: ' + relative);
}
if (/js\/30-android-enhancements|js\/31-android-v13|js\/32-chrome-android/.test(html)) throw new Error('Android-only runtime module leaked into the iOS build.');
for (const relative of ['css/bundle-core.css','css/bundle-late.css',
  'js/30-ios-v5.js','js/31-ios-v6.js','js/44-islamic-reminders.js']) {
  if (!fs.existsSync(safePath(relative))) throw new Error('Required iOS runtime asset is missing: ' + relative);
}
const baseBank = JSON.parse(fs.readFileSync(safePath('data/qbData.json'), 'utf8'));
if (!Array.isArray(baseBank.questions) || baseBank.questions.length !== 1718) throw new Error('The base question bank must remain at 1,718 questions.');
const pwaManifest = JSON.parse(fs.readFileSync(safePath('manifest.webmanifest'), 'utf8'));
for (const icon of pwaManifest.icons || []) {
  const iconPath = String(icon.src || '').replace(/^\.\//, '');
  if (!iconPath || !fs.existsSync(safePath(iconPath))) throw new Error('PWA icon is missing: ' + icon.src);
}
const iosOfflineSetup = fs.readFileSync(safePath('js/29-offline-setup.js'), 'utf8');
const serviceWorker = fs.readFileSync(safePath('sw.js'), 'utf8');
if (!iosOfflineSetup.includes("var CACHE_NAME='shbace-medical-offline-v2'") ||
    !iosOfflineSetup.includes("var DB_NAME='shbace-medical-offline-state-v1'") ||
    !serviceWorker.includes("const CACHE_NAME = 'shbace-medical-offline-v2'") ||
    !serviceWorker.includes("const SHELL_CACHE_NAME = 'shbace-medical-ios-shell-v150'")) {
  throw new Error('The iOS offline cache or saved-state database identifiers changed unexpectedly.');
}
const onboardingMain = fs.readFileSync(safePath('js/04-app-main.js'), 'utf8');
if (!onboardingMain.includes('function gradeScreen()') || !onboardingMain.includes('function finishScreen()')) throw new Error('The final two onboarding screens are missing from the app core.');
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
console.log('iOS cache and saved-state identifiers verified.');
console.log('Base question bank: '+baseBank.questions.length);
console.log('Deferred runtime assets verified: '+deferredRefs.length);
console.log('Offline inventory: '+manifest.fileCount+' files ('+(manifest.totalBytes/1024/1024).toFixed(2)+' MiB).');
