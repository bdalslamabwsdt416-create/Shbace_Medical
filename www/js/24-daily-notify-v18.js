
/* v18 · Daily Medical Insight notifications (Capacitor Local Notifications), 10:00 and 22:00 device-local time.
   Content comes only from the app's own DAILY_FACTS list, using the same day/slot selection as the Home "Daily Medical Fact"
   (10:00 -> the morning fact, 22:00 -> the evening fact). Needs the @capacitor/local-notifications plugin in the native project;
   without it (plain browser) this file does nothing. The next 30 days are re-planned each time the app is opened. */
(function(){
 var CH='daily-insight',DAYS=30,HOURS=[10,22],LO=200000000,HI=299999999,started=false;
 function pad(n){return String(n).padStart(2,'0')}
 function ymdOf(d){return d.getFullYear()+'-'+pad(d.getMonth()+1)+'-'+pad(d.getDate())}
 function plugin(){try{var c=window.Capacitor;if(!c)return null;if(c.isNativePlatform&&!c.isNativePlatform())return null;return (c.Plugins&&c.Plugins.LocalNotifications)||null}catch(e){return null}}
 function facts(){
  var raw=(typeof DAILY_FACTS!=='undefined'&&Array.isArray(DAILY_FACTS))?DAILY_FACTS:[];
  return raw.map(function(o){
   if(!o||typeof o!=='object'||typeof o.text!=='string'||!o.text.trim())return null;
   var r={text:o.text.trim()};
   ['title','source','topic','category','pearl'].forEach(function(k){if(typeof o[k]==='string'&&o[k].trim())r[k]=o[k].trim()});
   if(Array.isArray(o.sources))r.sources=o.sources.filter(function(x){return x&&typeof x.url==='string'&&/^https:\/\//i.test(x.url)}).map(function(x){return {label:String(x.label||'Reference'),url:x.url}});
   if(/^\d{4}-\d{2}-\d{2}$/.test(o.date||''))r.date=o.date;
   return r}).filter(Boolean)}
 /* identical selection to todayFacts() in the Home Daily Medical Fact */
 function pair(d){
  var F=facts();if(!F.length)return [];
  var nd=F.filter(function(f){return !f.date}),pool=nd.length?nd:F,key=ymdOf(d),seed=2166136261,i;
  for(i=0;i<key.length;i++){seed^=key.charCodeAt(i);seed=Math.imul(seed,16777619)}
  var rnd=function(){seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296};
  var a=pool.slice();
  for(i=a.length-1;i>0;i--){var j=Math.floor(rnd()*(i+1)),t=a[i];a[i]=a[j];a[j]=t}
  return a.slice(0,Math.min(2,a.length))}
 function factFor(d,slot){var p=pair(d);return p.length?p[Math.min(slot,p.length-1)]:null}
 function clip(s,n){s=String(s).replace(/\s+/g,' ').trim();if(s.length<=n)return s;return s.slice(0,n-1).replace(/\s+\S*$/,'')+'…'}
 function titleOf(f,slot){return (slot?'🌙 ':'🧠 ')+clip(f.title||f.pearl||'Medical Insight of the Day',50)}
 function bodyOf(f){
  var t=f.text.replace(/\s+/g,' '),m=t.match(/^.{40,130}?[.!?](\s|$)/),s=m?m[0].trim():clip(t,125);
  return s+' Tap to discover more.'}
 function build(){
  var out=[],now=Date.now(),k;
  for(k=0;k<DAYS;k++){
   var d=new Date();d.setHours(0,0,0,0);d.setDate(d.getDate()+k);
   HOURS.forEach(function(h,slot){
    var at=new Date(d.getFullYear(),d.getMonth(),d.getDate(),h,0,0,0);
    if(at.getTime()<=now+30000)return;
    var f=factFor(d,slot);if(!f)return;
    out.push({id:Number(d.getFullYear()+pad(d.getMonth()+1)+pad(d.getDate()))*10+slot,
     title:titleOf(f,slot),body:bodyOf(f),largeBody:clip(f.text,420),summaryText:'Shbace Medical'+(f.category?' · '+f.category:''),
     schedule:{at:at,allowWhileIdle:true},channelId:CH,extra:{ymd:ymdOf(d),slot:slot}})});}
  return out}
 /* tapping a notification: open the matching fact in the existing Daily Medical Fact sheet */
 function openFact(ymd,slot){
  var m=/^(\d{4})-(\d{2})-(\d{2})$/.exec(ymd||'');if(!m)return true;
  var sp=document.getElementById('startupSplash');
  if(sp&&sp.isConnected&&getComputedStyle(sp).visibility!=='hidden')return false;
  if(typeof mode==='undefined'||mode!=='app'||typeof window.h7Sheet!=='function'||!document.querySelector('.phone'))return false;
  var f=factFor(new Date(+m[1],+m[2]-1,+m[3]),+slot||0);if(!f)return true;
  try{if(appPage!=='subjects'){appPage='subjects';renderAppDemo()}}catch(e){}
  window.h7Sheet(0,f);return true}
 function deliver(ymd,slot){var n=0;(function t(){if(openFact(ymd,slot))return;if(++n<90)setTimeout(t,500)})()}
 var LN=plugin();
 if(!LN)return;
 try{LN.addListener('localNotificationActionPerformed',function(ev){var x=(ev&&ev.notification&&ev.notification.extra)||{};deliver(x.ymd,x.slot)})}catch(e){}
 async function plan(){
  try{
   var perm=await LN.checkPermissions();
   /* no automatic permission prompt: the request is made only after the student taps the bell and agrees (see askFromBell) */
   if(perm.display!=='granted')return;
   try{await LN.createChannel({id:CH,name:'Daily Medical Insight',description:'A clinical pearl every day at 10:00 and 22:00',importance:4,visibility:1,lights:true,lightColor:'#35E6FF',vibration:true})}catch(e){}
   var list=build(),pend=await LN.getPending(),mine=(pend.notifications||[]).filter(function(n){return n.id>=LO&&n.id<=HI});
   var want={};list.forEach(function(n){want[n.id]=1});
   if(mine.length===list.length&&mine.every(function(n){return want[n.id]}))return;      /* already planned: no duplicates, no rework */
   if(mine.length)await LN.cancel({notifications:mine.map(function(n){return {id:n.id}})});
   if(list.length)await LN.schedule({notifications:list});
  }catch(e){console.error('daily notifications',e)}}
 function ready(){
  var sp=document.getElementById('startupSplash');
  return typeof mode!=='undefined'&&mode==='app'&&!(sp&&sp.isConnected&&getComputedStyle(sp).visibility!=='hidden')}
 var iv=setInterval(function(){if(!started&&ready()){started=true;plan()}if(started)clearInterval(iv)},2500);
 document.addEventListener('visibilitychange',function(){if(!document.hidden&&started)plan()});
 /* Ask for notification permission only when the student taps the bell, with a clear reason, and never again once they have decided. */
 var ASKED='shbace_notif_perm_asked_v1',asking=false;
 function getFlag(){try{return localStorage.getItem(ASKED)}catch(e){return null}}
 function setFlag(v){try{localStorage.setItem(ASKED,v)}catch(e){}}
 function closeAsk(el){if(el&&el.parentNode)el.parentNode.removeChild(el);asking=false}
 function showAsk(){
  var host=document.querySelector('.phone')||document.body;if(!host)return;
  var el=document.createElement('div');el.className='npx-ask';el.style.cssText='position:absolute;inset:0;z-index:99999';
  el.innerHTML='<div class="xbk"></div><div class="xsheet" role="alertdialog" aria-modal="true" aria-labelledby="npxT" style="text-align:center"><h3 id="npxT" style="margin:0 0 10px;font-size:20px">Turn on study reminders?</h3><p class="xnote" style="margin:0 0 6px">Shbace Medical can send you a short clinical pearl at 10:00 and 22:00 every day, plus review and study reminders, so you keep your streak without opening the app.</p><p class="xnote" style="margin:0">You can change this anytime in Settings.</p><button type="button" class="btn primary block" data-a="y">Allow notifications</button><button type="button" class="btn block" data-a="n" style="margin-top:10px">Not now</button></div>';
  host.appendChild(el);asking=true;
  el.querySelector('.xbk').addEventListener('click',function(){setFlag('dismissed');closeAsk(el)});
  el.querySelector('[data-a="n"]').addEventListener('click',function(){setFlag('dismissed');closeAsk(el)});
  el.querySelector('[data-a="y"]').addEventListener('click',async function(){
   setFlag('asked');closeAsk(el);
   try{var r=await LN.requestPermissions();if(r&&r.display==='granted'){started=true;plan()}}catch(e){console.error('notification permission',e)}});
 }
 async function askFromBell(){
  if(asking||getFlag())return;
  try{var perm=await LN.checkPermissions();
   if(perm.display==='prompt'||perm.display==='prompt-with-rationale')showAsk();
   else setFlag('decided')}catch(e){}
 }
 var prevTap=window.hdrTap;
 if(typeof prevTap==='function')window.hdrTap=function(n){if(n==='Notifications'){try{askFromBell()}catch(e){}}return prevTap.apply(this,arguments)};
})();
