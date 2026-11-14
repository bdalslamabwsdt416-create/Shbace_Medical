(function(){
'use strict';

/* Offline package installer + update flow for the Chrome Android PWA.
   - Everything that can be prepared is prepared silently while the splash screen is visible.
   - The setup / update window is built hidden during the splash and revealed the moment the splash is gone.
   - An update downloads only the changed files into a staging cache, verifies them (size + SHA-256) and only
     then swaps them into the installed package, so the installed app is never left half old / half new.
   - The window can always be dismissed with "Later"; it never traps the student outside the app. */

var CACHE_NAME='shbace-chrome-offline-v1.3.4';          /* must match sw.js (checked by scripts/build-pwa.mjs) */
var STAGE_CACHE=CACHE_NAME+'-staging';
var DB_NAME='shbace-medical-offline-state-v1';
var MANIFEST_URL=new URL('./offline-assets-manifest.json',location.href).href;
var INSTALLED_URL=new URL('./__shbace_offline_installed__',location.href).href;   /* manifest of the verified, installed package */
var READY_URL=new URL('./__shbace_offline_ready__',location.href).href;
var LATER_KEY='shbace_offline_later_v1';
var REMOTE_TIMEOUT_MS=4000;
var AUDIT_CONCURRENCY=3;
var DOWNLOAD_WORKERS=2;
var STAGES=[
 {id:'app',label:'Application files'},
 {id:'images',label:'Images and visual assets'},
 {id:'data',label:'Question bank and learning data'},
 {id:'other',label:'Other local resources'},
 {id:'verify',label:'Integrity verification'}
];

var ui=null,started=false,state=null,cache=null,plan=null;
var verifiedCount=0,verifiedBytes=0,donePaths=Object.create(null),errors=[];
var stageCounts={app:0,images:0,data:0,other:0},stageDone={app:0,images:0,data:0,other:0};

function standalone(){
 try{return !!(navigator.standalone===true || (window.matchMedia&&(
  window.matchMedia('(display-mode: standalone)').matches ||
  window.matchMedia('(display-mode: fullscreen)').matches
 )))}
 catch(e){return false}
}
function iosDevice(){
 return /iPad|iPhone|iPod/.test(navigator.userAgent||'') ||
  (navigator.platform==='MacIntel'&&navigator.maxTouchPoints>1);
}
function fmtBytes(n){
 if(!Number.isFinite(n)||n<0)return 'Unknown';
 if(n<1024)return n+' B';
 var units=['KB','MB','GB'],v=n/1024,i=0;
 while(v>=1024&&i<units.length-1){v/=1024;i++}
 return v.toFixed(v>=10?1:2)+' '+units[i];
}
function esc(s){
 return String(s).replace(/[&<>"']/g,function(c){
  return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c];
 });
}
function fileGroup(f){
 if(f.group)return f.group;
 if(/^assets\/img\//.test(f.path))return 'images';
 if(/^data\//.test(f.path))return 'data';
 return 'app';
}
function urlFor(path){
 return new URL(path.split('/').map(encodeURIComponent).join('/'),new URL('./',location.href)).href;
}
function wait(ms){return new Promise(function(resolve){setTimeout(resolve,ms)})}
function jsonResponse(value){
 return new Response(JSON.stringify(value),{status:200,headers:{'content-type':'application/json'}});
}
function mapLimit(items,limit,fn){
 var index=0,results=new Array(items.length);
 function worker(){
  if(index>=items.length)return Promise.resolve();
  var i=index++;
  return Promise.resolve(fn(items[i],i)).then(function(r){results[i]=r}).then(worker);
 }
 var workers=[];
 for(var k=0;k<Math.min(limit,items.length);k++)workers.push(worker());
 return Promise.all(workers).then(function(){return results});
}

/* ───────────────────────── overlay (built hidden during the splash) ───────────────────────── */
function mount(){
 if(ui&&ui.root&&ui.root.isConnected)return ui;
 var root=document.createElement('div');
 root.id='shbaceOfflineSetup';
 root.className='shb-offline-setup';
 root.setAttribute('role','dialog');
 root.setAttribute('aria-modal','true');
 root.setAttribute('aria-labelledby','shbOfflineTitle');
 root.setAttribute('aria-hidden','true');
 root.style.visibility='hidden';
 root.innerHTML=
  '<div class="shb-offline-card">'+
   '<div class="shb-offline-brand"><span class="shb-offline-mark">S</span><span>SHBACE <b>MEDICAL</b></span><span class="shb-offline-pill" id="shbOfflinePill">ONE-TIME SETUP</span></div>'+
   '<div class="shb-offline-kicker" id="shbOfflineKicker">LOCAL INSTALLATION</div>'+
   '<h1 id="shbOfflineTitle">Prepare Shbace for offline study</h1>'+
   '<p class="shb-offline-intro" id="shbOfflineIntro"></p>'+
   '<div class="shb-offline-status" id="shbOfflineStatus" aria-live="polite">Preparing the installation checklist…</div>'+
   '<div id="shbOfflineProgress">'+
    '<div class="shb-offline-progress-head"><b id="shbOfflinePercent">0%</b><span id="shbOfflineCount">0 / 0 files</span></div>'+
    '<div class="shb-offline-track" role="progressbar" aria-label="Offline installation progress" aria-valuemin="0" aria-valuemax="100" aria-valuenow="0" id="shbOfflineTrack"><i id="shbOfflineBar"></i></div>'+
    '<div class="shb-offline-bytes"><span id="shbOfflineBytes">0 B / 0 B</span><span id="shbOfflineStage">Waiting</span></div>'+
    '<div class="shb-offline-stages" id="shbOfflineStages"></div>'+
   '</div>'+
   '<div class="shb-offline-warning" id="shbOfflineWarning"></div>'+
   '<div class="shb-offline-errors" id="shbOfflineErrors" hidden></div>'+
   '<button type="button" class="shb-offline-action" id="shbOfflineAction" disabled>Preparing…</button>'+
   '<button type="button" class="shb-offline-later" id="shbOfflineLater">Later</button>'+
   '<p class="shb-offline-footnote" id="shbOfflineFootnote">Your answers and study progress remain in the app’s existing local storage. The browser can still clear site data under storage pressure, so keep regular backups of your progress.</p>'+
  '</div>';
 document.body.appendChild(root);
 ui={
  root:root,
  pill:root.querySelector('#shbOfflinePill'),
  kicker:root.querySelector('#shbOfflineKicker'),
  title:root.querySelector('#shbOfflineTitle'),
  intro:root.querySelector('#shbOfflineIntro'),
  status:root.querySelector('#shbOfflineStatus'),
  progress:root.querySelector('#shbOfflineProgress'),
  percent:root.querySelector('#shbOfflinePercent'),
  count:root.querySelector('#shbOfflineCount'),
  track:root.querySelector('#shbOfflineTrack'),
  bar:root.querySelector('#shbOfflineBar'),
  bytes:root.querySelector('#shbOfflineBytes'),
  stage:root.querySelector('#shbOfflineStage'),
  stages:root.querySelector('#shbOfflineStages'),
  warning:root.querySelector('#shbOfflineWarning'),
  errors:root.querySelector('#shbOfflineErrors'),
  button:root.querySelector('#shbOfflineAction'),
  later:root.querySelector('#shbOfflineLater'),
  foot:root.querySelector('#shbOfflineFootnote')
 };
 ui.button.addEventListener('click',function(){
  if(ui.button.dataset.restart==='1'){location.reload();return}
  if(ui.button.dataset.done==='1'){removeSetupOverlay();return}
  if(ui.button.dataset.retryCheck==='1'){
   try{sessionStorage.removeItem(LATER_KEY)}catch(e){}
   location.reload();return;
  }
  startDownload();
 });
 ui.later.addEventListener('click',function(){
  if(started)return;
  try{sessionStorage.setItem(LATER_KEY,'1')}catch(e){}
  removeSetupOverlay();
 });
 return ui;
}
function removeSetupOverlay(){
 var element=ui&&ui.root;
 if(element&&element.parentNode)element.parentNode.removeChild(element);
}
function revealOverlay(){
 if(!ui||!ui.root||!ui.root.isConnected)return;
 var root=ui.root;
 root.classList.toggle('is-light',!!document.querySelector('.phone.light'));
 root.style.visibility='';
 root.removeAttribute('aria-hidden');
 root.classList.add('is-revealed');
 try{ui.button.focus({preventScroll:true})}catch(e){}
}
function showInstallHint(){
 if(!iosDevice())return;
 try{if(sessionStorage.getItem('shbace_pwa_install_hint_dismissed')==='1')return}catch(e){}
 var hint=document.createElement('div');
 hint.className='shb-pwa-install-hint';
 hint.innerHTML='<div><b>Install Shbace Medical for offline setup</b><span>In Safari, tap Share → Add to Home Screen, then open the new Shbace icon to download the full app once.</span></div><button type="button" aria-label="Dismiss">×</button>';
 hint.querySelector('button').addEventListener('click',function(){
  try{sessionStorage.setItem('shbace_pwa_install_hint_dismissed','1')}catch(e){}
  hint.remove();
 });
 document.body.appendChild(hint);
}

/* ───────────────────────── storage helpers ───────────────────────── */
function openDb(){
 return new Promise(function(resolve,reject){
  if(!window.indexedDB){reject(new Error('IndexedDB is not available in this browser.'));return}
  var request=indexedDB.open(DB_NAME,1);
  request.onupgradeneeded=function(){
   var database=request.result;
   if(!database.objectStoreNames.contains('meta'))database.createObjectStore('meta');
   if(!database.objectStoreNames.contains('verified'))database.createObjectStore('verified');
  };
  request.onsuccess=function(){resolve(request.result)};
  request.onerror=function(){reject(request.error||new Error('Could not open local installation storage.'))};
  request.onblocked=function(){reject(new Error('Local installation storage is busy. Close other Shbace tabs and retry.'))};
 });
}
var dbPromise=null;
function db(){if(!dbPromise)dbPromise=openDb();return dbPromise}
function dbGet(store,key){
 return db().then(function(database){
  return new Promise(function(resolve,reject){
   var tx=database.transaction(store,'readonly'),req=tx.objectStore(store).get(key);
   req.onsuccess=function(){resolve(req.result)};
   req.onerror=function(){reject(req.error||new Error('Could not read local installation state.'))};
   tx.onabort=function(){reject(tx.error||new Error('Local read was interrupted.'))};
  });
 });
}
function dbPut(store,key,value){
 return db().then(function(database){
  return new Promise(function(resolve,reject){
   var tx=database.transaction(store,'readwrite'),req=tx.objectStore(store).put(value,key);
   req.onsuccess=function(){resolve(true)};
   req.onerror=function(){reject(req.error||new Error('Could not save installation progress.'))};
   tx.onabort=function(){reject(tx.error||new Error('Local write was interrupted.'))};
  });
 });
}
function hashBytes(bytes){
 if(!window.crypto||!crypto.subtle)throw new Error('Secure file verification is unavailable. Open the installed app over HTTPS.');
 return crypto.subtle.digest('SHA-256',bytes).then(function(hash){
  return Array.from(new Uint8Array(hash)).map(function(b){return b.toString(16).padStart(2,'0')}).join('');
 });
}
function isQuotaError(e){return !!(e&&(e.name==='QuotaExceededError'||/quota/i.test(e.message||'')))}
function fileValid(c,file,checkHash){
 return c.match(urlFor(file.path)).then(function(response){
  if(!response||!response.ok)return false;
  return response.arrayBuffer().then(function(bytes){
   if(bytes.byteLength!==file.bytes)return false;
   if(!checkHash)return true;
   return hashBytes(bytes).then(function(sum){return sum===file.sha256});
  }).catch(function(){return false});
 }).catch(function(){return false});
}
function normalizeManifest(data){
 if(!data||data.schema!==1||!Array.isArray(data.files)||!data.files.length||!data.version)return null;
 var total=data.files.reduce(function(sum,f){return sum+(Number(f.bytes)||0)},0);
 data.totalBytes=Number(data.totalBytes)||total;
 data.fileCount=data.files.length;
 return data;
}
function readCachedJson(c,url){
 return c.match(url).then(function(hit){return hit&&hit.ok?hit.json():null}).catch(function(){return null});
}

/* ───────────────────────── silent check (runs under the splash) ───────────────────────── */
/* Reads the server's current package list. Network only (the service worker never answers this URL from a
   cache), with a short timeout so a weak connection can never hold the check hostage. Null = unknown / offline. */
function fetchRemoteManifest(){
 if(navigator.onLine===false)return Promise.resolve(null);
 var ctl=('AbortController' in window)?new AbortController():null,timer=null;
 var url=MANIFEST_URL+'?__shbace_integrity=manifest-'+Date.now();
 var request=fetch(url,{credentials:'same-origin',cache:'no-store',signal:ctl?ctl.signal:undefined}).then(function(r){
  if(!r.ok)throw new Error('HTTP '+r.status);
  return r.json();
 });
 var timeout=new Promise(function(resolve,reject){
  timer=setTimeout(function(){if(ctl)try{ctl.abort()}catch(e){}reject(new Error('timeout'))},REMOTE_TIMEOUT_MS);
 });
 return Promise.race([request,timeout]).then(function(data){clearTimeout(timer);return normalizeManifest(data)},function(){clearTimeout(timer);return null});
}
/* The manifest of the package that is verified and installed on this device. Older releases kept it under the
   network manifest URL, so that copy is accepted only when it matches the recorded installed version. */
function readInstalled(c){
 return dbGet('meta','ready').catch(function(){return null}).then(function(record){
  return readCachedJson(c,INSTALLED_URL).then(function(m){
   m=normalizeManifest(m);
   if(m)return {record:record||null,manifest:m};
   if(!record||!record.verified)return {record:record||null,manifest:null};
   return readCachedJson(c,MANIFEST_URL).then(function(legacy){
    legacy=normalizeManifest(legacy);
    return {record:record,manifest:legacy&&legacy.version===record.version?legacy:null};
   });
  });
 });
}
function auditFiles(c,m){
 return mapLimit(m.files,AUDIT_CONCURRENCY,function(f){
  return fileValid(c,f,true).then(function(ok){return ok?null:f.path});
 }).then(function(list){return list.filter(Boolean)});
}
function diffManifests(installed,remote){
 var before=Object.create(null),after=Object.create(null);
 installed.files.forEach(function(f){before[f.path]=f.sha256});
 remote.files.forEach(function(f){after[f.path]=1});
 return {
  changed:remote.files.filter(function(f){return before[f.path]!==f.sha256}),
  removed:installed.files.filter(function(f){return !after[f.path]}).map(function(f){return f.path})
 };
}
function writeInstalledState(c,manifestData){
 var record={version:manifestData.version,verified:true,fileCount:manifestData.files.length,totalBytes:manifestData.totalBytes,completedAt:Date.now()};
 return c.put(INSTALLED_URL,jsonResponse(manifestData))
  .then(function(){return dbPut('meta','ready',record)})
  .then(function(){return c.put(READY_URL,jsonResponse(record))});
}
function ensureReadyMarkers(c,installedManifest){
 return Promise.all([c.match(READY_URL),c.match(INSTALLED_URL)]).then(function(hits){
  if(hits[0]&&hits[1])return null;
  return writeInstalledState(c,installedManifest);
 }).catch(function(){});
}
function inspect(){
 return caches.open(CACHE_NAME).then(function(c){
  cache=c;
  var installedP=readInstalled(c).then(function(inst){
   var auditP=inst.manifest?auditFiles(c,inst.manifest):Promise.resolve([]);
   return auditP.then(function(bad){return {inst:inst,bad:bad}});
  });
  return Promise.all([installedP,fetchRemoteManifest()]).then(function(res){
   var inst=res[0].inst,bad=res[0].bad,remote=res[1],installed=inst.manifest;
   if(installed&&!bad.length){
    if(!remote||remote.version===installed.version){
     if(remote)caches.delete(STAGE_CACHE).catch(function(){});
     return ensureReadyMarkers(c,installed).then(function(){return {kind:'ready'}});
    }
    var d=diffManifests(installed,remote);
    if(!d.changed.length){
     /* only removals / metadata: nothing to download, adopt the new list silently */
     return Promise.all(d.removed.map(function(p){return c.delete(urlFor(p)).catch(function(){})}))
      .then(function(){return writeInstalledState(c,remote)})
      .then(function(){return {kind:'ready'}});
    }
    return {kind:'update',target:remote,installed:installed,changed:d.changed,removed:d.removed};
   }
   if(!remote)return {kind:'offline',hadPackage:!!(inst.record||installed),bad:bad};
   var removed=installed?diffManifests(installed,remote).removed:[];
   return {kind:(inst.record||installed)?'repair':'first',target:remote,installed:installed,bad:bad,removed:removed};
  });
 });
}

/* ───────────────────────── window content ───────────────────────── */
function buildPlan(s){
 var files=s.kind==='update'?s.changed:s.target.files;
 return {
  files:files,
  staging:s.kind==='update',
  totalBytes:files.reduce(function(sum,f){return sum+(Number(f.bytes)||0)},0)
 };
}
function stageMarkup(p){
 var counts={app:0,images:0,data:0,other:0};
 p.files.forEach(function(f){var g=fileGroup(f);counts[g]=(counts[g]||0)+1});
 ui.stages.innerHTML=STAGES.filter(function(s){return s.id!=='verify'&&(counts[s.id]||0)>0}).map(function(s){
  return '<div class="shb-offline-stage" data-stage="'+s.id+'"><span class="shb-offline-stage-dot"></span><span>'+s.label+'</span><b>0 / '+(counts[s.id]||0)+'</b></div>';
 }).join('')+
 '<div class="shb-offline-stage" data-stage="verify"><span class="shb-offline-stage-dot"></span><span>Integrity verification</span><b>Pending</b></div>';
 return counts;
}
function setStatus(text){if(ui)ui.status.textContent=text}
function setWarning(text){if(ui)ui.warning.textContent=text}
function setErrorList(items){
 if(!ui)return;
 if(!items.length){ui.errors.hidden=true;ui.errors.textContent='';return}
 ui.errors.hidden=false;
 ui.errors.innerHTML='<b>Files that still need attention</b><ul>'+items.slice(0,5).map(function(x){return '<li>'+esc(x)+'</li>'}).join('')+'</ul>';
}
function paintProgress(current,verifying){
 if(!ui||!plan)return;
 var total=plan.files.length,done=verifiedCount;
 var pct=total?Math.min(100,Math.floor(done*100/total)):0;
 if(verifying&&done===total)pct=99;
 ui.percent.textContent=pct+'%';
 ui.count.textContent=done+' / '+total+' files';
 ui.track.setAttribute('aria-valuenow',String(pct));
 ui.bar.style.width=pct+'%';
 ui.bytes.textContent=fmtBytes(verifiedBytes)+' / '+fmtBytes(plan.totalBytes);
 ui.stage.textContent=verifying?'Verifying stored files':(current||'Downloading');
 var nodes=ui.stages.querySelectorAll('[data-stage]');
 Array.prototype.forEach.call(nodes,function(node){
  var id=node.getAttribute('data-stage');
  if(id==='verify'){node.querySelector('b').textContent=verifying?'In progress':'Pending';node.classList.toggle('is-active',verifying);return}
  node.querySelector('b').textContent=(stageDone[id]||0)+' / '+(stageCounts[id]||0);
  node.classList.toggle('is-active',id===current);
  node.classList.toggle('is-done',(stageDone[id]||0)===(stageCounts[id]||0)&&(stageCounts[id]||0)>0);
 });
}
function addDone(file){
 if(donePaths[file.path])return;
 donePaths[file.path]=1;
 verifiedCount++;
 verifiedBytes+=Number(file.bytes)||0;
 var group=fileGroup(file);stageDone[group]=(stageDone[group]||0)+1;
 paintProgress(group,false);
}
function resetCounters(){
 verifiedCount=0;verifiedBytes=0;donePaths=Object.create(null);
 stageDone={app:0,images:0,data:0,other:0};
}
function setLater(label,visible){
 ui.later.textContent=label;
 ui.later.hidden=!visible;
}
/* Builds the whole window for the current state. Called while the splash is still running, so that revealing
   it later costs nothing. */
function prepareOverlay(s){
 mount();
 resetCounters();
 ui.button.dataset.done='0';ui.button.dataset.restart='0';ui.button.dataset.retryCheck='0';
 ui.progress.hidden=true;setErrorList([]);
 var kind=s.kind;
 if(kind==='first'||kind==='repair'||kind==='update'){
  plan=buildPlan(s);
  stageCounts=stageMarkup(plan);
  ui.progress.hidden=false;
  ui.count.textContent='0 / '+plan.files.length+' files';
  ui.bytes.textContent='0 B / '+fmtBytes(plan.totalBytes);
  ui.percent.textContent='0%';
  ui.bar.style.width='0%';
  ui.stage.textContent='Waiting';
  ui.button.disabled=false;
  setLater('Later',true);
 }
 if(kind==='first'){
  ui.pill.textContent='ONE-TIME SETUP';ui.kicker.textContent='LOCAL INSTALLATION';
  ui.title.textContent='Prepare Shbace for offline study';
  ui.intro.textContent='Download the complete app package once. We will save every required file on this device, verify it, and then use the local copy for your study sessions.';
  setStatus('Download the complete local package before using offline mode.');
  setWarning('One-time package · '+s.target.files.length+' files · '+fmtBytes(s.target.totalBytes)+'. Connect to the internet, tap the button, and keep the app open until verification completes.');
  ui.button.textContent='Start one-time download';
 }else if(kind==='update'){
  ui.pill.textContent='UPDATE';ui.kicker.textContent='UPDATE AVAILABLE';
  ui.title.textContent='A new version is ready';
  ui.intro.textContent='Only the files that changed are downloaded, and every one is verified before anything is replaced. Your answers, bookmarks and study progress are kept.';
  setStatus(s.changed.length+(s.changed.length===1?' changed file':' changed files')+' · '+fmtBytes(plan.totalBytes)+'.');
  setWarning('You can update later. The version already saved on this device keeps working offline until then.');
  ui.button.textContent='Update now';
 }else if(kind==='repair'){
  ui.pill.textContent='REPAIR';ui.kicker.textContent='OFFLINE PACKAGE';
  ui.title.textContent='Restore the offline package';
  ui.intro.textContent='Some saved files are missing or failed verification. Restore them to keep studying without an internet connection.';
  setStatus((s.bad&&s.bad.length?s.bad.length+' saved file(s) need to be restored. ':'')+'Verified files are reused and only the missing ones are downloaded.');
  setWarning('Package · '+s.target.files.length+' files · '+fmtBytes(s.target.totalBytes)+'. Connect to the internet and keep the app open until verification completes.');
  ui.button.textContent='Restore now';
 }else if(kind==='offline'){
  ui.pill.textContent=s.hadPackage?'REPAIR':'ONE-TIME SETUP';ui.kicker.textContent=s.hadPackage?'OFFLINE PACKAGE':'LOCAL INSTALLATION';
  ui.title.textContent=s.hadPackage?'Some offline files need restoring':'Offline setup needs internet';
  ui.intro.textContent=s.hadPackage
   ?'Some saved files are missing or failed verification, and the server could not be reached to restore them.'
   :'The server could not be reached to read the offline package list, so the one-time download cannot start yet.';
  setStatus('Connect to the internet, then choose Retry. You can keep using the app meanwhile.');
  setWarning('Nothing was deleted. Your answers and study progress are untouched.');
  ui.button.textContent='Retry setup';ui.button.disabled=false;ui.button.dataset.retryCheck='1';
  setLater('Continue',true);
 }else if(kind==='unavailable'){
  ui.pill.textContent='NOT SUPPORTED';ui.kicker.textContent='LOCAL INSTALLATION';
  ui.title.textContent='Offline mode is unavailable';
  ui.intro.textContent='';
  setStatus('This browser does not provide the storage features required for a verified offline installation.');
  setWarning('Use the latest Chrome and install Shbace Medical as an app. The app will keep working online.');
  ui.button.hidden=true;
  setLater('Continue',true);
 }else{
  ui.pill.textContent='SETUP';ui.kicker.textContent='LOCAL INSTALLATION';
  ui.title.textContent='Offline setup could not finish checking';
  ui.intro.textContent='';
  setStatus(s.message||'Could not read the offline installation state.');
  setWarning('Your previously saved files have not been deleted. Choose Retry setup, or continue and try again next time.');
  ui.button.textContent='Retry setup';ui.button.disabled=false;ui.button.dataset.retryCheck='1';
  setLater('Continue',true);
 }
}

/* ───────────────────────── download / update ───────────────────────── */
function waitForWorkerActivation(worker){
 return new Promise(function(resolve){
  var timer=null;
  function check(){
   if(worker.state==='activated'||worker.state==='redundant'){
    worker.removeEventListener('statechange',check);clearTimeout(timer);resolve();
   }
  }
  worker.addEventListener('statechange',check);
  timer=setTimeout(function(){worker.removeEventListener('statechange',check);resolve()},20000);
  check();
 });
}
function ensureServiceWorker(){
 if(!('serviceWorker' in navigator))return Promise.reject(new Error('This browser does not support Service Workers.'));
 return navigator.serviceWorker.getRegistration('./').then(function(reg){
  if(!reg)return navigator.serviceWorker.register('./sw.js',{scope:'./'});
  /* Pick up a newer worker first: it contains the network-only route used by the verified downloads. */
  return reg.update().catch(function(){}).then(function(){
   var candidate=reg.installing||reg.waiting;
   return candidate?waitForWorkerActivation(candidate).then(function(){return reg}):reg;
  });
 }).then(function(){return navigator.serviceWorker.ready});
}
function fetchAndStore(sink,file){
 var target=urlFor(file.path),lastError=null;
 /* Bypasses every cache (service-worker and HTTP): the bytes must come from the server and pass SHA-256
    before they are stored under the normal URL. */
 var freshTarget=target+(target.indexOf('?')>=0?'&':'?')+'__shbace_integrity='+encodeURIComponent(state.target.version.slice(0,16)+'-'+file.sha256.slice(0,16));
 function attempt(n){
  return fetch(freshTarget,{credentials:'same-origin',cache:'reload'}).then(function(response){
   if(!response||!response.ok)throw new Error('HTTP '+(response?response.status:'no response'));
   return response.arrayBuffer().then(function(bytes){
    if(bytes.byteLength!==file.bytes)throw new Error('Size check failed ('+bytes.byteLength+' of '+file.bytes+' bytes).');
    return hashBytes(bytes).then(function(sum){
     if(sum!==file.sha256)throw new Error('SHA-256 integrity check failed.');
     var headers=new Headers(response.headers);
     headers.delete('content-length');
     headers.delete('content-encoding');
     return sink.put(target,new Response(bytes,{status:200,statusText:'OK',headers:headers}));
    });
   });
  }).catch(function(error){
   lastError=error;
   if(isQuotaError(error))throw new Error('The device storage quota was exceeded. Free some device storage, then retry; verified files already saved will be kept.');
   if(n>=3)throw lastError;
   return wait(450*n).then(function(){return attempt(n+1)});
  });
 }
 return attempt(1);
}
function verifyList(c,files){
 setStatus('Checking that every downloaded file can be read from local storage…');
 paintProgress('verify',true);
 var checked=0;
 return mapLimit(files,AUDIT_CONCURRENCY,function(file){
  return fileValid(c,file,true).then(function(ok){
   if(!ok)errors.push(file.path+': missing or failed integrity check');
   checked++;
   if(checked%8===0||checked===files.length)ui.stage.textContent='Verifying '+checked+' / '+files.length;
  });
 });
}
/* Update only: copy the verified staged files into the installed package in one quick local step. */
function commitStaged(sink){
 setStatus('Applying the verified update…');
 ui.stage.textContent='Applying update';
 var files=plan.files,i=0;
 function next(){
  if(i>=files.length)return Promise.resolve();
  var f=files[i++],u=urlFor(f.path);
  return sink.match(u).then(function(resp){
   if(!resp)throw new Error(f.path+': staged copy is missing');
   return cache.put(u,resp);
  }).then(next);
 }
 return next().then(function(){
  return Promise.all((state.removed||[]).map(function(p){return cache.delete(urlFor(p)).catch(function(){})}));
 });
}
function finalizeInstall(){
 var target=state.target;
 var drop=Promise.resolve();
 if(!plan.staging&&state.removed&&state.removed.length){
  drop=Promise.all(state.removed.map(function(p){return cache.delete(urlFor(p)).catch(function(){})}));
 }
 return drop.then(function(){return writeInstalledState(cache,target)})
  .then(function(){return caches.delete(STAGE_CACHE).catch(function(){})});
}
function showComplete(){
 var restart=state.kind!=='first';
 ui.percent.textContent='100%';ui.count.textContent=plan.files.length+' / '+plan.files.length+' files';
 ui.track.setAttribute('aria-valuenow','100');ui.bar.style.width='100%';
 ui.bytes.textContent=fmtBytes(plan.totalBytes)+' / '+fmtBytes(plan.totalBytes);
 ui.stage.textContent='Verified and ready';
 var verifyRow=ui.stages.querySelector('[data-stage="verify"]');
 if(verifyRow){verifyRow.querySelector('b').textContent='Complete';verifyRow.classList.add('is-done');verifyRow.classList.remove('is-active')}
 if(restart){
  setStatus('Update installed and verified. Restart the app to start using the new version.');
  setWarning('All '+plan.files.length+' updated file(s) passed size and SHA-256 verification before they replaced the old ones. Your answers and study progress were not reset.');
  ui.button.textContent='Restart now';ui.button.dataset.restart='1';
  setLater('Later',true);
 }else{
  setStatus('Setup complete. Shbace Medical is ready to open from this device without an internet connection.');
  setWarning('All '+state.target.files.length+' required files were saved and verified locally. Your existing answers and study progress were not reset.');
  ui.button.textContent='Open Shbace Medical';ui.button.dataset.done='1';
  setLater('',false);
 }
 ui.button.disabled=false;ui.button.dataset.retryCheck='0';
 ui.foot.textContent='Offline package verified · '+fmtBytes(state.target.totalBytes)+' stored. Keep a JSON backup of your study progress.';
}
function showFailure(error){
 setStatus(error.message||'The offline download could not be completed.');
 setWarning('No file is marked complete unless the HTTP response, byte size, SHA-256 hash, and local cache write have all succeeded. Retry to continue from verified files.');
 setErrorList(errors.length?errors:[error.message||String(error)]);
 ui.button.disabled=false;ui.button.textContent='Retry download';ui.button.dataset.done='0';ui.button.dataset.restart='0';
 setLater('Later',true);
}
function startDownload(){
 if(started||!state||!state.target||!ui||!plan)return;
 started=true;errors=[];resetCounters();setErrorList([]);
 ui.button.dataset.retryCheck='0';ui.button.dataset.done='0';ui.button.dataset.restart='0';
 ui.button.disabled=true;ui.button.textContent='Downloading…';setLater('',false);
 setStatus('Preparing local storage and the download…');
 setWarning(plan.staging
  ?'Changed files are downloaded and verified first, then swapped in. The current version stays intact until then.'
  :'The download is resumable. Files already saved and verified will be skipped.');
 var staging=plan.staging,sink=null;
 Promise.resolve().then(function(){return ensureServiceWorker()})
 .then(function(){return caches.open(CACHE_NAME)})
 .then(function(c){
  cache=c;
  return staging?caches.open(STAGE_CACHE):caches.delete(STAGE_CACHE).catch(function(){}).then(function(){return c});
 }).then(function(s){
  sink=s;
  return dbPut('meta','progress',{version:state.target.version,startedAt:Date.now(),fileCount:plan.files.length});
 }).then(function(){
  var persistPromise=Promise.resolve(null);
  try{if(navigator.storage&&navigator.storage.persist)persistPromise=navigator.storage.persist()}catch(e){}
  return persistPromise;
 }).then(function(persisted){
  if(persisted===false)setWarning('The browser did not grant persistent storage. The app will work offline after verification, but the browser may still remove site data under storage pressure. Keep backups of your study progress.');
  return navigator.storage&&navigator.storage.estimate?navigator.storage.estimate().catch(function(){return null}):null;
 }).then(function(estimate){
  if(estimate&&Number.isFinite(estimate.quota)&&Number.isFinite(estimate.usage)){
   var free=Math.max(0,estimate.quota-estimate.usage),need=plan.totalBytes*(staging?2:1);
   if(free<need)setWarning('Available storage estimate ('+fmtBytes(free)+') is below what is needed ('+fmtBytes(need)+'). Free some space before continuing. Completed files will remain saved if the download stops.');
  }
  /* A first install / repair writes straight into the package, so the "ready" marker is dropped until it is complete again. */
  return staging?null:cache.delete(READY_URL);
 }).then(function(){
  var cursor=0;
  var workers=[];
  for(var w=0;w<DOWNLOAD_WORKERS;w++){
   workers.push((async function(){
    while(true){
     var i=cursor++;if(i>=plan.files.length)return;
     var file=plan.files[i];
     try{
      var valid=await fileValid(sink,file,true);
      if(!valid){
       if(!staging)await sink.delete(urlFor(file.path));
       await fetchAndStore(sink,file);
      }
      addDone(file);
     }catch(error){errors.push(file.path+': '+(error.message||String(error)))}
    }
   })());
  }
  return Promise.all(workers);
 }).then(function(){
  if(errors.length)throw new Error('Some files could not be downloaded. The saved files are kept; reconnect and retry the missing items.');
  return verifyList(sink,plan.files);
 }).then(function(){
  if(errors.length)throw new Error('The final integrity check found missing or unreadable files.');
  if(!staging)return null;
  return commitStaged(sink).then(function(){return verifyList(cache,plan.files)}).then(function(){
   if(errors.length)throw new Error('The updated files could not be read back after applying the update. Retry to repair them.');
  });
 }).then(function(){return finalizeInstall()})
 .then(showComplete)
 .catch(showFailure)
 .finally(function(){started=false});
}

/* ───────────────────────── start-up ───────────────────────── */
function waitForSplash(){
 return new Promise(function(resolve){
  var splash=document.getElementById('startupSplash');
  if(!splash||!splash.isConnected){resolve();return}
  var finished=false,observer=null,timer=null,poll=null;
  function finish(){
   if(finished)return;
   finished=true;
   if(observer)observer.disconnect();
   clearTimeout(timer);clearInterval(poll);
   resolve();
  }
  function check(){if(!splash.isConnected)finish()}
  /* Only the splash's own parent is observed (not the whole page): the app builds thousands of nodes under the splash. */
  try{observer=new MutationObserver(check);observer.observe(splash.parentNode||document.body,{childList:true})}catch(e){}
  poll=setInterval(check,400);
  timer=setTimeout(finish,14000);
 });
}
function present(s,splashFinished){
 state=s;
 prepareOverlay(s);
 return splashFinished.then(revealOverlay);
}
function start(){
 if(!standalone()){
  waitForSplash().then(showInstallHint);
  return;
 }
 if(!document.body)return;
 /* "Later" was chosen earlier in this app session (e.g. before a reload): stay out of the way until the next launch. */
 try{if(sessionStorage.getItem(LATER_KEY)==='1')return}catch(e){}
 var splashFinished=waitForSplash();
 if(!('caches' in window)||!window.crypto||!crypto.subtle||!window.indexedDB){
  present({kind:'unavailable'},splashFinished);
  return;
 }
 /* Runs underneath the splash: network list check, local SHA-256 audit and the window itself are all prepared
    during the seven seconds. Nothing is shown at all when the installed package is current and intact. */
 inspect().then(function(s){
  if(s.kind==='ready')return;
  /* Offline with a package already on the device: nothing can be restored right now, so stay silent;
     the next launch with a connection offers the repair. */
  if(s.kind==='offline'&&s.hadPackage)return;
  return present(s,splashFinished);
 }).catch(function(error){
  return present({kind:'error',message:error&&error.message},splashFinished);
 });
}
function boot(){start();}

if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});
else boot();
})();
