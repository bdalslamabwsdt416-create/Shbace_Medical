/* Shbace Medical v1.1 — same-origin static asset cache.
   First visit stores resources; later launches can reuse them without waiting for network.
   HTML navigations stay network-first so app updates are not trapped behind an old page. */
const SHB_CACHE='shbace-static-v1-1';
self.addEventListener('install',event=>{event.waitUntil(self.skipWaiting())});
self.addEventListener('activate',event=>{
 event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k.indexOf('shbace-static-')===0&&k!==SHB_CACHE).map(k=>caches.delete(k)))).then(()=>self.clients.claim()));
});
self.addEventListener('fetch',event=>{
 const req=event.request;
 if(req.method!=='GET')return;
 const url=new URL(req.url);
 if(url.origin!==self.location.origin)return;
 if(req.mode==='navigate'||url.pathname.endsWith('/'))return;
 if(!/\.(?:js|css|json|webp|png|jpe?g|svg|woff2?|ttf|ico)$/i.test(url.pathname))return;
 event.respondWith(caches.open(SHB_CACHE).then(async cache=>{
  const cached=await cache.match(req);
  if(cached)return cached;
  try{
   const response=await fetch(req);
   if(response&&response.ok&&response.type!=='opaque')cache.put(req,response.clone()).catch(()=>{});
   return response;
  }catch(error){if(cached)return cached;throw error}
 }));
});
