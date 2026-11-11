
(function(){
'use strict';
/* Android 1.3 no longer uses the legacy onboarding completion journey.
   Keep the artwork available to the independent PWA flow, but do not preload or initialise it in Android. */
const cap=window.Capacitor;
if(cap&&cap.isNativePlatform&&cap.isNativePlatform()&&(!cap.getPlatform||cap.getPlatform()==='android'))return;
const BG='/assets/img/297c220bd3da.webp';
const VB_W=865,VB_H=680,BG_H=600;
/* grade platforms (poster layout, numerals 1→5 climb bottom → top) */
const PTS=[{x:358,y:590},{x:540,y:465},{x:277,y:400},{x:560,y:297},{x:400,y:170}];
const START={x:196,y:596};
const SUMMIT={x:430,y:104};
const CAP_ON_GRADE=5;
const JOURNEY_AVATAR_DATA='/assets/img/0300b02ebf65.png';
const JOURNEY_AVATAR=JOURNEY_AVATAR_DATA;try{(window.requestIdleCallback||function(f){return setTimeout(f,1500)})(function(){const im=new Image();im.src=JOURNEY_AVATAR;if(im.decode)im.decode().catch(function(){})})}catch(e){}
const HERO_IMG_Y=-114;
const ES=n=>String(n);
const reduce=()=>matchMedia('(prefers-reduced-motion: reduce)').matches;
const doc=n=>{try{return (window.DOC_EMB&&DOC_EMB[n])||''}catch(e){return ''}};

/* ---- smooth route through START → 1..5 → summit (Catmull-Rom → cubic) ---- */
function routeD(){
  const P=[START,...PTS,SUMMIT],t=.5;let d=`M${P[0].x} ${P[0].y}`;
  for(let i=0;i<P.length-1;i++){
    const p0=P[i-1]||P[i],p1=P[i],p2=P[i+1],p3=P[i+2]||P[i+1];
    const c1={x:p1.x+(p2.x-p0.x)*t/3*1.0,y:p1.y+(p2.y-p0.y)*t/3*1.0};
    const c2={x:p2.x-(p3.x-p1.x)*t/3*1.0,y:p2.y-(p3.y-p1.y)*t/3*1.0};
    d+=` C${c1.x.toFixed(1)} ${c1.y.toFixed(1)} ${c2.x.toFixed(1)} ${c2.y.toFixed(1)} ${p2.x} ${p2.y}`;
  }
  return d;
}
const ROUTE=routeD();

/* v32 · cinematic scene. Same route, same grade stops, same student controller: only the drawing changes.
   The 3-D ribbon below is built from the SAME Catmull-Rom path as ROUTE (pure maths), so the student still walks ROUTE. */
const RIB=(function(){
  const P=[START,...PTS,SUMMIT],t=.5,N=26,C=[];
  for(let i=0;i<P.length-1;i++){
    const p0=P[i-1]||P[i],p1=P[i],p2=P[i+1],p3=P[i+2]||P[i+1];
    const ax=p1.x+(p2.x-p0.x)*t/3,ay=p1.y+(p2.y-p0.y)*t/3,bx=p2.x-(p3.x-p1.x)*t/3,by=p2.y-(p3.y-p1.y)*t/3;
    for(let k=(i?1:0);k<=N;k++){const s=k/N,u=1-s;
      C.push([u*u*u*p1.x+3*u*u*s*ax+3*u*s*s*bx+s*s*s*p2.x,u*u*u*p1.y+3*u*u*s*ay+3*u*s*s*by+s*s*s*p2.y])}
  }
  const A=[],B=[];
  for(let j=0;j<C.length;j++){
    const a=C[Math.max(0,j-1)],b=C[Math.min(C.length-1,j+1)];
    let dx=b[0]-a[0],dy=b[1]-a[1];const m=Math.hypot(dx,dy)||1;dx/=m;dy/=m;
    const hw=6+11*Math.max(0,Math.min(1,(C[j][1]-104)/492));      /* wider near the camera, narrower toward the summit */
    A.push([C[j][0]+dy*hw,C[j][1]-dx*hw]);B.push([C[j][0]-dy*hw,C[j][1]+dx*hw]);
  }
  const f=q=>q[0].toFixed(1)+' '+q[1].toFixed(1);
  return {A:'M'+A.map(f).join('L'),B:'M'+B.map(f).join('L'),poly:'M'+A.map(f).join('L')+'L'+B.slice().reverse().map(f).join('L')+'Z'};
})();

const PEAK='M298 130L318 117L330 118L352 104L362 106L380 93L388 95L402 81L410 83L421 69L427 71L436 62L446 73L452 71L463 86L470 84L484 98L492 96L510 108L520 107L546 120L556 119L580 132L580 150L298 150Z';
const PEAK_L='M436 62L434 78L438 92L432 106L436 124L432 150L298 150L298 130L318 117L330 118L352 104L362 106L380 93L388 95L402 81L410 83L421 69L427 71Z';
const SNOW_L='M380 40L436 40L436 62L434 78L438 92L436 110L428 94L420 106L412 92L402 102L390 92L380 96Z';
const SNOW_R='M436 62L436 40L500 40L500 92L486 100L474 90L466 100L458 88L448 104L436 110L438 92L434 78Z';
const RIDGE_L='M298 130L318 117L330 118L352 104L362 106L380 93L388 95L402 81L410 83L421 69L427 71L436 62';
const BX=438,BY=32;   /* arrival beacon centre (above the peak, clear of the student's head at Grade 5) */

function nodeSVG(n){
  const p=PTS[n-1];
  return `<g class="mj-node mj-upcoming" data-n="${n}" transform="translate(${p.x} ${p.y})" aria-label="Grade ${n}">
   <circle class="mj-hit" cx="0" cy="-12" r="76"/>
   <ellipse class="mj-halo" cx="0" cy="8" rx="104" ry="34"/>
   <ellipse cx="0" cy="31" rx="88" ry="19" fill="rgba(0,6,24,.5)"/>
   <ellipse class="mj-ring" cx="0" cy="10" rx="92" ry="28"/>
   <ellipse class="mj-rim" cx="0" cy="14" rx="80" ry="24"/>
   <path d="M-72 7L-80 14A80 24 0 0 0 80 14L72 7A72 20 0 0 1 -72 7Z" fill="url(#mjWall)"/>
   <ellipse class="mj-top" cx="0" cy="7" rx="72" ry="20"/>
   <ellipse cx="-8" cy="2" rx="46" ry="9" fill="url(#mjSheen)"/>
   <ellipse cx="0" cy="7" rx="50" ry="13" fill="none" stroke="rgba(190,235,255,.4)" stroke-width="1.6" stroke-dasharray="3 6"/>
   <path d="M-92 24L-80 9L-66 15L-60 30L-78 36Z" fill="#0a214c" stroke="rgba(120,180,240,.35)" stroke-width="1.2" stroke-linejoin="round"/>
   <path d="M90 26L78 10L64 15L59 31L80 37Z" fill="#081b40" stroke="rgba(120,180,240,.3)" stroke-width="1.2" stroke-linejoin="round"/>
   <g class="mj-pin" transform="translate(92 -70) scale(1.1)"><path d="M0 26C-15 4-20-2-20-12a20 20 0 0 1 40 0C20-2 15 4 0 26Z"/><circle cy="-12" r="7"/></g>
   <ellipse cx="-70" cy="9" rx="17" ry="5" fill="rgba(0,6,24,.5)"/>
   <path class="mj-badge" d="M-84 8L-84 -24L-77 -34L-63 -34L-56 -24L-56 8Z"/>
   <text class="mj-num" x="-70" y="-12">${n}</text>
   <g class="mj-check" transform="translate(-56 -34) scale(.6)"><circle r="14"/><path d="M-6 0l5 5.4L7.5-5.4"/></g>
  </g>`;
}

function sceneSVG(opts){
  opts=opts||{};const id=opts.id||'mjScene';
  const rays=[-80,-60,-40,-20,0,20,40,60,80].map(a=>{const r2=34+Math.abs(a)*.2;
    return `<path d="M${BX} ${BY-27}L${BX} ${(BY-r2).toFixed(1)}" transform="rotate(${a} ${BX} ${BY})" stroke="rgba(255,226,150,.55)" stroke-width="2" stroke-linecap="round"/>`}).join('');
  return `<svg class="mj-scene" id="${id}" viewBox="0 0 ${VB_W} ${VB_H}" preserveAspectRatio="xMidYMid meet" role="group" aria-label="Five grade milestones on the way up the mountain. Choose your grade.">
  <defs>
   <linearGradient id="mjRoad" x1="0" y1="1" x2="0" y2="0"><stop offset="0" stop-color="#0a7dff"/><stop offset=".6" stop-color="#26c0ff"/><stop offset="1" stop-color="#7fd0ff"/></linearGradient>
   <radialGradient id="mjBlue" cx=".4" cy=".3" r=".8"><stop offset="0" stop-color="#2aa6ff"/><stop offset="1" stop-color="#062f86"/></radialGradient>
   <radialGradient id="mjGold" cx=".4" cy=".3" r=".8"><stop offset="0" stop-color="#ffe9a5"/><stop offset=".5" stop-color="#ffbe36"/><stop offset="1" stop-color="#a65306"/></radialGradient>
   <radialGradient id="mjDim" cx=".4" cy=".3" r=".8"><stop offset="0" stop-color="#34557f"/><stop offset="1" stop-color="#10233e"/></radialGradient>
   <linearGradient id="mjRock" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#2b5aa8"/><stop offset=".5" stop-color="#15356f"/><stop offset="1" stop-color="#0a1f4a"/></linearGradient>
   <linearGradient id="mjSnow" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#eef8ff"/><stop offset="1" stop-color="#8fbff0"/></linearGradient>
   <linearGradient id="mjCapG" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#3a3f4d"/><stop offset="1" stop-color="#0b0d14"/></linearGradient>
   <radialGradient id="mjBurst"><stop offset="0" stop-color="#ffd35b" stop-opacity=".8"/><stop offset="1" stop-color="#ffac25" stop-opacity="0"/></radialGradient>
   <filter id="mjGlowB" x="-20%" y="-20%" width="140%" height="140%"><feGaussianBlur stdDeviation="3.2" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter>
   <filter id="mjSoft"><feGaussianBlur stdDeviation="1.1"/></filter>
   <radialGradient id="mjAura" cx=".5" cy=".5" r=".5"><stop offset="0" stop-color="#9fdcff" stop-opacity=".55"/><stop offset=".45" stop-color="#3f9bff" stop-opacity=".2"/><stop offset="1" stop-color="#1a5fe0" stop-opacity="0"/></radialGradient>
   <linearGradient id="mjPeakR" gradientUnits="userSpaceOnUse" x1="0" y1="62" x2="0" y2="150"><stop offset="0" stop-color="#1b3f86"/><stop offset=".55" stop-color="#0d2a62"/><stop offset="1" stop-color="#071a45" stop-opacity="0"/></linearGradient>
   <linearGradient id="mjPeakL" gradientUnits="userSpaceOnUse" x1="0" y1="62" x2="0" y2="150"><stop offset="0" stop-color="#5a9be8"/><stop offset=".5" stop-color="#2a5fb4"/><stop offset="1" stop-color="#123a82" stop-opacity="0"/></linearGradient>
   <linearGradient id="mjSnowR" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#cfe6fb"/><stop offset="1" stop-color="#6f9fd8"/></linearGradient>
   <radialGradient id="mjMist" cx=".5" cy=".5" r=".5"><stop offset="0" stop-color="#b9d9ff" stop-opacity=".55"/><stop offset="1" stop-color="#b9d9ff" stop-opacity="0"/></radialGradient>
   <radialGradient id="mjSheen" cx=".5" cy=".5" r=".5"><stop offset="0" stop-color="#dff4ff" stop-opacity=".38"/><stop offset="1" stop-color="#dff4ff" stop-opacity="0"/></radialGradient>
   <linearGradient id="mjWall" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#0f3270"/><stop offset="1" stop-color="#061a40"/></linearGradient>
   <linearGradient id="mjBeam" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#ffffff" stop-opacity=".9"/><stop offset="1" stop-color="#7fd0ff" stop-opacity=".1"/></linearGradient>
   <radialGradient id="mjOrb" cx=".38" cy=".3" r=".8"><stop offset="0" stop-color="#3b8fe8"/><stop offset=".55" stop-color="#123f94"/><stop offset="1" stop-color="#061a45"/></radialGradient>
   <linearGradient id="mjRimG" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#dff6ff"/><stop offset=".5" stop-color="#5fc4ff"/><stop offset="1" stop-color="#ffd36b"/></linearGradient>
   <linearGradient id="mjCross" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#ffffff"/><stop offset="1" stop-color="#ffdf8a"/></linearGradient>
   <radialGradient id="mjHeroMist" cx=".5" cy=".5" r=".5"><stop offset="0" stop-color="#bfe0ff" stop-opacity=".6"/><stop offset=".6" stop-color="#6fb4ff" stop-opacity=".25"/><stop offset="1" stop-color="#3f86ff" stop-opacity="0"/></radialGradient>
   <linearGradient id="mjHeroFadeG" x1="0" y1="0" x2="0" y2="1"><stop offset=".7" stop-color="#fff"/><stop offset=".88" stop-color="#000"/></linearGradient>
   <mask id="mjHeroFade" maskUnits="objectBoundingBox" maskContentUnits="objectBoundingBox" x="-.1" y="-.1" width="1.2" height="1.2"><rect x="-.1" y="-.1" width="1.2" height="1.2" fill="url(#mjHeroFadeG)"/></mask>
   <linearGradient id="mjRibTop" gradientUnits="userSpaceOnUse" x1="0" y1="600" x2="0" y2="100"><stop offset="0" stop-color="#1c7fe0" stop-opacity=".9"/><stop offset=".55" stop-color="#3a9cf0" stop-opacity=".74"/><stop offset="1" stop-color="#9fd8ff" stop-opacity=".55"/></linearGradient>
   <linearGradient id="mjRibSide" gradientUnits="userSpaceOnUse" x1="0" y1="600" x2="0" y2="100"><stop offset="0" stop-color="#051a52" stop-opacity=".95"/><stop offset="1" stop-color="#0a2a6a" stop-opacity=".8"/></linearGradient>
   <clipPath id="mjPeakClip"><path d="${PEAK}"/></clipPath>
  </defs>
  <image class="mj-bg" href="${BG}" x="0" y="0" width="${VB_W}" height="${BG_H}" preserveAspectRatio="none"/>
  <g class="mj-summit">
   <ellipse cx="438" cy="74" rx="175" ry="84" fill="url(#mjAura)"/>
   <ellipse cx="${BX}" cy="${BY}" rx="62" ry="40" fill="url(#mjAura)"/>
   <path d="${PEAK}" fill="url(#mjPeakR)"/>
   <path d="${PEAK_L}" fill="url(#mjPeakL)"/>
   <g clip-path="url(#mjPeakClip)"><path d="${SNOW_L}" fill="url(#mjSnow)"/><path d="${SNOW_R}" fill="url(#mjSnowR)"/></g>
   <path d="${RIDGE_L}" fill="none" stroke="#cfeeff" stroke-opacity=".85" stroke-width="1.8" stroke-linejoin="round" filter="url(#mjGlowB)"/>
   <path d="M436 62L434 78L438 92L436 110" fill="none" stroke="#eaf8ff" stroke-opacity=".5" stroke-width="1.2"/>
   <ellipse cx="330" cy="130" rx="74" ry="13" fill="url(#mjMist)"/>
   <ellipse cx="550" cy="130" rx="82" ry="13" fill="url(#mjMist)"/>
   <ellipse cx="438" cy="146" rx="130" ry="14" fill="url(#mjMist)"/>
  </g>
  <g class="mj-rays"><ellipse cx="${BX}" cy="${BY}" rx="120" ry="64" fill="url(#mjBurst)"/>${rays}</g>
  <g transform="translate(${BX} ${BY})"><g class="mj-cap">
   <path d="M-6 22L6 22L10 30L-10 30Z" fill="url(#mjBeam)"/>
   <circle r="22" fill="url(#mjOrb)"/>
   <circle r="22" fill="none" stroke="url(#mjRimG)" stroke-width="2.4"/>
   <circle r="16.5" fill="none" stroke="rgba(200,235,255,.5)" stroke-width="1" stroke-dasharray="2 4"/>
   <path d="M-4 -12H4V-4H12V4H4V12H-4V4H-12V-4H-4Z" fill="url(#mjCross)" stroke="#fff" stroke-width="1.6" stroke-linejoin="round"/>
   <ellipse rx="33" ry="9" transform="rotate(-20)" fill="none" stroke="rgba(160,225,255,.65)" stroke-width="1.3"/>
   <circle cx="31" cy="-11" r="2.4" fill="#fff"/><circle cx="-31" cy="11" r="1.8" fill="#9fe0ff"/>
  </g></g>
  <g class="mj-road" aria-hidden="true">
   <path d="${RIB.poly}" transform="translate(0 9)" fill="rgba(0,6,26,.34)"/>
   <path d="${RIB.poly}" transform="translate(0 5)" fill="rgba(0,6,26,.4)"/>
   <path d="${RIB.poly}" transform="translate(0 6)" fill="url(#mjRibSide)"/>
   <path d="${RIB.poly}" fill="url(#mjRibTop)"/>
   <path d="${RIB.A}" fill="none" stroke="rgba(200,238,255,.8)" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/>
   <path d="${RIB.B}" fill="none" stroke="rgba(6,24,70,.75)" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"/>
   <path d="${ROUTE}" fill="none" stroke="rgba(220,244,255,.5)" stroke-width="1.6" stroke-dasharray="9 13" stroke-linecap="round"/>
  </g>
  <path class="mj-route-progress" id="${id}Route" d="${ROUTE}" pathLength="1000" stroke-dasharray="0 1000"/>
  <g class="mj-start" transform="translate(${START.x} ${START.y})">
   <ellipse cx="0" cy="24" rx="60" ry="14" fill="rgba(0,6,24,.5)"/>
   <ellipse cx="0" cy="13" rx="54" ry="15" fill="#08224d" stroke="#3f78b8" stroke-width="2"/>
   <ellipse cx="0" cy="8" rx="47" ry="12" fill="#16346a" stroke="#5f93cf" stroke-width="1.6"/>
   <ellipse cx="-6" cy="5" rx="30" ry="6" fill="url(#mjSheen)"/>
   <text x="0" y="48">START</text>
  </g>
  ${[1,2,3,4,5].map(nodeSVG).join('')}
  <g class="mj-hero" id="${id}Hero" transform="translate(${START.x} ${START.y})">
   <ellipse class="mj-hero-shadow" cx="0" cy="7" rx="30" ry="8"/>
   <image class="mj-hero-img" href="${JOURNEY_AVATAR}" x="-55" y="${HERO_IMG_Y}" width="110" height="120" preserveAspectRatio="xMidYMax meet" mask="url(#mjHeroFade)" aria-label="Medical student companion facing the journey"/>
   <ellipse cx="0" cy="3" rx="46" ry="12" fill="url(#mjHeroMist)"/>
  </g>
 </svg>`;
}

/* ---------------- runtime controller (one per mounted scene) ---------------- */
const CTRL={};
function mount(svg,startGrade){
  if(!svg)return null;
  const route=svg.querySelector('.mj-route-progress'),hero=svg.querySelector('.mj-hero'),img=hero.querySelector('.mj-hero-img');
  const nodes=[...svg.querySelectorAll('.mj-node')],cap=svg.querySelector('.mj-cap'),rays=svg.querySelector('.mj-rays');
  const total=route.getTotalLength();
  /* length along the route of each platform, and of the start */
  const __ck=total.toFixed(2);let L;if(Math.abs(total-1266.2007)<0.6){L=[0,164,392,668,974,1186]}else if(window.__mjLc&&window.__mjLc.k===__ck){L=window.__mjLc.v.slice()}else{L=[0];let last=0;const __xy=[];for(let l=0;l<=total;l+=2){const q=route.getPointAtLength(l);__xy.push(q.x,q.y)}for(let k=0;k<PTS.length;k++){let best=last,bd=1e9;for(let l=last;l<=total;l+=2){const j=(l>>1)*2,d=(__xy[j]-PTS[k].x)**2+(__xy[j+1]-PTS[k].y)**2;if(d<bd){bd=d;best=l}}L.push(best);last=best}window.__mjLc={k:__ck,v:L.slice()}}
  const c={svg,route,hero,img,nodes,cap,rays,total,L,pos:0,target:0,raf:0,at:0,onArrive:null,moving:false,swap:null};
  /* The companion always uses the supplied transparent PNG; only its route position changes. */
  c.setImg=()=>{if(img.getAttribute('href')!==JOURNEY_AVATAR)img.setAttribute('href',JOURNEY_AVATAR)};
  c.place=function(len){c.pos=len;const q=route.getPointAtLength(len);hero.setAttribute('transform',`translate(${q.x.toFixed(1)} ${q.y.toFixed(1)})`);route.setAttribute('stroke-dasharray',`${(len/total*1000).toFixed(1)} 1000`)};
  c.paint=function(sel,active){ /* Highlight the live position only; grade selection is not completion history. */
    nodes.forEach((el,i)=>{const n=i+1;el.classList.remove('mj-completed','mj-current','mj-upcoming');
      const cur=(active===undefined?sel:active);
      el.classList.add(cur&&n===cur?'mj-current':'mj-upcoming')});
    const done=sel===CAP_ON_GRADE&&!c.moving;cap.classList.toggle('on',done);rays.classList.toggle('on',done)};
  c.snap=function(g){c.target=g;c.at=g;c.moving=false;c.place(L[g]);c.setImg('normal');c.paint(g,g)};
  c.go=function(g){
    c.target=g;cancelAnimationFrame(c.raf);
    if(reduce()){c.snap(g);return Promise.resolve()}
    c.moving=true;svg.classList.add('mj-travel');hero.classList.add('mj-moving');
    return new Promise(res=>{let lt=performance.now(),lastNode=-1;
      const tick=now=>{const dt=Math.min(.05,(now-lt)/1000);lt=now;const goal=L[c.target];const dir=Math.sign(goal-c.pos);
        const dist=Math.abs(goal-c.pos),speed=Math.max(70,Math.min(330,dist*3.2+40));      /* ease out near the target */
        const step=Math.min(dist,speed*dt);c.place(c.pos+dir*step);
        let a=0;for(let k=1;k<=5;k++){if(c.pos>=L[k]-3)a=k}   /* node most recently reached */
        if(dir>=0&&a!==lastNode){lastNode=a;if(a>0){nodes[a-1].classList.remove('mj-pulse');void nodes[a-1].getBoundingClientRect();nodes[a-1].classList.add('mj-pulse')}}
        if(dir<0){a=0;for(let k=1;k<=5;k++){if(c.pos>=L[k]-3)a=k}}
        c.paint(c.target,a);
        const bob=Math.sin(now/90)*2.2;img.setAttribute('y',(HERO_IMG_Y+bob).toFixed(1));
        c.setImg('normal');
        if(dist-step<=.5){c.place(goal);img.setAttribute('y',String(HERO_IMG_Y));c.moving=false;c.at=c.target;hero.classList.remove('mj-moving');svg.classList.remove('mj-travel');
          c.paint(c.target,c.target);c.setImg(c.target?(c.target===5?'celebrating':'happy'):'normal');
          setTimeout(()=>{if(!c.moving&&c.target===c.at)c.setImg('normal')},2200);res();return}
        c.raf=requestAnimationFrame(tick)};
      c.raf=requestAnimationFrame(tick)})};
  c.snap(startGrade||0);
  CTRL.cur=c;return c;
}

function fit(host){
  try{
    const pc=host||document.getElementById('phoneContent');if(!pc)return;
    const scs=pc.querySelectorAll('.cp-screen');if(!scs.length)return;
    const st=pc.querySelector('.device-status');const sh=st?st.offsetHeight:0;
    const W=pc.clientWidth,H=Math.max(300,pc.clientHeight-sh);
    const uu=Math.max(2.4,Math.min(W/100,H*.0046)).toFixed(3)+'px';scs.forEach(sc=>sc.style.setProperty('--u',uu));
  }catch(e){}
}
window.cpScene={sceneSVG,mount,fit};
})();
