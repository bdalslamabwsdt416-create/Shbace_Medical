'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const crypto=require('node:crypto');
const {Readable}=require('node:stream');
const analytics=require('../lib/usage-analytics');

const install='1f7b3f6a-37af-4b90-b8b8-a985f2bfcb2b';
const event='c97b1b2e-a184-4ad0-9e1e-1f50e5a20c60';
const now=Date.parse('2026-11-22T12:00:00.000Z');

test('PWA source attribution stores only a validated hostname, not URL paths or IP addresses',()=>{
 assert.equal(analytics.sourceHost({headers:{origin:'https://shbace-medical-ios.vercel.app',host:'shbace-medical-ios.vercel.app'}}),'shbace-medical-ios.vercel.app');
 assert.equal(analytics.sourceHost({headers:{host:'shbace-medical-chrome.vercel.app'}}),'shbace-medical-chrome.vercel.app');
 assert.equal(analytics.sourceHost({headers:{host:'203.0.113.10'}}),null);
 assert.equal(analytics.sourceHost({headers:{origin:'not a URL'}}),null);
});
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
test('distributed Admin rate limiter fails closed when both Redis and PostgreSQL are unavailable',async()=>{
 const old={url:process.env.UPSTASH_REDIS_REST_URL,token:process.env.UPSTASH_REDIS_REST_TOKEN,secret:process.env.ANALYTICS_RATE_LIMIT_SECRET,database:process.env.DATABASE_URL};
 delete process.env.UPSTASH_REDIS_REST_URL;delete process.env.UPSTASH_REDIS_REST_TOKEN;delete process.env.ANALYTICS_RATE_LIMIT_SECRET;delete process.env.DATABASE_URL;
 const result=await analytics.consumeAdminLoginAttempt({headers:{'x-real-ip':'203.0.113.10'}});
 assert.equal(result.available,false);assert.equal(result.allowed,false);
 if(old.url!==undefined)process.env.UPSTASH_REDIS_REST_URL=old.url;
 if(old.token!==undefined)process.env.UPSTASH_REDIS_REST_TOKEN=old.token;
 if(old.secret!==undefined)process.env.ANALYTICS_RATE_LIMIT_SECRET=old.secret;
 if(old.database!==undefined)process.env.DATABASE_URL=old.database;
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
  assert.match(seen[0][3],/^shbace:analytics:admin-login:v2:[a-f0-9]{64}$/);
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
const indexSource=fs.readFileSync(require('node:path').join(__dirname,'../index.html'),'utf8');
const buildSource=fs.readFileSync(require('node:path').join(__dirname,'../scripts/build-pwa.mjs'),'utf8');

test('To Me PWA build injects only a validated external HTTPS analytics API origin before the client loads',()=>{
 const slot='window.SHBACE_ANALYTICS_API_BASE_URL="__SHBACE_ANALYTICS_API_BASE_URL__";';
 assert.ok(indexSource.includes(slot));
 assert.ok(indexSource.indexOf(slot)<indexSource.indexOf('id="usage-analytics-v1"'));
 assert.ok(buildSource.includes('process.env.SHBACE_ANALYTICS_API_BASE_URL'));
 assert.ok(buildSource.includes('parsedAnalyticsOrigin.protocol !== "https:"'));
 assert.ok(buildSource.includes('parsedAnalyticsOrigin.pathname !== "/"'));
 assert.ok(buildSource.includes('html.replace(analyticsApiSlot'));
});


test('source_host is added only to PWA inserts; Android analytics keeps its original schema',()=>{
 assert.ok(analyticsSource.includes("const sourceColumn = platform === 'pwa' ? ', source_host' : '';"));
 assert.ok(analyticsSource.includes("const sourceValue = platform === 'pwa' ? ', $4::text' : '';"));
 assert.ok(analyticsSource.includes("const params = platform === 'pwa'"));
 assert.ok(analyticsSource.includes("' INSERT INTO ' + t.installs + ' (install_id, first_seen_at, last_active_at' + sourceColumn + ')'"));
});
test('PWA source is captured on first install insert and never overwritten on later activity',()=>{
 assert.ok(analyticsSource.includes('(install_id, first_seen_at, last_active_at, source_host)'));
 assert.ok(analyticsSource.includes('' SELECT install_id, occurred_at, occurred_at' + sourceValue + ' FROM inserted_event''));
 assert.ok(analyticsSource.includes('platform === \'pwa\' ? sourceHost(req) : null'));
 const conflict=analyticsSource.slice(analyticsSource.indexOf('ON CONFLICT (install_id) DO UPDATE'),analyticsSource.indexOf('RETURNING install_id',analyticsSource.indexOf('ON CONFLICT (install_id) DO UPDATE')));
 assert.ok(conflict.includes('last_active_at'));
 assert.ok(!conflict.includes('source_host'));
 assert.ok(schemaSource.includes('ADD COLUMN IF NOT EXISTS source_host TEXT'));
});
test('event-first ingestion relies on deferred foreign keys and upserts the install only for a new event',()=>{
 assert.ok(analyticsSource.includes('WITH inserted_event AS ('));
 assert.ok(analyticsSource.includes('' SELECT install_id, occurred_at, occurred_at' + sourceValue + ' FROM inserted_event''));
 assert.ok(analyticsSource.includes('ON CONFLICT (install_id) DO UPDATE SET last_active_at = GREATEST'));
 assert.ok(analyticsSource.includes('RETURNING install_id'));
 assert.ok(analyticsSource.includes('SELECT event_id FROM inserted_event'));
});
test('analytics SQL inserts the event first and then upserts the install through the deferred foreign key',()=>{
 assert.ok(analyticsSource.includes('WITH inserted_event AS ('));
 assert.ok(analyticsSource.includes('VALUES ($2::uuid, $1::uuid,'));
 assert.ok(analyticsSource.includes('' SELECT install_id, occurred_at, occurred_at' + sourceValue + ' FROM inserted_event''));
 assert.ok(analyticsSource.includes('ON CONFLICT (install_id) DO UPDATE SET last_active_at = GREATEST'));
 assert.ok(analyticsSource.includes('SELECT event_id FROM inserted_event'));
 assert.ok(schemaSource.includes('DEFERRABLE INITIALLY DEFERRED'));
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

test('Vercel raw-body endpoints explicitly disable automatic body parsing',()=>{
 for(const route of ['../server/analytics/pwa-event','../server/analytics/android-event','../server/analytics/admin-login']){
  const handler=require(route);
  assert.deepEqual(handler.config,{api:{bodyParser:false}});
 }
});
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
 const handler=require('../server/analytics/pwa-event');
 const hostile=responseStub();
 await handler({method:'POST',headers:{origin:'https://evil.example',host:'shbace-preview.example','content-type':'application/json'},body:{eventId:event,installId:install,occurredAt:new Date().toISOString()}},hostile);
 assert.equal(hostile.statusCode,403);
 const invalid=responseStub();
 await handler({method:'POST',headers:{origin:'https://shbace-preview.example',host:'shbace-preview.example','content-type':'application/json'},body:{eventId:'bad',installId:install,occurredAt:new Date().toISOString()}},invalid);
 assert.equal(invalid.statusCode,422);
});
test('raw PWA request stream enforces the 1 KiB limit without reading req.body',async()=>{
 const handler=require('../server/analytics/pwa-event');
 const req=Readable.from([Buffer.alloc(1025,0x61)]);
 req.method='POST';
 req.headers={origin:'https://shbace-preview.example',host:'shbace-preview.example','content-type':'application/json'};
 Object.defineProperty(req,'body',{get(){throw new Error('req.body must not be accessed');}});
 const res=responseStub();
 await handler(req,res);
 assert.equal(res.statusCode,413);
 assert.equal(JSON.parse(res.body).error,'payload_too_large');
});
test('event ingestion rejects oversized bodies, batches and unsupported methods before Redis or database access',async()=>{
 const handler=require('../server/analytics/pwa-event');
 const oversized=responseStub();
 await handler({method:'POST',headers:{origin:'https://shbace-preview.example',host:'shbace-preview.example','content-type':'application/json'},body:'x'.repeat(1025)},oversized);
 assert.equal(oversized.statusCode,413);
 const batch=responseStub();
 await handler({method:'POST',headers:{origin:'https://shbace-preview.example',host:'shbace-preview.example','content-type':'application/json'},body:[{eventId:event,installId:install,occurredAt:new Date().toISOString()}]},batch);
 assert.equal(batch.statusCode,422);
 const method=responseStub();
 await handler({method:'GET',headers:{origin:'https://shbace-preview.example',host:'shbace-preview.example'}},method);
 assert.equal(method.statusCode,405);
});

test('PWA endpoint fails closed until the approved database exists after distributed quota admission',async()=>{
 const oldDb=process.env.DATABASE_URL;
 const oldRedis={url:process.env.UPSTASH_REDIS_REST_URL,token:process.env.UPSTASH_REDIS_REST_TOKEN,secret:process.env.ANALYTICS_RATE_LIMIT_SECRET};
 const oldFetch=global.fetch;
 delete process.env.DATABASE_URL;
 process.env.UPSTASH_REDIS_REST_URL='https://unit-test.upstash.io';
 process.env.UPSTASH_REDIS_REST_TOKEN='test-token';
 process.env.ANALYTICS_RATE_LIMIT_SECRET='test-rate-limit-secret-with-at-least-32-bytes';
 global.fetch=async()=>({ok:true,json:async()=>({result:[1,1,1,0,0]})});
 try {
  const handler=require('../server/analytics/pwa-event'),res=responseStub();
  await handler({method:'POST',headers:{origin:'https://shbace-preview.example',host:'shbace-preview.example','content-type':'application/json'},body:{eventId:event,installId:install,occurredAt:new Date().toISOString()}},res);
  assert.equal(res.statusCode,503);
  assert.equal(JSON.parse(res.body).error,'analytics_database_not_configured');
 } finally {
  global.fetch=oldFetch;
  if(oldDb===undefined)delete process.env.DATABASE_URL;else process.env.DATABASE_URL=oldDb;
  for(const [key,value] of Object.entries({UPSTASH_REDIS_REST_URL:oldRedis.url,UPSTASH_REDIS_REST_TOKEN:oldRedis.token,ANALYTICS_RATE_LIMIT_SECRET:oldRedis.secret})){
   if(value===undefined)delete process.env[key];else process.env[key]=value;
  }
 }
});
test('Admin summary denies access without an authenticated session',async()=>{
 const handler=require('../server/analytics/admin-summary'),res=responseStub();
 await handler({method:'GET',url:'/api/analytics/admin-summary?platform=all',headers:{host:'shbace-preview.example'}},res);
 assert.equal(res.statusCode,401);
 assert.equal(JSON.parse(res.body).error,'admin_auth_required');
});
test('scheduled retention cleanup is authenticated, method-limited and fails closed without a database',async()=>{
 const handler=require('../server/analytics/cleanup');
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
 const handler=require('../server/analytics/android-event'),res=responseStub();
 await handler({method:'POST',headers:{origin:'https://localhost',host:'shbace-preview.example','content-type':'application/json'},body:{eventId:'bad',installId:install,occurredAt:new Date().toISOString()}},res);
 assert.equal(res.statusCode,422);
});

test('Admin login enforces Origin validation before touching the distributed limiter',async()=>{
 const handler=require('../server/analytics/admin-login'),res=responseStub();
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
 const handler=require('../server/analytics/admin-login'),res=responseStub(),oldFetch=global.fetch;
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
test('Admin global login lockout blocks every client until its window resets, then issues a hardened session cookie',async()=>{
 const handler=require('../server/analytics/admin-login'),oldFetch=global.fetch,counters=new Map();
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
  const correctButLocked=responseStub();await handler(req('203.0.113.78','test-admin-password-long'),correctButLocked);
  assert.equal(correctButLocked.statusCode,429);
  counters.clear(); // Simulate expiry of the shared 15-minute Redis window.
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
 const handler=require('../server/analytics/admin-logout');
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

test('Admin session-secret rotation immediately invalidates copied stateless tokens',()=>{
 const previous=process.env.ANALYTICS_SESSION_SECRET;
 try{
  process.env.ANALYTICS_SESSION_SECRET='first-session-secret-with-at-least-32-bytes';
  const session=analytics.createSession(now);
  assert.equal(analytics.validSession(session.token,now),true);
  process.env.ANALYTICS_SESSION_SECRET='rotated-session-secret-with-at-least-32-bytes';
  assert.equal(analytics.validSession(session.token,now),false);
 }finally{
  if(previous===undefined)delete process.env.ANALYTICS_SESSION_SECRET;
  else process.env.ANALYTICS_SESSION_SECRET=previous;
 }
});

test('PostgreSQL query failure returns 503 from analytics APIs without changing app-side client state',async()=>{
 const analyticsPath=require.resolve('../lib/usage-analytics');
 const eventPath=require.resolve('../server/analytics/pwa-event');
 const summaryPath=require.resolve('../server/analytics/admin-summary');
 const pgPath=require.resolve('@neondatabase/serverless');
 const paths=[analyticsPath,eventPath,summaryPath,pgPath];
 const cached=new Map(paths.map(path=>[path,require.cache[path]]));
 const previousEnv={
  DATABASE_URL:process.env.DATABASE_URL,
  ANALYTICS_SESSION_SECRET:process.env.ANALYTICS_SESSION_SECRET,
  UPSTASH_REDIS_REST_URL:process.env.UPSTASH_REDIS_REST_URL,
  UPSTASH_REDIS_REST_TOKEN:process.env.UPSTASH_REDIS_REST_TOKEN,
  ANALYTICS_RATE_LIMIT_SECRET:process.env.ANALYTICS_RATE_LIMIT_SECRET
 };
 const oldFetch=global.fetch;
 try{
  process.env.DATABASE_URL='postgresql://analytics-test.invalid/db';
  process.env.ANALYTICS_SESSION_SECRET='database-outage-session-secret-32-bytes';
  process.env.UPSTASH_REDIS_REST_URL='https://unit-test.upstash.io';
  process.env.UPSTASH_REDIS_REST_TOKEN='test-token';
  process.env.ANALYTICS_RATE_LIMIT_SECRET='database-outage-rate-limit-secret-32-bytes';
  require.cache[pgPath]={id:pgPath,filename:pgPath,loaded:true,exports:{
   neon:()=>({query:async()=>{throw new Error('simulated PostgreSQL connection failure');}})
  }};
  for(const path of [analyticsPath,eventPath,summaryPath])delete require.cache[path];
  global.fetch=async(_url,options)=>{
   const command=JSON.parse(options.body);
   if(command[0]==='EVAL')return {ok:true,json:async()=>({result:[1,1,1,0,0]})};
   return {ok:true,json:async()=>({result:1})};
  };
  const isolated=require(analyticsPath);
  const session=isolated.createSession();
  const summaryHandler=require(summaryPath),summaryResponse=responseStub();
  await summaryHandler({method:'GET',url:'/api/analytics/admin-summary?platform=all',headers:{
   host:'shbace-preview.example',
   cookie:'shbace_analytics_admin='+encodeURIComponent(session.token)
  }},summaryResponse);
  assert.equal(summaryResponse.statusCode,503);
  assert.equal(JSON.parse(summaryResponse.body).error,'analytics_summary_unavailable');

  const eventHandler=require(eventPath),eventResponse=responseStub();
  await eventHandler({method:'POST',headers:{'content-type':'application/json'},body:{
   eventId:event,installId:install,occurredAt:new Date().toISOString()
  }},eventResponse);
  assert.equal(eventResponse.statusCode,503);
  assert.equal(JSON.parse(eventResponse.body).error,'analytics_storage_unavailable');

  // Client-side study state is separate from server analytics storage.
  const storage=new Map([['shbace-study-state','preserved']]);
  const client=makeClient({storage,online:false});
  assert.equal(storage.get('shbace-study-state'),'preserved');
  assert.ok(client.window);
 }finally{
  global.fetch=oldFetch;
  for(const [key,value] of Object.entries(previousEnv)){
   if(value===undefined)delete process.env[key];else process.env[key]=value;
  }
  for(const path of paths){
   delete require.cache[path];
   if(cached.get(path))require.cache[path]=cached.get(path);
  }
 }
});


test('PWA ingestion enforces the 1 KiB raw stream limit before accessing Vercel parsed req.body',async()=>{
 const {Readable}=require('node:stream');
 const handler=require('../server/analytics/pwa-event');
 const makeRequest=(raw,extraHeaders={})=>{
  const req=Readable.from([Buffer.from(raw)]);
  req.method='POST';
  req.headers={origin:'https://shbace-preview.example',host:'shbace-preview.example','content-type':'application/json',...extraHeaders};
  let bodyAccessed=false;
  Object.defineProperty(req,'body',{get(){bodyAccessed=true;throw new Error('parsed req.body must not be accessed');}});
  req.wasBodyAccessed=()=>bodyAccessed;
  return req;
 };
 const declaredOversized=makeRequest('{}',{'content-length':'1025'});
 const declaredResponse=responseStub();
 await handler(declaredOversized,declaredResponse);
 assert.equal(declaredResponse.statusCode,413);
 assert.equal(declaredOversized.wasBodyAccessed(),false);

 const streamedOversized=makeRequest('x'.repeat(1025));
 const streamedResponse=responseStub();
 await handler(streamedOversized,streamedResponse);
 assert.equal(streamedResponse.statusCode,413);
 assert.equal(streamedOversized.wasBodyAccessed(),false);

 const malformed=makeRequest('{');
 const malformedResponse=responseStub();
 await handler(malformed,malformedResponse);
 assert.equal(malformedResponse.statusCode,400);
 assert.equal(JSON.parse(malformedResponse.body).error,'invalid_json');
 assert.equal(malformed.wasBodyAccessed(),false);
});

test('Admin login enforces its 512-byte raw body limit before accessing Vercel parsed req.body',async()=>{
 const {Readable}=require('node:stream');
 const handler=require('../server/analytics/admin-login');
 const req=Readable.from([Buffer.from('x'.repeat(513))]);
 req.method='POST';
 req.headers={origin:'https://shbace-preview.example',host:'shbace-preview.example','content-type':'application/json'};
 let bodyAccessed=false;
 Object.defineProperty(req,'body',{get(){bodyAccessed=true;throw new Error('parsed req.body must not be accessed');}});
 const res=responseStub();
 await handler(req,res);
 assert.equal(res.statusCode,413);
 assert.equal(JSON.parse(res.body).error,'payload_too_large');
 assert.equal(bodyAccessed,false);
});


test('PostgreSQL fallback keeps distributed ingestion and Admin quotas on fixed non-identifying scopes',async()=>{
 const names=['UPSTASH_REDIS_REST_URL','UPSTASH_REDIS_REST_TOKEN','ANALYTICS_RATE_LIMIT_SECRET','DATABASE_URL'];
 const before=Object.fromEntries(names.map(k=>[k,process.env[k]]));
 const driverPath=require.resolve('@neondatabase/serverless');
 const analyticsPath=require.resolve('../lib/usage-analytics');
 const previousDriver=require.cache[driverPath];
 const previousAnalytics=require.cache[analyticsPath];
 const originalFetch=global.fetch;
 const calls=[];
 process.env.DATABASE_URL='postgresql://analytics-test.invalid/test';
 delete process.env.UPSTASH_REDIS_REST_URL;
 delete process.env.UPSTASH_REDIS_REST_TOKEN;
 delete process.env.ANALYTICS_RATE_LIMIT_SECRET;
 global.fetch=async()=>{throw new Error('Redis must not be called by the PostgreSQL fallback');};
 require.cache[driverPath]={
  id:driverPath,filename:driverPath,loaded:true,
  exports:{neon:(url)=>{
   assert.equal(url,process.env.DATABASE_URL);
   return {query:async(sql,params)=>{
    calls.push({sql,params});
    if(sql.includes('reset_shbace_analytics_rate_limit')) return [{reset:true}];
    return [{allowed:true,window_count:1,daily_count:1,retry_after_seconds:0,reason:null}];
   }};
  }}
 };
 delete require.cache[analyticsPath];
 try{
  const isolated=require('../lib/usage-analytics');
  const pwa=await isolated.consumeIngestionAttempt('pwa',now);
  const android=await isolated.consumeIngestionAttempt('android',now);
  const admin=await isolated.consumeAdminLoginAttempt({headers:{'x-real-ip':'203.0.113.77','user-agent':'private-test'}},now);
  assert.equal(pwa.available,true);assert.equal(pwa.allowed,true);
  assert.equal(android.available,true);assert.equal(android.allowed,true);
  assert.equal(admin.available,true);assert.equal(admin.allowed,true);
  assert.equal(await isolated.clearAdminLoginAttempts(),true);
  assert.deepEqual(calls.map(x=>x.params[0]),['ingest:pwa','ingest:android','admin-login','admin-login']);
  assert.ok(calls.every(x=>x.sql.includes('consume_shbace_analytics_rate_limit')||x.sql.includes('reset_shbace_analytics_rate_limit')));
  assert.ok(calls.every(x=>!JSON.stringify(x.params).includes('203.0.113.77')));
  assert.ok(calls.every(x=>!JSON.stringify(x.params).includes('private-test')));
  assert.equal(calls[0].params[2],60);
  assert.equal(calls[0].params[3],isolated.INGESTION_PER_MINUTE_LIMIT);
  assert.equal(calls[0].params[4],isolated.INGESTION_PER_DAY_LIMIT);
  assert.equal(calls[2].params[2],900);
  assert.equal(calls[2].params[3],5);
  assert.equal(calls[2].params[4],null);
 } finally {
  global.fetch=originalFetch;
  if(previousDriver)require.cache[driverPath]=previousDriver;else delete require.cache[driverPath];
  if(previousAnalytics)require.cache[analyticsPath]=previousAnalytics;else delete require.cache[analyticsPath];
  for(const [key,value] of Object.entries(before)){if(value===undefined)delete process.env[key];else process.env[key]=value;}
 }
});
