(function(){let last='';
const collection=()=>String(window.__SHB_PED_COLLECTION__||'');
const key=()=>mode+'|'+slide+'|'+appPage+'|'+collection();
function snap(replace){
 const k=key();if(k===last&&!replace)return;last=k;
 const st={m:mode,s:slide,p:appPage,c:collection()};
 try{if(replace)history.replaceState(st,'');else if(history.state)history.pushState(st,'');else history.replaceState(st,'')}catch(e){}
}
window.__SHBACE_HISTORY_SNAPSHOT__=function(){snap(true)};
const rs=renderSlide;renderSlide=function(){rs.apply(this,arguments);snap()};
const ra=renderAppDemo;renderAppDemo=function(){ra.apply(this,arguments);snap()};
addEventListener('popstate',e=>{const st=e.state;if(!st)return;mode=st.m;slide=st.s;appPage=st.p;if(Object.prototype.hasOwnProperty.call(st,'c'))window.__SHB_PED_COLLECTION__=st.c;last=key();setModeUI();if(mode==='preview')rs();else if(mode==='app')ra()});
/* Phone/browser Back restores the previous Pediatrics collection before Home. */
})();