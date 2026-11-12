
(function(){let last='';
const key=()=>mode+'|'+slide+'|'+appPage;
function snap(){const k=key();if(k===last)return;last=k;const st={m:mode,s:slide,p:appPage};try{history.state?history.pushState(st,''):history.replaceState(st,'')}catch(e){}}
const rs=renderSlide;renderSlide=function(){rs.apply(this,arguments);snap()};
const ra=renderAppDemo;renderAppDemo=function(){ra.apply(this,arguments);snap()};
addEventListener('popstate',e=>{const st=e.state;if(!st)return;mode=st.m;slide=st.s;appPage=st.p;last=key();setModeUI();if(mode==='preview')rs();else if(mode==='app')ra()});
/* Heartbeat haptics are driven by launchExperience() at the same 833ms visual cadence. */
})();
