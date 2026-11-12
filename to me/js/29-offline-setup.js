(function(){
'use strict';

var CACHE_NAME='shbace-chrome-offline-v1.3.7';
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
   '<div class="shb-offline-warning" id="shbOfflineWarning">Keep this app open and connected to the internet until verification finishes. Do not close the app during the first download.</div>'+
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
  if(ui.button.dataset.done==='1'){removeSetupOverlay();return}
  if(ui.button.dataset.retryCheck==='1'){location.reload();return}
  startDownload();
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
function fileValid(file,checkHash){
 return cache.match(urlFor(file.path)).then(function(response){
  if(!response||!response.ok)return false;
  return response.arrayBuffer().then(function(bytes){
   if(bytes.byteLength!==file.bytes)return false;
   if(!checkHash)return true;
   return hashBytes(bytes).then(function(sum){return sum===file.sha256});
  }).catch(function(){return false});
 });
}
function loadManifest(){
 return caches.open(CACHE_NAME).then(function(c){
  /* Network first: a stale cached copy of the file list makes size/SHA checks fail against newer files.
     The cached copy is only a fallback for when the device is offline. */
  return fetch(MANIFEST_URL,{credentials:'same-origin',cache:'no-store'}).then(function(r){
   if(!r.ok)throw new Error('Offline asset manifest returned HTTP '+r.status+'.');
   var copy=r.clone();
   return r.json().then(function(data){
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
 manifest.files.forEach(function(f){var g=fileGroup(f);counts[g]=(counts[g]||0)+1});
 ui.stages.innerHTML=STAGES.filter(function(s){return s.id!=='verify'}).map(function(s){
  return '<div class="shb-offline-stage" data-stage="'+s.id+'"><span class="shb-offline-stage-dot"></span><span>'+s.label+'</span><b>0 / '+(counts[s.id]||0)+'</b></div>';
 }).join('')+
 '<div class="shb-offline-stage" data-stage="verify"><span class="shb-offline-stage-dot"></span><span>Integrity verification</span><b>Pending</b></div>';
 return counts;
}
var stageCounts=null,stageDone={app:0,images:0,data:0,other:0};
function paintProgress(current,verifying){
 if(!ui||!manifest)return;
 var total=manifest.files.length,done=verifiedCount;
 var pct=total?Math.min(100,Math.floor(done*100/total)):0;
 if(verifying&&done===total)pct=99;
 ui.percent.textContent=pct+'%';
 ui.count.textContent=done+' / '+total+' files';
 ui.track.setAttribute('aria-valuenow',String(pct));
 ui.bar.style.width=pct+'%';
 ui.bytes.textContent=fmtBytes(verifiedBytes)+' / '+fmtBytes(manifest.totalBytes);
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
function ensureServiceWorker(){
 if(!('serviceWorker' in navigator))return Promise.reject(new Error('This browser does not support Service Workers.'));
 return navigator.serviceWorker.getRegistration('./').then(function(reg){
  if(reg)return reg;
  return navigator.serviceWorker.register('./sw.js',{scope:'./'});
 }).then(function(){return navigator.serviceWorker.ready});
}
function fetchAndStore(file){
 var target=urlFor(file.path),lastError=null;
 function attempt(n){
  return fetch(target,{credentials:'same-origin',cache:'no-store'}).then(function(response){
   if(!response||!response.ok)throw new Error('HTTP '+(response?response.status:'no response'));
   return response.arrayBuffer().then(function(bytes){
    if(bytes.byteLength!==file.bytes)throw new Error('Size check failed ('+bytes.byteLength+' of '+file.bytes+' bytes).');
    return hashBytes(bytes).then(function(sum){
     if(sum!==file.sha256)throw new Error('SHA-256 integrity check failed.');
     var headers=new Headers(response.headers);
     headers.delete('content-length');
     headers.delete('content-encoding');
     return cache.put(target,new Response(bytes,{status:200,statusText:'OK',headers:headers})).then(function(){
      return dbPut('verified',manifest.version+':'+file.path,{version:manifest.version,path:file.path,bytes:file.bytes,sha256:file.sha256,verifiedAt:Date.now()});
     });
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
function verifyAll(){
 setStatus('Checking that every downloaded file can be read from local storage…');
 paintProgress('verify',true);
 var index=0;
 function next(){
  if(index>=manifest.files.length)return Promise.resolve();
  var file=manifest.files[index++];
  return fileValid(file,true).then(function(ok){
   if(!ok)errors.push(file.path+': missing or failed integrity check');
   if(index%8===0||index===manifest.files.length)ui.stage.textContent='Verifying '+index+' / '+manifest.files.length;
   return next();
  });
 }
 return next();
}
function startDownload(){
 if(started||!manifest||!ui)return;
 started=true;errors=[];resetCounters();setErrorList([]);ui.button.dataset.retryCheck='0';
 ui.button.disabled=true;ui.button.textContent='Downloading…';ui.button.dataset.done='0';
 setStatus('Preparing local storage and the offline download…');
 setWarning('The download is resumable. Files already saved and verified will be skipped.');
 Promise.resolve().then(function(){return ensureServiceWorker()})
 .then(function(){return caches.open(CACHE_NAME)})
 .then(function(c){
  cache=c;
  return dbPut('meta','progress',{version:manifest.version,startedAt:Date.now(),fileCount:manifest.files.length});
 }).then(function(){
  var persistPromise=Promise.resolve(null);
  try{if(navigator.storage&&navigator.storage.persist)persistPromise=navigator.storage.persist()}catch(e){}
  return persistPromise;
 }).then(function(persisted){
  if(persisted===false)setWarning('Chrome/browser did not grant persistent storage. The app will work offline after verification, but iOS may still remove website data under storage pressure. Keep backups of your study progress.');
  else if(persisted===true)setWarning('Persistent storage was granted by the browser. iOS can still manage storage, so keep backups of your study progress.');
  return navigator.storage&&navigator.storage.estimate?navigator.storage.estimate().catch(function(){return null}):null;
 }).then(function(estimate){
  if(estimate&&Number.isFinite(estimate.quota)&&Number.isFinite(estimate.usage)){
   var free=Math.max(0,estimate.quota-estimate.usage);
   if(free<manifest.totalBytes)setWarning('Available storage estimate ('+fmtBytes(free)+') is below the package size ('+fmtBytes(manifest.totalBytes)+'). Free some space before continuing. Completed files will remain saved if the download stops.');
  }
  return cache.delete(READY_URL);
 }).then(function(){
  stageCounts=stageMarkup();
  var cursor=0;
  var workers=[0,1].map(function(){
   return (async function(){
    while(true){
     var i=cursor++;if(i>=manifest.files.length)return;
     var file=manifest.files[i],group=fileGroup(file);
     try{
      var valid=await fileValid(file,true);
      if(!valid){
       await cache.delete(urlFor(file.path));
       await fetchAndStore(file);
      }else{
       await dbPut('verified',manifest.version+':'+file.path,{version:manifest.version,path:file.path,bytes:file.bytes,sha256:file.sha256,verifiedAt:Date.now()});
      }
      addDone(file);
     }catch(error){errors.push(file.path+': '+(error.message||String(error)))}
    }
   })();
  });
  return Promise.all(workers);
 }).then(function(){
  if(errors.length)throw new Error('Some files could not be downloaded. The saved files are kept; reconnect and retry the missing items.');
  return verifyAll();
 }).then(function(){
  if(errors.length)throw new Error('The final integrity check found missing or unreadable files.');
  var record={version:manifest.version,verified:true,fileCount:manifest.files.length,totalBytes:manifest.totalBytes,completedAt:Date.now()};
  return dbPut('meta','ready',record).then(function(){
   return cache.put(READY_URL,new Response(JSON.stringify(record),{status:200,headers:{'content-type':'application/json'}}));
  }).then(function(){
   ui.percent.textContent='100%';ui.count.textContent=manifest.files.length+' / '+manifest.files.length+' files';
   ui.track.setAttribute('aria-valuenow','100');ui.bar.style.width='100%';
   ui.bytes.textContent=fmtBytes(manifest.totalBytes)+' / '+fmtBytes(manifest.totalBytes);
   ui.stage.textContent='Verified and ready';
   ui.stages.querySelector('[data-stage="verify"] b').textContent='Complete';
   ui.stages.querySelector('[data-stage="verify"]').classList.add('is-done');
   ui.stages.querySelector('[data-stage="verify"]').classList.remove('is-active');
   setStatus('Setup complete. Shbace Medical is ready to open from this device without an internet connection.');
   setWarning('All '+manifest.files.length+' required files were saved and verified locally. Your existing answers and study progress were not reset.');
   ui.button.disabled=false;ui.button.textContent='Open Shbace Medical';ui.button.dataset.done='1';ui.button.dataset.retryCheck='0';
   ui.foot.textContent='Offline package verified · '+fmtBytes(manifest.totalBytes)+' stored. Keep a JSON backup of your study progress.';
  });
 }).catch(function(error){
  setStatus(error.message||'The offline download could not be completed.');
  setWarning('No file is marked complete unless the HTTP response, byte size, SHA-256 hash, and local cache write have all succeeded. Retry to continue from verified files.');
  setErrorList(errors.length?errors:[error.message||String(error)]);
  ui.button.disabled=false;ui.button.textContent='Retry download';ui.button.dataset.done='0';
 }).finally(function(){started=false});
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
function showSetupNeeded(check){
 mount();
 stageCounts=stageMarkup();resetCounters();
 var reason=check.record&&check.record.version!==manifest.version?
  'The installed app package has changed. Restore the local files manually to use this build.':
  (check.missing&&check.missing.length?'Some required files are missing from local storage. Restore them to continue offline.':'Download the complete local package before using offline mode.');
 setStatus(reason);
 setWarning('One-time package · '+manifest.files.length+' files · '+fmtBytes(manifest.totalBytes)+'. Connect to the internet, tap the button, and keep the app open until verification completes.');
 var restoreNeeded=!!(check.record||check.missing&&check.missing.length);
 ui.button.disabled=false;ui.button.textContent=restoreNeeded?'Restore offline package':'Start one-time download';
 ui.count.textContent='0 / '+manifest.files.length+' files';
 ui.bytes.textContent='0 B / '+fmtBytes(manifest.totalBytes);
 ui.percent.textContent='0%';paintProgress('prepare',false);
}
function showSetupError(error){
 mount();
 setStatus(error.message||'Could not read the offline installation manifest.');
 setWarning('The setup check could not finish. Your previously saved files have not been deleted. Connect to the internet if needed, then choose Retry setup.');
 ui.button.disabled=false;ui.button.textContent='Retry setup';ui.button.dataset.done='0';ui.button.dataset.retryCheck='1';
}
function inspectInstalledState(){
 return loadManifest().then(function(data){
  manifest=data;cache=null;
  return caches.open(CACHE_NAME).then(function(c){cache=c;return dbGet('meta','ready')})
   .then(function(record){
    if(!record||!record.verified)return {ready:false,record:record};
    // Audit current assets silently while the splash is visible. Do not create setup UI
    // unless at least one current manifest file is missing or fails SHA-256 verification.
    var missing=[],idx=0;
    function inspect(){
     if(idx>=manifest.files.length)return Promise.resolve(missing);
     var f=manifest.files[idx++];
     return fileValid(f,true).then(function(ok){if(!ok)missing.push(f.path);return inspect()});
    }
    return inspect().then(function(list){
     if(list.length)return {ready:false,missing:list,record:record};
     var refreshed={version:manifest.version,verified:true,fileCount:manifest.files.length,totalBytes:manifest.totalBytes,completedAt:Date.now()};
     return dbPut('meta','ready',refreshed).then(function(){
      return cache.put(READY_URL,new Response(JSON.stringify(refreshed),{status:200,headers:{'content-type':'application/json'}}));
     }).then(function(){return {ready:true,record:refreshed}});
    });
   });
 });
}
function start(){
 if(!standalone()){
  waitForSplash().then(showInstallHint);
  return;
 }
 if(!document.body)return;
 // Start network/manifest and local SHA-256 checks immediately, underneath the splash.
 // The offline setup overlay is mounted only after the splash and only when actually needed.
 var splashFinished=waitForSplash();
 if(!('caches' in window)||!window.crypto||!crypto.subtle||!window.indexedDB){
  splashFinished.then(showSetupUnavailable);
  return;
 }
 inspectInstalledState().then(function(check){
  if(check.ready)return;
  return splashFinished.then(function(){showSetupNeeded(check)});
 }).catch(function(error){
  return splashFinished.then(function(){showSetupError(error)});
 });
}
function boot(){start();}

if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});
else boot();
})();