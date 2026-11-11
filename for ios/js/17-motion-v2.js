
/* Motion v2: tactile press feedback + paired page transitions. Nothing here delays a click or a render. */
(function(){
 var SEL='button,[onclick],[role="button"],summary',SKIP='#startupSplash,.drawer-bk,.mj-node,.gx-step,input,select,textarea,.pr-no';
 var cur=null;
 function reduce(){try{return matchMedia('(prefers-reduced-motion: reduce)').matches}catch(e){return false}}
 function target(e){var t=e.target&&e.target.closest?e.target.closest(SEL):null;
  if(!t||t.disabled||t.closest(SKIP)||!t.closest('.phone'))return null;
  var r=t.getBoundingClientRect();if(r.height>320||t.querySelector('.screen'))return null;
  try{if(getComputedStyle(t).transform!=='none')return null}catch(_){return null}
  t.__lg=r.width>240||r.height>110;return t}
 function down(t){if(!t)return;t.classList.remove('pr-up');t.classList.toggle('pr-lg',!!t.__lg);t.classList.add('pr-down');cur=t}
 /* the press frame starts on pointerdown itself (touch included); a scroll start fires pointercancel, which undoes it without a bounce */
 document.addEventListener('pointerdown',function(e){down(target(e))},{passive:true});
 function release(cancel){var t=cur;cur=null;if(!t)return;
  t.classList.remove('pr-down');
  if(cancel)return;
  t.classList.add('pr-up');t.addEventListener('animationend',function(){t.classList.remove('pr-up','pr-lg')},{once:true})}
 document.addEventListener('pointerup',function(){release(false)},{passive:true});
 document.addEventListener('pointercancel',function(){release(true)},{passive:true});

 /* ---- page transitions: wrap the app's single render entry point ----
    The outgoing page is frozen as a ghost (same scroll offset) that fades out and drifts 10px away while the real
    incoming page fades in from 10px on the other side, at the same time. Header and bottom bar are never animated. */
 var TABS=['subjects','search','quiz','review','stats'],last=null,stack=[],scrolls={},ghostTimer=0,base=window.renderAppDemo;
 if(typeof base!=='function')return;
 function shell(){var pc=document.getElementById('phoneContent');return pc?pc.querySelector(':scope>.screen.app-shell'):null}
 function dropGhosts(){clearTimeout(ghostTimer);document.querySelectorAll('.pg-ghost').forEach(function(g){g.remove()})}
 window.renderAppDemo=function(){
  var page=(typeof mode!=='undefined'&&mode==='app')?appPage:null,dir=0,ghost=null,gBox=null,gTop=0;
  try{
   dropGhosts();
   var osh=page&&last?shell():null,osc=osh&&osh.querySelector(':scope>.app-scroll');
   if(osc)scrolls[last]=osc.scrollTop;
   if(page&&last&&page!==last&&!document.hidden){
    var ti=TABS.indexOf(page),tl=TABS.indexOf(last);
    if(ti>-1&&tl>-1){dir=ti>tl?1:-1;stack=[]}
    else if(stack.length&&stack[stack.length-1]===page){stack.pop();dir=-1}
    else if(ti>-1){stack=[];dir=-1}
    else{stack.push(last);if(stack.length>14)stack.shift();dir=1}
    if(dir&&osc&&!reduce()){
     var a=osh.getBoundingClientRect(),b=osc.getBoundingClientRect();
     ghost=document.createElement('div');ghost.className='app-scroll pg-ghost';ghost.setAttribute('aria-hidden','true');
     try{ghost.inert=true}catch(_){}
     Array.prototype.forEach.call(osc.childNodes,function(n){var c=n.cloneNode(true);if(c.querySelectorAll){c.querySelectorAll('[id]').forEach(function(x){x.removeAttribute('id')});if(c.removeAttribute)c.removeAttribute('id')}ghost.appendChild(c)});
     ghost.style.cssText='left:'+(b.left-a.left)+'px;top:'+(b.top-a.top)+'px;width:'+b.width+'px;height:'+b.height+'px';
     gTop=osc.scrollTop}}
  }catch(e){ghost=null;console.error('transition prep',e)}
  var out=base.apply(this,arguments);
  try{
   last=page;
   var nsh=shell(),nsc=nsh&&nsh.querySelector(':scope>.app-scroll:not(.pg-ghost)');
   if(dir&&nsc&&!reduce()){
    if(dir<0&&scrolls[page])nsc.scrollTop=scrolls[page];
    nsc.classList.add(dir>0?'pg-in-r':'pg-in-l');
    nsc.addEventListener('animationend',function(){nsc.classList.remove('pg-in-r','pg-in-l')},{once:true});
    if(ghost){ghost.classList.add(dir>0?'pg-out-l':'pg-out-r');nsh.insertBefore(ghost,nsh.querySelector(':scope>.app-nav')||null);ghost.scrollTop=gTop;
     ghostTimer=setTimeout(function(){ghost.remove()},260)}
   }else if(dir<0&&nsc&&scrolls[page]){nsc.scrollTop=scrolls[page]}
  }catch(e){console.error('transition',e)}
  return out};
})();
