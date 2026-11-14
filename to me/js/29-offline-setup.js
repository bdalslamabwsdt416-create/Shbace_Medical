(function(){
'use strict';

/* One stable cache shared with sw.js. It is NOT versioned: an app update only replaces the files that changed. */
var CACHE_NAME='shbace-chrome-offline-v1.3.8';
var STAGING_NAME='shbace-staging-offline';
var INSTALLED_KEY='installed';
var manifestFromNetwork=false,plan=null;
var DB_NAME='shbace-medical-offline-state-v1';
var MANIFEST_URL=new URL('./offline-assets-manifest.json',location.href).href;
var READY_URL=new URL('./__shbace_offline_ready__',location.href).href;
var manifest=null,cache=null,ui=null,started=false;
var verifiedCount=0,verifiedBytes=0,donePaths=Object.create(null),errors=[];
var STAGES=[
 {id:'app',label:'Application files'},
 {id:'images',label:'Images and visual assets'},
 {id:'data',label:'Question bank and learning data'},
 {id:'other',label:'Other local resources'},
 {id:'verify',label:'Integrity verification'}
];

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
function mount(){
 if(ui&&ui.root&&ui.root.isConnected)return ui;
 var root=document.createElement('div');
 root.id='shbaceOfflineSetup';
 root.className='shb-offline-setup';
 root.setAttribute('role','dialog');
 root.setAttribute('aria-modal','true');
 root.setAttribute('aria-labelledby','shbOfflineTitle');
 root.innerHTML=
  '<div class="shb-offline-card">'+
   '<div class="shb-offline-brand"><span class="shb-offline-mark">S</span><span>SHBACE <b>MEDICAL</b></span><span class="shb-offline-pill">ONE-TIME SETUP</span></div>'+
   '<div class="shb-offline-kicker">LOCAL INSTALLATION</div>'+
   '<h1 id="shbOfflineTitle">Prepare Shbace for offline study</h1>'+
   '<p class="shb-offline-intro">Download the complete app package once. We will save every required file on this device, verify it, and then use the local copy for your study sessions.</p>'+
   '<div class="shb-offline-status" id="shbOfflineStatus" aria-live="polite">Preparing the installation checklist…</div>'+
   '<div class="shb-offline-progress-head"><b id="shbOfflinePercent">0%</b><span id="shbOfflineCount">0 / 0 files</span></div>'+
   '<div class="shb-offline-track" role="progressbar" aria-label="Offline installation progress" aria-valuemin="0" aria-valuemax="100" aria-valuenow="0" id="shbOfflineTrack"><i id="shbOfflineBar"></i></div>'+
   '<div class="shb-offline-bytes"><span id="shbOfflineBytes">0 B / 0 B</span><span id="shbOfflineStage">Waiting</span></div>'+
   '<div class="shb-offline-stages" id="shbOfflineStages"></div>'+
   '<div class="shb-offline-warning" id="shbOfflineWarning">Keep this app open and connected to the internet until verification finishes.</div>'+
   '<div class="shb-offline-errors" id="shbOfflineErrors" hidden></div>'+
   '<button type="button" class="shb-offline-action" id="shbOfflineAction" disabled>Preparing…</button>'+
   '<p class="shb-offline-footnote" id="shbOfflineFootnote">Your answers and study progress remain in the app’s existing local storage. iOS storage can still be cleared by the operating system; keep regular backups of your progress.</p>'+
  '</div>';
 document.body.appendChild(root);
 ui={
  root:root,
  status:root.querySelector('#shbOfflineStatus'),
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
  foot:root.querySelector('#shbOfflineFootnote')
 };
 ui.button.addEventListener('click',function(){
  if(ui.button.dataset.done==='1'){if(plan&&plan.mode==='update'){location.reload();return}removeSetupOverlay();return}
  if(ui.button.dataset.retryCheck==='1'){location.reload();return}
  runPlan();
 });
 if(document.querySelector('.phone.light'))root.classList.add('is-light');
 return ui;
}
function removeSetupOverlay(){
 var element=ui&&ui.root;
 if(element&&element.parentNode)element.parentNode.removeChild(element);
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
function fileValid(file,checkHash,target){
 return (target||cache).match(urlFor(file.path)).then(function(response){
  if(!response||!response.ok)return false;
  return response.arrayBuffer().then(function(bytes){
   if(bytes.byteLength!==file.bytes)return false;
   if(!checkHash)return true;
   return hashBytes(bytes).then(function(sum){return sum===file.sha256});
  }).catch(function(){return false});
 });
}
function cleanupPreviousCaches(){
 /* Keep only the current manifest assets, its manifest and its ready marker in
    the active package cache. This also removes stale files left by older releases. */
 var keep=Object.create(null);
 manifest.files.forEach(function(file){keep[urlFor(file.path)]=true});
 keep[MANIFEST_URL]=true;
 keep[READY_URL]=true;
 keep[new URL('./',location.href).href]=true;
 return cache.keys().then(function(requests){
  return Promise.all(requests.filter(function(request){return !keep[request.url]}).map(function(request){
   return cache.delete(request).then(function(ok){return {name:request.url,ok:ok}}).catch(function(){return {name:request.url,ok:false}});
  }));
 }).then(function(internalResults){
  return caches.keys().then(function(names){
   var stale=names.filter(function(name){
    return (name.indexOf('shbace-chrome-offline-')===0&&name!==CACHE_NAME)||name.indexOf('shbace-to-me-chrome-offline-')===0;
   });
   return Promise.all(stale.map(function(name){
    return caches.delete(name).then(function(ok){return {name:name,ok:ok}}).catch(function(){return {name:name,ok:false}});
   })).then(function(namedResults){return internalResults.concat(namedResults)});
  });
 });
}
function loadManifest(){
 return caches.open(CACHE_NAME).then(function(c){
  /* Network first: a stale cached copy of the file list makes size/SHA checks fail against newer files.
     The cached copy is only a fallback for when the device is offline. */
  manifestFromNetwork=false;
  return fetch(MANIFEST_URL,{credentials:'same-origin',cache:'no-store'}).then(function(r){
   if(!r.ok)throw new Error('Offline asset manifest returned HTTP '+r.status+'.');
   var copy=r.clone();
   return r.json().then(function(data){manifestFromNetwork=true;
    return c.put(MANIFEST_URL,copy).catch(function(){}).then(function(){return data});
   });
  }).catch(function(err){
   return c.match(MANIFEST_URL).then(function(hit){
    if(hit)return hit.json();
    throw err;
   });
  });
 }).then(function(data){
  if(!data||data.schema!==1||!Array.isArray(data.files)||!data.files.length||!data.version)
   throw new Error('The offline asset manifest is missing or invalid. Reconnect and reload the installed app.');
  var total=data.files.reduce(function(sum,f){return sum+(Number(f.bytes)||0)},0);
  data.totalBytes=Number(data.totalBytes)||total;
  data.fileCount=data.files.length;
  return data;
 });
}
function setStatus(text){if(ui)ui.status.textContent=text}
function setWarning(text){if(ui)ui.warning.textContent=text}
function setErrorList(items){
 if(!ui)return;
 if(!items.length){ui.errors.hidden=true;ui.errors.textContent='';return}
 ui.errors.hidden=false;
 ui.errors.innerHTML='<b>Files that still need attention</b><ul>'+items.slice(0,5).map(function(x){return '<li>'+esc(x)+'</li>'}).join('')+'</ul>';
}
function stageMarkup(){
 var counts={app:0,images:0,data:0,other:0};
 plan.files.forEach(function(f){var g=fileGroup(f);counts[g]=(counts[g]||0)+1});
 ui.stages.innerHTML=STAGES.filter(function(s){return s.id!=='verify'&&(counts[s.id]||0)>0}).map(function(s){
  return '<div class="shb-offline-stage" data-stage="'+s.id+'"><span class="shb-offline-stage-dot"></span><span>'+s.label+'</span><b>0 / '+(counts[s.id]||0)+'</b></div>';
 }).join('')+
 '<div class="shb-offline-stage" data-stage="verify"><span class="shb-offline-stage-dot"></span><span>Integrity verification</span><b>Pending</b></div>';
 return counts;
}
var stageCounts=null,stageDone={app:0,images:0,data:0,other:0};
function paintProgress(current,verifying){
 if(!ui||!plan)return;
 var total=plan.files.length,done=verifiedCount;
 var pct=total?Math.min(100,Math.floor(done*100/total)):0;
 if(verifying&&done===total)pct=99;
 ui.percent.textContent=pct+'%';
 ui.count.textContent=done+' / '+total+' files';
 ui.track.setAttribute('aria-valuenow',String(pct));
 ui.bar.style.width=pct+'%';
 ui.bytes.textContent=fmtBytes(verifiedBytes)+' / '+fmtBytes(plan.bytes);
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
function waitForWorkerActivation(worker){
 return new Promise(function(resolve,reject){
  function check(){
   if(worker.state==='activated'){
    worker.removeEventListener('statechange',check);resolve();
   }else if(worker.state==='redundant'){
    worker.removeEventListener('statechange',check);
    reject(new Error('The updated offline worker could not activate. Close other Shbace tabs and retry.'));
   }
  }
  worker.addEventListener('statechange',check);check();
 });
}
function ensureServiceWorker(){
 if(!('serviceWorker' in navigator))return Promise.reject(new Error('This browser does not support Service Workers.'));
 return navigator.serviceWorker.getRegistration('./').then(function(reg){
  if(!reg)return navigator.serviceWorker.register('./sw.js',{scope:'./'});
  /* Force an update check so integrity downloads are not intercepted by an older
     cache-first worker. The current worker uses a network-only integrity route. */
  return reg.update().then(function(){
   var candidate=reg.installing||reg.waiting;
   return candidate?waitForWorkerActivation(candidate).then(function(){return reg}):reg;
  });
 }).then(function(){return navigator.serviceWorker.ready});
}
function fetchAndStore(file,target){
 var dest=target||cache,url=urlFor(file.path),lastError=null;
 /* Integrity downloads bypass any stale Service Worker/CDN copy; the verified bytes are stored under the canonical URL. */
 var freshTarget=url+(url.indexOf('?')>=0?'&':'?')+'__shbace_integrity='+encodeURIComponent(manifest.version+'-'+file.sha256.slice(0,16));
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
     return dest.put(url,new Response(bytes,{status:200,statusText:'OK',headers:headers}));
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
function verifyAll(target){
 setStatus('Checking that every downloaded file can be read from local storage…');
 paintProgress('verify',true);
 var index=0;
 function next(){
  if(index>=plan.files.length)return Promise.resolve();
  var file=plan.files[index++];
  return fileValid(file,true,target).then(function(ok){
   if(!ok)errors.push(file.path+': missing or failed integrity check');
   if(index%8===0||index===plan.files.length)ui.stage.textContent='Verifying '+index+' / '+plan.files.length;
   return next();
  });
 }
 return next();
}

var MODE_TEXT={
 install:{kicker:'LOCAL INSTALLATION',title:'Prepare Shbace for offline study',pill:'ONE-TIME SETUP',
  intro:'Download the complete app package once. It is saved on this device and verified; later updates only download the files that changed.',button:'Start one-time download'},
 restore:{kicker:'LOCAL REPAIR',title:'Restore offline files',pill:'RESTORE',
  intro:'Some saved files are missing from this device. Only the missing files are downloaded again.',button:'Restore missing files'},
 update:{kicker:'APP UPDATE',title:'Updating Shbace Medical',pill:'UPDATE',
  intro:'Only the files that changed are downloaded. Your answers, notes and study progress are not touched.',button:'Update now'}
};
function setMode(mode){
 var t=MODE_TEXT[mode]||MODE_TEXT.install;
 try{
  ui.root.querySelector('.shb-offline-kicker').textContent=t.kicker;
  ui.root.querySelector('#shbOfflineTitle').textContent=t.title;
  ui.root.querySelector('.shb-offline-pill').textContent=t.pill;
  ui.root.querySelector('.shb-offline-intro').textContent=t.intro;
 }catch(e){}
}
function planOf(mode,files,removed){
 return {mode:mode,files:files,removed:removed||[],bytes:files.reduce(function(sum,f){return sum+(Number(f.bytes)||0)},0)};
}
function fileMap(files){
 var map={};files.forEach(function(f){map[f.path]={sha256:f.sha256,bytes:f.bytes}});return map;
}
function saveInstalled(files){
 var record={version:manifest.version,files:fileMap(files),verified:true,fileCount:files.length,totalBytes:files.reduce(function(s,f){return s+(Number(f.bytes)||0)},0),completedAt:Date.now()};
 return dbPut('meta',INSTALLED_KEY,record).then(function(){
  return dbPut('meta','ready',{version:manifest.version,verified:true,fileCount:record.fileCount,totalBytes:record.totalBytes,completedAt:record.completedAt});
 }).then(function(){
  return cache.put(READY_URL,new Response(JSON.stringify({version:manifest.version,verified:true,completedAt:record.completedAt}),{status:200,headers:{'content-type':'application/json'}}));
 });
}
function cacheUrlSet(){
 return cache.keys().then(function(requests){var have=Object.create(null);requests.forEach(function(r){have[r.url]=true});return have});
}
/* Compare the saved record with the current manifest: nothing is hashed or downloaded here. */
function computePlan(installed){
 return cacheUrlSet().then(function(have){
  var files=[],changed=0,current=Object.create(null);
  manifest.files.forEach(function(f){
   current[f.path]=true;
   var old=installed.files&&installed.files[f.path];
   var same=!!(old&&old.sha256===f.sha256);
   if(!same||!have[urlFor(f.path)]){files.push(f);if(!same)changed++}
  });
  var removed=Object.keys(installed.files||{}).filter(function(p){return !current[p]});
  return {files:files,changed:changed,removed:removed};
 });
}
/* Older builds stored only a "ready" marker. Verify the saved files once, then keep a per-file record from then on. */
function adoptLegacy(){
 var good=[],bad=[],idx=0;
 function inspect(){
  if(idx>=manifest.files.length)return Promise.resolve();
  var f=manifest.files[idx++];
  return fileValid(f,true).then(function(ok){(ok?good:bad).push(f);return inspect()});
 }
 return inspect().then(function(){
  var record={version:manifest.version,files:fileMap(good),verified:true,fileCount:good.length,completedAt:Date.now()};
  return dbPut('meta',INSTALLED_KEY,record).then(function(){return {good:good,bad:bad}});
 });
}
function decide(){
 return loadManifest().then(function(data){
  manifest=data;
  return caches.open(CACHE_NAME);
 }).then(function(c){
  cache=c;
  return Promise.all([dbGet('meta',INSTALLED_KEY),dbGet('meta','ready')]);
 }).then(function(rec){
  var installed=rec[0],legacy=rec[1];
  if(installed&&installed.files)return installed;
  if(legacy&&legacy.verified)return adoptLegacy().then(function(r){
   if(!r.bad.length)return saveInstalled(manifest.files).then(function(){return null});
   return dbGet('meta',INSTALLED_KEY);
  });
  return false;
 }).then(function(installed){
  if(installed===null)return {kind:'none'};
  if(installed===false)return {kind:'setup',plan:planOf('install',manifest.files,[])};
  return computePlan(installed).then(function(d){
   if(!d.files.length&&!d.removed.length){
    if(installed.version!==manifest.version)return saveInstalled(manifest.files).then(function(){return {kind:'none'}});
    return {kind:'none'};
   }
   if(!d.files.length){
    return Promise.all(d.removed.map(function(p){return cache.delete(urlFor(p))})).then(function(){return saveInstalled(manifest.files)}).then(function(){return {kind:'none'}});
   }
   if(!manifestFromNetwork)return {kind:'none'};
   if(!d.changed)return {kind:'setup',plan:planOf('restore',d.files,d.removed)};
   return {kind:'prompt',plan:planOf('update',d.files,d.removed)};
  });
 });
}
function commitPlan(target){
 var chain=Promise.resolve();
 if(target!==cache){
  plan.files.forEach(function(f){
   chain=chain.then(function(){return target.match(urlFor(f.path))}).then(function(r){
    if(!r)throw new Error(f.path+': staged copy is missing');
    return cache.put(urlFor(f.path),r);
   });
  });
 }
 plan.removed.forEach(function(p){chain=chain.then(function(){return cache.delete(urlFor(p))})});
 return chain.then(function(){return saveInstalled(manifest.files)}).then(function(){
  return target!==cache?caches.delete(STAGING_NAME):null;
 });
}
function runPlan(){
 if(started||!manifest||!ui||!plan)return;
 started=true;errors=[];resetCounters();setErrorList([]);ui.button.dataset.retryCheck='0';
 var staged=plan.mode==='update',target=null;
 ui.button.disabled=true;ui.button.textContent=staged?'Updating…':'Downloading…';ui.button.dataset.done='0';
 setStatus(staged?'Downloading only the changed files…':'Preparing local storage and the offline download…');
 setWarning('The download is resumable. Files already saved and verified are skipped.');
 Promise.resolve().then(function(){return ensureServiceWorker()})
 .then(function(){return caches.open(CACHE_NAME)})
 .then(function(c){cache=c;return staged?caches.open(STAGING_NAME):c})
 .then(function(t){target=t;return dbPut('meta','progress',{version:manifest.version,startedAt:Date.now(),fileCount:plan.files.length,mode:plan.mode})})
 .then(function(){
  var persistPromise=Promise.resolve(null);
  try{if(navigator.storage&&navigator.storage.persist)persistPromise=navigator.storage.persist()}catch(e){}
  return persistPromise;
 }).then(function(){
  return navigator.storage&&navigator.storage.estimate?navigator.storage.estimate().catch(function(){return null}):null;
 }).then(function(estimate){
  if(estimate&&Number.isFinite(estimate.quota)&&Number.isFinite(estimate.usage)){
   var free=Math.max(0,estimate.quota-estimate.usage);
   if(free<plan.bytes)setWarning('Available storage estimate ('+fmtBytes(free)+') is below the download size ('+fmtBytes(plan.bytes)+'). Free some space before continuing.');
  }
  return staged?null:cache.delete(READY_URL);
 }).then(function(){
  stageCounts=stageMarkup();
  var cursor=0;
  var workers=[0,1].map(function(){
   return (async function(){
    while(true){
     var i=cursor++;if(i>=plan.files.length)return;
     var file=plan.files[i];
     try{
      var valid=await fileValid(file,true,target);
      if(!valid){
       await target.delete(urlFor(file.path));
       await fetchAndStore(file,target);
      }
      addDone(file);
     }catch(error){errors.push(file.path+': '+(error.message||String(error)))}
    }
   })();
  });
  return Promise.all(workers);
 }).then(function(){
  if(errors.length)throw new Error('Some files could not be downloaded. The saved files are kept; reconnect and retry.');
  return verifyAll(target);
 }).then(function(){
  if(errors.length)throw new Error('The final integrity check found missing or unreadable files.');
  return commitPlan(target);
 }).then(function(){return cleanupPreviousCaches()}).then(function(){
  ui.percent.textContent='100%';ui.count.textContent=plan.files.length+' / '+plan.files.length+' files';
  ui.track.setAttribute('aria-valuenow','100');ui.bar.style.width='100%';
  ui.bytes.textContent=fmtBytes(plan.bytes)+' / '+fmtBytes(plan.bytes);
  ui.stage.textContent='Verified and ready';
  var vs=ui.stages.querySelector('[data-stage="verify"]');
  if(vs){vs.querySelector('b').textContent='Complete';vs.classList.add('is-done');vs.classList.remove('is-active')}
  if(staged){
   setStatus('Update installed. Restart to use the new version.');
   setWarning('Only '+plan.files.length+' changed file'+(plan.files.length===1?' was':'s were')+' downloaded ('+fmtBytes(plan.bytes)+'). Your answers and study progress were not touched.');
   ui.button.textContent='Restart now';
  }else{
   setStatus('Setup complete. Shbace Medical is ready to open from this device without an internet connection.');
   setWarning('All required files were saved and verified. From now on, updates download only the files that change. Keep a JSON backup of your study progress.');
   ui.button.textContent='Open Shbace Medical';
  }
  ui.button.disabled=false;ui.button.dataset.done='1';ui.button.dataset.retryCheck='0';
  ui.foot.textContent='Offline package verified · '+fmtBytes(manifest.totalBytes)+' stored.';
 }).catch(function(error){
  setStatus(error.message||'The download could not be completed.');
  setWarning('No file is marked complete unless the HTTP response, byte size, SHA-256 hash and local cache write all succeeded. Retry to continue from verified files.');
  setErrorList(errors.length?errors:[error.message||String(error)]);
  ui.button.disabled=false;ui.button.textContent='Retry download';ui.button.dataset.done='0';
 }).finally(function(){started=false});
}
function showPlanNeeded(p){
 plan=p;mount();setMode(p.mode);
 stageCounts=stageMarkup();resetCounters();
 var what=p.mode==='restore'?'Restore':'One-time package';
 setStatus(p.mode==='restore'?'Some required files are missing from local storage.':'Download the complete local package before using offline mode.');
 setWarning(what+' · '+p.files.length+' files · '+fmtBytes(p.bytes)+'. Connect to the internet, tap the button, and keep the app open until verification completes.');
 ui.button.disabled=false;ui.button.textContent=(MODE_TEXT[p.mode]||MODE_TEXT.install).button;
 ui.count.textContent='0 / '+p.files.length+' files';
 ui.bytes.textContent='0 B / '+fmtBytes(p.bytes);
 ui.percent.textContent='0%';paintProgress('prepare',false);
}
function showUpdateSheet(p){
 if(document.getElementById('shbaceUpdateSheet'))return;
 plan=p;
 var st=document.createElement('style');
 st.textContent='#shbaceUpdateSheet{position:fixed;left:12px;right:12px;bottom:calc(86px + env(safe-area-inset-bottom,0px));z-index:99990;max-width:520px;margin:0 auto;padding:14px 16px;border-radius:18px;border:1px solid rgba(95,169,225,.4);background:linear-gradient(150deg,#0e2a4e,#071a33);color:#eaf4ff;box-shadow:0 10px 30px rgba(0,0,0,.45);font:14px system-ui,sans-serif}'+
  '#shbaceUpdateSheet b{display:block;font-size:15px;margin-bottom:4px}#shbaceUpdateSheet span{display:block;color:#a9c4de;line-height:1.45;font-size:12.5px}'+
  '#shbaceUpdateSheet div{display:flex;gap:8px;margin-top:12px}#shbaceUpdateSheet button{flex:1;min-height:42px;border-radius:12px;border:1px solid rgba(95,169,225,.4);background:rgba(8,25,48,.7);color:#eaf4ff;font:inherit;font-weight:700;cursor:pointer}'+
  '#shbaceUpdateSheet button.go{background:#1f6fe0;border-color:#3b8bff}';
 var el=document.createElement('div');el.id='shbaceUpdateSheet';el.setAttribute('role','dialog');
 el.innerHTML='<b>Update available</b><span>'+p.files.length+' changed file'+(p.files.length===1?'':'s')+' · '+fmtBytes(p.bytes)+'. Only the changes are downloaded; your progress is kept.</span><div><button type="button" id="shbUpdLater">Later</button><button type="button" class="go" id="shbUpdNow">Update now</button></div>';
 el.appendChild(st);document.body.appendChild(el);
 el.querySelector('#shbUpdLater').addEventListener('click',function(){el.remove()});
 el.querySelector('#shbUpdNow').addEventListener('click',function(){
  el.remove();showPlanNeeded(p);runPlan();
 });
}
function waitForSplash(){
 return new Promise(function(resolve){
  var splash=document.getElementById('startupSplash');
  if(!splash||!splash.isConnected){resolve();return}
  var finished=false,observer=null;
  function done(){
   if(finished||splash.isConnected)return;
   finished=true;if(observer)observer.disconnect();resolve();
  }
  try{observer=new MutationObserver(done);observer.observe(document.body,{childList:true,subtree:true})}catch(e){}
  setTimeout(function(){if(!finished){finished=true;if(observer)observer.disconnect();resolve()}},14000);
 });
}
function showSetupUnavailable(){
 mount();
 setStatus('This browser does not provide the storage features required for a verified offline installation.');
 setWarning('Use the latest supported browser and install Shbace Medical as an app. The app will remain online until offline storage is supported.');
 ui.button.disabled=true;
}
function showSetupError(error){
 mount();
 setStatus(error.message||'Could not read the offline installation manifest.');
 setWarning('The setup check could not finish. Your previously saved files have not been deleted. Connect to the internet if needed, then choose Retry setup.');
 ui.button.disabled=false;ui.button.textContent='Retry setup';ui.button.dataset.done='0';ui.button.dataset.retryCheck='1';
}

function start(){
 if(!standalone()){
  waitForSplash().then(showInstallHint);
  return;
 }
 if(!document.body)return;
 var splashFinished=waitForSplash();
 if(!('caches' in window)||!window.crypto||!crypto.subtle||!window.indexedDB){
  splashFinished.then(showSetupUnavailable);
  return;
 }
 decide().then(function(res){
  if(!res||res.kind==='none')return;
  return splashFinished.then(function(){
   if(res.kind==='prompt')showUpdateSheet(res.plan);else showPlanNeeded(res.plan);
  });
 }).catch(function(error){
  /* Offline (or manifest unreachable) after a completed install: stay silent and keep using the saved copy. */
  return dbGet('meta',INSTALLED_KEY).catch(function(){return null}).then(function(rec){
   if(rec&&rec.files)return;
   return dbGet('meta','ready').catch(function(){return null}).then(function(ready){
    if(ready&&ready.verified)return;
    return splashFinished.then(function(){showSetupError(error)});
   });
  });
 });
}
function boot(){start();}

if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});
else boot();
})();
