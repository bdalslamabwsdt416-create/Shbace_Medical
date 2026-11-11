'use strict';

const fs = require('fs');
const path = require('path');
const zlib = require('zlib');
const crypto = require('crypto');
const vm = require('vm');

const root = path.resolve(__dirname, '..');
const out = path.join(root, 'dist');
const manifestPath = path.join(root, 'offline-assets-manifest.json');
const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));

const packed = {
  'js/30-ios-v5.js': ['v5-01.b64', 'v5-02.b64', 'v5-03.b64', 'v5-04.b64'],
  'js/31-ios-v6.js': ['v6-01.b64', 'v6-02.b64', 'v6-03.b64'],
  'js/32-ios-v7.js': ['v7-01.b64', 'v7-02.b64']
};

const expected = {
  'js/30-ios-v5.js': { bytes: 31301, sha256: '12f7876ebdcfa8f6dd6b1f1e2b87e82a1d00335d919b24704dac0c238ac56a87' },
  'js/31-ios-v6.js': { bytes: 14188, sha256: '1c0669c83d403b641a9fc300056201df230deca4918a5f1993c819c21ad865f5' },
  'js/32-ios-v7.js': { bytes: 10780, sha256: '18bc123e3728234fa303a2293657e87baa74f37d509fed79d354fb58d9fd10ff' }
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
  const record = manifest.files.find(function (item) { return item.path === relative; });
  if (!record) throw new Error('Missing offline manifest record: ' + relative);
  if (expected[relative] && (bytes.length !== expected[relative].bytes || sha256 !== expected[relative].sha256)) {
    throw new Error('Packed iOS bundle failed source integrity check: ' + relative);
  }
  // Rebuild the shipped offline manifest from the exact files being deployed.
  record.bytes = bytes.length;
  record.sha256 = sha256;
}

fs.rmSync(out, { recursive: true, force: true });
fs.mkdirSync(out, { recursive: true });

