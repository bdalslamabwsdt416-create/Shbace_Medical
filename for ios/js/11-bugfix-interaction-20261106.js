
(function(){
  function captureScroll(){
    var el=document.querySelector('.app-scroll')||document.querySelector('.screen')||document.querySelector('.phone-content');
    return {top:el?el.scrollTop:window.scrollY,left:el?el.scrollLeft:window.scrollX,had:!!el};
  }
  function restoreScroll(pos){
    var run=function(){
      var el=document.querySelector('.app-scroll')||document.querySelector('.screen')||document.querySelector('.phone-content');
      if(el&&pos.had){el.scrollTop=pos.top;el.scrollLeft=pos.left;}
      else if(!el&&window.scrollTo){window.scrollTo(pos.left,pos.top);}
    };
    if(typeof requestAnimationFrame==='function')requestAnimationFrame(run);else setTimeout(run,0);
  }
  ['qzPick','qzMark'].forEach(function(name){
    var original=window[name];
    if(typeof original!=='function')return;
    window[name]=function(){var pos=captureScroll();var result=original.apply(this,arguments);restoreScroll(pos);return result;};
  });

  // Header quick pages behave as toggles: the same icon closes back to the page
  // from which it was opened; tapping the other icon switches between quick pages.
  var activePanel=null,returnPage='subjects';
  var target={Notifications:'notifs',Settings:'settings'};
  var oldRender=window.renderAppDemo;
  if(typeof oldRender==='function'){
    window.renderAppDemo=function(){
      var result=oldRender.apply(this,arguments);
      if(activePanel&&appPage!==target[activePanel])activePanel=null;
      return result;
    };
  }
  window.hdrTap=function(label){
    if(!target[label])return;
    if(activePanel===label){
      appPage=returnPage||'subjects';
      activePanel=null;
    }else{
      if(!activePanel)returnPage=appPage||'subjects';
      activePanel=label;
      appPage=target[label];
    }
    if(typeof window.renderAppDemo==='function')window.renderAppDemo();
  };
  var oldBack=window.navBack;
  window.navBack=function(){
    if(activePanel){appPage=returnPage||'subjects';activePanel=null;
      if(typeof window.renderAppDemo==='function')window.renderAppDemo();return;}
    if(typeof oldBack==='function')return oldBack.apply(this,arguments);
  };
})();
