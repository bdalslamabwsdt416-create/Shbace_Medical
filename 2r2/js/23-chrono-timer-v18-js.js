
/* v18 · Study Timer chronograph decoration + welcome intro. Adds markup only inside the existing timer card; no timer/session code is touched. */
(function(){
 var base=window.renderAppDemo,last=null,lastDeg=0;
 if(typeof base!=='function')return;
 function reduced(){try{return window.matchMedia('(prefers-reduced-motion: reduce)').matches}catch(e){return false}}
 function pt(r,deg){var a=deg*Math.PI/180;return [(120+r*Math.sin(a)).toFixed(2),(120-r*Math.cos(a)).toFixed(2)]}
 function chronoSVG(){
  var t='',i,mj,a,b;
  for(i=0;i<60;i++){mj=i%5===0;a=pt(mj?111:114,i*6);b=pt(119,i*6);
   t+='<line class="tk'+(mj?' mj':'')+'" style="--i:'+i+'" x1="'+a[0]+'" y1="'+a[1]+'" x2="'+b[0]+'" y2="'+b[1]+'"/>'}
  return '<svg class="tm-chrono" viewBox="0 0 240 240" aria-hidden="true"><defs>'+
   '<linearGradient id="tmBz" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#5b4dff"/><stop offset=".5" stop-color="#35e6ff"/><stop offset="1" stop-color="#2f8bff"/></linearGradient>'+
   '<linearGradient id="tmMt" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#8cc4ff"/><stop offset="1" stop-color="#1d3f9c"/></linearGradient></defs>'+
   '<circle class="bz" cx="120" cy="120" r="122"/>'+t+
   '<rect class="mt" x="110" y="-11" width="20" height="10" rx="2.5"/><path class="gr" d="M114 -8v4M120 -8v4M126 -8v4"/>'+
   '<g transform="rotate(60 120 120)"><rect class="mt" x="113" y="-8" width="14" height="9" rx="2.5"/></g>'+
   '<g transform="rotate(120 120 120)"><rect class="mt" x="113" y="-8" width="14" height="9" rx="2.5"/></g></svg>'}
 function handSVG(){return '<svg class="tm-hand" viewBox="0 0 240 240" aria-hidden="true"><g class="hg"><line class="hn" x1="120" y1="134" x2="120" y2="12"/><circle class="hb" cx="120" cy="120" r="4.5"/></g></svg>'}
 function curMs(){try{var s=window.__shbStudy.state().cur;if(!s)return 0;return s.ms+(s.running&&isFinite(s.rs)?Math.max(0,Date.now()-s.rs):0)}catch(e){return 0}}
 function setHand(ms){var g=document.querySelector('.tm-hand .hg');if(!g)return;var deg=ms/60000*360;g.style.transition=deg<lastDeg?'none':'';lastDeg=deg;g.style.transform='rotate('+deg+'deg)'}
 function decorate(entering){
  var ring=document.querySelector('#phoneContent .tm-ring');
  if(!ring||ring.querySelector('.tm-chrono'))return;
  ring.insertAdjacentHTML('afterbegin',chronoSVG());
  var svgs=ring.querySelectorAll(':scope>svg:not(.tm-chrono)'),host=svgs[svgs.length-1];
  if(host)host.insertAdjacentHTML('afterend',handSVG());
  lastDeg=0;var g=ring.querySelector('.hg');if(g)g.style.transition='none';setHand(curMs());
  requestAnimationFrame(function(){var h=document.querySelector('.tm-hand .hg');if(h)h.style.transition=''});
  if(entering&&!reduced()){
   ring.classList.add('tm-boot');
   var card=ring.closest('.tm-card');
   if(card&&!card.querySelector('.tm-intro')){
    card.insertAdjacentHTML('beforeend','<div class="tm-intro" aria-hidden="true"><div class="ti-in"><span class="ti-k">SHBACE · FOCUS LAB</span><b class="ti-h">Welcome back, Doctor</b><span class="ti-s">Calibrating your chronograph…</span><i class="ti-bar"></i></div></div>');
    var it=card.querySelector('.tm-intro');
    it.addEventListener('animationend',function(e){if(e.target===it&&e.animationName==='tiOut')it.remove()});
    setTimeout(function(){if(it&&it.isConnected)it.remove()},2800);
   }
  }
 }
 window.renderAppDemo=function(){
  var out=base.apply(this,arguments);
  try{var pg=(typeof mode!=='undefined'&&mode==='app')?appPage:null;if(pg==='timer')decorate(last!=='timer');last=pg}catch(e){}
  return out};
 var tick=window.stTimerTick;
 if(typeof tick==='function')window.stTimerTick=function(ms){try{tick(ms)}catch(e){}try{setHand(ms)}catch(e){}};
 try{if(typeof mode!=='undefined'&&mode==='app'){last=appPage;if(appPage==='timer')decorate(false)}}catch(e){}
})();
