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
test('distributed Admin rate limiter fails closed without approved Upstash configuration',async()=>{
 const old={url:process.env.UPSTASH_REDIS_REST_URL,token:process.env.UPSTASH_REDIS_REST_TOKEN,secret:process.env.ANALYTICS_RATE_LIMIT_SECRET};
 delete process.env.UPSTASH_REDIS_REST_URL;delete process.env.UPSTASH_REDIS_REST_TOKEN;delete process.env.ANALYTICS_RATE_LIMIT_SECRET;
 const result=await analytics.consumeAdminLoginAttempt({headers:{'x-real-ip':'203.0.113.10'}});
 assert.equal(result.available,false);assert.equal(result.allowed,false);
 if(old.url!==undefined)process.env.UPSTASH_REDIS_REST_URL=old.url;
 if(old.token!==undefined)process.env.UPSTASH_REDIS_REST_TOKEN=old.token;
 if(old.secret!==undefined)process.env.ANALYTICS_RATE_LIMIT_SECRET=old.secret;
});
test('distributed Admin rate limit is shared across fresh module instances and never sends raw IP',async()=>{
 const old={url:process.env.UPSTASH_REDIS_REST_URL,token:process.env.UPSTASH_REDIS_REST_TOKEN,secret:process.env.ANALYTICS_RATE_LIMIT_SECRET};
 const oldFetch=global.fetch, counters=new Map(), seen=[];
 process.env.UPSTASH_REDIS_REST_URL='https://example.upstash.io';
 process.env.UPSTASH_REDIS_REST_TOKEN='test-token';
 process.env.ANALYTICS_RATE_LIMIT_SECRET='test-rate-limit-secret-with-at-least-32-bytes';
 global.fetch=async(url,options)=>{
  const cmd=JSON.parse(options.body);seen.push(cmd);
  if(cmd[0]==='EVAL'){
   const key=cmd[3],count=(counters.get(key)||0)+1;counters.set(key,count);
   return {ok:true,json:async()=>({result:[count,900]})};
  }
  if(cmd[0]==='DEL'){counters.delete(cmd[1]);return {ok:true,json:async()=>({result:1})};}
  return {ok:false,json:async()=>({})};
 };
 try{
  const req={headers:{'x-real-ip':'203.0.113.44'}};
  for(let i=0;i<5;i++){
   delete require.cache[require.resolve('../lib/usage-analytics')];
   const isolated=require('../lib/usage-analytics');
   const result=await isolated.consumeAdminLoginAttempt(req);
   assert.equal(result.available,true);assert.equal(result.allowed,true);
  }
  delete require.cache[require.resolve('../lib/usage-analytics')];
  const isolated=require('../lib/usage-analytics');
  const blocked=await isolated.consumeAdminLoginAttempt(req);
  assert.equal(blocked.available,true);assert.equal(blocked.allowed,false);
  assert.ok(seen.every(cmd=>!JSON.stringify(cmd).includes('203.0.113.44')));
  assert.match(seen[0][3],/^shbace:analytics:admin-login:v1:[a-f0-9]{64}$/);
  assert.equal(await isolated.clearAdminLoginAttempts(req),true);
  assert.equal(counters.size,0);
 } finally {
  global.fetch=oldFetch;
  for(const [key,value] of Object.entries({UPSTASH_REDIS_REST_URL:old.url,UPSTASH_REDIS_REST_TOKEN:old.token,ANALYTICS_RATE_LIMIT_SECRET:old.secret})){
   if(value===undefined)delete process.env[key];else process.env[key]=value;
  }
 }
});
test('the API does not accept a client-selected platform',()=>{
 assert.equal(analytics.getTables('pwa').events,'pwa_analytics_events');
 assert.equal(analytics.getTables('android').events,'android_analytics_events');
});


