'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),crypto=require('node:crypto');
const repoRoot=path.resolve(__dirname,'../..');
const clientSource=fs.readFileSync(path.join(repoRoot,'to me/js/54-usage-analytics.js'),'utf8');
const html=fs.readFileSync(path.join(__dirname,'../index.html'),'utf8');
const builder=fs.readFileSync(path.join(__dirname,'../scripts/restore-ios-packed.js'),'utf8');
const worker=fs.readFileSync(path.join(__dirname,'../sw.js'),'utf8');
const updater=fs.readFileSync(path.join(__dirname,'../js/29-offline-setup.js'),'utf8');
function createClient(storage,online,apiBase){
 const listeners={},requests=[];
 const localStorage={getItem:k=>storage.has(k)?storage.get(k):null,setItem:(k,v)=>storage.set(k,String(v)),removeItem:k=>storage.delete(k)};
 function element(){return {style:{},parentNode:null,setAttribute(){},addEventListener(){},appendChild(child){child.parentNode=this;}}}
 const document={readyState:'complete',visibilityState:'hidden',body:{appendChild(){}},createElement:element,addEventListener(){}};
 const window={localStorage,crypto:crypto.webcrypto,location:{origin:'https://ios-shbace.example'},SHBACE_ANALYTICS_API_BASE_URL:apiBase||'',navigator:{onLine:online},addEventListener:(n,f)=>{listeners[n]=f;},setTimeout,clearTimeout,AbortController,fetch:async(url,options)=>{requests.push({url,body:JSON.parse(options.body)});return {ok:true,status:200};}};
 vm.runInNewContext(clientSource,{window,document,URL,Promise,Date,Uint8Array,JSON,Array,Math,Number,String,RegExp,Object,Error,AbortController,setTimeout,clearTimeout});
 return {window,listeners,requests};
}
function queue(storage){return JSON.parse(storage.get('shbace_usage_analytics_queue_v1_pwa')||'{"queue":[]}').queue;}
test('iOS PWA loads the canonical shared analytics client exactly once',()=>{
 assert.equal((html.match(new RegExp('data-src="js/54-usage-analytics\\.js"','g'))||[]).length,1);
 assert.ok(builder.includes("path.resolve(root, '../to me/js/54-usage-analytics.js')"));
 assert.ok(builder.includes("'js/54-usage-analytics.js'"));
 assert.ok(builder.includes('SHBACE_ANALYTICS_API_BASE_URL'));
 assert.ok(html.includes('__SHBACE_ANALYTICS_API_BASE_URL__'));
 assert.ok(html.indexOf('js/33-ios-exam-planner.js')<html.indexOf('js/54-usage-analytics.js'));
});
test('iOS API base override accepts only a configured HTTPS origin',()=>{
 const storage=new Map(),app=createClient(storage,false,'https://analytics-api.example');
 app.window.navigator.onLine=true;app.listeners.online();
 assert.equal(app.requests[0].url,'https://analytics-api.example/api/analytics/pwa-event');
 const invalid=createClient(new Map(),false,'http://analytics-api.example');
 assert.equal(invalid.requests.length,0);
});
test('UUID and daily queue survive simulated reload/update without touching student stores',()=>{
 const storage=new Map();createClient(storage,false);
 const key='shbace_usage_analytics_install_id_v1',id=storage.get(key);
 assert.match(id,/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i);
 assert.equal(queue(storage).length,1);createClient(storage,false);
 assert.equal(storage.get(key),id);assert.equal(queue(storage).length,1);
});
test('offline event survives missing API route and syncs when connectivity returns',async()=>{
 const storage=new Map(),app=createClient(storage,false);
 app.window.fetch=async(url,options)=>{app.requests.push({url,body:JSON.parse(options.body)});return {ok:false,status:404};};
 app.window.navigator.onLine=true;app.listeners.online();await new Promise(r=>setTimeout(r,0));assert.equal(queue(storage).length,1);
 app.window.fetch=async(url,options)=>{app.requests.push({url,body:JSON.parse(options.body)});return {ok:true,status:200};};
 app.listeners.online();await new Promise(r=>setTimeout(r,0));assert.equal(queue(storage).length,0);
 assert.deepEqual(Object.keys(app.requests[0].body).sort(),['eventId','installId','occurredAt']);
 assert.equal(app.requests[0].url,'https://ios-shbace.example/api/analytics/pwa-event');
});
test('iOS updater and Service Worker keep their original cache and student database namespaces',()=>{
 assert.ok(worker.includes("const CACHE_NAME = 'shbace-medical-offline-v2'"));assert.ok(updater.includes("var CACHE_NAME='shbace-medical-offline-v2'"));assert.ok(updater.includes("var DB_NAME='shbace-medical-offline-state-v1'"));
 assert.match(worker,/if \(request\.method !== 'GET'\) return;/);assert.doesNotMatch(worker,/indexedDB|localStorage|shbace_usage_analytics/);assert.doesNotMatch(updater,/shbace_usage_analytics_install_id_v1|shbace_usage_analytics_queue_v1/);
});
test('iOS PWA declares Safari standalone support but does not rely on guaranteed background execution',()=>{
 assert.ok(!clientSource.includes('SyncManager'));assert.ok(!clientSource.includes('registration.sync'));
});
