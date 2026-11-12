
/* v17 · Buttons no longer "jump to the top".
   Cause: every in-page button (Smart Review rating/answer/reveal, Study Timer start/pause/reset/goal, Statistics tabs, filters…) calls
   renderAppDemo(), which rebuilds the page, so the scroll position fell back to 0. This wrapper remembers the scroll offset of the page
   being re-rendered and puts it back when the SAME page is drawn again. Navigating to a different page is unchanged, and the explicit
   "go to top" calls Smart Review makes (next question, back, tab switch) still work. No data or handler is changed. */
(function(){
 var base=window.renderAppDemo;if(typeof base!=='function')return;
 var lastPage=null,gen=0;
 function sc(){return document.querySelector('#phoneContent .app-shell>.app-scroll:not(.pg-ghost)')}
 function put(e,v){if(!e)return;try{e.scrollTo({top:v,left:0,behavior:'instant'})}catch(_){e.scrollTop=v}}
 /* Smart Review sets phoneContent.scrollTop=0 for "scroll to top"; the real scroller is .app-scroll, so forward that to it */
 try{var p=document.getElementById('phoneContent'),d=Object.getOwnPropertyDescriptor(Element.prototype,'scrollTop');
  if(p&&d&&d.set&&d.get)Object.defineProperty(p,'scrollTop',{configurable:true,get:function(){return d.get.call(this)},set:function(v){d.set.call(this,v);if(+v===0){gen++;put(sc(),0)}}})}catch(_){}
 window.renderAppDemo=function(){
  var before=null,keep=null,my;gen++;
  try{if(typeof mode!=='undefined'&&mode==='app'){before=appPage;if(lastPage===before){var e=sc();if(e)keep=e.scrollTop}}}catch(_){}
  var out=base.apply(this,arguments);
  try{
   if(typeof mode!=='undefined'&&mode==='app'){
    var pg=appPage;
    if(keep!=null&&pg===before){var n=sc();put(n,keep);my=gen;requestAnimationFrame(function(){if(gen===my&&appPage===before&&Math.abs((sc()||{}).scrollTop-keep)>1)put(sc(),keep)})}
    document.querySelectorAll('#phoneContent .app-scroll .rs').forEach(function(r){r.classList.toggle('nx',pg==='stats'||pg==='timer')});
    lastPage=pg;
   }else lastPage=null;
  }catch(_){}
  return out};
 /* first paint: if the app page is already on screen, tag it */
 try{if(typeof mode!=='undefined'&&mode==='app'){lastPage=appPage;document.querySelectorAll('#phoneContent .app-scroll .rs').forEach(function(r){r.classList.toggle('nx',appPage==='stats'||appPage==='timer')})}}catch(_){}
})();
