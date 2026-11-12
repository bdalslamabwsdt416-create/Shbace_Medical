
(function(){
/* 1) mark the onboarding state for CSS (also covers the neighbour panes shown while swiping) */
const mark=()=>{try{if(mode==='preview')phoneContent.setAttribute('data-ob',String(slide));else phoneContent.removeAttribute('data-ob')}catch(e){}};
const rs0=renderSlide;renderSlide=function(){const r=rs0.apply(this,arguments);mark();return r};
const ra0=renderAppDemo;renderAppDemo=function(){const r=ra0.apply(this,arguments);mark();return r};
/* 2) Smart Review: real sync icon + icon button (same content, new look) */
const SYNC='<svg viewBox="0 0 64 64" fill="none" stroke="currentColor" stroke-width="6.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M50 26a19 19 0 0 0-33-6"/><path d="M50 10v16H34" /><path d="M14 38a19 19 0 0 0 33 6"/><path d="M14 54V38h16"/></svg>';
const DOC='<svg class="ob-bi" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="5" y="3" width="14" height="18" rx="2.5"/><path d="M9 8h6M9 12h6M9 16h4"/></svg>';
const CHV='<svg class="ob-bc" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M9 5l7 7-7 7"/></svg>';
const sr0=smartReviewScreen;
smartReviewScreen=function(){return sr0.apply(this,arguments).replace('<div class="feature-orbit">↻</div>','<div class="feature-orbit">'+SYNC+'</div>').replace('>Preview a review card</button>','>'+DOC+'<span class="ob-bl">Preview a review card</span>'+CHV+'</button>')};
window.showReviewSample=function(btn){const el=document.getElementById('reviewSample');if(!el)return;el.style.display=el.style.display==='none'?'block':'none';const l=btn.querySelector('.ob-bl');if(l)l.textContent=el.style.display==='none'?'Preview a review card':'Hide sample card'};
/* 3) Footer: keep both arrows and swipe gestures, with tappable progress dots. */
const GRADE=()=>screenTitles.indexOf('Choose your grade');
window.obGoTo=function(i){
 if(i===slide||mode!=='preview'||splashHolding())return;
 if(obVisible().indexOf(i)<0)return;
 if(Math.abs(i-slide)===1){window.swGo(i-slide);return}
 const g=GRADE();
 if(!obReplay&&i>slide&&g>-1&&slide<=g&&i>g&&!selectedGrade){i=g}  /* grade must be chosen before moving beyond it */
 if(i===slide)return;
 if(window.swJump){window.swJump(i);return}
 slide=i;renderSlide();
};
function obDots(){const N=screenTitles.length;return '<div class="ob-dots" role="tablist" aria-label="Onboarding progress">'+obVisible().map(i=>{const t=screenTitles[i];return '<button type="button" class="ob-dot'+(i===slide?' on':'')+'" role="tab" aria-selected="'+(i===slide)+'" aria-label="Step '+(i+1)+' of '+N+': '+String(t).replace(/"/g,'')+'" onclick="obGoTo('+i+')"><i></i></button>'}).join('')+'</div>'}
function obArrow(direction){const back=direction<0;if(!back&&obNb(1)<0&&!obCanExit())return '<button type="button" class="ob-arrow" style="visibility:hidden" tabindex="-1" aria-hidden="true" disabled>›</button>';return '<button type="button" class="ob-arrow" onclick="swGo('+direction+')" aria-label="'+(back?'Previous step':'Next step')+'" '+((back?obNb(-1)<0:(obNb(1)<0&&!obCanExit()))?'disabled':'')+'>'+(back?'‹':'›')+'</button>'}
footer=function(){
 return '<div class="screen-foot sw-foot ob-foot">'+obArrow(-1)+obDots()+obArrow(1)+'</div>';
};
/* Custom quiz and grade screens keep their own CTA, but gain a previous arrow and the same interactive progress dots. */
function obUpgradeCustomFooter(screenHtml){
 const qdOld='<div class="screen-foot" id="qdFoot">'+dots()+'<span class="tiny">Tap an answer</span></div>';
 const qdNew='<div class="screen-foot sw-foot ob-foot" id="qdFoot">'+obArrow(-1)+obDots()+obArrow(1)+'</div>';
 if(screenHtml.includes(qdOld))return screenHtml.replace(qdOld,qdNew);
 const old='<div class="screen-foot">'+dots();
 const gi=screenHtml.indexOf(old);
 if(gi<0)return screenHtml;
 /* grade page: the Continue button stays (same markup/ids, same enable logic) but sits ABOVE the shared navigation bar, so the bar is identical on every page */
 const tail0=screenHtml.slice(gi+old.length);
 if(tail0.startsWith('</div>'))return screenHtml.slice(0,gi)+footer().replace('class="ob-arrow" onclick="swGo(1)"','class="ob-arrow'+(selectedGrade?'':' ob-wait')+'" onclick="swGo(1)"')+tail0.slice(6);   /* the › arrow now does what Continue did */
 const be=screenHtml.indexOf('</button>',gi+old.length)+9,ge=screenHtml.indexOf('</div>',be)+6,btn=screenHtml.slice(gi+old.length,be);
 return screenHtml.slice(0,gi)+'<div class="screen-foot ob-cta">'+btn+'</div>'+footer()+screenHtml.slice(ge);
}
const __obQuizScreen=quizDemo;quizDemo=function(){return obUpgradeCustomFooter(__obQuizScreen.apply(this,arguments))};
const __obGradeScreen=gradeScreen;gradeScreen=function(){return obUpgradeCustomFooter(__obGradeScreen.apply(this,arguments))};
/* finish page: "Begin My Journey" + tagline stay as the page's call-to-action; the shared navigation bar is added below it */
const __obFinishScreen=finishScreen;finishScreen=function(){let h=__obFinishScreen.apply(this,arguments);
 h=h.replace('class="screen-foot cp-finish-foot" style="margin-top:auto"','class="screen-foot ob-cta cp-finish-foot" style="margin-top:auto"');
 return h.replace(/<\/section>\s*$/,footer()+'</section>')};
if(mode==='preview'&&!splashHolding()){try{renderSlide()}catch(e){console.error(e)}}
})();
