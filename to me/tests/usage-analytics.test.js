'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const crypto=require('node:crypto');
const analytics=require('../lib/usage-analytics');

const install='1f7b3f6a-37af-4b90-b8b8-a985f2bfcb2b';
const event='c97b1b2e-a184-4ad0-9e1e-1f50e5a20c60';
const now=Date.parse('2026-11-22T12:00:00.000Z');

test('platform storage is physically separated',()=>{
 assert.notEqual(analytics.getTables('pwa').installs,analytics.getTables('android').installs);
 assert.notEqual(analytics.getTables('pwa').events,analytics.getTables('android').events);
 assert.equal(analytics.getTables('unknown'),null);
});
test('accepts a valid event and normalizes UUIDs',()=>{
 const value=analytics.validateEvent({eventId:event.toUpperCase(),installId:install.toUpperCase(),occurredAt:new Date(now).toISOString()},now);
 assert.equal(value.eventId,event);assert.equal(value.installId,install);
});
test('rejects invalid fields, identifiers and timestamps',()=>{
 assert.throws(()=>analytics.validateEvent({eventId:event,installId:'not-a-uuid',occurredAt:new Date(now).toISOString()},now),/invalid_install_id/);
 assert.throws(()=>analytics.validateEvent({eventId:event,installId:install,occurredAt:new Date(now).toISOString(),extra:'x'},now),/invalid_fields/);
 assert.throws(()=>analytics.validateEvent({eventId:event,installId:install,occurredAt:'bad'},now),/invalid_timestamp/);
});
test('rejects stale or future-dated offline events',()=>{
 assert.throws(()=>analytics.validateEvent({eventId:event,installId:install,occurredAt:new Date(now-31*24*60*60*1000).toISOString()},now),/event_too_old/);
 assert.throws(()=>analytics.validateEvent({eventId:event,installId:install,occurredAt:new Date(now+6*60*1000).toISOString()},now),/timestamp_in_future/);
});
test('admin password comparison is constant input independent and correct',()=>{
 assert.equal(analytics.passwordMatches('correct horse battery staple','correct horse battery staple'),true);
 assert.equal(analytics.passwordMatches('wrong password','correct horse battery staple'),false);
});
test('admin session is signed, expiring and tamper-resistant',()=>{
 process.env.ANALYTICS_SESSION_SECRET='test-only-session-secret-with-at-least-32-bytes';
 const session=analytics.createSession(now);
 assert.equal(analytics.validSession(session.token,now),true);
 assert.equal(analytics.validSession(session.token,session.expiresAt+1),false);
 assert.equal(analytics.validSession(session.token+'x',now),false);
 delete process.env.ANALYTICS_SESSION_SECRET;
});
test('admin login throttling blocks five consecutive failures for fifteen minutes',()=>{
 analytics.resetLoginFailures();
 for(let i=0;i<4;i++)analytics.loginFailed(now);
 assert.equal(analytics.loginBlocked(now),false);
 analytics.loginFailed(now);
 assert.equal(analytics.loginBlocked(now),true);
 assert.equal(analytics.loginBlocked(now+15*60*1000),false);
 analytics.resetLoginFailures();
});
test('the API does not accept a client-selected platform',()=>{
 assert.equal(analytics.getTables('pwa').events,'pwa_analytics_events');
 assert.equal(analytics.getTables('android').events,'android_analytics_events');
});


const fs=require('node:fs');
const vm=require('node:vm');
const analyticsSource=fs.readFileSync(require('node:path').join(__dirname,'../lib/usage-analytics.js'),'utf8');
const schemaSource=fs.readFileSync(require('node:path').join(__dirname,'../scripts/usage-analytics-schema.sql'),'utf8');

test('analytics SQL defers event foreign keys and inserts events before installation upsert',()=>{
 assert.equal((schemaSource.match(/DEFERRABLE INITIALLY DEFERRED/g)||[]).length,2);
 assert.ok(analyticsSource.includes('WITH inserted_event AS ('));
 assert.ok(analyticsSource.indexOf('ON CONFLICT DO NOTHING RETURNING event_id, install_id, occurred_at') < analyticsSource.indexOf('), upsert_install AS ('));
 assert.ok(analyticsSource.includes('SELECT install_id, occurred_at, occurred_at FROM inserted_event'));
 assert.ok(analyticsSource.includes('ON CONFLICT (install_id) DO UPDATE'));
 assert.ok(analyticsSource.includes('SELECT event_id FROM inserted_event'));
 assert.ok(schemaSource.includes('UNIQUE (install_id, event_date)'));
});
const clientSource=fs.readFileSync(require('node:path').join(__dirname,'../js/54-usage-analytics.js'),'utf8');

