
(function(){
  var root=document.documentElement;
  document.addEventListener('pointerdown',function(e){if(e.pointerType==='touch'||e.pointerType==='pen')root.classList.add('touch-mode');},true);
  document.addEventListener('keydown',function(e){if(e.key==='Tab'||e.key==='ArrowDown'||e.key==='ArrowUp'||e.key==='ArrowLeft'||e.key==='ArrowRight')root.classList.remove('touch-mode');},true);
})();
