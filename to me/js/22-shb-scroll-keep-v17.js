/* v18 · Route-aware scroll restoration and direction-aware sticky Back.
   The real scroller is .app-scroll (not #phoneContent). Keep each bank/system/topic route's position
   so returning from a topic restores the exact list location. The existing navigation stack still owns routing. */
(function(){
 'use strict';
 var base=window.renderAppDemo;if(typeof base!=='function')return;
 var positions=new Map(),lastKey=null,generation=0,lastY=new WeakMap();
 function sc(){return document.querySelector('#phoneContent .app-shell>.app-scroll:not(.pg-ghost)')}
 function put(el,value){if(!el)return;var top=Math.max(0,Number(value)||0);try{el.scrollTo({top:top,left:0,behavior:'instant'})}catch(_){el.scrollTop=top}}
 function routeKey(){
  var q=(window.__SHB_BRIDGE&&window.__SHB_BRIDGE.qs)||window.__qs||{};
  var page=String(typeof appPage==='string'?appPage:'');
  var collection=String(window.__SHB_PED_COLLECTION__||'');
  var key=[page,collection];
  if(page==='specialties')key.push(collection?String(q.spec||''):'');
  else if(page==='topics')key.push(String(q.spec||''),String(window.__SHB_PED_COLLECTION_SYSTEM__||''));
  else if(page==='questions')key.push(String(q.spec||''),String(q.topic||0),String(q.view||'all'));
  return JSON.stringify(key);
 }
 function remember(key,value){
  if(!key||!Number.isFinite(Number(value)))return;
  positions.set(key,Math.max(0,Number(value)));
  if(positions.size>60)positions.delete(positions.keys().next().value);
 }
 function markRestored(el,value){
  if(!el)return;
  var y=Math.max(0,Number(value)||0),b=el.querySelector('.backb');
  lastY.set(el,y);
  if(!b)return;
  b.classList.toggle('is-scroll-down',false);
  b.classList.toggle('is-scroll-up',y>16);
  b.classList.toggle('is-scroll-top',y<=16);
 }
 function onScroll(event){
  var el=event&&event.target;
  if(!el||!el.classList||!el.classList.contains('app-scroll'))return;
  var y=Math.max(0,Number(el.scrollTop)||0),previous=lastY.get(el),b=el.querySelector('.backb');
  if(b){
   if(y<=16){
    b.classList.toggle('is-scroll-down',false);
    b.classList.toggle('is-scroll-up',false);
    b.classList.toggle('is-scroll-top',true);
   }else if(previous!==undefined&&y>previous+.5){
    b.classList.toggle('is-scroll-down',true);
    b.classList.toggle('is-scroll-up',false);
    b.classList.toggle('is-scroll-top',false);
   }else if(previous!==undefined&&y<previous-.5){
    b.classList.toggle('is-scroll-down',false);
    b.classList.toggle('is-scroll-up',true);
    b.classList.toggle('is-scroll-top',false);
   }
  }
  lastY.set(el,y);
 }
 /* scroll does not bubble; capture it from the dedicated app scroller, including recreated screens. */
 document.addEventListener('scroll',onScroll,{capture:true,passive:true});
 /* Legacy actions still set phoneContent.scrollTop=0. Forward only that explicit top reset to app-scroll. */
 try{
  var p=document.getElementById('phoneContent'),d=Object.getOwnPropertyDescriptor(Element.prototype,'scrollTop');
  if(p&&d&&d.set&&d.get)Object.defineProperty(p,'scrollTop',{configurable:true,get:function(){return d.get.call(this)},set:function(v){
   d.set.call(this,v);
   if(+v===0){generation++;var el=sc();put(el,0);markRestored(el,0)}
  }});
 }catch(_){}
 window.renderAppDemo=function(){
  var active=typeof mode!=='undefined'&&mode==='app';
  var beforeKey=active?(lastKey||routeKey()):null,oldScroller=active?sc():null;
  var beforeTop=oldScroller?oldScroller.scrollTop:null;
  if(active&&beforeKey&&beforeTop!==null)remember(beforeKey,beforeTop);
  var out=base.apply(this,arguments);
  try{
   if(active){
    var nextKey=routeKey(),target=positions.has(nextKey)?positions.get(nextKey):0,token=++generation;
    if(nextKey===beforeKey&&beforeTop!==null)target=beforeTop;
    requestAnimationFrame(function(){
     if(token!==generation||routeKey()!==nextKey)return;
     var el=sc();if(!el)return;
     put(el,target);markRestored(el,target);
    });
    document.querySelectorAll('#phoneContent .app-scroll .rs').forEach(function(r){
     r.classList.toggle('nx',appPage==='stats'||appPage==='timer');
    });
    lastKey=nextKey;
   }else lastKey=null;
  }catch(_){}
  return out
 };
 try{
  if(typeof mode!=='undefined'&&mode==='app'){
   lastKey=routeKey();
   var el=sc();if(el)markRestored(el,el.scrollTop||0);
   document.querySelectorAll('#phoneContent .app-scroll .rs').forEach(function(r){
    r.classList.toggle('nx',appPage==='stats'||appPage==='timer');
   });
  }
 }catch(_){}
})();