function makeClient({storage,online,native}) {
 const listeners={},docListeners={},calls=[];
 const localStorage={
  getItem(key){return storage.has(key)?storage.get(key):null;},
  setItem(key,value){storage.set(key,String(value));},
  removeItem(key){storage.delete(key);}
 };
 function element(){
  return {style:{},children:[],parentNode:null,textContent:'',setAttribute(){},addEventListener(){},appendChild(child){this.children.push(child);child.parentNode=this;}};
 }
 const document={
  readyState:'complete',visibilityState:'hidden',body:{appendChild(){}},
  createElement:element,
  addEventListener(name,fn){docListeners[name]=fn;}
 };
 const window={
  localStorage,crypto:crypto.webcrypto,location:{origin:'https://shbace-test.example'},
  navigator:{onLine:online},addEventListener(name,fn){listeners[name]=fn;},
  AbortController, setTimeout,clearTimeout,
  fetch:async function(url,options){calls.push({url,options});return {ok:true,status:200};}
 };
 if(native)window.ShbaceNative=native;
 vm.runInNewContext(clientSource,{window,document,URL,Promise,Date,Uint8Array,JSON,Array,Math,Number,String,RegExp,Object,Error,AbortController,setTimeout,clearTimeout});
 return {window,document,listeners,docListeners,calls,storage};
}

test('PWA installation UUID remains stable and daily queue stays bounded to one event',()=>{
 const storage=new Map();
 const first=makeClient({storage,online:false});
 const idKey='shbace_usage_analytics_install_id_v1';
 const queueKey='shbace_usage_analytics_queue_v1_pwa';
 const firstId=storage.get(idKey);
 assert.match(firstId,/^[0-9a-f-]{36}$/i);
 const firstQueue=JSON.parse(storage.get(queueKey));
 assert.equal(firstQueue.queue.length,1);
 const second=makeClient({storage,online:false});
 assert.equal(storage.get(idKey),firstId);
 assert.equal(JSON.parse(storage.get(queueKey)).queue.length,1);
 assert.equal(second.calls.length,0);
});

test('PWA offline activity is synchronized after connectivity returns',async()=>{
 const storage=new Map();
 const offline=makeClient({storage,online:false});
 assert.equal(JSON.parse(storage.get('shbace_usage_analytics_queue_v1_pwa')).queue.length,1);
 const online=makeClient({storage,online:true});
 await new Promise(resolve=>setImmediate(resolve));
 assert.equal(online.calls.length,1);
 assert.equal(online.calls[0].url,'https://shbace-test.example/api/analytics/pwa-event');
 assert.equal(JSON.parse(storage.get('shbace_usage_analytics_queue_v1_pwa')).queue.length,0);
});

test('Android client uses the native SharedPreferences UUID and its separate endpoint',()=>{
 const storage=new Map();
 const nativeId='3b6fb4f4-97e1-4a28-9615-7a090e8a2399';
 const native={getAnalyticsInstallId(){return nativeId;},getAnalyticsApiBaseUrl(){return 'https://api.shbace.example';}};
 const app=makeClient({storage,online:false,native});
 const queued=JSON.parse(storage.get('shbace_usage_analytics_queue_v1_android')).queue;
 assert.equal(queued.length,1);
 assert.equal(queued[0].installId,nativeId);
 assert.equal(storage.has('shbace_usage_analytics_install_id_v1'),false);
 assert.equal(app.calls.length,0);
});


function responseStub(){
 const headers={};return {headers,statusCode:200,body:'',setHeader(k,v){headers[k]=v;},end(body){this.body=body||'';}};
}
test('PWA event endpoint rejects hostile origins and invalid payloads',async()=>{
 const handler=require('../api/analytics/pwa-event');
 const hostile=responseStub();
 await handler({method:'POST',headers:{origin:'https://evil.example',host:'shbace-preview.example','content-type':'application/json'},body:{eventId:event,installId:install,occurredAt:new Date().toISOString()}},hostile);
 assert.equal(hostile.statusCode,403);
 const invalid=responseStub();
 await handler({method:'POST',headers:{origin:'https://shbace-preview.example',host:'shbace-preview.example','content-type':'application/json'},body:{eventId:'bad',installId:install,occurredAt:new Date().toISOString()}},invalid);
 assert.equal(invalid.statusCode,422);
});
test('PWA endpoint fails closed until the approved database exists',async()=>{
 const old=process.env.DATABASE_URL;delete process.env.DATABASE_URL;
 const handler=require('../api/analytics/pwa-event'),res=responseStub();
 await handler({method:'POST',headers:{origin:'https://shbace-preview.example',host:'shbace-preview.example','content-type':'application/json'},body:{eventId:event,installId:install,occurredAt:new Date().toISOString()}},res);
 assert.equal(res.statusCode,503);
 assert.equal(JSON.parse(res.body).error,'analytics_database_not_configured');
 if(old!==undefined)process.env.DATABASE_URL=old;
});
test('Admin summary denies access without an authenticated session',async()=>{
 const handler=require('../api/analytics/admin-summary'),res=responseStub();
 await handler({method:'GET',url:'/api/analytics/admin-summary?platform=all',headers:{host:'shbace-preview.example'}},res);
 assert.equal(res.statusCode,401);
 assert.equal(JSON.parse(res.body).error,'admin_auth_required');
});
test('Android event endpoint is independent and rejects malformed IDs',async()=>{
 const handler=require('../api/analytics/android-event'),res=responseStub();
 await handler({method:'POST',headers:{origin:'https://localhost',host:'shbace-preview.example','content-type':'application/json'},body:{eventId:'bad',installId:install,occurredAt:new Date().toISOString()}},res);
 assert.equal(res.statusCode,422);
});
