
(function(){
const pc=document.getElementById('phoneContent');if(!pc)return;
const RM=()=>!!(window.matchMedia&&matchMedia('(prefers-reduced-motion: reduce)').matches);
/* Decode the four high-value onboarding visuals during idle time, not during a page transition. */
function warmOnboardingArt(){
 try{
  const list=[IMG.iconBig,IMG.climber,IMG.obHeart,DOC_EMB&&DOC_EMB.encouraging].filter(Boolean);
  [...new Set(list)].forEach(src=>{const im=new Image();im.decoding='async';im.src=src;if(im.decode)im.decode().catch(()=>{})});
 }catch(e){}
}
try{
 if('requestIdleCallback' in window)requestIdleCallback(warmOnboardingArt,{timeout:1800});
 else setTimeout(warmOnboardingArt,900);
}catch(e){}
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
 /* Preserve the actual first-onboarding-page artwork inside the frozen layer; it is a sibling of #phoneContent in the live phone shell. */
 try{
  const liveBg=ph.querySelector(':scope>.shb-obbg');
  if(liveBg){
   const cs=getComputedStyle(liveBg),bg=liveBg.cloneNode(false);
   bg.removeAttribute('id');bg.setAttribute('aria-hidden','true');
   bg.style.cssText='position:absolute;inset:0;z-index:0;pointer-events:none;opacity:'+cs.opacity+
    ';background-color:'+cs.backgroundColor+';background-image:'+cs.backgroundImage+
    ';background-size:'+cs.backgroundSize+';background-position:'+cs.backgroundPosition+
    ';background-repeat:'+cs.backgroundRepeat+';transition:none';
   g.insertBefore(bg,g.firstChild);
  }
 }catch(e){}
 const st=pc.scrollTop;ph.appendChild(g);g.scrollTop=st;window.__xfBusy=true;
 let r;try{r=eA.apply(this,arguments)}catch(e){g.remove();window.__xfBusy=false;throw e}
 if(mode!=='app'){g.remove();window.__xfBusy=false;return r}
 pc.classList.add('xf-home');
 const end=()=>{g.remove();pc.classList.remove('xf-home');window.__xfBusy=false};
 requestAnimationFrame(()=>splashDissolve(g,RM()?350:2000,end));   /* same left -> right reveal as the splash */
 return r};
})();
