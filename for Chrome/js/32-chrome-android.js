/* SHBACE Medical · Chrome Android PWA bridge (Web APIs only). */
(function(){
'use strict';
if(!window.__SHBACE_CHROME_PWA__||!/Android/i.test(navigator.userAgent||''))return;

var deferredInstall=null,screenLock=null,lockBusy=false;
var VERSION_KEY='shbace_chrome_seen_version_v1';
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
  box.innerHTML='<h3>Chrome · Android</h3>'+
   '<p class="meta">Browser features for the installed SHBACE Medical app.</p>'+
   '<div class="shb-chrome-tools">'+
   '<button type="button" id="shbChromeInstall">Install app</button>'+
   '<button type="button" id="shbChromeFullscreen">Enter fullscreen</button></div>'+
   '<p class="shb-chrome-meta" id="shbChromeInstallNote">Install from Chrome to launch SHBACE without browser controls. You can also use Chrome ⋮ → Install app / Add to Home screen.</p>'+
   '<p class="shb-chrome-meta">Screen wake lock is applied automatically while the Question Bank is open when “Keep screen awake” is enabled. Browser reminders are not scheduled as native Android alarms.</p>';
  root.appendChild(box);
 }
 refreshSettings();
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
  if(!deferredInstall){toast('Open Chrome menu ⋮ and choose Install app or Add to Home screen.');return}
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
 requestAnimationFrame(function(){observerQueued=false;mountSettings();syncWakeLock()});
}
try{new MutationObserver(onDomChange).observe(document.body,{childList:true,subtree:true})}catch(_){}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',onDomChange,{once:true});
else onDomChange();

/* Quiet background checks. The app never reloads itself: new files reach the device only through the verified
   update window (js/29-offline-setup.js), which the student can accept or postpone. A new service worker leaves the
   installed package untouched, so a worker update needs no reload either. */
function checkVersion(){
 if(!navigator.serviceWorker||!navigator.serviceWorker.controller)return;
 fetch('./pwa-version.json',{cache:'no-store'})
  .then(function(r){if(!r.ok)throw new Error('version unavailable');return r.json()})
  .then(function(v){
   if(!v||!v.version)return;
   try{localStorage.setItem(VERSION_KEY,String(v.version))}catch(_){}
  }).catch(function(){});
}
if('serviceWorker' in navigator){
 navigator.serviceWorker.ready.then(function(reg){reg.update().catch(function(){});checkVersion()}).catch(function(){});
 window.addEventListener('online',checkVersion);
 document.addEventListener('visibilitychange',function(){if(!document.hidden)checkVersion()});
 setInterval(function(){
  if(document.hidden)return;
  navigator.serviceWorker.getRegistration('./').then(function(reg){if(reg)return reg.update()}).catch(function(){});
  checkVersion();
 },30*60*1000);
}
})();