function patchPackedAsset(relative, originalBytes) {
  if (relative !== 'js/30-ios-v5.js' && relative !== 'js/32-ios-v7.js') return originalBytes;
  let source = originalBytes.toString('utf8');

  const oldGuide = "    '<li>إذا ظهر '+E('A new version is available')+'، اتصل بالإنترنت واضغط زر التحديث واترك العملية تكتمل قبل إغلاق الصفحة.</li>'+";
  const newGuide = "    '<li>يتم فحص تحديثات التطبيق وتطبيقها تلقائياً في الخلفية، ولا تحتاج إلى الضغط على زر تحديث. قد يعاد تحميل الصفحة مرة واحدة بعد اكتمال تحديث ملفات التطبيق، مع بقاء بياناتك المحلية محفوظة.</li>'+";

  if (relative === 'js/30-ios-v5.js') {
    const flag = 'updateBanner:true,';
    if (!source.includes(flag)) throw new Error('Expected iOS update-banner flag was not found.');
    source = source.replace(flag, 'updateBanner:false,\n autoUpdate:true,');

    const startMarker = '/* ---------- 8. new version available ---------- */';
    const endMarker = '/* ---------- 9. weekly backup reminder';
    const start = source.indexOf(startMarker);
    const end = source.indexOf(endMarker, start);
    if (start < 0 || end < 0) throw new Error('Could not locate the legacy iOS update-banner block.');

    const silentUpdates = `/* ---------- 8. silent automatic PWA updates: no user-facing banner ---------- */
var VER_KEY='shbace_v5_seen_version';
function swReady(){return 'serviceWorker' in navigator}
if(V5.autoUpdate&&swReady()){
 var hadController=!!navigator.serviceWorker.controller;
 var pendingReload=false,reloadStarted=false,waitingForGate=false,lastCheck=0;
 function reloadWhenSafe(){
  if(!pendingReload||reloadStarted||!hadController||!navigator.serviceWorker.controller)return;
  /* Never interrupt an active study session. Apply the new shell when the app is backgrounded,
     or during startup before the app has finished booting. */
  if(!document.hidden&&window.__shbBooted)return;
  if(window.__shbOfflineGatePromise&&!window.__shbOfflineGateReleased){
   if(!waitingForGate){
    waitingForGate=true;
    window.__shbOfflineGatePromise.then(function(){waitingForGate=false;reloadWhenSafe()},function(){waitingForGate=false});
   }
   return;
  }
  reloadStarted=true;
  setTimeout(function(){location.reload()},200);
 }
 navigator.serviceWorker.addEventListener('controllerchange',function(){
  if(hadController&&navigator.serviceWorker.controller){pendingReload=true;reloadWhenSafe()}
 });
 function checkUpdates(force){
  var now=Date.now();
  if(!force&&now-lastCheck<30*60*1000)return;
  lastCheck=now;
  if(navigator.onLine===false)return;
  navigator.serviceWorker.getRegistration('./').then(function(reg){
   if(reg)return reg.update().catch(function(){});
  }).catch(function(){});
  fetch('pwa-version.json?shbcheck='+Date.now(),{cache:'no-store'})
   .then(function(r){return r.ok?r.json():null})
   .then(function(v){if(v&&v.version)lsSet(VER_KEY,v.version)})
   .catch(function(){});
 }
 setTimeout(function(){checkUpdates(true)},9000);
 setInterval(function(){checkUpdates(false)},30*60*1000);
 document.addEventListener('visibilitychange',function(){
  if(document.hidden){reloadWhenSafe();return}
  setTimeout(function(){checkUpdates(true)},1200);
 });
 addEventListener('online',function(){setTimeout(function(){checkUpdates(true)},1200)});
}`;
    source = source.slice(0, start) + silentUpdates + source.slice(end);
  }

  if (!source.includes(oldGuide)) {
    throw new Error('Expected manual-update instruction was not found in ' + relative);
  }
  source = source.replace(oldGuide, newGuide);
  return Buffer.from(source, 'utf8');
}

for (const item of manifest.files) {
  const originalBytes = readAsset(item.path);
  const originalDigest = crypto.createHash('sha256').update(originalBytes).digest('hex');
  // Verify the original compressed source bundle before applying the deterministic release patch.
  verify(item.path, originalBytes, originalDigest);

  const bytes = patchPackedAsset(item.path, originalBytes);
  const digest = crypto.createHash('sha256').update(bytes).digest('hex');
  const record = manifest.files.find(function (entry) { return entry.path === item.path; });
  record.bytes = bytes.length;
  record.sha256 = digest;

  if (item.path.endsWith('.js')) new vm.Script(bytes.toString('utf8'), { filename: item.path });
  const destination = safePath(item.path);
  fs.mkdirSync(path.dirname(destination), { recursive: true });
  fs.writeFileSync(destination, bytes);
}

for (const name of ['index.html', 'manifest.webmanifest', 'pwa-version.json', 'sw.js']) {
  const source = path.join(root, name);
  if (!fs.existsSync(source)) throw new Error('Missing PWA shell file: ' + name);
  fs.copyFileSync(source, path.join(out, name));
}

manifest.totalBytes = manifest.files.reduce(function (sum, item) { return sum + item.bytes; }, 0);
// Keep the offline package version tied to the exact deployed file inventory and hashes.
manifest.version = crypto.createHash('sha256')
  .update(manifest.files.slice().sort(function (a, b) { return a.path.localeCompare(b.path); })
    .map(function (item) { return item.path + ':' + item.sha256; }).join('\n'))
  .digest('hex');
manifest.generatedAt = new Date().toISOString();
fs.writeFileSync(path.join(out, 'offline-assets-manifest.json'), JSON.stringify(manifest, null, 2) + '\n');

console.log('Shbace Medical iOS PWA build complete: ' + manifest.files.length + ' verified offline assets.');
