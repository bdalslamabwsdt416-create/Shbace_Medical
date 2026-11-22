/* Privacy-limited installation and once-daily activity telemetry. */
(function(window,document){
'use strict';
if(window.__SHBACE_USAGE_ANALYTICS_STARTED__)return;
window.__SHBACE_USAGE_ANALYTICS_STARTED__=true;
var native=window.ShbaceNative||null;
var platform=native?'android':'pwa';
var ID_KEY='shbace_usage_analytics_install_id_v1';
var QUEUE_KEY='shbace_usage_analytics_queue_v1_'+platform;
var NOTICE_KEY='shbace_usage_analytics_notice_dismissed_v1';
var LIMIT=30,installId='',endpoint='',flushing=false;

function uuid(){
 try{
  var b=new Uint8Array(16);window.crypto.getRandomValues(b);
  b[6]=(b[6]&15)|64;b[8]=(b[8]&63)|128;
  var h=Array.prototype.map.call(b,function(x){return x.toString(16).padStart(2,'0')}).join('');
  return h.slice(0,8)+'-'+h.slice(8,12)+'-'+h.slice(12,16)+'-'+h.slice(16,20)+'-'+h.slice(20);
 }catch(_){return ''}
}
function valid(value){return typeof value==='string'&&/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)}
function store(){try{return window.localStorage||null}catch(_){return null}}
function loadInstallId(){
 if(platform==='android'){
  try{
   if(!native||typeof native.getAnalyticsInstallId!=='function')return '';
   var id=native.getAnalyticsInstallId();return valid(id)?id.toLowerCase():'';
  }catch(_){return ''}
 }
 var s=store();if(!s)return '';
 try{
  var saved=s.getItem(ID_KEY);if(valid(saved))return saved.toLowerCase();
  var fresh=uuid();if(!valid(fresh))return '';
  s.setItem(ID_KEY,fresh);return fresh;
 }catch(_){return ''}
}
function state(){
 var s=store();if(!s)return {day:'',queue:[]};
 try{
  var v=JSON.parse(s.getItem(QUEUE_KEY)||'null');
  if(!v||v.version!==1||!Array.isArray(v.queue))return {day:'',queue:[]};
  return {day:typeof v.day==='string'?v.day:'',queue:v.queue.filter(function(x){return x&&valid(x.eventId)&&valid(x.installId)&&typeof x.occurredAt==='string'}).slice(-LIMIT)};
 }catch(_){return {day:'',queue:[]}}
}
function save(v){
 var s=store();if(!s)return false;
 try{s.setItem(QUEUE_KEY,JSON.stringify({version:1,day:v.day,queue:v.queue.slice(-LIMIT)}));return true}catch(_){return false}
}
function queueDaily(){
 if(!installId)return;
 var v=state(),day=new Date().toISOString().slice(0,10);
 if(v.day===day)return;
 var id=uuid();if(!valid(id))return;
 v.queue.push({eventId:id,installId:installId,occurredAt:new Date().toISOString()});
 if(v.queue.length>LIMIT)v.queue=v.queue.slice(-LIMIT);
 v.day=day;save(v);
}
function endpointUrl(){
 if(platform==='pwa'){
  try{
   var base=new URL(String(window.SHBACE_ANALYTICS_API_BASE_URL||window.location.origin));
   if((base.protocol!=='https:'&&base.hostname!=='localhost')||base.username||base.password||base.pathname!=='/'||base.search||base.hash)return '';
   return base.origin+'/api/analytics/pwa-event';
  }catch(_){return ''}
 }
 try{
  if(!native||typeof native.getAnalyticsApiBaseUrl!=='function')return '';
  var base=new URL(String(native.getAnalyticsApiBaseUrl()||''));
  if(base.protocol!=='https:'||base.username||base.password)return '';
  return base.origin+'/api/analytics/android-event';
 }catch(_){return ''}
}
function remove(id){var v=state();v.queue=v.queue.filter(function(x){return x.eventId!==id});save(v)}
async function flush(){
 if(flushing||!endpoint||!installId)return;
 try{if(window.navigator.onLine===false)return}catch(_){}
 flushing=true;var sent=0;
 try{
  for(var i=0;i<5;i++){
   var v=state(),item=v.queue[0];if(!item)break;
   var controller=window.AbortController?new window.AbortController():null;
   var timer=controller?window.setTimeout(function(){controller.abort()},8000):null;
   try{
    var response=await window.fetch(endpoint,{
     method:'POST',mode:'cors',credentials:'omit',cache:'no-store',
     headers:{'Content-Type':'application/json'},body:JSON.stringify(item),
     signal:controller?controller.signal:undefined
    });
    if(timer!==null)window.clearTimeout(timer);
    if(response.ok){remove(item.eventId);sent++;continue}
    if([400,413,415,422].indexOf(response.status)>=0){remove(item.eventId);continue}
    break;
   }catch(_){if(timer!==null)window.clearTimeout(timer);break}
  }
 }finally{flushing=false}
 if(sent===5&&state().queue.length&&window.setTimeout)window.setTimeout(flush,250);
}
function privacyNotice(){
 var s=store();try{if(s&&s.getItem(NOTICE_KEY)==='1')return}catch(_){}
 if(!document.body)return;
 var box=document.createElement('aside');
 box.setAttribute('role','note');box.setAttribute('aria-label','Basic usage analytics notice');
 box.style.cssText='position:fixed;z-index:2147483000;left:12px;right:12px;bottom:12px;max-width:780px;margin:auto;padding:13px 15px;border:1px solid #426785;border-radius:13px;background:#0b1b2c;color:#eaf4ff;box-shadow:0 10px 32px #0006;font:13px/1.5 system-ui,sans-serif;display:flex;align-items:center;gap:12px';
 var text=document.createElement('span');
 text.textContent='Basic usage analytics: Shbace records a random installation ID and at most one activity timestamp per day. It does not collect names, phone numbers, locations, study content, answers, scores, notes, bookmarks or saved progress. Counts represent installations/devices, not necessarily unique people.';
 text.style.flex='1';
 var button=document.createElement('button');button.type='button';button.textContent='Got it';
 button.style.cssText='border:0;border-radius:8px;padding:8px 12px;background:#2688ce;color:#fff;font-weight:650';
 button.addEventListener('click',function(){
  try{if(s)s.setItem(NOTICE_KEY,'1')}catch(_){}
  if(box.parentNode)box.parentNode.removeChild(box);
 });
 box.appendChild(text);box.appendChild(button);document.body.appendChild(box);
}
installId=loadInstallId();endpoint=endpointUrl();
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',privacyNotice,{once:true});else privacyNotice();
if(installId){
 queueDaily();
 if(window.addEventListener)window.addEventListener('online',function(){queueDaily();flush()});
 if(document.addEventListener)document.addEventListener('visibilitychange',function(){if(document.visibilityState==='visible'){queueDaily();flush()}});
 if(window.navigator.onLine!==false)flush();
}
})(window,document);