const fs=require('node:fs');
const vm=require('node:vm');
const analyticsSource=fs.readFileSync(require('node:path').join(__dirname,'../lib/usage-analytics.js'),'utf8');
const schemaSource=fs.readFileSync(require('node:path').join(__dirname,'../scripts/usage-analytics-schema.sql'),'utf8');

test('concurrent first-install conflicts return the winning install row to the same statement snapshot',()=>{
 assert.ok(analyticsSource.includes('ON CONFLICT (install_id) DO UPDATE SET install_id = EXCLUDED.install_id RETURNING install_id'));
 assert.ok(analyticsSource.includes('target_install AS ('));
 assert.ok(analyticsSource.includes('SELECT install_id FROM created_install'));
 assert.ok(!analyticsSource.includes('NOT EXISTS (SELECT 1 FROM created_install)'));
});
test('analytics SQL inserts or locates the install before idempotent event insertion',()=>{
 assert.ok(analyticsSource.includes('WITH created_install AS ('));
 assert.ok(analyticsSource.includes('target_install AS ('));
 assert.ok(analyticsSource.includes('ON CONFLICT DO NOTHING RETURNING install_id, occurred_at, event_id'));
 assert.ok(analyticsSource.includes('UPDATE '));
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
test('scheduled retention cleanup is authenticated, method-limited and fails closed without a database',async()=>{
 const handler=require('../api/analytics/cleanup');
 const priorSecret=process.env.CRON_SECRET, priorDatabase=process.env.DATABASE_URL;
 process.env.CRON_SECRET='test-only-cron-secret-with-at-least-32-bytes';
 delete process.env.DATABASE_URL;
 const unauthorized=responseStub();
 await handler({method:'GET',headers:{}},unauthorized);
 assert.equal(unauthorized.statusCode,401);
 const wrongMethod=responseStub();
 await handler({method:'POST',headers:{authorization:'Bearer '+process.env.CRON_SECRET}},wrongMethod);
 assert.equal(wrongMethod.statusCode,405);
 const unavailable=responseStub();
 await handler({method:'GET',headers:{authorization:'Bearer '+process.env.CRON_SECRET}},unavailable);
 assert.equal(unavailable.statusCode,503);
 if(priorSecret===undefined)delete process.env.CRON_SECRET;else process.env.CRON_SECRET=priorSecret;
 if(priorDatabase===undefined)delete process.env.DATABASE_URL;else process.env.DATABASE_URL=priorDatabase;
});
test('retention cleanup covers both isolated event tables and the 12-month cutoff',()=>{
 assert.ok(analyticsSource.includes('cleanupExpiredEvents'));
 assert.ok(analyticsSource.includes('pwa_analytics_events WHERE occurred_at < NOW() - INTERVAL \'12 months\''));
 assert.ok(analyticsSource.includes('android_analytics_events WHERE occurred_at < NOW() - INTERVAL \'12 months\''));
});
test('Android event endpoint is independent and rejects malformed IDs',async()=>{
 const handler=require('../api/analytics/android-event'),res=responseStub();
 await handler({method:'POST',headers:{origin:'https://localhost',host:'shbace-preview.example','content-type':'application/json'},body:{eventId:'bad',installId:install,occurredAt:new Date().toISOString()}},res);
 assert.equal(res.statusCode,422);
});

test('Admin login enforces Origin validation before touching the distributed limiter',async()=>{
 const handler=require('../api/analytics/admin-login'),res=responseStub();
 const oldFetch=global.fetch;let called=false;global.fetch=async()=>{called=true;return {ok:true,json:async()=>({result:[1,900]})};};
 const prior={password:process.env.ANALYTICS_ADMIN_PASSWORD,session:process.env.ANALYTICS_SESSION_SECRET};
 process.env.ANALYTICS_ADMIN_PASSWORD='test-admin-password-long';
 process.env.ANALYTICS_SESSION_SECRET='test-session-secret-with-at-least-32-bytes';
 try{
  await handler({method:'POST',headers:{origin:'https://evil.example',host:'shbace-preview.example','content-type':'application/json'},body:{password:'wrong'}},res);
  assert.equal(res.statusCode,403);assert.equal(called,false);
 }finally{
  global.fetch=oldFetch;
  if(prior.password===undefined)delete process.env.ANALYTICS_ADMIN_PASSWORD;else process.env.ANALYTICS_ADMIN_PASSWORD=prior.password;
  if(prior.session===undefined)delete process.env.ANALYTICS_SESSION_SECRET;else process.env.ANALYTICS_SESSION_SECRET=prior.session;
 }
});
test('Admin login fails closed when the shared rate limiter is unavailable',async()=>{
 const handler=require('../api/analytics/admin-login'),res=responseStub(),oldFetch=global.fetch;
 const prior={password:process.env.ANALYTICS_ADMIN_PASSWORD,session:process.env.ANALYTICS_SESSION_SECRET,url:process.env.UPSTASH_REDIS_REST_URL,token:process.env.UPSTASH_REDIS_REST_TOKEN,secret:process.env.ANALYTICS_RATE_LIMIT_SECRET};
 process.env.ANALYTICS_ADMIN_PASSWORD='test-admin-password-long';
 process.env.ANALYTICS_SESSION_SECRET='test-session-secret-with-at-least-32-bytes';
 process.env.UPSTASH_REDIS_REST_URL='https://example.upstash.io';process.env.UPSTASH_REDIS_REST_TOKEN='test-token';
 process.env.ANALYTICS_RATE_LIMIT_SECRET='test-rate-limit-secret-with-at-least-32-bytes';
 global.fetch=async()=>{throw new Error('Redis unavailable');};
 try{
  await handler({method:'POST',headers:{origin:'https://shbace-preview.example',host:'shbace-preview.example','content-type':'application/json','x-real-ip':'203.0.113.55'},body:{password:'test-admin-password-long'}},res);
  assert.equal(res.statusCode,503);assert.equal(JSON.parse(res.body).error,'admin_rate_limiter_unavailable');
  assert.equal(res.headers['Set-Cookie'],undefined);
 }finally{
  global.fetch=oldFetch;
  const values={ANALYTICS_ADMIN_PASSWORD:prior.password,ANALYTICS_SESSION_SECRET:prior.session,UPSTASH_REDIS_REST_URL:prior.url,UPSTASH_REDIS_REST_TOKEN:prior.token,ANALYTICS_RATE_LIMIT_SECRET:prior.secret};
  for(const [key,value] of Object.entries(values)){if(value===undefined)delete process.env[key];else process.env[key]=value;}
 }
});
test('Admin login blocks the sixth failed attempt across requests and issues a hardened session cookie after valid login',async()=>{
 const handler=require('../api/analytics/admin-login'),oldFetch=global.fetch,counters=new Map();
 const prior={password:process.env.ANALYTICS_ADMIN_PASSWORD,session:process.env.ANALYTICS_SESSION_SECRET,url:process.env.UPSTASH_REDIS_REST_URL,token:process.env.UPSTASH_REDIS_REST_TOKEN,secret:process.env.ANALYTICS_RATE_LIMIT_SECRET};
 process.env.ANALYTICS_ADMIN_PASSWORD='test-admin-password-long';
 process.env.ANALYTICS_SESSION_SECRET='test-session-secret-with-at-least-32-bytes';
 process.env.UPSTASH_REDIS_REST_URL='https://example.upstash.io';process.env.UPSTASH_REDIS_REST_TOKEN='test-token';
 process.env.ANALYTICS_RATE_LIMIT_SECRET='test-rate-limit-secret-with-at-least-32-bytes';
 global.fetch=async(url,options)=>{
  const cmd=JSON.parse(options.body);
  if(cmd[0]==='EVAL'){const key=cmd[3],count=(counters.get(key)||0)+1;counters.set(key,count);return {ok:true,json:async()=>({result:[count,900]})};}
  if(cmd[0]==='DEL'){counters.delete(cmd[1]);return {ok:true,json:async()=>({result:1})};}
  return {ok:false,json:async()=>({})};
 };
 const req=(ip,password)=>({method:'POST',headers:{origin:'https://shbace-preview.example',host:'shbace-preview.example','content-type':'application/json','x-real-ip':ip},body:{password}});
 try{
  for(let i=0;i<5;i++){const res=responseStub();await handler(req('203.0.113.77','incorrect-password'),res);assert.equal(res.statusCode,401);}
  const blocked=responseStub();await handler(req('203.0.113.77','incorrect-password'),blocked);
  assert.equal(blocked.statusCode,429);assert.ok(Number(blocked.headers['Retry-After'])>0);
  assert.equal(blocked.headers['Set-Cookie'],undefined);
  const success=responseStub();await handler(req('203.0.113.78','test-admin-password-long'),success);
  assert.equal(success.statusCode,200);
  assert.match(success.headers['Set-Cookie'],/HttpOnly/);
  assert.match(success.headers['Set-Cookie'],/Secure/);
  assert.match(success.headers['Set-Cookie'],/SameSite=Strict/);
  assert.ok(success.headers['Set-Cookie'].includes('Path=/api/analytics'));
 }finally{
  global.fetch=oldFetch;
  const values={ANALYTICS_ADMIN_PASSWORD:prior.password,ANALYTICS_SESSION_SECRET:prior.session,UPSTASH_REDIS_REST_URL:prior.url,UPSTASH_REDIS_REST_TOKEN:prior.token,ANALYTICS_RATE_LIMIT_SECRET:prior.secret};
  for(const [key,value] of Object.entries(values)){if(value===undefined)delete process.env[key];else process.env[key]=value;}
 }
});
test('Android UUID remains backed by private SharedPreferences and Android release version is unchanged',()=>{
 const native=fs.readFileSync(require('node:path').join(__dirname,'../../android/app/src/main/java/com/shbace/medical/ShbaceNative.java'),'utf8');
 const gradle=fs.readFileSync(require('node:path').join(__dirname,'../../android/app/build.gradle'),'utf8');
 assert.ok(native.includes('ANALYTICS_PREFS = "shbace_usage_analytics_v1"'));
 assert.ok(native.includes('ANALYTICS_ID_KEY = "install_id"'));
 assert.ok(native.includes('getSharedPreferences(ANALYTICS_PREFS, Context.MODE_PRIVATE)'));
 assert.ok(native.includes('UUID.randomUUID().toString()'));
 assert.ok(native.includes('prefs.edit().putString(ANALYTICS_ID_KEY, created).commit()'));
 assert.ok(gradle.includes('versionCode 18'));
 assert.ok(gradle.includes('versionName "1.3.9"'));
});

test('Admin logout rejects cross-origin requests and clears the hardened session cookie on same-origin POST',async()=>{
 const handler=require('../api/analytics/admin-logout');
 const hostile=responseStub();
 await handler({method:'POST',headers:{origin:'https://evil.example',host:'shbace-preview.example'}},hostile);
 assert.equal(hostile.statusCode,403);assert.equal(hostile.headers['Set-Cookie'],undefined);
 const accepted=responseStub();
 await handler({method:'POST',headers:{origin:'https://shbace-preview.example',host:'shbace-preview.example'}},accepted);
 assert.equal(accepted.statusCode,200);
 assert.ok(accepted.headers['Set-Cookie'].includes('Max-Age=0'));
 assert.ok(accepted.headers['Set-Cookie'].includes('HttpOnly'));
 assert.ok(accepted.headers['Set-Cookie'].includes('Secure'));
 assert.ok(accepted.headers['Set-Cookie'].includes('SameSite=Strict'));
});
