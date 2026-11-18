/* Shbace Medical — Offline System v2

   Principles
   - The app always starts from the local copy. Nothing here ever blocks the screen.
   - First install, repairs and updates run in the background with a small progress chip (no full-screen setup page).
   - Updates are downloaded into a staging cache, verified (size + SHA-256), then swapped in together. A half-finished
     update can never leave the app in a mixed state, and an interrupted download resumes where it stopped.
   - Every network step has a timeout and a stall watchdog. Failures retry by themselves with growing delays.
   - Saved files are re-verified now and then and repaired silently.

   Compatible with the previous version: same cache name, same IndexedDB state, same public window.* functions. */
(function(){
'use strict';

/* The HTML boot loader waits on this gate only for a true first installation. */
var setupGateResolve=null,setupGateReleased=false;
var setupGatePromise=new Promise(function(resolve){setupGateResolve=resolve});
window.__SHBACE_OFFLINE_SETUP_GATE__=setupGatePromise;
function releaseSetupGate(){if(setupGateReleased)return;setupGateReleased=true;if(setupGateResolve)setupGateResolve({ready:true})}
/* Native Capacitor builds ship the full asset bundle inside the APK. Nothing to do there. */
if(window.Capacitor&&typeof window.Capacitor.isNativePlatform==='function'&&window.Capacitor.isNativePlatform()){releaseSetupGate();return}
if(window.__SHBACE_OFFLINE_V2__){releaseSetupGate();return}
window.__SHBACE_OFFLINE_V2__=true;

/* ---------- constants ---------- */
/* NEVER rotate this name for an app release (must match sw.js). */
var CACHE_NAME='shbace-medical-offline-v2';
var STAGING_NAME='shbace-staging-offline';
var DB_NAME='shbace-medical-offline-state-v1';
var INSTALLED_KEY='installed',STAGED_KEY='staged';
var CHECK_OK_KEY='shbace_pkg_check_ok_v1',CHECK_TRY_KEY='shbace_pkg_check_try_v1',HEAL_KEY='shbace_pkg_heal_ok_v1',REPAIR_KEY='shbace_pkg_repair_look_v1';
var PENDING_KEY='shbace_pkg_update_pending_v1',NOTIF_ID='update-available';
var VER_KEY='shbace_pkg_version_installed_v1',VER_AVAIL_KEY='shbace_pkg_version_available_v1',EXAM_KEY='shbace_exam_goal_planner_v1';
var DAY=86400000;
var CHECK_EVERY=2*DAY,CHECK_RETRY=2*3600000,HEAL_EVERY=14*DAY,SNOOZE_DAYS=2,EXAM_QUIET_DAYS=7;
var MANIFEST_TIMEOUT=10000,STALL_MS=45000,CONCURRENCY=3,MAX_TRIES=3,RETRY_DELAYS=[15000,60000,300000];
var MANIFEST_URL=new URL('./offline-assets-manifest.json',location.href).href;
var READY_URL=new URL('./__shbace_offline_ready__',location.href).href;

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
function recentTry(){var t=lsNum(CHECK_TRY_KEY);return t>0&&t<=Date.now()&&Date.now()-t<CHECK_RETRY}
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
function db(){
 if(!dbp){
  dbp=new Promise(function(res,rej){
   if(!window.indexedDB){rej(new Error('IndexedDB is not available.'));return}
   var q=indexedDB.open(DB_NAME,1);
   q.onupgradeneeded=function(){var d=q.result;
    if(!d.objectStoreNames.contains('meta'))d.createObjectStore('meta');
    if(!d.objectStoreNames.contains('verified'))d.createObjectStore('verified');};
   q.onsuccess=function(){res(q.result)};
   q.onerror=function(){rej(q.error||new Error('Could not open local storage.'))};
   q.onblocked=function(){rej(new Error('Local storage is busy. Close other Shbace tabs.'))};
  });
  dbp.catch(function(){dbp=null});
 }
 return dbp;
}
function dbOp(store,mode,fn){
 return db().then(function(d){return new Promise(function(res,rej){
  var tx=d.transaction(store,mode),req=fn(tx.objectStore(store));
  tx.oncomplete=function(){res(req&&req.result)};
  tx.onabort=tx.onerror=function(){rej(tx.error||new Error('Local storage transaction failed.'))};
 })});
}
function dbGet(s,k){return dbOp(s,'readonly',function(o){return o.get(k)})}
function dbPut(s,k,v){return dbOp(s,'readwrite',function(o){return o.put(v,k)})}

/* ---------- state machine + UI ----------
   boot → ready | installing | repairing | updating → update-ready → ready
   needs-network / error are recoverable and retry on their own. */
var state='boot',S={pct:0,done:0,total:0,bytes:0,totalBytes:0,msg:'',announce:false};
var splashDone=false,splashP=null,chip=null,lastPaint='',announceTimer=null;
var initialSetupPending=false,setupPackageReady=false,setupUI=null;
function setState(s,extra){
 state=s;
 if(extra){for(var k in extra)if(Object.prototype.hasOwnProperty.call(extra,k))S[k]=extra[k]}
 paintChip();
 paintSetup();
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
 if(initialSetupPending&&!setupPackageReady){if(chip)chip.classList.remove('on');return}
 var text='',pct=null,act='',label='',show=false;
 switch(state){
  case 'installing':show=true;text='Downloading offline package · '+S.pct+'%';pct=S.pct;break;
  case 'verifying':show=true;text='Verifying offline package';pct=S.pct;break;
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

/* First-install Setup. It is prepared under the ECG splash; only the first complete
   package install uses this full-screen UI. Later repairs/updates use the compact chip. */
function mountInitialSetup(){
 if(setupUI&&setupUI.root&&setupUI.root.isConnected)return setupUI;
 if(!document.body)return null;
 var root=document.createElement('div');
 root.id='shbaceOfflineSetup';root.className='shb-offline-setup';root.style.visibility='hidden';
 root.setAttribute('role','dialog');root.setAttribute('aria-modal','true');root.setAttribute('aria-labelledby','shbOfflineTitle');
 root.innerHTML=
  '<div class="shb-offline-card">'+
   '<div class="shb-offline-brand"><span class="shb-offline-mark">S</span><span>SHBACE <b>MEDICAL</b></span><span class="shb-offline-pill">ONE-TIME SETUP</span></div>'+
   '<div class="shb-offline-kicker">LOCAL INSTALLATION</div>'+
   '<h1 id="shbOfflineTitle">Prepare Shbace for offline study</h1>'+
   '<p class="shb-offline-intro">Download the complete app package once. We will save every required file on this device, verify it, and then open your study experience.</p>'+
   '<div class="shb-offline-status" id="shbOfflineStatus" aria-live="polite">Preparing the installation checklist…</div>'+
   '<div class="shb-offline-progress-head"><b id="shbOfflinePercent">0%</b><span id="shbOfflineCount">Preparing file list…</span></div>'+
   '<div class="shb-offline-track" role="progressbar" aria-label="Offline installation progress" aria-valuemin="0" aria-valuemax="100" aria-valuenow="0" id="shbOfflineTrack"><i id="shbOfflineBar"></i></div>'+
   '<div class="shb-offline-bytes"><span id="shbOfflineBytes">Preparing package size…</span><span id="shbOfflineStage">Preparing</span></div>'+
   '<div class="shb-offline-stages" id="shbOfflineStages">'+
    '<div class="shb-offline-stage is-active" data-step="download"><span class="shb-offline-stage-dot"></span><span>Application and learning files</span><b id="shbOfflineDownloadState">Preparing</b></div>'+
    '<div class="shb-offline-stage" data-step="verify"><span class="shb-offline-stage-dot"></span><span>Integrity verification</span><b id="shbOfflineVerifyState">Pending</b></div>'+
   '</div>'+
   '<div class="shb-offline-warning" id="shbOfflineWarning">Keep the app open and connected to the internet until the first setup is complete.</div>'+
   '<div class="shb-offline-errors" id="shbOfflineErrors" hidden></div>'+
   '<button type="button" class="shb-offline-action" id="shbOfflineAction" disabled>Preparing…</button>'+
   '<p class="shb-offline-footnote" id="shbOfflineFootnote">Your existing answers and study progress are kept in the app’s existing local storage.</p>'+
  '</div>';
 document.body.appendChild(root);
 setupUI={
  root:root,status:root.querySelector('#shbOfflineStatus'),percent:root.querySelector('#shbOfflinePercent'),
  count:root.querySelector('#shbOfflineCount'),track:root.querySelector('#shbOfflineTrack'),bar:root.querySelector('#shbOfflineBar'),
  bytes:root.querySelector('#shbOfflineBytes'),stage:root.querySelector('#shbOfflineStage'),stages:root.querySelector('#shbOfflineStages'),
  downloadState:root.querySelector('#shbOfflineDownloadState'),verifyState:root.querySelector('#shbOfflineVerifyState'),
  warning:root.querySelector('#shbOfflineWarning'),errors:root.querySelector('#shbOfflineErrors'),
  button:root.querySelector('#shbOfflineAction'),foot:root.querySelector('#shbOfflineFootnote')
 };
 setupUI.button.addEventListener('click',function(){
  if(setupUI.button.dataset.action!=='retry')return;
  setupUI.button.disabled=true;setupUI.button.dataset.action='';
  setupUI.button.textContent='Retrying…';retryN=0;runFullCheck({force:true});
 });
 if(document.querySelector('.phone.light'))root.classList.add('is-light');
 revealInitialSetup();paintSetup();return setupUI;
}
function revealInitialSetup(){
 if(!initialSetupPending||!setupUI||!splashDone)return;
 setupUI.root.style.visibility='visible';setupUI.root.style.pointerEvents='auto';
}
function paintSetup(){
 if(!setupUI||!initialSetupPending)return;
 revealInitialSetup();
 var pct=setupPackageReady?100:Math.max(0,Math.min(99,Number(S.pct)||0));
 setupUI.percent.textContent=pct+'%';setupUI.track.setAttribute('aria-valuenow',String(pct));setupUI.bar.style.width=pct+'%';
 setupUI.count.textContent=S.total?(S.done+' / '+S.total+' files'):'Preparing file list…';
 setupUI.bytes.textContent=S.totalBytes?(fmtBytes(S.bytes)+' / '+fmtBytes(S.totalBytes)):'Preparing package size…';
 var verify=state==='verifying'||setupPackageReady;
 setupUI.stage.textContent=setupPackageReady?'Ready':(verify?'Verifying':'Downloading');
 setupUI.downloadState.textContent=setupPackageReady?'Saved':(verify?'Downloaded':(S.total?(S.done+' / '+S.total):'Preparing'));
 setupUI.verifyState.textContent=setupPackageReady?'Complete':(verify?'In progress':'Pending');
 Array.prototype.forEach.call(setupUI.stages.querySelectorAll('[data-step]'),function(node){
  var active=node.getAttribute('data-step')===(verify?'verify':'download');
  node.classList.toggle('is-active',active&&!setupPackageReady);
  node.classList.toggle('is-done',setupPackageReady||(verify&&node.getAttribute('data-step')==='download'));
 });
 if(setupPackageReady){
  setupUI.status.textContent='All files have been saved and verified. Preparing your first screen…';
  setupUI.warning.textContent='The offline package is ready. The app is now loading its first screen from the verified local package.';
  setupUI.button.disabled=true;setupUI.button.dataset.action='';setupUI.button.textContent='Opening Shbace Medical…';
  setupUI.foot.textContent='Offline package verified · '+fmtBytes(S.totalBytes)+' stored.';
  setupUI.errors.hidden=true;return;
 }
 if(state==='needs-network'||state==='error'){
  setupUI.status.textContent=state==='needs-network'?'Connect to the internet once to finish the offline installation.':(S.msg||'The offline setup needs to retry.');
  setupUI.warning.textContent='Your existing student data is safe. Reconnect, then retry the setup.';
  setupUI.errors.hidden=false;setupUI.errors.textContent=S.msg||'The app needs an internet connection for its first offline installation.';
  setupUI.button.disabled=false;setupUI.button.dataset.action='retry';setupUI.button.textContent='Retry setup';return;
 }
 setupUI.errors.hidden=true;
 setupUI.status.textContent=state==='verifying'?'All package files are downloaded. Verifying file sizes and SHA-256 integrity…':(state==='installing'?'Downloading and saving the complete offline package…':'Preparing the offline installation…');
 setupUI.warning.textContent='The installer is preparing the complete app package. The onboarding and question-bank modules will start only after verification finishes.';
 setupUI.button.disabled=true;setupUI.button.dataset.action='';
 setupUI.button.textContent=state==='verifying'?'Verifying…':(state==='installing'?'Installing…':'Preparing…');
}
function removeSetupOverlay(){if(setupUI&&setupUI.root&&setupUI.root.parentNode)setupUI.root.parentNode.removeChild(setupUI.root);setupUI=null}
function finishInitialSetupPackage(){
 setupPackageReady=true;S.pct=100;S.done=S.total;S.bytes=S.totalBytes;
 setState('ready',{pct:100,done:S.total,total:S.total,bytes:S.totalBytes,totalBytes:S.totalBytes,announce:false,msg:''});
 paintSetup();releaseSetupGate();
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
  var finished=false,observer=null;
  function done(){if(finished||splash.isConnected)return;finished=true;if(observer)observer.disconnect();resolve()}
  try{observer=new MutationObserver(done);observer.observe(document.body,{childList:true,subtree:true})}catch(e){}
  setTimeout(function(){if(!finished){finished=true;if(observer)observer.disconnect();resolve()}},14000);
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
async function cachedManifest(){
 try{
  var c=await caches.open(CACHE_NAME),hit=await c.match(MANIFEST_URL);
  if(!hit)return null;
  var d=await hit.json();return validManifest(d)?d:null;
 }catch(e){return null}
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
 paintChip();paintSetup();
}
function scheduleRetry(){
 if(retryTimer||retryN>=RETRY_DELAYS.length)return;
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
 var v=await dbGet('verified',tname+'|'+f.path).catch(function(){return null});
 if(v!==f.sha256)return false;
 return !!(await target.match(urlFor(f.path)));
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
 await dbPut('meta',INSTALLED_KEY,{version:m.version,files:fileMap(m.files),verified:true,fileCount:m.files.length,totalBytes:total,completedAt:at});
 await dbPut('meta','ready',{version:m.version,verified:true,fileCount:m.files.length,totalBytes:total,completedAt:at});
 var c=await caches.open(CACHE_NAME);
 await c.put(READY_URL,new Response(JSON.stringify({version:m.version,verified:true,completedAt:at}),{status:200,headers:{'content-type':'application/json'}}));
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
  try{if(navigator.storage&&navigator.storage.persist)navigator.storage.persist().catch(noop)}catch(e){}
  var files=plan.files.slice().sort(byPriority),cursor=0;
  var worker=async function(){
   while(!sig.aborted){
    var i=cursor++;if(i>=files.length)return;
    var f=files[i];
    try{
     if(await isVerified(f,tname,target)){bump(Number(f.bytes)||0)}
     else{await target.delete(urlFor(f.path));await downloadFile(f,target,sig);await markVerified(f,tname)}
     S.done++;tick();paintSetup();
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
  setState('verifying',{pct:Math.max(99,S.pct),msg:'Verifying the offline package…'});
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
   if(mode==='install'&&initialSetupPending)finishInitialSetupPackage();else announceReady();
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
  requestReload();
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
 if(busy)return {state:'busy'};
 busy=true;
 var next=null,out={state:'offline'};
 try{
  lsSet(CHECK_TRY_KEY,Date.now());
  var rec=await dbGet('meta',INSTALLED_KEY).catch(function(){return null});
  var hasRec=!!(rec&&rec.files);
  if(!online()){
   if(!hasRec)setState('needs-network');
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
   else if(autoAllowed()){next={plan:res.plan,mode:'update'}}
   else if(!examSoon()){showSheetLater(res.plan,info)}
   return {state:'update'};
  }
  if(res.kind==='install'&&initialSetupPending){
   /* Prepare the manifest during ECG; start the package download as soon as the splash ends. */
   if(splashP)await splashP;
   splashDone=true;revealInitialSetup();paintSetup();
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
async function heal(){
 /* Background hashing of the whole package: never on Data Saver / slow networks, never in exam week. */
 if(busy||!online()||!autoAllowed()||examSoon())return;
 busy=true;var bad=[];
 try{
  var m=await cachedManifest();
  if(!m)return;
  var r=await verifyCachedFiles(m.files,'',true);
  bad=r.bad;
  if(bad.length){
   /* Never delete a damaged file unless the server is reachable right now to replace it. */
   try{await loadManifest()}catch(e){}
   if(!manifestFromNetwork){lsSet(HEAL_KEY,Date.now()-(HEAL_EVERY-DAY));bad=[];return}
  }
  var c=await caches.open(CACHE_NAME);
  for(var i=0;i<bad.length;i++)await c.delete(urlFor(bad[i].path));
  lsSet(HEAL_KEY,Date.now());
 }catch(e){}finally{busy=false}
 if(bad.length)runFullCheck({force:true});
}
async function localRepairNeeded(){
 try{
  var m=await cachedManifest();if(!m)return false;
  var have=await urlSetOf(await caches.open(CACHE_NAME));
  return m.files.some(function(f){return !have[urlFor(f.path)]});
 }catch(e){return false}
}

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
 try{
  navigator.serviceWorker.register('./sw.js',{scope:'./'}).then(function(reg){if(checkDue())reg.update().catch(noop)}).catch(noop);
 }catch(e){}
}
async function boot(){
 var rec=await dbGet('meta',INSTALLED_KEY).catch(function(){return null});
 var hasRec=!!(rec&&rec.files);
 var legacy=await dbGet('meta','ready').catch(function(){return null});
 var hasLegacy=!!(legacy&&legacy.verified);
 var st=await dbGet('meta',STAGED_KEY).catch(function(){return null});
 if(st&&st.ready){
  if(hasRec&&rec.version!==st.version&&(await stagingIntact(st))){setState('ready');await applyStagedNow();releaseSetupGate();return}
  await dbPut('meta',STAGED_KEY,null).catch(noop);caches.delete(STAGING_NAME).catch(noop);
 }
 if(!hasRec&&!hasLegacy){
  initialSetupPending=true;mountInitialSetup();revealInitialSetup();
  if(!online()){setState('needs-network');return}
  return runFullCheck({firstInstall:true});
 }
 /* Existing installations open immediately; checks and small repairs continue in the background. */
 releaseSetupGate();removeSetupOverlay();
 if(!hasRec)return runFullCheck();
 setState('ready');
 if(online()){
  /* Opening the app never triggers a network check by itself: the scheduled check runs at most every CHECK_EVERY days. */
  if(checkDue())return runFullCheck();
  /* Local-only look for missing files: at most once a day, and it only goes to the network if something is really missing. */
  if(Date.now()-lsNum(REPAIR_KEY)>DAY){
   lsSet(REPAIR_KEY,Date.now());
   if(!recentTry()&&(await localRepairNeeded()))return runFullCheck();
  }
  if(Date.now()-lsNum(HEAL_KEY)>HEAL_EVERY)setTimeout(function(){if(window.requestIdleCallback)requestIdleCallback(function(){heal()},{timeout:60000});else heal()},30000);
 }
}
function kick(){
 if(!started||busy||!online())return;
 if(initialSetupPending){retryN=0;runFullCheck({force:true});return}
 if(state==='needs-network'||state==='error'){if(Date.now()-lsNum(CHECK_TRY_KEY)<5*60000)return;retryN=0;runFullCheck({force:true})}
 else if(checkDue())runFullCheck();
}
function start(){
 if(!document.body){releaseSetupGate();return}
 if(!supported()){releaseSetupGate();return}
 /* The package installer belongs to the installed home-screen app, not a Safari tab. */
 if(!standalone()){releaseSetupGate();if(iosDevice())waitForSplash().then(showInstallHint);return}
 started=true;registerSW();splashP=waitForSplash();mountInitialSetup();
 splashP.then(function(){splashDone=true;revealInitialSetup();paintChip();paintSetup()});
 document.addEventListener('shb-scripts-ready',function(){if(!setupPackageReady)return;removeSetupOverlay();initialSetupPending=false;setupPackageReady=false});
 boot().catch(function(error){if(initialSetupPending)setState('error',{msg:friendly(error)});else releaseSetupGate()});
 window.addEventListener('online',function(){setTimeout(kick,1500)});
 document.addEventListener('visibilitychange',function(){if(document.visibilityState==='visible')kick()});
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start,{once:true});
else start();
})();
