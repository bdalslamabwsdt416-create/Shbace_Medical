/* Shbace Medical — Offline System v2

   Principles
   - First install: show Setup immediately after the Splash finishes; download the complete package manifest and verify
     every file before releasing the app boot gate or allowing onboarding / question-bank modules to start.
   - Returning installs: trust the committed local ready record and open directly without a full-package hash scan.
   - Updates: check one manifest at most every 48 hours (or through the Settings action), stage only changed files,
     verify them and commit safely. Download progress is shown in the compact background chip.
   - Repair is targeted to files found missing or changed by a manifest comparison; no recurring whole-package scan.
   - If IndexedDB install markers are lost, recover from the Cache Storage ready marker and verify saved files before restoring metadata.
   - Every network step has a timeout and a stall watchdog. Interrupted downloads keep verified files for retry.

   Compatible with the previous version: same cache name, same IndexedDB state, same public window.* functions. */
(function(){
'use strict';

/* The page boot loader waits for this gate before loading question data or preloading app modules. */
var bootGateResolve=null,bootGateReleased=false;
window.__SHBACE_OFFLINE_BOOT_PROMISE__=new Promise(function(resolve){bootGateResolve=resolve;});
function releaseBootGate(){
 if(bootGateReleased)return;
 bootGateReleased=true;
 if(bootGateResolve){bootGateResolve(true);bootGateResolve=null;}
}

/* Native Capacitor builds ship the full asset bundle inside the APK. Nothing to do there. */
if(window.Capacitor&&typeof window.Capacitor.isNativePlatform==='function'&&window.Capacitor.isNativePlatform()){releaseBootGate();return;}
if(window.__SHBACE_OFFLINE_V2__){releaseBootGate();return;}
window.__SHBACE_OFFLINE_V2__=true;

/* ---------- constants ---------- */
/* NEVER rotate this name for an app release (must match sw.js). */
var CACHE_NAME='shbace-chrome-offline-v1.3.4';
var STAGING_NAME='shbace-staging-offline';
var DB_NAME='shbace-medical-offline-state-v1';
var INSTALLED_KEY='installed',STAGED_KEY='staged';
var CHECK_OK_KEY='shbace_pkg_check_ok_v1',CHECK_TRY_KEY='shbace_pkg_check_try_v1';
var PENDING_KEY='shbace_pkg_update_pending_v1',NOTIF_ID='update-available';
var VER_KEY='shbace_pkg_version_installed_v1',VER_AVAIL_KEY='shbace_pkg_version_available_v1',EXAM_KEY='shbace_exam_goal_planner_v1';
var DAY=86400000;
/* A single lightweight manifest check every 48 hours; manual Settings checks use the same updater. */
var CHECK_EVERY=48*3600000,CHECK_RETRY=2*3600000,SNOOZE_DAYS=2,EXAM_QUIET_DAYS=7;
var MANIFEST_TIMEOUT=10000,STALL_MS=45000,CONCURRENCY=3,MAX_TRIES=3,RETRY_DELAYS=[15000,60000,300000];
var MANIFEST_URL=new URL('./offline-assets-manifest.json',location.href).href;
var READY_URL=new URL('./__shbace_offline_ready__',location.href).href;
function manifestSnapshotUrl(version){return MANIFEST_URL+(MANIFEST_URL.indexOf('?')>=0?'&':'?')+'__shbace_offline_snapshot='+encodeURIComponent(String(version));}

/* ---------- small helpers ---------- */
function noop(){}
function wait(ms){return new Promise(function(r){setTimeout(r,ms)})}
function online(){return navigator.onLine!==false}
function lsNum(k){try{return Number(localStorage.getItem(k))||0}catch(e){return 0}}
function lsSet(k,v){try{localStorage.setItem(k,String(v))}catch(e){}}
function lsDel(k){try{localStorage.removeItem(k)}catch(e){}}
function lsGetJson(k){try{return JSON.parse(localStorage.getItem(k)||'null')}catch(e){return null}}
function lsSetJson(k,v){try{localStorage.setItem(k,JSON.stringify(v))}catch(e){}}
function esc(s){return String(s).replace(/[&<>"']/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]})}
function fmtBytes(n){
 if(!isFinite(n)||n<0)return 'Unknown';
 if(n<1024)return n+' B';
 var u=['KB','MB','GB'],v=n/1024,i=0;
 while(v>=1024&&i<u.length-1){v/=1024;i++}
 return v.toFixed(v>=10?1:2)+' '+u[i];
}
function urlFor(path){return new URL(path.split('/').map(encodeURIComponent).join('/'),new URL('./',location.href)).href}
function fileGroup(f){
 if(f.group)return f.group;
 if(/^assets\/img\//.test(f.path))return 'images';
 if(/^data\//.test(f.path))return 'data';
 return 'app';
}
var GROUP_ORDER={app:0,data:1,other:2,images:3};
function byPriority(a,b){return (GROUP_ORDER[fileGroup(a)]||0)-(GROUP_ORDER[fileGroup(b)]||0)}
function fileMap(files){var m={};files.forEach(function(f){m[f.path]={sha256:f.sha256,bytes:f.bytes}});return m}
function planOf(files,removed){return {files:files,removed:removed||[],bytes:files.reduce(function(s,f){return s+(Number(f.bytes)||0)},0)}}
function isQuota(e){return !!(e&&(e.name==='QuotaExceededError'||/quota/i.test(e.message||'')))}
function standalone(){
 try{return !!(navigator.standalone===true||(window.matchMedia&&(window.matchMedia('(display-mode: standalone)').matches||window.matchMedia('(display-mode: fullscreen)').matches)))}catch(e){return false}
}
function iosDevice(){return /iPad|iPhone|iPod/.test(navigator.userAgent||'')||(navigator.platform==='MacIntel'&&navigator.maxTouchPoints>1)}
function supported(){return !!(window.caches&&window.crypto&&crypto.subtle&&window.indexedDB&&('serviceWorker' in navigator))}
function autoAllowed(){
 /* Background downloads respect Data Saver and very slow connections. */
 var c=navigator.connection;
 if(c){if(c.saveData)return false;if(/2g/.test(c.effectiveType||''))return false}
 return true;
}
/* Ask the browser to protect this origin's offline package from automatic storage eviction.
   A denial is non-fatal: cached files are still recovered by their actual size and SHA-256. */
async function requestPersistentStorage(){
 try{
  if(!navigator.storage)return false;
  if(typeof navigator.storage.persisted==='function'&&await navigator.storage.persisted())return true;
  if(typeof navigator.storage.persist==='function')return await navigator.storage.persist();
 }catch(e){}
 return false;
}
function checkDue(){
 var now=Date.now(),ok=lsNum(CHECK_OK_KEY),tried=lsNum(CHECK_TRY_KEY);
 if(ok&&ok<=now&&now-ok<CHECK_EVERY)return false;
 if(tried&&tried<=now&&now-tried<CHECK_RETRY)return false;
 return true;
}
function examSoon(){
 var items=lsGetJson(EXAM_KEY);if(!Array.isArray(items))return false;
 var n=new Date(),t=Date.UTC(n.getFullYear(),n.getMonth(),n.getDate());
 return items.some(function(x){
  var p=String(x&&x.date||'').split('-').map(Number);if(p.length!==3||p.some(isNaN))return false;
  var d=Math.round((Date.UTC(p[0],p[1]-1,p[2])-t)/DAY);return d>=0&&d<=EXAM_QUIET_DAYS;
 });
}
function setPending(n){
 if(n>0)lsSet(PENDING_KEY,n);else lsDel(PENDING_KEY);
 try{
  if(n>0){if(typeof window.shbAddNotif==='function')window.shbAddNotif(NOTIF_ID,'A new update is available',n+' file'+(n===1?'':'s')+' changed. Open Settings → App updates → Check for updates to install it. Your progress is kept.','settings')}
  else if(typeof window.shbRemoveNotif==='function')window.shbRemoveNotif(NOTIF_ID);
 }catch(e){}
}
/* Version + short release notes from pwa-version.json (6 s limit). */
function fetchVersionInfo(){
 return new Promise(function(resolve){
  var done=false;function fin(v){if(!done){done=true;resolve(v)}}
  setTimeout(function(){fin(null)},6000);
  try{
   fetch(new URL('./pwa-version.json',location.href).href,{cache:'no-store',credentials:'same-origin'}).then(function(r){if(!r.ok)throw new Error('http');return r.json()}).then(function(j){
    var notes=Array.isArray(j.summary)?j.summary:(typeof j.summary==='string'&&j.summary?[j.summary]:(Array.isArray(j.releaseNotes)?j.releaseNotes.slice(0,3):[]));
    fin({version:String(j.version||''),displayVersion:String(j.displayVersion||j.version||''),releaseDate:String(j.releaseDate||''),
     notes:notes.slice(0,3).map(function(x){x=String(x);return x.length>150?x.slice(0,147)+'…':x})});
   }).catch(function(){fin(null)});
  }catch(e){fin(null)}
 });
}
function rememberInstalled(info){if(info)lsSetJson(VER_KEY,{displayVersion:info.displayVersion,releaseDate:info.releaseDate})}
function markInstalledNow(){
 var av=lsGetJson(VER_AVAIL_KEY);
 if(av){rememberInstalled(av);lsDel(VER_AVAIL_KEY)}else fetchVersionInfo().then(rememberInstalled);
}
function requestReload(){
 try{if(typeof window.shbaceRequestAppReload==='function')return !!window.shbaceRequestAppReload()}catch(e){}
 try{if(sessionStorage.getItem('shbace_v2_reloaded')==='1')return false;sessionStorage.setItem('shbace_v2_reloaded','1')}catch(e){}
 location.reload();return true;
}

/* ---------- IndexedDB (same database and stores as before) ---------- */
var dbp=null;
function isClosingDbError(e){
 var message=String(e&&e.message||e||'');
 return !!e&&(e.name==='InvalidStateError'||/database connection is closing|connection is closing/i.test(message));
}
function db(){
 if(!dbp){
  var pending;
  pending=new Promise(function(res,rej){
   if(!window.indexedDB){rej(new Error('IndexedDB is not available.'));return}
   var q=indexedDB.open(DB_NAME,1);
   q.onupgradeneeded=function(){var d=q.result;
    if(!d.objectStoreNames.contains('meta'))d.createObjectStore('meta');
    if(!d.objectStoreNames.contains('verified'))d.createObjectStore('verified');};
   q.onsuccess=function(){
    var d=q.result;
    /* A newer app/tab may request a schema change. Drop this cached handle before closing it,
       so the next operation opens a fresh connection instead of reusing a closing database. */
    d.onversionchange=function(){
     if(dbp===pending)dbp=null;
     try{d.close()}catch(e){}
    };
    /* Browsers can also close a connection unexpectedly (for example, storage pressure). */
    d.onclose=function(){if(dbp===pending)dbp=null};
    res(d);
   };
   q.onerror=function(){rej(q.error||new Error('Could not open local storage.'))};
   q.onblocked=function(){rej(new Error('Local storage is busy. Close other Shbace tabs.'))};
  });
  dbp=pending;
  pending.catch(function(){if(dbp===pending)dbp=null});
 }
 return dbp;
}
function dbOp(store,mode,fn,attempt){
 attempt=attempt||0;
 var connectionPromise=db();
 return connectionPromise.then(function(d){return new Promise(function(res,rej){
  var tx,req,settled=false;
  function fail(err){
   if(settled)return;
   settled=true;
   /* Retry once only when the connection itself is closing. Ordinary storage errors
      still surface to the existing recovery flow and are never hidden. */
   if(isClosingDbError(err)&&attempt<1){
    if(dbp===connectionPromise)dbp=null;
    dbOp(store,mode,fn,attempt+1).then(res,rej);
    return;
   }
   rej(err||new Error('Local storage transaction failed.'));
  }
  try{
   tx=d.transaction(store,mode);
   req=fn(tx.objectStore(store));
  }catch(e){fail(e);return}
  tx.oncomplete=function(){if(settled)return;settled=true;res(req&&req.result)};
  tx.onabort=tx.onerror=function(){fail(tx.error||new Error('Local storage transaction failed.'))};
 })});
}
function dbGet(s,k){return dbOp(s,'readonly',function(o){return o.get(k)})}
function dbPut(s,k,v){return dbOp(s,'readwrite',function(o){return o.put(v,k)})}

/* ---------- state machine + UI ----------
   boot → ready | installing | repairing | updating → update-ready → ready
   needs-network / error are recoverable and retry on their own. */
var state='boot',S={pct:0,done:0,total:0,bytes:0,totalBytes:0,msg:'',announce:false};
var splashDone=false,splashP=null,chip=null,lastPaint='',announceTimer=null;
var setupUi=null,setupPlan=null,setupFails=0,setupSkipped=false,silentReinstall=false;
/* Emergency exit: after 3 failed Setup attempts the student may continue online instead of being stuck on Setup.
   Nothing is marked as installed, so the next launch runs Setup again. */
function paintSkip(){
 if(!setupUi||!setupUi.skip||!setupUi.root||!setupUi.root.isConnected)return;
 setupUi.skip.style.display=(state==='error'&&setupFails>=3)?'':'none';
}
function setState(s,extra){
 state=s;
 if(s==='error'&&setupUi)setupFails++;
 if(extra){for(var k in extra)if(Object.prototype.hasOwnProperty.call(extra,k))S[k]=extra[k]}
 paintChip();
 paintSetupOverlay();
 paintSkip();
}
function mountSetupOverlay(){
 if(setupUi&&setupUi.root&&setupUi.root.isConnected)return setupUi;
 var root=document.createElement('div');
 root.id='shbaceOfflineSetup';root.className='shb-offline-setup';
 root.setAttribute('role','dialog');root.setAttribute('aria-modal','true');root.setAttribute('aria-labelledby','shbOfflineTitle');
 root.innerHTML=
  '<div class="shb-offline-card">'+
   '<div class="shb-offline-brand"><span class="shb-offline-mark">S</span><span>SHBACE <b>MEDICAL</b></span><span class="shb-offline-pill">ONE-TIME SETUP</span></div>'+
   '<div class="shb-offline-kicker">LOCAL INSTALLATION</div>'+
   '<h1 id="shbOfflineTitle">Prepare Shbace for offline study</h1>'+
   '<p class="shb-offline-intro">Download the complete app package once. Setup saves and verifies every required application file, including onboarding resources and all question banks.</p>'+
   '<div class="shb-offline-status" id="shbOfflineStatus" aria-live="polite">Preparing the installation checklist…</div>'+
   '<div class="shb-offline-progress-head"><b id="shbOfflinePercent">0%</b><span id="shbOfflineCount">0 / 0 files</span></div>'+
   '<div class="shb-offline-track" id="shbOfflineTrack" role="progressbar" aria-label="Offline installation progress" aria-valuemin="0" aria-valuemax="100" aria-valuenow="0"><i id="shbOfflineBar"></i></div>'+
   '<div class="shb-offline-bytes"><span id="shbOfflineBytes">0 B / 0 B</span><span id="shbOfflineStage">Preparing</span></div>'+
   '<div class="shb-offline-stages" id="shbOfflineStages">'+
    '<div class="shb-offline-stage"><span class="shb-offline-stage-dot"></span><span>Application and interface files</span><b>Included</b></div>'+
    '<div class="shb-offline-stage"><span class="shb-offline-stage-dot"></span><span>Question banks and learning data</span><b>Included</b></div>'+
    '<div class="shb-offline-stage"><span class="shb-offline-stage-dot"></span><span>Images, icons, fonts and resources</span><b>Included</b></div>'+
    '<div class="shb-offline-stage" id="shbOfflineVerify"><span class="shb-offline-stage-dot"></span><span>File integrity verification</span><b>Pending</b></div>'+
   '</div>'+
   '<div class="shb-offline-warning" id="shbOfflineWarning">Keep the app open and connected to the internet until the complete package is verified.</div>'+
   '<div class="shb-offline-errors" id="shbOfflineErrors" hidden></div>'+
   '<button type="button" class="shb-offline-action" id="shbOfflineAction" disabled>Preparing…</button>'+
   '<button type="button" class="shb-offline-action" id="shbOfflineSkip" style="display:none;margin-top:10px">Continue online</button>'+
   '<p class="shb-offline-footnote">Your existing answers, notes, bookmarks and study progress are kept in the current To Me storage.</p>'+
  '</div>';
 document.body.appendChild(root);
 setupUi={
  root:root,status:root.querySelector('#shbOfflineStatus'),percent:root.querySelector('#shbOfflinePercent'),
  count:root.querySelector('#shbOfflineCount'),track:root.querySelector('#shbOfflineTrack'),bar:root.querySelector('#shbOfflineBar'),
  bytes:root.querySelector('#shbOfflineBytes'),stage:root.querySelector('#shbOfflineStage'),verify:root.querySelector('#shbOfflineVerify'),
  warning:root.querySelector('#shbOfflineWarning'),errors:root.querySelector('#shbOfflineErrors'),button:root.querySelector('#shbOfflineAction'),skip:root.querySelector('#shbOfflineSkip')
 };
 setupUi.button.addEventListener('click',function(){
  var action=setupUi.button.getAttribute('data-action');
  if(action==='open'||action==='continue'){
   setupUi.root.remove();setupUi=null;releaseBootGate();return;
  }
  if(action==='retry'){
   setupUi.button.disabled=true;setupUi.button.textContent='Retrying…';setupUi.button.removeAttribute('data-action');
   retryN=0;runFullCheck({force:true,firstInstall:true});return;
  }
 });
 setupUi.skip.addEventListener('click',function(){
  /* Stop every pending Setup retry so the overlay cannot come back over the running app. */
  setupSkipped=true;clearTimeout(retryTimer);retryTimer=null;
  setupUi.root.remove();setupUi=null;
  setState('ready');releaseBootGate();
 });
 if(document.querySelector('.phone.light'))root.classList.add('is-light');
 paintSetupOverlay();
 return setupUi;
}
function paintSetupOverlay(){
 if(!setupUi||!setupUi.root||!setupUi.root.isConnected)return;
 var total=S.total||(setupPlan&&setupPlan.files?setupPlan.files.length:0);
 var done=S.done||0,pct=Math.max(0,Math.min(100,Number(S.pct)||0));
 if(state==='setup-complete'){done=total;pct=100;}
 setupUi.percent.textContent=pct+'%';
 setupUi.count.textContent=done+' / '+total+' files';
 setupUi.track.setAttribute('aria-valuenow',String(pct));
 setupUi.bar.style.width=pct+'%';
 setupUi.bytes.textContent=fmtBytes(S.bytes)+' / '+fmtBytes(S.totalBytes||(setupPlan&&setupPlan.bytes)||0);
 setupUi.stage.textContent=state==='setup-complete'?'Verified and ready':(state==='installing'?'Downloading and verifying':(state==='error'||state==='needs-network'?'Action required':'Preparing'));
 var message='Preparing the complete offline package…';
 var warning='Setup downloads and verifies the full application package before onboarding starts.';
 if(state==='installing'){message='Downloading the complete app package…';warning='Every file is checked by size and SHA-256 before it is accepted. Keep the app open until setup completes.';}
 if(state==='needs-network'){message='An internet connection is required for the first setup.';warning='Connect to the internet, then retry. No student data has been changed.';}
 if(state==='error'){message=S.msg||'The installation could not be completed.';warning='Verified files are kept. Reconnect if needed, then retry setup; incomplete files are not marked as installed.';}
 if(state==='setup-complete'){message='Setup complete. All application files have been saved and verified.';warning='The first onboarding screen will open next. After this, the app opens from its local files.';}
 if(state==='unsupported'){message=S.msg||'Verified offline setup is not supported in this browser.';warning='You may continue online, but offline installation cannot be verified on this device.';}
 setupUi.status.textContent=message;setupUi.warning.textContent=warning;
 setupUi.errors.hidden=state!=='error';setupUi.errors.textContent=state==='error'?(S.msg||'Setup failed.'):'';
 var verify=setupUi.verify;
 if(verify){verify.querySelector('b').textContent=state==='setup-complete'?'Complete':(state==='installing'?'Checking files':'Pending');verify.classList.toggle('is-done',state==='setup-complete');verify.classList.toggle('is-active',state==='installing');}
 if(state==='setup-complete'){
  setupUi.button.disabled=false;setupUi.button.textContent='Open Shbace Medical';setupUi.button.setAttribute('data-action','open');
 }else if(state==='error'||state==='needs-network'){
  setupUi.button.disabled=false;setupUi.button.textContent='Retry setup';setupUi.button.setAttribute('data-action','retry');
 }else if(state==='unsupported'){
  setupUi.button.disabled=false;setupUi.button.textContent='Continue online';setupUi.button.setAttribute('data-action','continue');
 }else{
  setupUi.button.disabled=true;setupUi.button.textContent=state==='installing'?'Installing…':'Preparing…';setupUi.button.removeAttribute('data-action');
 }
}
function injectCss(){
 if(document.getElementById('shbOfflineCss'))return;
 var st=document.createElement('style');st.id='shbOfflineCss';
 st.textContent=
 '#shbOfflineChip{position:fixed;left:12px;right:12px;bottom:calc(86px + env(safe-area-inset-bottom,0px));z-index:99990;max-width:420px;margin:0 auto;display:none;align-items:center;gap:10px;padding:10px 14px;border-radius:16px;border:1px solid rgba(95,169,225,.4);background:linear-gradient(150deg,#0e2a4e,#071a33);color:#eaf4ff;font:13px system-ui,sans-serif;box-shadow:0 8px 24px rgba(0,0,0,.4)}'+
 '#shbOfflineChip.on{display:flex}'+
 '#shbOfflineChip .t{flex:1;min-width:0}#shbOfflineChip .m{display:block;line-height:1.35}'+
 '#shbOfflineChip .bar{display:none;height:4px;border-radius:3px;background:rgba(255,255,255,.16);margin-top:7px;overflow:hidden}'+
 '#shbOfflineChip .bar.on{display:block}#shbOfflineChip .bar b{display:block;height:100%;width:0;background:#3b8bff;transition:width .3s}'+
 '#shbOfflineChip button{display:none;min-height:34px;padding:0 14px;border-radius:10px;border:1px solid #3b8bff;background:#1f6fe0;color:#fff;font:inherit;font-weight:700;cursor:pointer}'+
 '#shbOfflineChip button.on{display:block}'+
 '#shbaceUpdateSheet{position:fixed;left:12px;right:12px;bottom:calc(86px + env(safe-area-inset-bottom,0px));z-index:99991;max-width:520px;max-height:70vh;overflow:auto;margin:0 auto;padding:14px 16px;border-radius:18px;border:1px solid rgba(95,169,225,.4);background:linear-gradient(150deg,#0e2a4e,#071a33);color:#eaf4ff;box-shadow:0 10px 30px rgba(0,0,0,.45);font:14px system-ui,sans-serif}'+
 '#shbaceUpdateSheet b{display:block;font-size:15px;margin-bottom:4px}#shbaceUpdateSheet span{display:block;color:#a9c4de;line-height:1.45;font-size:12.5px}'+
 '#shbaceUpdateSheet div{display:flex;gap:8px;margin-top:12px}#shbaceUpdateSheet button{flex:1;min-height:42px;border-radius:12px;border:1px solid rgba(95,169,225,.4);background:rgba(8,25,48,.7);color:#eaf4ff;font:inherit;font-weight:700;cursor:pointer}'+
 '#shbaceUpdateSheet button.go{background:#1f6fe0;border-color:#3b8bff}';
 document.head.appendChild(st);
}
function ensureChip(){
 if(chip&&chip.isConnected)return chip;
 injectCss();
 chip=document.createElement('div');chip.id='shbOfflineChip';chip.setAttribute('role','status');chip.setAttribute('aria-live','polite');
 chip.innerHTML='<div class="t"><span class="m"></span><span class="bar"><b></b></span></div><button type="button"></button>';
 chip.querySelector('button').addEventListener('click',function(e){onAction(e.currentTarget.getAttribute('data-act'))});
 document.body.appendChild(chip);
 return chip;
}
function paintChip(){
 if(!document.body||!splashDone)return;
 var text='',pct=null,act='',label='',show=false;
 switch(state){
  case 'installing':show=true;text='Downloading offline package · '+S.pct+'%';pct=S.pct;break;
  case 'repairing':show=true;text=(S.msg||'Repairing local files')+' · '+S.pct+'%';pct=S.pct;break;
  case 'updating':show=true;text='Downloading update · '+S.pct+'%';pct=S.pct;break;
  case 'update-ready':if(!examSoon()){show=true;text='Update ready';act='restart';label='Restart'}break;
  case 'needs-network':show=true;text='Connect to the internet once to finish offline setup';act='retry';label='Retry';break;
  case 'error':show=true;text=S.msg||'Offline setup paused. It will retry automatically.';act='retry';label='Retry';break;
  case 'ready':if(S.announce){show=true;text='Ready offline ✓'}break;
 }
 var key=[show,text,pct,act].join('|');
 if(key===lastPaint)return;
 lastPaint=key;
 if(!show){if(chip)chip.classList.remove('on');return}
 var c=ensureChip();
 c.querySelector('.m').textContent=text;
 var bar=c.querySelector('.bar');
 if(pct===null)bar.classList.remove('on');else{bar.classList.add('on');bar.firstChild.style.width=pct+'%'}
 var b=c.querySelector('button');
 if(act){b.textContent=label;b.setAttribute('data-act',act);b.classList.add('on')}else b.classList.remove('on');
 c.classList.add('on');
}
function announceReady(){
 setState('ready',{announce:true});
 clearTimeout(announceTimer);
 announceTimer=setTimeout(function(){if(state==='ready')setState('ready',{announce:false})},3500);
}
function onAction(act){
 if(act==='retry'){retryN=0;runFullCheck({force:true})}
 else if(act==='restart')applyStagedNow();
}
function showUpdateSheet(p,info){
 if(document.getElementById('shbaceUpdateSheet'))return;
 injectCss();
 var el=document.createElement('div');el.id='shbaceUpdateSheet';el.setAttribute('role','dialog');
 var notes=(info&&info.notes&&info.notes.length)?'<ul style="margin:8px 0 0;padding-left:18px;color:#a9c4de;font-size:12px;line-height:1.45">'+info.notes.map(function(x){return '<li>'+esc(x)+'</li>'}).join('')+'</ul>':'';
 el.innerHTML='<b>Update available'+(info&&info.displayVersion?' · '+esc(info.displayVersion):'')+'</b><span>'+p.files.length+' changed file'+(p.files.length===1?'':'s')+' · '+fmtBytes(p.bytes)+'. Only the changes are downloaded in the background; your progress is kept.</span>'+notes+'<div><button type="button" id="shbUpdLater">Later</button><button type="button" class="go" id="shbUpdNow">Update now</button></div>';
 document.body.appendChild(el);
 el.querySelector('#shbUpdLater').addEventListener('click',function(){
  /* Ask again after SNOOZE_DAYS. The bell notification stays. */
  lsSet(CHECK_OK_KEY,Date.now()-(CHECK_EVERY-SNOOZE_DAYS*DAY));el.remove();
 });
 el.querySelector('#shbUpdNow').addEventListener('click',function(){el.remove();startPlan(p,'update')});
}
function showSheetLater(p,info){(splashP||Promise.resolve()).then(function(){showUpdateSheet(p,info)})}
function showInstallHint(){
 if(!iosDevice())return;
 try{if(sessionStorage.getItem('shbace_pwa_install_hint_dismissed')==='1')return}catch(e){}
 var hint=document.createElement('div');
 hint.className='shb-pwa-install-hint';
 hint.innerHTML='<div><b>Install Shbace Medical for offline use</b><span>In Safari, tap Share → Add to Home Screen, then open the new Shbace icon. It saves the app in the background, once.</span></div><button type="button" aria-label="Dismiss">×</button>';
 hint.querySelector('button').addEventListener('click',function(){
  try{sessionStorage.setItem('shbace_pwa_install_hint_dismissed','1')}catch(e){}
  hint.remove();
 });
 document.body.appendChild(hint);
}
function waitForSplash(){
 return new Promise(function(resolve){
  var splash=document.getElementById('startupSplash');
  if(!splash||!splash.isConnected){resolve();return}
  var finished=false,timer=null,observer=null;
  function done(){
   if(finished)return;finished=true;
   if(timer)clearTimeout(timer);
   if(observer)observer.disconnect();
   document.removeEventListener('spEcgDone',onEcgDone);
   resolve();
  }
  function onEcgDone(){/* Let the existing ECG fade finish before Setup covers the Splash. */setTimeout(done,650)}
  document.addEventListener('spEcgDone',onEcgDone,{once:true});
  /* Reduced-motion mode completes the splash trace synchronously without dispatching spEcgDone. */
  try{
   if(window.matchMedia&&window.matchMedia('(prefers-reduced-motion: reduce)').matches){
    var ready=document.getElementById('startupSplash');
    if(ready&&ready.classList.contains('sp-ready'))setTimeout(done,1200);
    else{
     observer=new MutationObserver(function(){if(ready&&ready.classList.contains('sp-ready')){observer.disconnect();setTimeout(done,1200)}});
     observer.observe(ready,{attributes:true,attributeFilter:['class']});
    }
   }
  }catch(e){}
  /* Safety fallback for browsers where Worker / ECG completion events are unavailable. */
  timer=setTimeout(done,10500);
 });
}

/* ---------- storage / network primitives ---------- */
function sha256(buf){
 return crypto.subtle.digest('SHA-256',buf).then(function(h){
  return Array.prototype.map.call(new Uint8Array(h),function(b){return b.toString(16).padStart(2,'0')}).join('');
 });
}
function urlSetOf(cache){
 return cache.keys().then(function(reqs){var m=Object.create(null);reqs.forEach(function(r){m[r.url]=1});return m});
}
function validManifest(d){return !!(d&&d.schema===1&&Array.isArray(d.files)&&d.files.length&&d.version)}

var manifest=null,manifestFromNetwork=false;
async function loadManifest(){
 var c=await caches.open(CACHE_NAME),data=null;
 manifestFromNetwork=false;
 var ctl=new AbortController(),t=setTimeout(function(){ctl.abort()},MANIFEST_TIMEOUT);
 try{
  var r=await fetch(MANIFEST_URL,{credentials:'same-origin',cache:'no-store',signal:ctl.signal});
  if(!r.ok)throw new Error('Manifest returned HTTP '+r.status);
  var copy=r.clone();
  data=await r.json();
  if(!validManifest(data))throw new Error('Offline asset manifest is invalid.');
  manifestFromNetwork=true;
  c.put(MANIFEST_URL,copy).catch(noop);
 }catch(err){
  var hit=await c.match(MANIFEST_URL);
  if(!hit)throw err;
  data=await hit.json();
  if(!validManifest(data))throw err;
 }finally{clearTimeout(t)}
 data.totalBytes=Number(data.totalBytes)||data.files.reduce(function(s,f){return s+(Number(f.bytes)||0)},0);
 return data;
}
/* Streaming download with a total timeout; reports bytes as they arrive (feeds the stall watchdog). */
async function fetchBytes(url,ms,outer,onBytes){
 var ctl=new AbortController(),t=setTimeout(function(){ctl.abort()},ms),got=0;
 function onAbort(){ctl.abort()}
 if(outer){if(outer.aborted)ctl.abort();else outer.addEventListener('abort',onAbort,{once:true})}
 try{
  var r=await fetch(url,{credentials:'same-origin',cache:'reload',signal:ctl.signal});
  if(!r.ok)throw new Error('HTTP '+r.status);
  var buf;
  if(r.body&&r.body.getReader){
   var rd=r.body.getReader(),chunks=[];
   for(;;){var x=await rd.read();if(x.done)break;chunks.push(x.value);got+=x.value.length;onBytes(x.value.length)}
   var out=new Uint8Array(got),o=0;
   chunks.forEach(function(c){out.set(c,o);o+=c.length});
   buf=out.buffer;
  }else{buf=await r.arrayBuffer();got=buf.byteLength;onBytes(got)}
  return {buf:buf,headers:r.headers,got:got};
 }catch(e){if(got)onBytes(-got);throw e}
 finally{clearTimeout(t);if(outer)outer.removeEventListener('abort',onAbort)}
}

/* ---------- run engine ---------- */
var busy=false,runCtl=null,watchdog=null,lastProgress=0,stalled=false,retryN=0,retryTimer=null,started=false;
var recoveryNeedsRepair=false,recoveryCheckAt=0;
function tick(){lastProgress=Date.now()}
function startWatchdog(){
 stopWatchdog();tick();stalled=false;
 watchdog=setInterval(function(){
  if(Date.now()-lastProgress>STALL_MS){stalled=true;try{runCtl.abort()}catch(e){}}
 },5000);
}
function stopWatchdog(){if(watchdog){clearInterval(watchdog);watchdog=null}}
function bump(n){
 S.bytes=Math.max(0,S.bytes+n);
 S.pct=S.totalBytes?Math.min(99,Math.floor(S.bytes*100/S.totalBytes)):0;
 if(n>0)tick();
 paintChip();
 paintSetupOverlay();
}
function scheduleRetry(){
 if(setupSkipped||retryTimer||retryN>=RETRY_DELAYS.length)return;
 var d=RETRY_DELAYS[retryN++];
 retryTimer=setTimeout(function(){retryTimer=null;if(!busy&&online())runFullCheck({force:true})},d);
}
function friendly(e){
 if(!e)return 'Unknown error';
 if(isQuota(e))return 'Device storage is full. Free some space; saved files are kept.';
 if(e.name==='AbortError')return stalled?'Connection stalled. Retrying automatically.':'Interrupted. Retrying automatically.';
 return e.message||String(e);
}
async function isVerified(f,tname,target){
 /* IndexedDB is an acceleration/index, not the source of truth for saved bytes.
    Chrome may evict or lose its metadata while Cache Storage still contains the package.
    Revalidate the actual cached response and rebuild the per-file record when it is intact. */
 var response=await target.match(urlFor(f.path));
 if(!response||!response.ok)return false;
 var bytes=await response.arrayBuffer();
 if(bytes.byteLength!==Number(f.bytes))return false;
 if((await sha256(bytes))!==f.sha256)return false;
 await markVerified(f,tname);
 return true;
}
function markVerified(f,tname){return dbPut('verified',tname+'|'+f.path,f.sha256).catch(noop)}

async function downloadFile(f,target,sig){
 var url=urlFor(f.path);
 var fresh=url+(url.indexOf('?')>=0?'&':'?')+'__shbace_integrity='+encodeURIComponent(manifest.version+'-'+f.sha256.slice(0,16));
 var timeout=Math.min(120000,20000+Math.ceil((Number(f.bytes)||0)/30720)*1000);
 for(var n=1;;n++){
  var r=null;
  try{
   r=await fetchBytes(fresh,timeout,sig,bump);
   if(r.buf.byteLength!==f.bytes)throw new Error('Size check failed ('+r.buf.byteLength+' of '+f.bytes+' bytes).');
   if((await sha256(r.buf))!==f.sha256)throw new Error('SHA-256 integrity check failed.');
   var h=new Headers(r.headers);h.delete('content-length');h.delete('content-encoding');
   await target.put(url,new Response(r.buf,{status:200,statusText:'OK',headers:h}));
   return;
  }catch(e){
   if(r)bump(-r.got);
   if(sig.aborted||isQuota(e)||n>=MAX_TRIES)throw e;
   await wait(400*n*n+Math.random()*300);
  }
 }
}

async function saveInstalled(m){
 var total=m.files.reduce(function(s,f){return s+(Number(f.bytes)||0)},0),at=Date.now();
 var c=await caches.open(CACHE_NAME);
 /* Persist the manifest first; READY_URL is the final commit marker for cache-based recovery. */
 await c.put(MANIFEST_URL,new Response(JSON.stringify(m),{status:200,headers:{'content-type':'application/json'}}));
 await c.put(manifestSnapshotUrl(m.version),new Response(JSON.stringify(m),{status:200,headers:{'content-type':'application/json'}}));
 await dbPut('meta',INSTALLED_KEY,{version:m.version,files:fileMap(m.files),verified:true,fileCount:m.files.length,totalBytes:total,completedAt:at});
 await dbPut('meta','ready',{version:m.version,verified:true,fileCount:m.files.length,totalBytes:total,completedAt:at});
 await c.put(READY_URL,new Response(JSON.stringify({version:m.version,verified:true,completedAt:at}),{status:200,headers:{'content-type':'application/json'}}));
 recoveryNeedsRepair=false;
}

/* Download a plan. mode: install | repair (straight into the live cache) or update (into staging, swapped later). */
async function runPlan(plan,mode){
 var staged=mode==='update',tname=staged?STAGING_NAME:CACHE_NAME;
 window.__SHBACE_OFFLINE_UPDATE_ACTIVE__=staged;
 runCtl=new AbortController();
 var sig=runCtl.signal,errors=[],fatal=null;
 try{
  var target=await caches.open(tname);
  setState(mode==='update'?'updating':(mode==='repair'?'repairing':'installing'),{done:0,total:plan.files.length,bytes:0,totalBytes:plan.bytes,pct:0,msg:''});
  startWatchdog();
  /* Persistent-storage permission was requested once during boot; do not fire-and-forget here. */
  var files=plan.files.slice().sort(byPriority),cursor=0;
  var worker=async function(){
   while(!sig.aborted){
    var i=cursor++;if(i>=files.length)return;
    var f=files[i];
    try{
     if(await isVerified(f,tname,target)){bump(Number(f.bytes)||0)}
     else{await target.delete(urlFor(f.path));await downloadFile(f,target,sig);await markVerified(f,tname)}
     S.done++;tick();paintSetupOverlay();
    }catch(e){
     if(sig.aborted)return;
     if(isQuota(e)){fatal=e;runCtl.abort();return}
     errors.push(f.path+': '+friendly(e));
    }
   }
  };
  var pool=[];for(var w=0;w<CONCURRENCY;w++)pool.push(worker());
  await Promise.all(pool);
  if(fatal)throw fatal;
  if(sig.aborted){var ab=new Error(stalled?'Connection stalled. Retrying automatically.':'Interrupted. Retrying automatically.');throw ab}
  if(errors.length)throw new Error('Some files could not be downloaded ('+errors.length+'). Saved files are kept; retrying automatically.');
  var have=await urlSetOf(target);
  var missing=plan.files.filter(function(f){return !have[urlFor(f.path)]});
  if(missing.length)throw new Error('The final check found '+missing.length+' missing file(s). Retrying automatically.');

  if(staged){
   await dbPut('meta',STAGED_KEY,{ready:true,version:manifest.version,paths:plan.files.map(function(f){return f.path}),removed:plan.removed,manifest:manifest});
   lsSet(CHECK_OK_KEY,Date.now());retryN=0;
   setState('update-ready',{pct:100});
  }else{
   await saveInstalled(manifest);
   for(var j=0;j<plan.removed.length;j++)await (await caches.open(CACHE_NAME)).delete(urlFor(plan.removed[j]));
   lsSet(CHECK_OK_KEY,Date.now());retryN=0;setPending(0);markInstalledNow();
   if(mode==='install'){
    /* The verified package is now complete, so register the worker only after Setup has finished its downloads. */
    registerSW();
    if(silentReinstall){silentReinstall=false;announceReady()}
    else setState('setup-complete',{pct:100,done:plan.files.length,total:plan.files.length,bytes:plan.bytes,totalBytes:plan.bytes});
   }else announceReady();
  }
 }catch(e){
  setState('error',{msg:friendly(e)});
  if(!isQuota(e))scheduleRetry();
 }finally{
  stopWatchdog();
  window.__SHBACE_OFFLINE_UPDATE_ACTIVE__=false;
 }
}
async function startPlan(plan,mode){
 if(busy)return;
 if(mode==='install'&&!silentReinstall){setupPlan=plan;mountSetupOverlay();}
 busy=true;
 try{await runPlan(plan,mode)}finally{busy=false}
}

/* Swap a fully verified staged update into the live cache (resumable: running it again is harmless). */
async function commitStaged(st){
 var main=await caches.open(CACHE_NAME),stg=await caches.open(STAGING_NAME);
 await dbPut('meta','committing',{version:st.version,at:Date.now()});
 var paths=st.paths.slice().sort(function(a,b){return (a==='index.html')-(b==='index.html')});
 for(var i=0;i<paths.length;i++){
  var u=urlFor(paths[i]),r=await stg.match(u);
  if(!r)throw new Error(paths[i]+': staged copy is missing');
  await main.put(u,r);
 }
 var removed=st.removed||[];
 for(var j=0;j<removed.length;j++)await main.delete(urlFor(removed[j]));
 await main.put(MANIFEST_URL,new Response(JSON.stringify(st.manifest),{status:200,headers:{'content-type':'application/json'}}));
 await saveInstalled(st.manifest);
 manifest=st.manifest;
 await dbPut('meta',STAGED_KEY,null);
 await dbPut('meta','committing',null);
 await caches.delete(STAGING_NAME);
}
async function stagingIntact(st){
 try{
  if(!(await caches.has(STAGING_NAME)))return false;
  var have=await urlSetOf(await caches.open(STAGING_NAME));
  return st.paths.every(function(p){return have[urlFor(p)]});
 }catch(e){return false}
}
async function applyStagedNow(){
 if(busy)return;
 busy=true;
 try{
  var st=await dbGet('meta',STAGED_KEY).catch(function(){return null});
  if(!st||!st.ready){setState('ready');return}
  await commitStaged(st);
  setPending(0);lsSet(CHECK_OK_KEY,Date.now());markInstalledNow();
  setState('ready');
  if(!requestReload())releaseBootGate();
 }catch(e){
  setState('error',{msg:'Could not apply the update: '+friendly(e)});
 }finally{busy=false}
}

/* ---------- decisions ---------- */
async function verifyCachedFiles(files,label,quiet){
 var c=await caches.open(CACHE_NAME),good=[],bad=[];
 if(!quiet)setState('repairing',{msg:label,total:files.length,done:0,pct:0,bytes:0,totalBytes:0});
 for(var i=0;i<files.length;i++){
  var f=files[i],ok=false;
  try{
   var r=await c.match(urlFor(f.path));
   if(r&&r.ok){var b=await r.arrayBuffer();ok=b.byteLength===f.bytes&&(await sha256(b))===f.sha256}
  }catch(e){}
  (ok?good:bad).push(f);
  if(!quiet){S.done=i+1;S.pct=Math.floor((i+1)*100/files.length);paintChip()}
  await wait(0); /* keep the UI responsive */
 }
 return {good:good,bad:bad};
}
/* Recover only when IndexedDB metadata is missing. The cache ready marker is written after a
   complete install; every manifest file is still checked by size and SHA-256 before trust. */
async function recoverInstalledFromCache(){
 try{
  var c=await caches.open(CACHE_NAME);
  var readyResponse=await c.match(READY_URL);
  if(!readyResponse||!readyResponse.ok)return {recovered:false};
  var marker;
  try{marker=await readyResponse.json()}catch(e){return {recovered:false}}
  if(!marker||marker.verified!==true||!marker.version)return {recovered:false};
  /* Versioned snapshots keep the previous READY marker recoverable if a new update is
     interrupted between writing its manifest and publishing the next READY marker. */
  var manifestResponse=await c.match(manifestSnapshotUrl(marker.version));
  if(!manifestResponse)manifestResponse=await c.match(MANIFEST_URL); /* older installs */
  if(!manifestResponse||!manifestResponse.ok)return {recovered:false};
  var cachedManifest;
  try{cachedManifest=await manifestResponse.json()}catch(e){return {recovered:false}}
  if(!validManifest(cachedManifest)||String(cachedManifest.version)!==String(marker.version))return {recovered:false};

  /* This is a one-time recovery scan, not a routine launch scan. Keep every intact file;
     the normal updater will repair only the missing or damaged entries. */
  var checked=await verifyCachedFiles(cachedManifest.files,'Restoring saved offline files',true);
  if(!checked.good.length)return {recovered:false};
  var complete=checked.bad.length===0;
  var total=checked.good.reduce(function(s,f){return s+(Number(f.bytes)||0)},0);
  var at=Number(marker.completedAt)||Date.now();
  var record={version:cachedManifest.version,files:fileMap(checked.good),verified:complete,fileCount:checked.good.length,totalBytes:total,completedAt:at,recoveredAt:Date.now()};
  await dbPut('meta',INSTALLED_KEY,record).catch(noop);
  if(complete){
   await dbPut('meta','ready',{version:cachedManifest.version,verified:true,fileCount:cachedManifest.files.length,totalBytes:cachedManifest.totalBytes||total,completedAt:at}).catch(noop);
  }else{
   await dbPut('meta','ready',null).catch(noop);
  }
  return {recovered:true,complete:complete,missing:checked.bad.length,installed:record};
 }catch(e){return {recovered:false,error:e}}
}
/* Installs made before the READY marker existed have the cached manifest but no marker. Treat intact cached files
   as proof of a previous install so a returning student is never sent back to the blocking Setup screen. */
async function recoverLegacyInstalledFromCache(){
 try{
  var c=await caches.open(CACHE_NAME);
  var r=await c.match(MANIFEST_URL);
  if(!r||!r.ok)return {recovered:false};
  var m;try{m=await r.json()}catch(e){return {recovered:false}}
  if(!validManifest(m))return {recovered:false};
  var checked=await verifyCachedFiles(m.files,'Restoring saved offline files',true);
  /* Require the app shell to be intact; anything else missing is repaired in the background. */
  var hasShell=checked.good.some(function(f){return f.path==='index.html'});
  if(!hasShell||checked.good.length<Math.ceil(m.files.length/2))return {recovered:false};
  var complete=checked.bad.length===0,total=checked.good.reduce(function(s,f){return s+(Number(f.bytes)||0)},0),at=Date.now();
  var record={version:m.version,files:fileMap(checked.good),verified:complete,fileCount:checked.good.length,totalBytes:total,completedAt:at,recoveredAt:at};
  await dbPut('meta',INSTALLED_KEY,record).catch(noop);
  if(complete){
   await dbPut('meta','ready',{version:m.version,verified:true,fileCount:m.files.length,totalBytes:m.totalBytes||total,completedAt:at}).catch(noop);
   await c.put(READY_URL,new Response(JSON.stringify({version:m.version,verified:true,completedAt:at}),{status:200,headers:{'content-type':'application/json'}})).catch(noop);
   await c.put(manifestSnapshotUrl(m.version),new Response(JSON.stringify(m),{status:200,headers:{'content-type':'application/json'}})).catch(noop);
  }
  return {recovered:true,complete:complete,missing:checked.bad.length,installed:record};
 }catch(e){return {recovered:false,error:e}}
}
async function computePlan(installed){
 var have=await urlSetOf(await caches.open(CACHE_NAME)),files=[],changed=0,cur=Object.create(null);
 manifest.files.forEach(function(f){
  cur[f.path]=1;
  var old=installed.files&&installed.files[f.path],same=!!(old&&old.sha256===f.sha256);
  if(!same||!have[urlFor(f.path)]){files.push(f);if(!same)changed++}
 });
 var removed=Object.keys(installed.files||{}).filter(function(p){return !cur[p]});
 return {files:files,changed:changed,removed:removed};
}
async function decide(){
 manifest=await loadManifest();
 var installed=await dbGet('meta',INSTALLED_KEY).catch(function(){return null});
 var legacy=await dbGet('meta','ready').catch(function(){return null});
 if(!(installed&&installed.files)){
  if(!(legacy&&legacy.verified)){
   if(!manifestFromNetwork)throw new Error('Could not reach the server. Retrying automatically.');
   return {kind:'install',plan:planOf(manifest.files,[])};
  }
  /* Older build left only a "ready" marker: verify the saved files once (in the background), then keep a per-file record. */
  var r=await verifyCachedFiles(manifest.files,'Checking saved files');
  installed={version:legacy.version||manifest.version,files:fileMap(r.good),verified:true,fileCount:r.good.length,completedAt:Date.now()};
  await dbPut('meta',INSTALLED_KEY,installed);
 }
 var d=await computePlan(installed);
 if(!d.files.length&&!d.removed.length){
  if(installed.version!==manifest.version)await saveInstalled(manifest);
  return {kind:'none'};
 }
 if(!d.files.length){
  var c=await caches.open(CACHE_NAME);
  for(var i=0;i<d.removed.length;i++)await c.delete(urlFor(d.removed[i]));
  await saveInstalled(manifest);
  return {kind:'none'};
 }
 if(!manifestFromNetwork)return {kind:'none'}; /* cannot download anything without the live manifest */
 return {kind:d.changed?'update':'repair',plan:planOf(d.files,d.removed)};
}

/* One check cycle. Returns {state}: latest | offline | update | setup | busy (the Settings screen relies on these). */
async function runFullCheck(opts){
 opts=opts||{};
 if(setupSkipped)return {state:'offline'}; /* student chose "Continue online": no more Setup this session */
 if(busy)return {state:'busy'};
 busy=true;
 var next=null,out={state:'offline'};
 try{
  lsSet(CHECK_TRY_KEY,Date.now());
  var rec=await dbGet('meta',INSTALLED_KEY).catch(function(){return null});
  var hasRec=!!(rec&&rec.files);
  if(!online()){
   if(!hasRec){setState('needs-network');scheduleRetry();}
   return out;
  }
  var res=await decide();
  if(res.kind==='none'){
   if(manifestFromNetwork){lsSet(CHECK_OK_KEY,Date.now());setPending(0);lsDel(VER_AVAIL_KEY);fetchVersionInfo().then(rememberInstalled);out={state:'latest'}}
   setState('ready');retryN=0;
   return out;
  }
  if(res.kind==='update'){
   lsSet(CHECK_OK_KEY,Date.now());setPending(res.plan.files.length);
   var info=await fetchVersionInfo();
   if(info)lsSetJson(VER_AVAIL_KEY,info);
   setState('ready');
   if(opts.manual){showSheetLater(res.plan,info)}
   else if(autoAllowed()&&!examSoon()){next={plan:res.plan,mode:'update'}}
   /* Automatic checks never interrupt the student with an update sheet. If auto-download is unsuitable
      (Data Saver, slow connection, or exam quiet window), leave the package untouched until a later check/manual request. */
   return {state:'update'};
  }
  next={plan:res.plan,mode:res.kind};
  return {state:'setup'};
 }catch(err){
  var rec2=await dbGet('meta',INSTALLED_KEY).catch(function(){return null});
  if(rec2&&rec2.files){setState('ready');return {state:'offline'}} /* installed: stay silent, keep using the local copy */
  setState('error',{msg:friendly(err)});scheduleRetry();
  return {state:'offline'};
 }finally{
  busy=false;
  if(next)startPlan(next.plan,next.mode);
 }
}

/* Re-verify saved files from time to time; anything damaged is deleted and re-downloaded by the normal check. */
/* Manual "Check for updates" (Settings). Ignores the schedule and reports what happened. */
async function manualCheck(){
 if(!supported())return {state:'unsupported'};
 if(busy)return {state:'busy'};
 var st=await dbGet('meta',STAGED_KEY).catch(function(){return null});
 if(st&&st.ready&&(await stagingIntact(st))){setState('update-ready',{pct:100});return {state:'update'}}
 return runFullCheck({manual:true,force:true});
}
window.shbaceCheckForUpdate=manualCheck;
window.shbaceLastUpdateCheck=function(){return lsNum(CHECK_OK_KEY)};
window.shbaceUpdatePending=function(){return lsNum(PENDING_KEY)};
window.shbaceVersionInfo=function(){return {installed:lsGetJson(VER_KEY),available:lsGetJson(VER_AVAIL_KEY)}};

/* ---------- boot ---------- */
function registerSW(){
 /* Do not force a Service Worker version check on each launch. The 48-hour manifest check owns updates. */
 try{
  navigator.serviceWorker.getRegistration('./').then(function(reg){
   if(!reg)return navigator.serviceWorker.register('./sw.js',{scope:'./'});
   return reg;
  }).catch(noop);
 }catch(e){}
}
async function boot(){
 /* Request storage protection before trusting the local offline package.
    If the browser declines, runPlan can still rebuild lost metadata from cached bytes. */
 await requestPersistentStorage();
 var rec=await dbGet('meta',INSTALLED_KEY).catch(function(){return null});
 var hasRec=!!(rec&&rec.files);
 if(hasRec&&rec.verified===false)recoveryNeedsRepair=true;
 var legacy=await dbGet('meta','ready').catch(function(){return null});
 var hasReadyMarker=!!(legacy&&legacy.verified);
 var recoveredFromCache=false;
 if(!hasRec&&!hasReadyMarker){
  var recovery=await recoverInstalledFromCache();
  if(!recovery.recovered)recovery=await recoverLegacyInstalledFromCache();
  if(recovery.recovered){
   recoveredFromCache=true;
   rec=recovery.installed;
   hasRec=!!(rec&&rec.files);
   hasReadyMarker=!!recovery.complete;
   recoveryNeedsRepair=!recovery.complete;
  }
 }
 var st=await dbGet('meta',STAGED_KEY).catch(function(){return null});
 if(st&&st.ready){
  if(hasRec&&rec.version!==st.version&&(await stagingIntact(st))){
   setState('ready');
   await applyStagedNow();
   if(!bootGateReleased)releaseBootGate();
   return;
  }
  await dbPut('meta',STAGED_KEY,null).catch(noop);
  caches.delete(STAGING_NAME).catch(noop);
 }
 if(!hasRec&&!hasReadyMarker&&!recoveredFromCache){
  /* A student who already completed Setup once (local markers survive) is a returning student whose offline state was lost.
     Open the app at once and restore the package silently through the compact progress chip. Only a genuine first install
     (no earlier completed Setup) gets the blocking Setup screen. */
  if(lsGetJson(VER_KEY)||lsNum(CHECK_OK_KEY)){
   silentReinstall=true;
   setState('ready');
   registerSW();
   releaseBootGate();
   if(online())runFullCheck({force:true}).catch(noop);
   return;
  }
  if(splashP)await splashP;
  mountSetupOverlay();
  setState('boot',{msg:'Preparing the complete installation…',done:0,total:0,bytes:0,totalBytes:0,pct:0});
  await runFullCheck({force:true,firstInstall:true});
  return;
 }
 /* Existing install: trust the committed local ready record and never hash or scan the whole package on launch. */
 setState('ready');
 registerSW();
 releaseBootGate();
 /* A recovered but incomplete cache gets an immediate targeted repair check; normal updates
    retain the existing 48-hour schedule and never delay app startup. */
 var shellHit=null;
 try{shellHit=await (await caches.open(CACHE_NAME)).match(urlFor('index.html'))}catch(e){}
 if(!shellHit&&online()){
  /* Saved package disappeared while the install record survived: restore it now, silently. */
  recoveryCheckAt=Date.now();
  runFullCheck({force:true}).catch(noop);
 }else if(recoveryNeedsRepair&&online()){
  recoveryCheckAt=Date.now();
  runFullCheck({force:true}).catch(noop);
 }else if(online()&&checkDue())runFullCheck({force:true}).catch(noop);
}
function kick(){
 if(!started||busy||!online())return;
 if(recoveryNeedsRepair){
  if(Date.now()-recoveryCheckAt<CHECK_RETRY)return;
  recoveryCheckAt=Date.now();
  runFullCheck({force:true}).catch(noop);
  return;
 }
 if(state==='needs-network'||state==='error'){if(Date.now()-lsNum(CHECK_TRY_KEY)<5*60000)return;retryN=0;runFullCheck({force:true})}
 else if(checkDue())runFullCheck();
}
function start(){
 if(!document.body){releaseBootGate();return}
 /* The offline package belongs to the installed app, not a normal browser tab. */
 if(!standalone()){
  releaseBootGate();
  if(iosDevice())waitForSplash().then(showInstallHint);
  return;
 }
 splashP=waitForSplash();
 if(!supported()){
  splashP.then(function(){mountSetupOverlay();setState('unsupported',{msg:'This browser cannot verify the offline package. You can continue online.'});});
  return;
 }
 started=true;
 splashP.then(function(){splashDone=true;paintChip()});
 boot().catch(function(error){
  splashP.then(function(){mountSetupOverlay();setState('error',{msg:friendly(error)});});
 });
 window.addEventListener('online',function(){setTimeout(kick,1500)});
 document.addEventListener('visibilitychange',function(){if(document.visibilityState==='visible')kick()});
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start,{once:true});
else start();
})();