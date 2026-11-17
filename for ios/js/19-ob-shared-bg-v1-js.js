
(function(){
const pc=document.getElementById('phoneContent');if(!pc)return;
const RM=()=>!!(window.matchMedia&&matchMedia('(prefers-reduced-motion: reduce)').matches);
document.documentElement.style.setProperty('--xf-splash',SPLASH_FADE_MS+'ms');
document.documentElement.style.setProperty('--xf-home',(RM()?350:3200)+'ms');
/* flag the real last onboarding slide (index = screenTitles.length-1), never a hard-coded page */
const sync=()=>{const v=pc.getAttribute('data-ob');if(v!==null&&Number(v)===screenTitles.length-1)pc.setAttribute('data-ob-final','');else pc.removeAttribute('data-ob-final')};
new MutationObserver(sync).observe(pc,{attributes:true,attributeFilter:['data-ob']});sync();
/* Splash -> Onboarding: onboarding is drawn under the splash and fades in while the splash fades out */
const rA=routeAfterSplash;
routeAfterSplash=function(){return rA.apply(this,arguments)};   /* dissolve is done by the splash mask itself; the destination is fully opaque underneath (no black / blank frames) */
/* Onboarding -> Home: a frozen copy of the last page dissolves while Home dissolves in underneath */
const eA=enterAppDemo;
enterAppDemo=function(){
 const ph=document.querySelector('.phone');
 if(!ph||mode!=='preview'||window.__xfBusy)return eA.apply(this,arguments);
 const g=pc.cloneNode(true);g.classList.add('xf-ghost');g.setAttribute('aria-hidden','true');g.setAttribute('inert','');
 g.querySelectorAll('[id]').forEach(n=>n.removeAttribute('id'));
 const st=pc.scrollTop;ph.appendChild(g);g.scrollTop=st;window.__xfBusy=true;
 let r;try{r=eA.apply(this,arguments)}catch(e){g.remove();window.__xfBusy=false;throw e}
 if(mode!=='app'){g.remove();window.__xfBusy=false;return r}
 pc.classList.add('xf-home');
 const end=()=>{g.remove();pc.classList.remove('xf-home');window.__xfBusy=false};
 requestAnimationFrame(()=>splashDissolve(g,RM()?350:2000,end));   /* same left -> right reveal as the splash */
 return r};
})();


/* PWA-only onboarding image pre-decode. Native Android keeps its existing asset lifecycle. */
(function(){
 try{
  const c=window.Capacitor;
  if(c&&typeof c.isNativePlatform==='function'&&c.isNativePlatform())return;
  const list=['/assets/img/62a732b97cb4.png','/assets/img/9611283933e0.webp','/assets/img/8e6540881e86.png','/assets/img/300a2b16b550.jpg'];
  window.__obPre=window.__obPre||[];
  const idle=window.requestIdleCallback?(f=>window.requestIdleCallback(f,{timeout:2500})):(f=>setTimeout(f,1500));
  const one=i=>{
   if(i>=list.length)return;
   try{const im=new Image();im.decoding='async';im.src=list[i];window.__obPre.push(im);(im.decode?im.decode():Promise.resolve()).catch(()=>{})}catch(e){}
   setTimeout(()=>one(i+1),250);
  };
  idle(()=>one(0));
 }catch(e){}
})();
