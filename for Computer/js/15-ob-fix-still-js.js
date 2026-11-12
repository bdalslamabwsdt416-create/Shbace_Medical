
(function(){
let pane=false;
try{new MutationObserver(l=>{for(const r of l){for(const n of r.addedNodes)if(n.classList&&n.classList.contains('sw-pane'))pane=true;
 for(const n of r.removedNodes)if(n.classList&&n.classList.contains('sw-pane'))pane=false}}).observe(phoneContent,{childList:true})}catch(e){}
const rs=renderSlide;
let lastS=-1;renderSlide=function(){const same=(lastS===slide&&mode==='preview'&&!!phoneContent.firstElementChild&&!splashHolding());phoneContent.classList.toggle('ob-still',pane||same);lastS=slide;return rs.apply(this,arguments)};
})();
