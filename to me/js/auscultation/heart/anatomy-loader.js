// A bounded download keeps the audio lesson usable even when a request stalls.
export async function loadAnatomy({base='assets/models/thorax',signal,onProgress=()=>{},timeoutMs=30000,maxDurationMs=180000,fetcher=fetch}={}) {
 const controller=new AbortController();let timedOut=false,timer,deadline;
 const expire=()=>{timedOut=true;controller.abort();};
 const touch=()=>{if(controller.signal.aborted)return;clearTimeout(timer);timer=setTimeout(expire,timeoutMs);};
 const abort=()=>controller.abort();
 if(signal?.aborted)abort();else signal?.addEventListener('abort',abort,{once:true});
 const aborted=new Promise((_,reject)=>{
  const fail=()=>reject(Object.assign(new Error(timedOut?'The anatomy download took too long.': 'Anatomy loading was interrupted.'),{code:timedOut?'timeout':'aborted'}));
  if(controller.signal.aborted)fail();else controller.signal.addEventListener('abort',fail,{once:true});
 });
 const download=async()=>{
  if(controller.signal.aborted)throw new Error("Anatomy loading was interrupted.");
  const manifest=await fetcher(base+'.json',{signal:controller.signal});
  if(!manifest.ok)throw new Error('Anatomy manifest unavailable');
  const meta=await manifest.json();touch();
  if(!Number.isSafeInteger(meta.bytes)||meta.bytes<=0||meta.bytes>25000000||!Array.isArray(meta.meshes))throw new Error('Invalid anatomy manifest');
  const response=await fetcher(base+'.bin',{signal:controller.signal});
  if(!response.ok)throw new Error('Anatomy data unavailable');
  const output=new Uint8Array(meta.bytes);let received=0;
  onProgress(0,meta.bytes);
  if(response.body?.getReader){
   const reader=response.body.getReader();
   try{for(;;){const {done,value}=await reader.read();if(done)break;
    if(received+value.length>output.length)throw new Error('Unexpected anatomy size');
    output.set(value,received);received+=value.length;touch();onProgress(received,meta.bytes);
   }}finally{reader.releaseLock();}
  }else{const bytes=new Uint8Array(await response.arrayBuffer());if(bytes.length!==output.length)throw new Error('Incomplete anatomy data');output.set(bytes);received=bytes.length;onProgress(received,meta.bytes);}
  if(received!==meta.bytes)throw new Error('Incomplete anatomy data');
  for(const m of meta.meshes){
   for(const [offset,count] of [[m.positionOffset,m.positionCount],[m.indexOffset,m.indexCount]]){
    if(!Number.isSafeInteger(offset)||!Number.isSafeInteger(count)||offset<0||count<=0||offset%4||count%3||offset+count*4>received)throw new Error('Invalid anatomy geometry');
   }
  }
  return {meta,bytes:output.buffer};
 };
 try{touch();deadline=setTimeout(expire,maxDurationMs);return await Promise.race([aborted,download()]);}
 finally{clearTimeout(timer);clearTimeout(deadline);controller.abort();signal?.removeEventListener('abort',abort);}
}
