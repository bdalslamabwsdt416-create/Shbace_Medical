
/* ===== warm-up during splash (onboarding) ===== */
(function(){
  'use strict';
  var pc=document.getElementById('phoneContent');
  if(!pc)return;

  /* (c) warm up the Grade-stage sprites while the splash is showing, so slide 6 has no blank stage on arrival */
  try{
    var idle=window.requestIdleCallback||function(f){return setTimeout(f,300)};
    setTimeout(function(){idle(function(){try{if(typeof gxLoad==='function')gxLoad()}catch(e){}})},1200);
  }catch(e){}
})();
