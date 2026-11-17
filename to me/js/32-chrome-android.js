/* SHBACE Medical · Chrome Android PWA bridge (Web APIs only). */
(function(){
'use strict';
if(!window.__SHBACE_CHROME_PWA__||!/Chrome\//i.test(navigator.userAgent||''))return;

var deferredInstall=null,screenLock=null,lockBusy=false,reloadPending=false,reloadStarted=false;
function installed(){
 try{return !!(window.matchMedia&&(
  window.matchMedia('(display-mode: fullscreen)').matches||
  window.matchMedia('(display-mode: standalone)').matches
 ))||navigator.standalone===true}catch(_){return false}
}
function toast(s){try{if(typeof window.toast==='function')window.toast(s)}catch(_){}}
function settingsRoot(){
 var root=document.querySelector('#phoneContent .rs'),h=root&&root.querySelector('h1');
 return root&&h&&/^settings$/i.test((h.textContent||'').trim())?root:null;
}
function mountSettings(){
 var root=settingsRoot();if(!root)return;
 if(!root.querySelector('#shbChromeSettings')){
  var box=document.createElement('section');
  box.className='card setcard';box.id='shbChromeSettings';
  box.innerHTML='<h3>Chrome · Unified</h3>'+
   '<p class="meta">Browser features for the installed SHBACE Medical app on phone and computer.</p>'+
   '<div class="shb-chrome-tools">'+
   '<button type="button" id="shbChromeInstall">Install app</button>'+
   '<button type="button" id="shbChromeFullscreen">Enter fullscreen</button></div>'+
   '<p class="shb-chrome-meta" id="shbChromeInstallNote">Install from Chrome to launch SHBACE without browser controls. You can also use Chrome ⋮ → Install app / Add to Home screen.</p>'+
   '<p class="shb-chrome-meta">Screen wake lock is applied automatically while the Question Bank is open when “Keep screen awake” is enabled. Browser reminders are not scheduled as native Android alarms.</p>';
  root.appendChild(box);
 }
 mountUpdateCard(root);
 refreshSettings();
}
/* Manual update check. Automatic manifest polling is owned by the offline engine (48-hour cadence). */
function updateNote(){
 var t=0,p=0,vi=null;try{t=Number(window.shbaceLastUpdateCheck&&window.shbaceLastUpdateCheck())||0;p=Number(window.shbaceUpdatePending&&window.shbaceUpdatePending())||0;vi=window.shbaceVersionInfo&&window.shbaceVersionInfo()}catch(_){}
 var inst=vi&&vi.installed,av=vi&&vi.available;
 var ver=inst&&inst.displayVersion?'Version '+inst.displayVersion+(inst.releaseDate?' · '+inst.releaseDate:'')+'. ':'';
 var base=ver+(t?'Last successful check: '+new Date(t).toLocaleString()+'. ':'')+'The app checks automatically every 48 hours.';
 return p?'A new update'+(av&&av.displayVersion?' ('+av.displayVersion+')':'')+' is available ('+p+' changed file'+(p===1?'':'s')+'). Tap Check for updates, then Update now. '+base:base;
}
function mountUpdateCard(root){
 if(!installed()||typeof window.shbaceCheckForUpdate!=='function')return;
 var existing=root.querySelector('#shbUpdateSettings');
 if(existing){var note=existing.querySelector('#shbUpdateNote');if(note&&!existing.dataset.busy)note.textContent=updateNote();return}
 var box=document.createElement('section');
 box.className='card setcard';box.id='shbUpdateSettings';
 box.innerHTML='<h3>App updates</h3>'+
  '<p class="meta">Changed files download and verify in the background. Your answers and study progress are kept.</p>'+
  '<div class="shb-chrome-tools"><button type="button" id="shbUpdateCheck">Check for updates</button></div>'+
  '<p class="shb-chrome-meta" id="shbUpdateNote">'+updateNote()+'</p>';
 root.appendChild(box);
 var button=box.querySelector('#shbUpdateCheck'),note=box.querySelector('#shbUpdateNote');
 button.addEventListener('click',function(){
  if(box.dataset.busy)return;
  box.dataset.busy='1';button.disabled=true;button.textContent='Checking…';
  Promise.resolve(window.shbaceCheckForUpdate()).then(function(r){
   var s=r&&r.state;
   note.textContent=s==='latest'?'You already have the latest version.':
    s==='update'?'An update is available. Tap Update now below to install it.':
    s==='setup'?'Some files need to be downloaded. Follow the on-screen steps.':
    s==='offline'?'Could not reach the server. Check your internet connection and try again.':
    s==='busy'?'An update is already in progress.':'Update checks are available in the installed app.';
  }).catch(function(){note.textContent='The check could not be completed. Try again later.'})
  .then(function(){delete box.dataset.busy;button.disabled=false;button.textContent='Check for updates'});
 });
}
function refreshSettings(){
 var root=document.getElementById('shbChromeSettings');if(!root)return;
 var install=root.querySelector('#shbChromeInstall'),full=root.querySelector('#shbChromeFullscreen'),note=root.querySelector('#shbChromeInstallNote');
 var isApp=installed();
 if(isApp){install.textContent='Installed on this device';install.disabled=true;note.textContent='SHBACE Medical is running as an installed Chrome app.'}
 else if(deferredInstall){install.textContent='Install SHBACE Medical';install.disabled=false;note.textContent='Install the app to open it in fullscreen with its own app icon.'}
 else{install.textContent='How to install';install.disabled=false;note.textContent='Open Chrome ⋮ → Install app or Add to Home screen. The install prompt appears here when Chrome makes it available.'}
 var isFull=!!document.fullscreenElement;
 full.textContent=isFull?'Exit browser fullscreen':(isApp?'Fullscreen app is active':'Enter fullscreen');
 full.disabled=isApp||(!document.documentElement.requestFullscreen&&!isFull);
}
window.addEventListener('beforeinstallprompt',function(event){event.preventDefault();deferredInstall=event;refreshSettings()});
window.addEventListener('appinstalled',function(){deferredInstall=null;refreshSettings();toast('SHBACE Medical installed')});
document.addEventListener('fullscreenchange',refreshSettings);
document.addEventListener('click',function(event){
 var install=event.target&&event.target.closest&&event.target.closest('#shbChromeInstall');
 if(install){
  if(!deferredInstall){toast('Open the Chrome menu ⋮ and choose Install app / Add to Home screen.');return}
  var promptEvent=deferredInstall;deferredInstall=null;
  Promise.resolve(promptEvent.prompt()).then(function(){return promptEvent.userChoice||null})
   .then(function(choice){if(choice&&choice.outcome==='accepted')toast('SHBACE Medical installation started');refreshSettings()})
   .catch(function(){refreshSettings();toast('Chrome could not open the install prompt')});
  return;
 }
 var full=event.target&&event.target.closest&&event.target.closest('#shbChromeFullscreen');
 if(full){
  if(document.fullscreenElement){if(document.exitFullscreen)document.exitFullscreen().catch(function(){})}
  else if(document.documentElement.requestFullscreen)document.documentElement.requestFullscreen().catch(function(){toast('Fullscreen is controlled by Chrome for this screen')});
  return;
 }
 var keep=event.target&&event.target.closest&&event.target.closest('[data-shb-pref="keepScreenOn"]');
 if(keep)setTimeout(syncWakeLock,0);
});
function keepAwakeEnabled(){
 try{var p=JSON.parse(localStorage.getItem('shbace_android_features_v1')||'{}');return p.keepScreenOn!==false}catch(_){return true}
}
function questionBankOpen(){return !!document.querySelector('#phoneContent .rs.qb')}
function releaseWakeLock(){
 if(!screenLock)return;
 var lock=screenLock;screenLock=null;
 try{lock.release().catch(function(){})}catch(_){}
}
function syncWakeLock(){
 var should=keepAwakeEnabled()&&questionBankOpen()&&!document.hidden&&!!navigator.wakeLock;
 if(!should){releaseWakeLock();return}
 if(screenLock||lockBusy)return;
 lockBusy=true;
 navigator.wakeLock.request('screen').then(function(lock){
  screenLock=lock;lock.addEventListener('release',function(){if(screenLock===lock)screenLock=null});
 }).catch(function(){/* Browser policy may deny the lock; the study session remains usable. */})
 .finally(function(){lockBusy=false});
}
document.addEventListener('visibilitychange',function(){if(document.hidden)releaseWakeLock();else syncWakeLock()});
window.addEventListener('pagehide',releaseWakeLock);
var observerQueued=false;
function onDomChange(){
 if(observerQueued)return;observerQueued=true;
 requestAnimationFrame(function(){observerQueued=false;mountSettings();syncWakeLock();applyPendingReload()});
}
try{new MutationObserver(onDomChange).observe(document.body,{childList:true,subtree:true})}catch(_){}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',onDomChange,{once:true});
else onDomChange();

/* Quiet update checks. New files apply only after the Question Bank screen is left. */
function safeToReload(){return document.hidden||(!window.__SHBACE_OFFLINE_UPDATE_ACTIVE__&&!questionBankOpen())}
function applyPendingReload(){
 if(!reloadPending||reloadStarted||!safeToReload())return false;
 reloadStarted=true;
 setTimeout(function(){location.reload()},180);
 return true;
}
/* The offline updater calls this after a user-approved, verified package commit.
   When a question-bank session is active, its next screen change triggers the reload. */
window.shbaceRequestAppReload=function(){reloadPending=true;return applyPendingReload();};

})();
