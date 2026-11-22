'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),analytics=require('../lib/usage-analytics');
const login=require('../api/analytics/admin-login'),logout=require('../api/analytics/admin-logout'),summary=require('../api/analytics/admin-summary');
const {Readable}=require('node:stream');
function res(){return {statusCode:0,headers:{},body:'',setHeader(k,v){this.headers[k]=v;},end(v){this.body=v||'';}}}
async function env(values,fn){const before={};for(const k of Object.keys(values)){before[k]=process.env[k];if(values[k]===null)delete process.env[k];else process.env[k]=values[k];}try{return await fn()}finally{for(const k of Object.keys(values)){if(before[k]===undefined)delete process.env[k];else process.env[k]=before[k];}}}
const config={ANALYTICS_ADMIN_PASSWORD:'test-only-admin-password-123',ANALYTICS_SESSION_SECRET:'test-only-session-secret-with-at-least-32-bytes',ANALYTICS_ALLOWED_ORIGIN:'https://to-me.example,https://ios-pwa.example',UPSTASH_REDIS_REST_URL:'https://unit-test.upstash.io',UPSTASH_REDIS_REST_TOKEN:'test-only-token',ANALYTICS_RATE_LIMIT_SECRET:'test-only-rate-limit-secret-at-least-32-bytes'};
test('Admin exact-origin allowlist supports separate PWAs and rejects lookalike origins',async()=>env({ANALYTICS_ALLOWED_ORIGIN:'https://to-me.example,https://ios-pwa.example'},()=>{
 assert.equal(analytics.sameOrigin({headers:{origin:'https://ios-pwa.example',host:'api.example','x-forwarded-proto':'https'}}),true);
 assert.equal(analytics.sameOrigin({headers:{origin:'https://ios-pwa.example.attacker.test',host:'api.example','x-forwarded-proto':'https'}}),false);
 assert.equal(analytics.sameOrigin({headers:{host:'api.example'}}),false);
}));
test('Admin summary denies unauthenticated requests and rejects non-GET methods',async()=>env(config,async()=>{
 const denied=res();await summary({method:'GET',url:'/api/analytics/admin-summary',headers:{host:'to-me.example'}},denied);assert.equal(denied.statusCode,401);
 const wrong=res();await summary({method:'POST',url:'/api/analytics/admin-summary',headers:{host:'to-me.example'}},wrong);assert.equal(wrong.statusCode,405);
}));
test('Admin login rejects cross-origin requests before Redis access',async()=>env(config,async()=>{
 const original=global.fetch;let called=false;global.fetch=async()=>{called=true;throw Error('unexpected Redis call');};
 try{const r=res();await login({method:'POST',headers:{origin:'https://attacker.test',host:'to-me.example','content-type':'application/json'},body:{password:config.ANALYTICS_ADMIN_PASSWORD}},r);assert.equal(r.statusCode,403);assert.equal(called,false);}finally{global.fetch=original;}
}));
test('Admin login fails closed when neither Redis nor PostgreSQL rate limiting is configured',async()=>env({...config,UPSTASH_REDIS_REST_URL:null,UPSTASH_REDIS_REST_TOKEN:null,ANALYTICS_RATE_LIMIT_SECRET:null,DATABASE_URL:null},async()=>{
 const r=res();await login({method:'POST',headers:{origin:'https://ios-pwa.example',host:'api.example','x-forwarded-proto':'https','x-real-ip':'203.0.113.20','content-type':'application/json'},body:{password:config.ANALYTICS_ADMIN_PASSWORD}},r);assert.equal(r.statusCode,503);
}));
test('Admin login issues Secure HttpOnly SameSite=Strict cookie after Redis and password checks',async()=>env(config,async()=>{
 const original=global.fetch,commands=[];global.fetch=async(_url,options)=>{const c=JSON.parse(options.body);commands.push(c);return {ok:true,json:async()=>({result:c[0]==='EVAL'?[1,900]:1})};};
 try{const r=res();await login({method:'POST',headers:{origin:'https://ios-pwa.example',host:'api.example','x-forwarded-proto':'https','x-real-ip':'203.0.113.21','content-type':'application/json'},body:{password:config.ANALYTICS_ADMIN_PASSWORD}},r);assert.equal(r.statusCode,200);assert.match(r.headers['Set-Cookie'],/HttpOnly/);assert.match(r.headers['Set-Cookie'],/Secure/);assert.match(r.headers['Set-Cookie'],/SameSite=Strict/);assert.match(r.headers['Set-Cookie'],/Path=\/api\/analytics/);assert.deepEqual(commands.map(c=>c[0]),['EVAL','DEL']);assert.ok(commands.every(c=>!JSON.stringify(c).includes('203.0.113.21')));}finally{global.fetch=original;}
}));
test('Admin login parses a real raw request stream without relying on req.body',async()=>env(config,async()=>{
 const original=global.fetch,commands=[];
 global.fetch=async(_url,options)=>{const c=JSON.parse(options.body);commands.push(c);return {ok:true,json:async()=>({result:c[0]==='EVAL'?[1,900]:1})};};
 try {
  const payload=JSON.stringify({password:config.ANALYTICS_ADMIN_PASSWORD});
  const req=Readable.from([Buffer.from(payload)]);
  req.method='POST';
  req.headers={origin:'https://ios-pwa.example',host:'api.example','x-forwarded-proto':'https','content-type':'application/json','content-length':String(Buffer.byteLength(payload))};
  const r=res();
  await login(req,r);
  assert.equal(r.statusCode,200);
  assert.equal(JSON.parse(r.body).authenticated,true);
  assert.match(r.headers['Set-Cookie'],/HttpOnly/);
  assert.deepEqual(commands.map(c=>c[0]),['EVAL','DEL']);
 } finally { global.fetch=original; }
}));
test('Admin login rejects an oversized raw request stream before parsing',async()=>env(config,async()=>{
 const req=Readable.from([Buffer.alloc(513,0x61)]);
 req.method='POST';
 req.headers={origin:'https://ios-pwa.example',host:'api.example','x-forwarded-proto':'https','content-type':'application/json'};
 Object.defineProperty(req,'body',{get(){throw new Error('req.body must not be accessed');}});
 const r=res();
 await login(req,r);
 assert.equal(r.statusCode,413);
 assert.match(r.body,/payload_too_large/);
}));
test('Admin logout enforces origin and expires the scoped host-only cookie',async()=>env(config,async()=>{
 const denied=res();logout({method:'POST',headers:{origin:'https://attacker.test',host:'to-me.example'}},denied);assert.equal(denied.statusCode,403);
 const ok=res();logout({method:'POST',headers:{origin:'https://to-me.example',host:'to-me.example'}},ok);assert.equal(ok.statusCode,200);assert.match(ok.headers['Set-Cookie'],/Max-Age=0/);assert.match(ok.headers['Set-Cookie'],/HttpOnly/);assert.match(ok.headers['Set-Cookie'],/Secure/);assert.match(ok.headers['Set-Cookie'],/SameSite=Strict/);assert.match(ok.headers['Set-Cookie'],/Path=\/api\/analytics/);
}));
test('valid signed session passes auth while summary remains unavailable without a database',async()=>env(config,async()=>{
 const session=analytics.createSession(),r=res();await summary({method:'GET',url:'/api/analytics/admin-summary?platform=all&page=1',headers:{host:'to-me.example',cookie:'shbace_analytics_admin='+encodeURIComponent(session.token)}},r);assert.equal(r.statusCode,503);assert.match(r.body,/analytics_database_not_configured/);
}));


test('repo-root Vercel routes resolve to the canonical To Me handlers and preserve raw-body config',()=>{
 const routes=[
  ['pwa-event','../api/analytics/pwa-event'],
  ['android-event','../api/analytics/android-event'],
  ['admin-login','../api/analytics/admin-login'],
  ['admin-logout','../api/analytics/admin-logout'],
  ['admin-summary','../api/analytics/admin-summary'],
  ['cleanup','../api/analytics/cleanup']
 ];
 for(const [name,canonicalPath] of routes){
  const rootRoute=require('../../api/analytics/'+name);
  const canonical=require(canonicalPath);
  assert.equal(rootRoute,canonical,name+' root route must reuse the canonical handler');
 }
 assert.deepEqual(require('../../api/analytics/pwa-event').config,{api:{bodyParser:false}});
 assert.deepEqual(require('../../api/analytics/android-event').config,{api:{bodyParser:false}});
 assert.deepEqual(require('../../api/analytics/admin-login').config,{api:{bodyParser:false}});
});
