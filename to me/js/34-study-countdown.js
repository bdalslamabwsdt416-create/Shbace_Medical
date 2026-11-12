/* SHBACE Medical · countdown focus timer for the unified Chrome PWA.
   The study log remains the original elapsed-time store; this layer presents a real countdown
   and finishes the session exactly when its configured focus target is reached. */
(function(){
'use strict';
var ALERT_KEY='shbace_to_me_timer_alerted_v1',lastId='';
function state(){try{return window.__shbStudy&&window.__shbStudy.state?window.__shbStudy.state():null}catch(_){return null}}
function onTimerPage(){try{return typeof appPage!=='undefined'&&appPage==='timer'}catch(_){return false}}
function goal(){try{var x=JSON.parse(localStorage.getItem('shbace_studytime_v1')||'{}');return Math.max(5,Math.min(240,Number(x.goal)||25))}catch(_){return 25}}
function elapsed(c){if(!c)return 0;return Math.max(0,(Number(c.ms)||0)+(c.running&&Number.isFinite(c.rs)?Math.max(0,Date.now()-c.rs):0))}
function clock(ms){var s=Math.max(0,Math.ceil(ms/1000)),m=Math.floor(s/60),x=s%60,h=Math.floor(m/60);return h?String(h)+':'+String(m%60).padStart(2,'0')+':'+String(x).padStart(2,'0'):String(m).padStart(2,'0')+':'+String(x).padStart(2,'0')}
function update(ms){
 var c=(state()||{}).cur,g=goal(),total=g*60000,left=Math.max(0,total-ms),progress=Math.max(0,Math.min(1,ms/total));
 var d=document.getElementById('tmDigits'),t=document.getElementById('tmGoalTxt'),a=document.getElementById('tmArc'),dot=document.getElementById('tmDot');document.querySelectorAll('.sst-time').forEach(function(el){el.textContent=clock(left)});
 if(d)d.textContent=clock(left);
 if(t)t.textContent=left>0?(clock(left)+' remaining · '+Math.round(progress*100)+'% complete'):'Focus time complete';
 if(a){var circ=2*Math.PI*100;a.style.strokeDashoffset=String(circ*progress)}
 if(dot){var ang=progress*2*Math.PI-Math.PI/2;dot.setAttribute('cx',(120+100*Math.cos(ang)).toFixed(1));dot.setAttribute('cy',(120+100*Math.sin(ang)).toFixed(1))}
 var st=document.getElementById('tmAlertStatus');
 if(st&&!st.dataset.permissionKnown)st.textContent=(!('Notification' in window))?'Browser alerts are not supported here.':Notification.permission==='granted'?'Timer notifications are enabled.':Notification.permission==='denied'?'Notifications are blocked in browser settings.':'Enable notifications to receive a browser alert when the timer finishes.';
}
function requestAlerts(){
 if(!('Notification' in window)){var x=document.getElementById('tmAlertStatus');if(x)x.textContent='This browser does not support notifications.';return}
 if(Notification.permission==='granted'){setAlertStatus('Timer notifications are enabled.');return}
 if(Notification.permission==='denied'){setAlertStatus('Notifications are blocked in browser settings. Enable them from the site permissions.');return}
 Notification.requestPermission().then(function(p){setAlertStatus(p==='granted'?'Timer notifications are enabled.':p==='denied'?'Notifications were not allowed.':'Notification permission was not changed.')}).catch(function(){setAlertStatus('Could not request notification permission.')});
}
function setAlertStatus(s){var x=document.getElementById('tmAlertStatus');if(x)x.textContent=s}
function vibrate(){try{if(navigator.vibrate)navigator.vibrate([350,150,350,150,800])}catch(_){}}
function beep(){
 try{
  var C=window.AudioContext||window.webkitAudioContext;if(!C)return;
  var ctx=new C(),start=ctx.currentTime;
  [0,0.85,1.7,2.55,3.4].forEach(function(offset){var o=ctx.createOscillator(),g=ctx.createGain();o.type='sine';o.frequency.value=880;g.gain.setValueAtTime(.0001,start+offset);g.gain.exponentialRampToValueAtTime(.18,start+offset+.025);g.gain.exponentialRampToValueAtTime(.0001,start+offset+.34);o.connect(g);g.connect(ctx.destination);o.start(start+offset);o.stop(start+offset+.36)});
  setTimeout(function(){try{ctx.close()}catch(_){}},4700);
 }catch(_){}
}
function notify(title,body){
 if(!('Notification' in window)||Notification.permission!=='granted')return;
 var opts={body:body,icon:'./assets/img/shbace-pwa-192.png',badge:'./assets/img/shbace-pwa-192.png',vibrate:[350,150,350,150,800],tag:'shbace-focus-timer',renotify:true};
 try{
  if(navigator.serviceWorker&&navigator.serviceWorker.ready){navigator.serviceWorker.ready.then(function(reg){return reg.showNotification(title,opts)}).catch(function(){try{new Notification(title,opts)}catch(_){}})}
  else new Notification(title,opts);
 }catch(_){}
}
function finishAtZero(c,g){
 if(!c||!c.id||lastId===c.id)return;lastId=c.id;
 try{localStorage.setItem(ALERT_KEY,c.id)}catch(_){}
 try{if(typeof window.stTimerFinish==='function')window.stTimerFinish()}catch(_){}
 vibrate();beep();notify('Focus session complete','Your '+g+'-minute study timer has reached zero. Take a short break or start another session.');
 setTimeout(function(){try{if(typeof window.renderAppDemo==='function'&&onTimerPage())window.renderAppDemo()}catch(_){}},80);
}
function sync(){
 var st=state(),c=st&&st.cur;
 if(!c){update(0);return}
 var ms=elapsed(c),g=goal();update(ms);
 if(c.running&&ms>=g*60000)finishAtZero(c,g);
}
var originalTick=window.stTimerTick;
window.stTimerTick=function(ms){try{if(typeof originalTick==='function')originalTick(ms)}catch(_){}try{var c=(state()||{}).cur;if(c&&c.running&&ms>=goal()*60000){finishAtZero(c,goal());return}update(ms)}catch(_){}};
var originalRender=window.renderAppDemo;
if(typeof originalRender==='function')window.renderAppDemo=function(){var r=originalRender.apply(this,arguments);try{if(onTimerPage()){sync();var host=document.querySelector('#phoneContent .tm-card');if(host&&!document.getElementById('tmAlertControls')){var box=document.createElement('div');box.id='tmAlertControls';box.className='tm-alert-controls';box.innerHTML='<button type="button" class="btn tm-sec" id="tmEnableAlerts">Enable timer notifications</button><small id="tmAlertStatus" role="status" aria-live="polite"></small><p class="meta">The countdown uses wall-clock time and updates when the app returns to the foreground. Chrome can show a notification while the PWA is active or suspended, but a browser timer cannot guarantee an exact alarm after the browser or device has fully closed the app.</p>';host.appendChild(box);setAlertStatus('');}}}catch(_){}return r};
document.addEventListener('click',function(e){var b=e.target&&e.target.closest&&e.target.closest('#tmEnableAlerts');if(b){e.preventDefault();requestAlerts()}},true);
document.addEventListener('visibilitychange',function(){if(!document.hidden)sync()});
window.addEventListener('pageshow',sync);
setInterval(sync,500);
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',sync,{once:true});else sync();
})();
