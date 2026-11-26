// Medara audio engine. Original synthetic examples are retained; user-library MP3s
// are decoded from the local audio-library folder and use the same waveform/player.
export const SYNTHETIC_IDS=['stenosis','mitralRegurgitation','aorticRegurgitation','mitralStenosis'];
export const HEART_RATE=72;
export const S1_PHASE=.025,S2_PHASE=.49;
export function murmurEnvelope(id,p){
 if(id==='stenosis')return p>.13&&p<.46?Math.sin(Math.PI*(p-.13)/.33)**1.4:0;
 if(id==='mitralRegurgitation')return p>.035&&p<.49?Math.min(1,(p-.035)/.025,(.49-p)/.025)*.8:0;
 if(id==='aorticRegurgitation')return p>.51&&p<.96?Math.min(1,(p-.51)/.015)*Math.exp(-5*(p-.51))*Math.min(1,(.96-p)/.03):0;
 if(id==='mitralStenosis')return p>.63&&p<.99?Math.min(1,(p-.63)/.03,(.99-p)/.025)*(.5+.35*Math.max(0,(p-.86)/.13)):0;
 return 0;
}
export function synthesizeMurmur(id,sampleRate=44100){
 if(!SYNTHETIC_IDS.includes(id))throw new Error('Unknown synthetic finding');
 const rate=HEART_RATE/60,duration=12/rate,data=new Float32Array(Math.round(sampleRate*duration));
 let seed=1731,low=0,mid=0,high=0,peak=0;
 const aLow=1-Math.exp(-2*Math.PI*100/sampleRate),aMid=1-Math.exp(-2*Math.PI*360/sampleRate),aHigh=1-Math.exp(-2*Math.PI*1000/sampleRate);
 for(let i=0;i<data.length;i++){
  const t=i/sampleRate,p=(t*rate)%1;seed=(Math.imul(1664525,seed)+1013904223)>>>0;const noise=seed/4294967296*2-1;
  low+=aLow*(noise-low);mid+=aMid*(noise-mid);high+=aHigh*(noise-high);
  const pulse=(at,freq,amp,decay=38)=>{const dt=(p-at)/rate;return dt>=0&&dt<.13?amp*Math.exp(-dt*decay)*Math.sin(2*Math.PI*freq*dt):0;};
  let signal=pulse(S1_PHASE,58,id==='mitralStenosis'?1:.8)+pulse(S2_PHASE,78,.55),texture=0;
  if(id==='stenosis')texture=3.2*(mid-low)+.06*Math.sin(2*Math.PI*165*t);
  if(id==='mitralRegurgitation')texture=3.1*(high-low);
  if(id==='aorticRegurgitation')texture=3.5*(high-mid)+.4*(mid-low);
  if(id==='mitralStenosis'){texture=2.3*low+.11*Math.sin(2*Math.PI*48*t)+.08*Math.sin(2*Math.PI*83*t);signal+=pulse(.59,210,.35,85);}
  data[i]=signal+murmurEnvelope(id,p)*texture;peak=Math.max(peak,Math.abs(data[i]));
 }
 if(peak>0)for(let i=0;i<data.length;i++)data[i]*=.85/peak;
 return data;
}
export function playbackNormalization(id,peak){return Math.min(12,.85/Math.max(.01,peak))*(id==='normal'?1.4:['pulmonaryStenosis','ventricularSeptalDefect'].includes(id)?.8:1);}
export function audioDeadline(promise,ms,code){
 if(!ms)return promise;let timer;
 const deadline=new Promise((_,reject)=>{timer=setTimeout(()=>reject(Object.assign(new Error(code==='audio-activation'?'Tap Play to enable audio.':'Audio loading timed out.'),{code})),ms);});
 return Promise.race([promise,deadline]).finally(()=>clearTimeout(timer));
}
export class SoundEngine{
 constructor({resumeTimeoutMs=0,loadTimeoutMs=0,fetcher=(typeof window!=='undefined'&&window.__shbAuscultationFetch)||fetch}={}){this.resumeTimeoutMs=resumeTimeoutMs;this.loadTimeoutMs=loadTimeoutMs;this.fetcher=fetcher;this.context=null;this.playing=false;this.cache=new Map();this.volume=.45;this.strength=1;this.playbackRate=1;this.piece='diaphragm';this.requestId=0;this.buffer=null;this.offset=0;this.startedAt=0;}
 init(){if(this.context)return;this.context=new AudioContext();this.gain=this.context.createGain();this.low=this.context.createBiquadFilter();this.low.type='lowpass';this.high=this.context.createBiquadFilter();this.high.type='highpass';this.analyser=this.context.createAnalyser();this.analyser.fftSize=2048;this.high.connect(this.low);this.low.connect(this.gain);this.gain.connect(this.analyser);this.analyser.connect(this.context.destination);this.setPiece(this.piece);this.setVolume(this.volume);}
 async load(id){
  this.init();if(this.cache.has(id))return this.cache.get(id);
  let buffer;
  if(SYNTHETIC_IDS.includes(id)){
   const samples=synthesizeMurmur(id,this.context.sampleRate);buffer=this.context.createBuffer(1,samples.length,this.context.sampleRate);buffer.getChannelData(0).set(samples);
  }else{
   const url=id.startsWith('user:')?'audio-library/'+id.slice(5).split('/').map(encodeURIComponent).join('/'):'assets/audio/'+id+'.wav';
   const response=await this.fetcher(url);if(!response.ok)throw new Error('Audio could not be loaded: '+url);
   buffer=await this.context.decodeAudioData(await response.arrayBuffer());
  }
  this.cache.set(id,buffer);return buffer;
 }
 async play(id){
  const req=++this.requestId;this.init();
  if(this.context.state!=='running')await audioDeadline(this.context.resume(),this.resumeTimeoutMs,'audio-activation');
  if(req!==this.requestId)return false;if(this.context.state&&this.context.state!=='running')throw Object.assign(new Error('Tap Play to enable audio.'),{code:'audio-activation'});
  const buffer=await audioDeadline(this.load(id),this.loadTimeoutMs,'audio-load');if(req!==this.requestId)return false;
  this.stopSource();this.buffer=buffer;this.source=this.context.createBufferSource();this.source.buffer=buffer;this.source.loop=true;this.source.playbackRate.value=this.playbackRate;this.source.connect(this.high);
  let peak=0;for(let c=0;c<buffer.numberOfChannels;c++){const d=buffer.getChannelData(c);for(let i=0;i<d.length;i++)peak=Math.max(peak,Math.abs(d[i]));}
  this.normalization=playbackNormalization(id,peak);this.applyGain();this.source.start();this.startedAt=this.context.currentTime;this.playing=true;return true;
 }
 stopSource(){if(this.source){try{this.source.stop();}catch{}this.source.disconnect();this.source=null;}}
 pause(){++this.requestId;this.stopSource();this.playing=false;}
 setVolume(value){this.volume=value;this.applyGain();}
 setStrength(value){this.strength=value;this.applyGain();}
 setPlaybackRate(value){const rate=Math.max(.5,Math.min(1.25,Number(value)||1));this.playbackRate=rate;if(this.source&&this.context)this.source.playbackRate.setTargetAtTime(rate,this.context.currentTime,.04);}
 applyGain(){if(this.gain)this.gain.gain.setTargetAtTime(this.volume*this.strength*(this.normalization||1),this.context.currentTime,.06);}
 setPiece(piece){this.piece=piece;if(!this.low)return;this.low.frequency.setTargetAtTime(piece==='bell'?180:1400,this.context.currentTime,.08);this.high.frequency.setTargetAtTime(piece==='bell'?20:65,this.context.currentTime,.08);}
 samples(){if(!this.analyser||!this.playing)return null;const a=new Float32Array(this.analyser.fftSize);this.analyser.getFloatTimeDomainData(a);return a;}
}