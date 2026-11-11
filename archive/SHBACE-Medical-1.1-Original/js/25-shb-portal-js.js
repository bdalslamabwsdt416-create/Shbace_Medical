
/* ONE cinematic transition ("portal"), reused for all three hand-offs:
     last Onboarding step -> Home        (original use: Onboarding pulls back into the glow)
     Splash -> first Onboarding step     (Splash pulls back into the glow)
     Splash -> Home                      (Splash pulls back into the glow)
   Same glow, same timings, same easing, same direction. Phase 1: the outgoing layer zooms in + fades while neon light blooms from the centre.
   Phase 2 (hidden under the light at its brightest): the destination is swapped in and emerges from the light (zoom-out settle + fade-in). */
(function(){
 if(typeof enterAppDemo!=='function')return;
 const orig=enterAppDemo;let busy=false;
 const reduce=()=>{try{return matchMedia('(prefers-reduced-motion:reduce)').matches}catch(e){return false}};
 const canAnim=()=>typeof Element!=='undefined'&&Element.prototype.animate;
 const EASE='cubic-bezier(.22,.8,.24,1)',SOFT='cubic-bezier(.4,0,.2,1)';
 /* cfg.out: element that pulls back in phase 1 · cfg.holdDest: keep the (already drawn) destination hidden during phase 1 · cfg.swap(): runs under the light · cfg.marksBusy: raise __xfBusy */
 function portal(cfg){
  const phone=document.querySelector('.phone'),pc=document.getElementById('phoneContent');
  if(!phone||!pc||!canAnim()||busy)return false;
  busy=true;
  const rm=reduce(),T=rm?{out:160,hold:0,in:260}:(cfg.T||{out:520,hold:60,in:760}),EZ=cfg.ease||EASE;
  const outEl=cfg.out||pc;
  let ov=null,finished=false,swapped=false,t1=0,t2=0,core,r1,r2,vig,sw;
  const hint=(el,on)=>{try{if(el&&el.style)el.style.willChange=on?'transform,opacity':''}catch(e){}};
  const cleanup=()=>{if(finished)return;finished=true;clearTimeout(t1);clearTimeout(t2);try{ov&&ov.remove()}catch(e){}busy=false;if(cfg.marksBusy)window.__xfBusy=false;try{pc.getAnimations().forEach(a=>a.cancel())}catch(e){}try{pc.style.opacity=''}catch(e){}hint(pc,false);hint(outEl,false)};
  /* Phase 2 (hidden under the light at its brightest): build the destination, then let it emerge from the light. The destination stays hidden by an inline
     opacity while it is built, so cancelling the old animations can never flash an unfinished frame. */
  const emerge=()=>{
   if(swapped||finished)return;swapped=true;
   if(cfg.marksBusy)window.__xfBusy=true; /* suppresses the older left->right ghost dissolve: this cinematic transition replaces it */
   try{pc.style.opacity='0'}catch(e){}
   try{cfg.swap&&cfg.swap()}catch(e){console.error(e)}
   try{pc.getAnimations().forEach(a=>a.cancel())}catch(e){}
   const clr=()=>{try{pc.style.opacity=''}catch(e){}};
   const a=pc.animate([{opacity:0,transform:rm?'none':'scale(.935)'},{opacity:1,transform:'scale(1)'}],{duration:T.in,easing:EZ,fill:'forwards'});
   a.onfinish=clr;a.oncancel=clr;
   ov.animate([{opacity:1},{opacity:0}],{duration:T.in*.95,delay:T.in*.05,easing:SOFT,fill:'forwards'});
   if(!rm){core.animate([{opacity:1,transform:'scale(1)'},{opacity:0,transform:'scale(1.35)'}],{duration:T.in,easing:SOFT,fill:'forwards'});
    vig.animate([{opacity:1},{opacity:0}],{duration:T.in,easing:SOFT,fill:'forwards'})}
   t2=setTimeout(cleanup,T.in+160);
  };
  try{
   ov=document.createElement('div');ov.className='shb-portal';ov.setAttribute('aria-hidden','true');
   ov.innerHTML='<i class="pt-vig"></i><i class="pt-core"></i><i class="pt-ring"></i><i class="pt-ring r2"></i><i class="pt-sweep"></i>';
   phone.appendChild(ov);
   const q=s=>ov.querySelector(s);core=q('.pt-core');r1=q('.pt-ring');r2=q('.pt-ring.r2');vig=q('.pt-vig');sw=q('.pt-sweep');
   hint(outEl,true);hint(pc,true);                    /* own compositor layers before the first frame: no re-raster, no flicker while scaling/fading */
   const fo={duration:T.out,easing:EZ,fill:'forwards'};
   /* Phase 1: the outgoing layer pulls back (soft zoom-in + fade) while neon/cyan light blooms from the centre */
   outEl.animate([{opacity:1,transform:'scale(1)'},{opacity:0,transform:'scale(1.07)'}],fo);
   if(cfg.holdDest&&outEl!==pc)pc.animate([{opacity:0},{opacity:0}],{duration:T.out+T.hold+400,fill:'forwards'});
   ov.animate([{opacity:0},{opacity:1}],{duration:T.out*.8,easing:SOFT,fill:'forwards'});
   if(!rm){
    core.animate([{opacity:0,transform:'scale(.2)'},{opacity:1,transform:'scale(1)'}],{duration:T.out+T.hold,easing:EZ,fill:'forwards'});
    vig.animate([{opacity:0},{opacity:1}],{duration:T.out,easing:SOFT,fill:'forwards'});
    r1.animate([{opacity:.95,transform:'scale(.35)'},{opacity:0,transform:'scale(3.1)'}],{duration:T.out+T.in*.6,easing:EZ,fill:'forwards'});
    r2.animate([{opacity:0,transform:'scale(.3)'},{opacity:.8,transform:'scale(.9)',offset:.3},{opacity:0,transform:'scale(2.4)'}],{duration:T.out+T.in*.6,delay:90,easing:EZ,fill:'forwards'});
    sw.animate([{opacity:0,transform:'translateX(-60%)'},{opacity:.9,offset:.4},{opacity:0,transform:'translateX(300%)'}],{duration:T.out+T.in*.7,easing:SOFT,fill:'forwards'});
   }
   /* the swap runs two painted frames AFTER the light reached its peak, so the heavy build never freezes a half-drawn bloom */
   t1=setTimeout(()=>{requestAnimationFrame(()=>requestAnimationFrame(emerge));setTimeout(emerge,120)},T.out+T.hold);
  }catch(e){console.error(e);cleanup();try{cfg.swap&&!swapped&&cfg.swap()}catch(_){}return true}
  setTimeout(()=>{if(!swapped){swapped=true;try{cfg.swap&&cfg.swap()}catch(e){}}cleanup()},T.out+T.hold+T.in+1500); /* safety */
  return true;
 }
 /* last Onboarding step -> Home */
 enterAppDemo=function(){
  if(busy)return;
  const pc=document.getElementById('phoneContent');
  /* only animate the real last-step -> Home hand-off; otherwise behave exactly as before */
  if(!pc||!canAnim()||typeof mode==='undefined'||mode!=='preview'||slide!==screenTitles.length-1){return orig.apply(this,arguments)}
  if(!portal({out:pc,marksBusy:true,swap:()=>orig.apply(window,[])}))return orig.apply(this,arguments);
 };
 try{window.enterAppDemo=enterAppDemo}catch(e){}
 /* Splash -> Onboarding page 1  /  Splash -> Home: the destination is already drawn under the opaque splash; the splash pulls back into the same glow. */
 window.shbPortalSplash=function(overlay,finish){
  if(!overlay||!overlay.isConnected)return false;
  return portal({out:overlay,holdDest:true,marksBusy:false,T:{out:1150,hold:160,in:1550},ease:'cubic-bezier(.45,.05,.25,1)',swap:()=>{try{finish()}catch(e){}}});   /* splash -> page: a longer, even flash (was 0.52 s + 0.76 s with a front-loaded curve, which read as a sudden cut) */
 };
})();
