
/* Four icons on onboarding page 1: the entrance sequence is tied to the real page lifecycle, not to mounting.
   - every freshly drawn page-1 screen starts WITHOUT .in6-go (icons hidden by CSS);
   - .in6-go is added only when: the splash overlay is gone (dissolve finished), the document is visible, no swipe is in progress and the page is still the live one;
   - leaving page 1 removes the screen from the DOM (state reset); coming back draws a fresh screen -> the sequence starts again from the first icon. */
(function(){
 const pc=document.getElementById('phoneContent');if(!pc)return;
 let token=0;
 const live=sc=>sc&&sc.isConnected&&pc.querySelector(':scope>.screen.intro.in6:not(.sw-pane)')===sc;
 function arm(sc){
  const my=++token;
  sc.classList.remove('in6-go');
  const ok=()=>my===token&&live(sc);
  const blocked=()=>!!document.getElementById('startupSplash')||document.hidden||document.body.classList.contains('sw-dragging')||!!window.__xfBusy;
  const wait=()=>{
   if(!ok())return;
   if(blocked()){setTimeout(wait,60);return}
   setTimeout(()=>{                      /* short settle after the page is fully visible */
    if(!ok())return;
    if(blocked()){wait();return}
    void sc.offsetWidth;
    requestAnimationFrame(()=>requestAnimationFrame(()=>{if(ok()&&!blocked())sc.classList.add('in6-go');else if(ok())wait()}));
   },220);
  };
  wait();
 }
 const scan=()=>{const sc=pc.querySelector(':scope>.screen.intro.in6:not(.sw-pane)');if(sc&&!sc.__in6armed){sc.__in6armed=true;arm(sc)}else if(!sc){token++}};
 new MutationObserver(scan).observe(pc,{childList:true});
 scan();
})();
