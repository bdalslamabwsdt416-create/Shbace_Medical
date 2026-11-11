
/* Feature flag: Report Error is paused. true = show the button, the handler and the Reported-questions page again. */
const REPORT_ERROR_ENABLED=false;
const ICON_SRC=IMG.icon;
const MASCOT_FACES={happy:'happy',sad:'sad',think:'thinking',celebrate:'celebrating',angry:'angry',encourage:'encouraging',explain:'explaining',normal:'normal'};
const docImg=n=>`src="${DOC_EMB[n]}"`;
const MASCOT_SRC=DOC_EMB.encouraging;
function docFace(n,c=''){try{const o=JSON.parse(localStorage.getItem('shbace_settings_v1')||'{}');if(o.doctor==='off')return ''}catch(e){}return `<img class="drface ${c}" ${docImg(n)} alt="Shbace doctor" draggable="false">`}
let wrongStreak=0;
const DOCF={}; /* per-question expression chosen at answer time (angry / encouraging on repeated mistakes) */
const ownerName='Dr. Abdulsalam Muhammad Abu Saada';
const ownerLine="A Palestinian Medical Student's Project";
const ownerUni='<span class="uni-l1">5th-Year Medical Student</span><span class="uni-l2">University of Tripoli · <bdi>جامعة طرابلس</bdi></span>';
let returningUser=false, mode='preview', slide=0, selectedGrade=null, demoAnswer=null, appPage='subjects', guideTab='screen', reviewRevealed=false, flashcardFlipped=false, demoSeconds=600, demoTimerHandle=null, activeDailyTip=0;
const phoneContent=document.getElementById('phoneContent');
const screenTitles=['Shbace Medical','Try a medical question','Smart Review','Timed Tests','Study Progress','Choose your grade','Your journey starts here'];
const screenHints=[
  'Clean brand intro right after the splash: the app icon in the center with sample chips (question, flashcard, timer, progress). No character image and no repeated splash text. Shown on first run only.',
  'Tap any answer. Correct becomes mint/green with a celebration; a wrong answer is gently marked, the correct answer is revealed, and the mascot reacts supportively.',
  'Give Smart Review its own focused screen: show missed/difficult questions and how the learner revisits them. Do not bundle it with unrelated tools.',
  'Give timed tests their own screen with a clear timer, question count, and a working sample Start/Pause interaction.',
  'Show study progress as a dedicated screen, with illustrative metrics clearly marked as sample data.',
  'Grade selection stays in onboarding. When a learner picks Grade 5, the mascot must visibly climb Grade 1, then 2, 3, 4, and finally 5.',
  'Finish onboarding without login or account creation, save completion and grade locally, then enter the existing app experience.'
];
function palestineFlag(extra=''){return `<svg class="${extra}" viewBox="0 0 300 180" aria-label="Subtle Palestinian flag watermark"><rect width="300" height="60" fill="#111"/><rect y="60" width="300" height="60" fill="#fff"/><rect y="120" width="300" height="60" fill="#16834a"/><path d="M0 0 L118 90 L0 180 Z" fill="#d82937"/></svg>`}
function domeSVG(cls=''){return `<svg class="${cls}" viewBox="0 0 180 140" aria-label="Faint Dome of the Rock silhouette"><path d="M18 119 H162" stroke="#d6b96a" stroke-width="2" opacity=".5"/><path d="M35 118 V86 Q90 68 145 86 V118" fill="#c9b36c" opacity=".15" stroke="#d9c37b" stroke-width="2"/><path d="M48 83 Q90 7 132 83" fill="#d8b85b" opacity=".16" stroke="#e3c56b" stroke-width="3"/><path d="M90 7 V0 M86 7 H94" stroke="#e5ca75" stroke-width="2"/><path d="M56 89 V118 M72 82 V118 M108 82 V118 M124 89 V118" stroke="#d6c17f" stroke-width="2" opacity=".32"/></svg>`}
function mascot(mood='neutral',cls='mascot'){
 const face={neutral:'normal',encourage:'encourage',happy:'happy',celebrate:'celebrate',wrong:'sad',sad:'sad',angry:'angry',thinking:'think',explaining:'explain'}[mood]||'normal';
 const marker={happy:'✓',celebrate:'★',wrong:'✕',sad:'✕',angry:'!',thinking:'…',explaining:'i'}[mood]||'•';
 const label={happy:'Happy — correct answer',celebrate:'Celebrating',wrong:'Sad — wrong answer',sad:'Sad',angry:'Mildly angry — repeated mistakes',thinking:'Thinking',encourage:'Encouraging',explaining:'Explaining'}[mood]||'Shbace Medical mascot';
 return `<span class="mascot-holder mood-${mood}" aria-label="${label}"><img class="${cls}" ${docImg(MASCOT_FACES[face])} alt="Shbace Medical doctor — ${label}"><span class="mascot-mood-badge" aria-hidden="true">${marker}</span></span>`;
}
function ecg(){return `<svg class="ecg" viewBox="0 0 320 42" preserveAspectRatio="none"><path class="base" d="M0 22 H70 L84 22 L94 13 L103 31 L114 3 L126 35 L137 22 H320"/><path class="pulse" d="M0 22 H70 L84 22 L94 13 L103 31 L114 3 L126 35 L137 22 H320"/></svg>`}
function screenShell(inner, extra=''){return `<section class="screen ${extra}">${inner}</section>`}
function dots(){return `<div class="dots">${obVisible().map(i=>`<span class="dot ${i===slide?'on':''}"></span>`).join('')}</div>`}
function footer(nextText='Next',final=false){return `<div class="screen-foot">${slide>0?'<button class="back-btn" onclick="prevSlide()" aria-label="Back">←</button>':'<span class="back-spacer"></span>'}${dots()}<button class="arrow-btn" onclick="${final?'enterAppDemo()':'nextSlide()'}" aria-label="${final?'Enter demo':'Next screen'}">${final?'↗':'→'}</button></div>`}
function splash(){return screenShell(`<div class="screen-kicker">SHBACE MEDICAL</div><div class="screen-heading">Your medical learning space.</div><p class="hero-sub">A World of Knowledge. A Future of Possibilities.</p>${ecg()}<div class="tiny">This brand artwork appears in the recurring 5-second startup splash, not as a repeated onboarding slide.</div>${footer()}`)}
function introScreen(){return screenShell(`<div class="intro-brand"><img src="${ICON_SRC}" alt=""><b>Shbace <span>Medical</span></b></div><div class="intro-stage" aria-hidden="true"><div class="chip chip-q"><small>QUESTION</small><div><i>?</i></div></div><div class="chip chip-f"><small>SMART REVIEW</small><b><svg viewBox="0 0 24 24" width="34" height="34" fill="none" stroke="#6ec3ff" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 12a8 8 0 0 1-14.2 5"/><path d="M4 12a8 8 0 0 1 14.2-5"/><path d="M18.5 3v4.5H14"/><path d="M5.5 21v-4.5H10"/></svg></b></div><span class="spark" style="left:66%;top:34%">✦</span><span class="spark" style="right:14%;top:56%;font-size:13px;animation-delay:-2s">✦</span><div class="intro-core"><img src="${ICON_SRC}" alt="Shbace Medical"></div><div class="chip chip-t"><i></i>24:18</div><div class="chip chip-p"><svg viewBox="0 0 70 70"><circle cx="35" cy="35" r="29" fill="none" stroke="#2a2c32" stroke-width="7"/><circle cx="35" cy="35" r="29" fill="none" stroke="#58d46d" stroke-width="7" stroke-linecap="round" stroke-dasharray="142 182" transform="rotate(-90 35 35)"/></svg><span>78%</span></div></div><div class="intro-title">Learn. Practice.<br>Excel.</div>${footer()}`,'intro')}
/* Reversible iOS-only design switch: false hides the legacy intro; true restores it. The original function is retained below as a backup. */
if(typeof window.SHBACE_LEGACY_INTRO_ENABLED!=='boolean')window.SHBACE_LEGACY_INTRO_ENABLED=false;
window.__SHBACE_LEGACY_INTRO_SCREEN=introScreen;
function welcome(){return screenShell(`<div class="screen-kicker">WELCOME TO SHBACE MEDICAL</div><div class="hero-title">A world of<br><span class="mint">knowledge awaits.</span></div><p class="hero-sub">Explore medical questions, understand the reasoning, review what you miss, and follow your progress — in one learning space.</p><div class="mascot-stage" style="height:270px"><div class="mascot-wrap">${mascot('neutral')}</div></div><div class="welcome-note"><b>Built with a Palestinian vision.</b><br><span class="tiny">Dr. Abdulsalam Muhammad Abu Saada · A Palestinian Medical Student's Project</span></div>${footer()}`)}
function quizDemo(){
 let mood=demoAnswer===null?'thinking':demoAnswer==='A'?'celebrate':(wrongStreak>=2?'angry':'wrong');
 let options=[['A','Radial pulse palpation'],['A','Carotid artery auscultation'],['C','Electrocardiography (ECG)'],['D','Chest X-ray']];
 return screenShell(`<div class="screen-kicker">SEE HOW LEARNING WORKS · SAMPLE 01</div><div class="screen-heading">Try a medical question.</div><p class="hero-sub">Choose an answer and watch the Shbace character react.</p><div class="question-box"><div class="question-meta"><span>CARDIOVASCULAR · SAMPLE MCQ</span><span>01 / 01</span></div><div class="question-text">What is the most common method used to assess heart rate in a conscious adult?</div><div class="options">${options.map(([letter,label])=>{let cls='option';if(demoAnswer!==null&&letter==='A')cls+=' correct';if(demoAnswer===letter&&letter!=='A')cls+=' incorrect';return `<button class="${cls}" onclick="chooseDemo('${letter}')" ${demoAnswer!==null?'disabled':''}><span class="letter">${letter}</span><span>${label}</span>${demoAnswer!==null&&letter==='A'?'<b style="margin-left:auto;color:#71e4a8">✓</b>':''}</button>`}).join('')}</div>${demoAnswer!==null?`<div class="feedback-box ${demoAnswer==='A'?'correct':'wrong'}"><b>${demoAnswer==='A'?'Correct! Well done.':'Not quite — that is how we learn.'}</b><br>${demoAnswer==='A'?'Radial pulse palpation is the quickest bedside method and needs no equipment.':'The correct answer is A · Radial pulse palpation. Shbace shows the correction and explains the reasoning.'}</div>`:''}</div><div class="reaction-row">${mascot(mood,'mascot small')}<div class="reaction-copy"><b style="color:#e8f4f6">${demoAnswer===null?'Thinking with you':demoAnswer==='A'?'Great choice!':(mood==='angry'?'Okay, a tiny grumpy moment — let’s slow down and fix it.':'Not quite — that’s okay.')}</b><br>${demoAnswer===null?'The mascot thinks along with you while you decide.':demoAnswer==='A'?'A short celebration, then the explanation.':(mood==='angry'?'Repeated mistakes make the mascot mildly angry in a playful way, then it helps you review.':'The mascot looks sad for a moment, then shows the correct answer and why.')}</div></div><div class="screen-foot">${dots()}${demoAnswer===null?'<span class="tiny">SELECT AN ANSWER · C · D</span>':`<div style="display:flex;gap:6px;align-items:center"><button class="secondary-btn" onclick="resetDemoQuestion()">Try again</button><button class="primary-btn" onclick="nextSlide()">See explanation →</button></div>`}</div>`)
}
function smartReviewScreen(){return screenShell(`<div class="screen-kicker">SMART REVIEW</div><div class="screen-heading">Make every mistake count.</div><p class="hero-sub">Your difficult and missed questions return when they are ready to be reviewed.</p><div class="feature-showcase"><div class="feature-orbit">↻</div><h3>Review what matters.</h3><p>Revisit difficult questions, rate how well you remember them, and build a stronger memory over time.</p><div class="feature-mini-row"><span>Again</span><span>Hard</span><span>Good</span><span>Easy</span></div></div><div class="app-card"><div class="eyebrow">SAMPLE REVIEW QUEUE</div><b>3 questions ready to revisit</b><p>Due today · Difficult topics · Previous mistakes</p><button class="secondary-btn" onclick="showReviewSample(this)">Preview a review card</button><div id="reviewSample" class="tiny" style="margin-top:8px;display:none">Sample card: Which nerve travels in the spiral groove of the humerus? · Reveal answer, then rate Again / Hard / Good / Easy.</div></div>${footer()}`)}
function timedTestScreen(){return screenShell(`<div class="screen-kicker">TIMED TESTS</div><div class="screen-heading">Practice under time.</div><p class="hero-sub">Build a timed quiz, keep an eye on the clock, and review your result at the end.</p><div class="timer-demo"><div><strong id="demoTimerText">10:00</strong><small>TIME LEFT</small></div></div><div class="app-card"><div class="question-meta"><span>MEDICAL MOCK TEST</span><span>20 QUESTIONS</span></div><p>Set a time limit, answer at your own pace, and submit when you're ready.</p><div class="meter"><span style="width:35%"></span></div><button class="primary-btn" id="timerDemoButton" style="width:100%" onclick="toggleDemoTimer()">Start sample timer</button><p class="tiny" id="timerDemoStatus" style="text-align:center;margin-top:8px">Illustrative timer only — it does not affect real quiz history.</p></div>${footer()}`)}
function questionBankScreen(){return screenShell(`<div class="screen-kicker">QUESTION BANK</div><div class="screen-heading">Find the question you need.</div><p class="hero-sub">Browse subjects and topics, search question text, and filter your practice.</p><div class="app-card"><div class="eyebrow">SEARCH THE BANK</div><div style="display:flex;gap:7px;align-items:center;margin:10px 0"><div style="flex:1;border:1px solid #315168;background:#0a1a29;padding:11px;border-radius:11px;color:#8ba5b4;font-size:10px">⌕ Search questions, options, explanations…</div><span class="pill">Filter</span></div><div class="feature-mini-row" style="justify-content:flex-start"><span>All</span><span>Unanswered</span><span>Correct</span><span>Incorrect</span><span>Saved</span></div><div class="question-box" style="margin-top:12px"><div class="question-meta"><span>PEDIATRICS · SAMPLE</span><span>12 / —</span></div><b style="font-size:12px">A child presents with fever and a sore throat. Which finding is most suggestive of a bacterial cause?</b><p class="tiny">A sample question card to demonstrate search and filtering. Actual content must come from the production bank.</p></div></div><div class="tiny">The live Question Bank already exists in the supplied production HTML. Keep its search, filters, navigation, and answer-key logic unchanged.</div>${footer()}`)}
function progressScreen(){return screenShell(`<div class="screen-kicker">STUDY PROGRESS</div><div class="screen-heading">See how far you've come.</div><p class="hero-sub">A clear view of your study activity, accuracy, and progress by topic.</p><div class="feature-showcase" style="min-height:230px"><div class="progress-ring"></div><h3>Your progress, at a glance.</h3><p>Track answered questions, accuracy, completed topics, and areas that need more practice.</p><div class="feature-mini-row"><span>Answered</span><span>Accuracy</span><span>Topics</span></div></div><div class="app-stat-grid"><div class="app-stat"><strong>120</strong><small>Sample answered</small></div><div class="app-stat"><strong>82%</strong><small>Sample accuracy</small></div><div class="app-stat"><strong>6</strong><small>Sample topics</small></div></div><div class="tiny">Illustrative values only. The production app must bind these to existing saved statistics.</div>${footer()}`)}
function showReviewSample(btn){const el=document.getElementById('reviewSample');if(el){el.style.display=el.style.display==='none'?'block':'none';btn.textContent=el.style.display==='none'?'Preview a review card':'Hide sample card';}}
function toggleDemoTimer(){if(demoTimerHandle){clearInterval(demoTimerHandle);demoTimerHandle=null;const b=document.getElementById('timerDemoButton');if(b)b.textContent='Resume sample timer';const st=document.getElementById('timerDemoStatus');if(st)st.textContent='Timer paused. Sample only.';return;}const b=document.getElementById('timerDemoButton');if(b)b.textContent='Pause sample timer';const st=document.getElementById('timerDemoStatus');if(st)st.textContent='Running sample timer…';demoTimerHandle=setInterval(()=>{demoSeconds=Math.max(0,demoSeconds-1);const el=document.getElementById('demoTimerText');if(el)el.textContent=String(Math.floor(demoSeconds/60)).padStart(2,'0')+':'+String(demoSeconds%60).padStart(2,'0');if(demoSeconds<=0){clearInterval(demoTimerHandle);demoTimerHandle=null;if(b)b.textContent='Restart sample timer';if(st)st.textContent='Time is up — sample timer completed.';}},1000);}
function flipFlashcard(){return;}

const GRADE_SUBJECTS={1:['Anatomy I','Physiology I','Biochemistry I','Histology I'],2:['Anatomy II','Physiology II','Biochemistry II','Histology II'],3:['Pathology','Pharmacology','Microbiology & Immunology','Parasitology'],4:['Gynecology & Obstetrics','Ophthalmology','Community Medicine','Forensic Medicine & Toxicology'],5:['Pediatrics','Internal Medicine','Surgery']};
function gradeSubjectsHTML(n){if(!n)return '<p>Pick your year to see the subjects that belong to it.</p>';const l=GRADE_SUBJECTS[n];return `<b>GRADE ${n} SUBJECTS</b>`+(l?l.map(x=>`<span class="gs">${x}</span>`).join(''):`<p>Subjects for this year will appear here once they are added to the Question Bank.</p>`)}
function gradeSubjectsBlock(){return `<div class="gs-box" id="gradeSubjects">${gradeSubjectsHTML(selectedGrade)}</div>`}
function updateGradeSubjects(){const el=document.getElementById('gradeSubjects');if(el)el.innerHTML=gradeSubjectsHTML(selectedGrade)}
function gradeScreen(){let x=10;let y=12;return screenShell(`<div class="screen-kicker">MAKE IT YOUR LEARNING SPACE</div><div class="screen-heading">Which grade are you in?</div><p class="hero-sub">Choose your current study year. The character climbs Grade 1, then Grade 2, and continues one step at a time.</p><div class="grade-stage" id="gradeStage" style="--gx:${x}%;--gy:${y}px"><div class="stairs">${[1,2,3,4,5].map(n=>`<button class="step ${selectedGrade===n?'active':''}" onclick="selectGrade(${n})" aria-label="Select Grade ${n}"><b>${n}</b><small>GRADE</small></button>`).join('')}</div><div class="grade-avatar" id="gradeAvatar">${mascot('neutral','mascot')}</div></div>${gradeSubjectsBlock()}<div class="grade-hint">${selectedGrade?`Grade ${selectedGrade} selected · You can change it later.`:'Choose your current study year to continue.'}</div><div class="screen-foot">${dots()}<button class="primary-btn" onclick="nextSlide()" ${selectedGrade===null?'disabled':''}>Continue →</button></div>`)}
function featureTour(){return screenShell(`<div class="screen-kicker">YOUR MEDICAL TOOLKIT</div><div class="screen-heading">Everything has its place.</div><p class="hero-sub">Each tool has its own focused space. No crowded screens, no repeated feature posters.</p><div class="tool-cards"><div class="tool-card"><div class="tool-ico">▤</div><b>Question Bank</b><small>Browse subjects, topics, and questions.</small></div><div class="tool-card"><div class="tool-ico">↻</div><b>Smart Review</b><small>Revisit difficult questions.</small></div><div class="tool-card"><div class="tool-ico">◷</div><b>Timed Tests</b><small>Practice against the clock.</small></div><div class="tool-card"><div class="tool-ico">▣</div><b>Question Bank</b><small>Search, filter, and practice.</small></div><div class="tool-card"><div class="tool-ico">▥</div><b>Study Progress</b><small>Track activity and accuracy.</small></div><div class="tool-card"><div class="tool-ico">☆</div><b>Saved & Wrong</b><small>Keep key questions for later.</small></div></div><div class="callout" style="font-size:10px">No accounts or sign-in. Your existing offline-first app remains the source of truth for saved study data.</div>${footer()}`)}
const CP_JOURNEY_ART='/assets/img/62a732b97cb4.png';
function finishScreen(){
 const g=Math.max(0,Math.min(5,Number(selectedGrade)||0));
 const ICON_CAP='<svg viewBox="0 0 64 64" aria-hidden="true"><path d="M32 12 5 25l27 13 27-13z" fill="#5fb8ff" stroke="#a9e0ff" stroke-width="2" stroke-linejoin="round"/><path d="M15 33v12c0 5 8.5 9 17 9s17-4 17-9V33l-17 8z" fill="#2f86e8" stroke="#a9e0ff" stroke-width="2" stroke-linejoin="round"/><path d="M59 25v17" stroke="#a9e0ff" stroke-width="3" stroke-linecap="round"/><circle cx="59" cy="46" r="3" fill="#a9e0ff"/></svg>';
 const ICON_BOOK='<svg viewBox="0 0 48 48" aria-hidden="true" fill="none" stroke="#7fc9ff" stroke-width="2.6" stroke-linejoin="round" stroke-linecap="round"><path d="M24 12c-4-3-10-4-18-4v28c8 0 14 1 18 4 4-3 10-4 18-4V8c-8 0-14 1-18 4z"/><path d="M24 12v28"/></svg>';
 const ICON_TARGET='<svg viewBox="0 0 48 48" aria-hidden="true" fill="none" stroke="#7fc9ff" stroke-width="2.6" stroke-linecap="round"><circle cx="21" cy="27" r="16"/><circle cx="21" cy="27" r="9.5"/><circle cx="21" cy="27" r="3.2" fill="#7fc9ff"/><path d="M21 27 38 10"/><path d="M33 8v7h7"/></svg>';
 const ICON_TROPHY='<svg viewBox="0 0 48 48" aria-hidden="true" fill="none" stroke-linejoin="round" stroke-linecap="round"><path d="M14 6h20v14c0 7-4.5 11-10 11S14 27 14 20z" fill="#f7bf3b" stroke="#ffe08a" stroke-width="2"/><path d="M14 10H6c0 8 3 12 8 13M34 10h8c0 8-3 12-8 13" stroke="#f0b52f" stroke-width="3"/><path d="M24 31v7M16 42h16M18 38h12" stroke="#ffd25e" stroke-width="3.2"/></svg>';
 const ICON_CHEV='<svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="#fff" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"><path d="M9 4l8 8-8 8"/></svg>';
 const scene=`<div class="cp-art-frame"><div class="cp-art-inner"><img src="${CP_JOURNEY_ART}" alt="Five grade platforms climbing to the medical tower" decoding="async" draggable="false">${[1,2,3,4,5].map(n=>`<i class="cp-art-glow g${n}${n<g?' lit':''}${n===g?' on':''}" style="--d:${(n*.2).toFixed(2)}s" aria-hidden="true"></i>`).join('')}${[1,2,3,4,5].map(n=>`<button type="button" class="cp-art-hit h${n}" onclick="cpPickGrade(${n})" aria-label="Grade ${n}"></button>`).join('')}</div></div>`;
 return screenShell(`${returningUser?'':'<button type="button" class="cp-back" onclick="prevSlide()" aria-label="Back">←</button>'}<div class="cp-finish-layout">
  <div class="screen-kicker cp-finish-kicker">THE MEDICAL JOURNEY</div>
  <div class="cp-scene-wrap cp-art">${scene}</div>
  <div class="cp-welcome">
   <h1 class="hero-title">Every Great <span class="cp-doc">Doctor</span><br>Starts Somewhere.</h1>
   <div class="cp-ecg" aria-hidden="true"><i></i><svg viewBox="0 0 60 30"><path d="M2 15h14l5-11 8 23 6-12h23" fill="none" stroke="#5fc9ff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg><i></i></div>
   <p class="hero-sub">\u201CYour journey begins with knowledge.<br>Your future is built with every step.</p>
   <div class="cp-grade-badge"><span class="cp-cap-ico">${ICON_CAP}</span><span class="cp-grade-sep"></span><span class="cp-grade-txt"><b class="cp-grade-num">${g?`GRADE ${g}`:'YOUR JOURNEY'}</b><small>YOUR CURRENT LEVEL</small></span></div>
  </div>
 </div>
 <div class="screen-foot cp-finish-foot" style="margin-top:auto"><button type="button" class="primary-btn" onclick="enterAppDemo()">Begin My Journey <span aria-hidden="true">${ICON_CHEV}</span></button><div class="cp-tagline"><i></i><span>YOUR FUTURE STARTS WITH THE NEXT STEP</span><i></i></div></div>`,'cp-screen');
}

/* Mount the completion scene: the character stands on the grade chosen on the stairs screen (read-only here). */
function cpPickGrade(n){
 n=Math.max(1,Math.min(5,Number(n)||0));if(!n)return;selectedGrade=n;
 document.querySelectorAll('.cp-art-glow').forEach((el,i)=>{el.classList.toggle('lit',i+1<n);el.classList.toggle('on',i+1===n)});
 const num=document.querySelector('.cp-grade-num');if(num)num.textContent='GRADE '+n;
}
function cpMountFinish(){
 const host=document.getElementById('phoneContent');if(!host||!window.cpScene)return;
 window.cpScene.fit(host);
 const svg=host.querySelector('.cp-screen .mj-scene');if(!svg)return;
 const g=Math.max(0,Math.min(5,Number(selectedGrade)||0));
 window.cpScene.mount(svg,g);
}
function renderSlide(){if(mode!=='preview')return;const firstIntro=(window.SHBACE_LEGACY_INTRO_ENABLED===true&&window.__SHBACE_LEGACY_INTRO_SCREEN)?window.__SHBACE_LEGACY_INTRO_SCREEN:introScreen;const renders=[firstIntro,quizDemo,smartReviewScreen,timedTestScreen,progressScreen,gradeScreen,finishScreen];phoneContent.innerHTML=`<div class="device-status"><span>9:41</span><span>● ● ● ▰</span></div>${renders[slide]()}`;document.getElementById('previewCount').textContent=String(slide+1).padStart(2,'0')+' / '+String(screenTitles.length).padStart(2,'0');document.getElementById('previewLabel').textContent='INTERACTIVE ONBOARDING · '+screenTitles[slide].toUpperCase();renderGuide()}
function nextSlide(){const n=obNb(1);if(n>=0){slide=n;renderSlide()}else enterAppDemo()}
function prevSlide(){const p=obNb(-1);if(p>=0){slide=p;renderSlide()}}
function chooseDemo(letter){demoAnswer=letter;if(letter==='A'){wrongStreak=0;}else{wrongStreak++;}renderSlide();}
function resetDemoQuestion(){demoAnswer=null;renderSlide();}
let gradeAnimationToken=0;
function wait(ms){return new Promise(resolve=>setTimeout(resolve,ms));}
async function selectGrade(n){
 const token=++gradeAnimationToken;selectedGrade=n;
 const stage=document.getElementById('gradeStage');if(!stage){renderSlide();return;}
 const heights=[62,94,126,158,190];const x=[10,30,50,70,90];
 const hint=document.querySelector('.grade-hint');const continueBtn=document.querySelector('.screen-foot .primary-btn');
 if(continueBtn)continueBtn.disabled=true;
 document.querySelectorAll('.grade-select').forEach(el=>el.disabled=true);
 document.querySelectorAll('.step').forEach(el=>el.classList.remove('active'));
 stage.classList.add('climbing');stage.style.setProperty('--gx','10%');stage.style.setProperty('--gy','12px');
 if(hint)hint.textContent=`Starting the climb to Grade ${n}…`;
 for(let i=1;i<=n;i++){
   if(token!==gradeAnimationToken)return;
   stage.style.setProperty('--gx',x[i-1]+'%');stage.style.setProperty('--gy',heights[i-1]+'px');
   document.querySelectorAll('.step').forEach((el,j)=>el.classList.toggle('active',j===i-1));
   document.querySelectorAll('.grade-select').forEach((el,j)=>el.classList.toggle('active',j===i-1));
   if(hint)hint.textContent=`Climbing… Grade ${i} of ${n}`;
   await wait(window.matchMedia('(prefers-reduced-motion: reduce)').matches?40:620);
 }
 if(token!==gradeAnimationToken)return;
 if(hint)hint.textContent=`You reached Grade ${n}. Your study space is ready.`;updateGradeSubjects();
 if(continueBtn)continueBtn.disabled=false;
 document.querySelectorAll('.grade-select').forEach(el=>el.disabled=false);
 stage.classList.remove('climbing');
}

function enterAppDemo(){if(!onboardingDone()&&!(mode==='preview'&&slide===screenTitles.length-1))return; /* never mark complete before the last step */ markOnboardingDone();obReplay=false;try{if(selectedGrade)localStorage.setItem('shbace_onboarding_v3_grade',String(selectedGrade));}catch(e){} mode='app';appPage='subjects';setModeUI();renderAppDemo()}
function setModeUI(){if(mode==='app'&&!onboardingDone())mode='preview';else if(mode==='preview'&&onboardingDone()&&!obReplay)mode='app';document.querySelectorAll('.rail [data-mode]').forEach(b=>b.classList.toggle('active',b.dataset.mode===mode));document.getElementById('previewView').classList.toggle('hide',!['preview','app'].includes(mode));document.getElementById('docView').classList.toggle('show',['decisions','preserve','build'].includes(mode));document.getElementById('previewLabel').textContent=mode==='app'?'INSIDE SHBACE MEDICAL':mode==='preview'?'INTERACTIVE ONBOARDING':mode.toUpperCase();document.getElementById('previewCount').textContent=mode==='preview'?String(slide+1).padStart(2,'0')+' / '+String(screenTitles.length).padStart(2,'0'):mode==='app'?'LIVE UI TOUR':'HANDOFF NOTES';renderGuide();if(!splashHolding()||splashPre){if(mode==='preview')renderSlide();if(mode==='app')renderAppDemo()}if(['decisions','preserve','build'].includes(mode))renderDoc()}
function appHeader(label){return `<div class="phone-appbar"><b>Shbace <span style="color:var(--mint)">Medical</span></b><span>03 · ${label}</span></div>`}
function appNav(){let items=[['subjects','⌂','Home'],['questions','▤','Bank'],['quiz','✓','Quiz'],['review','◷','Review'],['stats','▥','Stats']];return `<div class="app-nav">${items.map(([id,ico,name])=>`<button class="${appPage===id?'active':''}" onclick="appPage='${id}';renderAppDemo()">${ico}<br>${name}</button>`).join('')}</div>`}
function subjectsView(){const tips=[['CLINICAL PEARL','A structured review of missed questions helps turn uncertainty into stronger recall.'],['QUICK REMINDER','When reviewing an MCQ, ask why each distractor is wrong — not only why the key is right.'],['STUDY SMARTER','Short, focused practice sessions can make it easier to spot weak topics.'],['TODAY’S CHALLENGE','Choose one difficult topic and revisit it after answering a few new questions.'],['MEDICAL THINKING','Look for the mechanism behind a clinical finding; it often explains the answer.']];const tip=tips[activeDailyTip%tips.length];return `${appHeader('Home')}<div class="screen-kicker">WELCOME BACK</div><div class="screen-heading">Your learning space.</div><div class="daily-mentor"><img src="${MASCOT_SRC}" alt="Shbace Medical mascot"><div><div class="daily-tag">${tip[0]}</div><b>Good to see you again.</b><p>${tip[1]}</p></div></div><div class="daily-challenge"><div class="eyebrow">QUICK DAILY CHALLENGE</div><b>What is the best way to learn from a wrong answer?</b><div class="options" style="margin-top:8px"><button class="option" onclick="this.classList.add('incorrect');document.getElementById('dailyFeedback').textContent='Try again: look at the reasoning behind every option.'"><span class="letter">A</span><span>Memorize the letter only</span></button><button class="option" onclick="this.classList.add('correct');document.getElementById('dailyFeedback').textContent='Exactly. Understand why the key is right and why the other choices are wrong.'"><span class="letter">B</span><span>Understand the key and the distractors</span></button></div><div id="dailyFeedback" class="tiny" style="margin-top:7px"></div></div><div class="app-stat-grid"><div class="app-stat"><strong>—</strong><small>Answered</small></div><div class="app-stat"><strong>—%</strong><small>Accuracy</small></div><div class="app-stat"><strong>—</strong><small>Topics</small></div></div><div class="app-card"><div class="eyebrow">AVAILABLE SUBJECT</div><h3 style="font-size:16px">Pediatrics</h3><p>Question count and completion are loaded dynamically from the existing bank — never hard-coded in the redesign.</p><div class="meter"><span style="width:36%"></span></div><button class="primary-btn" style="width:100%" onclick="appPage='specialties';renderAppDemo()">Open Pediatrics →</button></div><div class="app-card"><h3>Specialties</h3><p>Endocrinology · Available</p><p>Nephrology · Coming soon when content is added</p><p>Urology · Coming soon when content is added</p></div><button class="secondary-btn" onclick="appPage='menu';renderAppDemo()">Open full navigation menu</button>`}
function specialtiesView(){return `${appHeader('Pediatrics')}<div class="screen-heading">Choose a specialty.</div><div class="app-card"><div class="eyebrow">AVAILABLE NOW</div><h3>Endocrinology</h3><p>Topics, counts, and progress come from real bank data.</p><button class="primary-btn" onclick="appPage='topics';renderAppDemo()">View topics →</button></div><div class="app-card"><h3>Nephrology</h3><p>Future specialty · Content not loaded yet.</p></div><div class="app-card"><h3>Urology</h3><p>Future specialty · Content not loaded yet.</p></div>`}
function topicsView(){return `${appHeader('Endocrinology')}<div class="screen-heading">Choose a topic.</div>${['Topic 01 · Example topic','Topic 02 · Example topic','Topic 03 · Example topic','All questions'].map((t,i)=>`<div class="app-card" style="display:flex;justify-content:space-between;align-items:center"><div><b style="font-size:11px">${t}</b><p>Dynamic question count · topic completion</p></div><button class="secondary-btn" onclick="appPage='questions';renderAppDemo()">Open →</button></div>`).join('')}`}
function questionBankView(){return `${appHeader('Question Bank')}<div class="demo-quiz-toolbar"><span>ENDOCRINOLOGY · TOPIC</span><span>QUESTION 12</span></div><input style="width:100%;padding:10px;border-radius:10px;background:#0c1a27;color:#d7e6ec;border:1px solid #2a485c" placeholder="Search question text…"><div style="display:flex;gap:5px;flex-wrap:wrap;margin:9px 0">${['All','Unanswered','Correct','Incorrect','Bookmarked'].map(t=>`<span class="pill">${t}</span>`).join('')}</div><div class="question-box"><div class="question-text">Wrist drop after a humerus shaft fracture. Which nerve is injured?</div><div class="options">${[['A','Median nerve'],['B','Radial nerve'],['C','Ulnar nerve'],['D','Axillary nerve']].map(([a,b])=>`<button class="option" onclick="this.classList.add('${a==='B'?'correct':'incorrect'}')"><span class="letter">${a}</span>${b}</button>`).join('')}</div><div class="feedback-box correct">Correct answer and explanation appear according to the real question data and answer-key status.</div></div><div style="display:flex;gap:6px;flex-wrap:wrap"><button class="secondary-btn">☆ Save</button><button class="secondary-btn">✎ Note</button><button class="secondary-btn">⚑ Report</button><button class="secondary-btn">Export PDF</button></div>`}
function quizView(){return `${appHeader('Quiz Mode')}<div class="screen-heading">Build a practice quiz.</div><div class="app-card"><label class="tiny">QUESTION SCOPE</label><p>All questions · Selected topics · Custom count</p><label class="tiny">QUIZ TYPE</label><p>Practice (no timer) · Timed</p><label class="tiny">FEEDBACK TIMING</label><p>Instant feedback · End-of-quiz review</p><label class="tiny">QUESTION ORDER</label><p>Random · Original bank order</p><label class="tiny">TIME LIMIT</label><p>Automatic or custom duration</p><button class="primary-btn" onclick="appPage='quizrun';renderAppDemo()">Start demo quiz →</button></div>`}
function quizRunView(){return `${appHeader('Quiz in progress')}<div class="demo-quiz-toolbar"><span>QUESTION 1 / 20</span><b style="color:var(--mint)">PRACTICE</b></div><div class="meter"><span style="width:5%"></span></div><div class="question-box"><div class="question-text">Which nerve is most commonly affected in a midshaft humeral fracture?</div><div class="options">${[['A','Median'],['B','Radial'],['C','Ulnar'],['D','Axillary']].map(([a,b])=>`<button class="option" onclick="this.classList.add('${a==='B'?'correct':'incorrect'}')"><span class="letter">${a}</span>${b} nerve</button>`).join('')}</div></div><div class="app-card"><p>Instant feedback or review all answers at the end. Mark questions for later review.</p><button class="secondary-btn">Mark for review</button></div><button class="primary-btn" onclick="appPage='quizresult';renderAppDemo()">Submit demo quiz</button>`}
function quizResultView(){return `${appHeader('Quiz result')}<div class="app-card" style="text-align:center;padding:22px"><div class="eyebrow">DEMO FINAL SCORE</div><div style="font-size:46px;font-weight:900;color:var(--mint)">80%</div><p>16 correct · 4 incorrect · 0 unanswered</p></div><div class="app-card"><h3>Review your answers</h3><p>Incorrect and unanswered questions are listed with the correct key and explanation.</p><button class="secondary-btn" onclick="appPage='questions';renderAppDemo()">Review questions</button></div>`}
function reviewView(){return `${appHeader('Smart Review')}<div class="screen-kicker">SPACED REVIEW</div><div class="screen-heading">Bring back what matters.</div><div class="app-card" style="min-height:220px;display:flex;flex-direction:column;justify-content:center;text-align:center"><span class="eyebrow">QUESTION CARD</span><h3 style="font-size:16px;margin:14px 0">What is the nerve root value of the radial nerve?</h3>${reviewRevealed?'<div class="feedback-box correct">C5–T1 · From the posterior cord of the brachial plexus.</div>':'<button class="primary-btn" onclick="reviewRevealed=true;renderAppDemo()">Show answer</button>'}</div>${reviewRevealed?`<div class="schedule-row">${['Again','Hard','Good','Easy'].map((x,i)=>`<button onclick="reviewRevealed=false;renderAppDemo()">${x}<br><small>${['1 min','6 min','1 day','4 days'][i]}</small></button>`).join('')}</div>`:'<p class="tiny">Rate recall after revealing the answer. The actual schedule is handled by the existing Smart Review engine.</p>'}`}
function statsView(){return `${appHeader('Study Statistics')}<div class="screen-heading">Your progress.</div><div class="app-stat-grid"><div class="app-stat"><strong>—%</strong><small>Accuracy</small></div><div class="app-stat"><strong>—</strong><small>Answered</small></div><div class="app-stat"><strong>—</strong><small>Streak</small></div></div><div class="app-card"><h3>Topic performance</h3><div class="bar-chart"><i style="height:32%"></i><i style="height:56%"></i><i style="height:40%"></i><i style="height:76%"></i><i style="height:61%"></i><i style="height:88%"></i></div><p>Accuracy and completion are derived from saved attempts, excluding questions with unverified keys from accuracy.</p></div><div class="app-card"><h3>Study insights</h3><p>Strongest topic · Topic needing review · Quiz history · Mistakes fixed.</p></div>`}
function menuView(){return `${appHeader('Navigation')}<div class="screen-heading">Your learning space.</div><div class="menu-list"><div class="menu-group">LEARNING</div>${['Subjects','Question Bank','Quiz Mode','Global Search'].map(x=>`<div class="menu-item"><span>${x}</span><span>›</span></div>`).join('')}<div class="menu-group">REVIEW</div>${['Saved Questions','Wrong Answers','Smart Review','Reported Questions'].map(x=>`<div class="menu-item"><span>${x}</span><span>›</span></div>`).join('')}<div class="menu-group">ANALYTICS & TOPICS</div>${['Study Statistics','Pinned & Recent Topics'].map(x=>`<div class="menu-item"><span>${x}</span><span>›</span></div>`).join('')}<div class="menu-group">ACCOUNT & HELP</div>${['Notifications','Changelog','About','Contact & Feedback','Rate This Website','Settings · Theme · Updates · Backup'].map(x=>`<div class="menu-item"><span>${x}</span><span>›</span></div>`).join('')}</div>`}
function renderAppDemo(){if(mode!=='app')return;document.getElementById('previewLabel').textContent='INSIDE THE APP · '+appPage.toUpperCase();document.getElementById('previewCount').textContent='UI TOUR';let body=appPage==='subjects'?subjectsView():appPage==='specialties'?specialtiesView():appPage==='topics'?topicsView():appPage==='questions'?questionBankView():appPage==='quiz'?quizView():appPage==='quizrun'?quizRunView():appPage==='quizresult'?quizResultView():appPage==='review'?reviewView():appPage==='stats'?statsView():appPage==='search'?searchView():menuView();phoneContent.innerHTML=`<div class="device-status"><span>9:41</span><span>● ● ● ▰</span></div><section class="screen" style="padding-top:11px;padding-bottom:10px">${body}${appNav()}</section>`;renderGuide()}
function renderGuide(){const box=document.getElementById('guideContent');document.querySelectorAll('[data-guide]').forEach(b=>b.classList.toggle('active',b.dataset.guide===guideTab));if(guideTab==='screen'){let text=mode==='preview'?screenHints[slide]:mode==='app'?'This is a UI tour, not the real question bank. All counts, topic names, quiz results, and progress must be connected to the existing data and state when the redesign is integrated.':'Choose a handoff section from the left navigation.';box.innerHTML=`<div class="eyebrow">DESIGN INTENT</div><h2>${mode==='preview'?screenTitles[slide]:mode==='app'?'Inside Shbace Medical':'Project handoff'}</h2><p>${text}</p><div class="callout"><b>Keep the agreed identity:</b><br>Deep navy / black, mint-teal glow, white text, the supplied original app icon, and small rhythmic ECG accents.</div><div class="callout"><b>Mascot asset note:</b> The recurring splash poster is intentionally a full composition. Use the separate mascot reference only for character styling; it is not a final clean production cutout. The next AI should prepare a clean transparent mascot and consistent expression poses, with no flag, Dome, text, poster badges, or staircase baked into it.</div><h3>Current controls</h3><p>${mode==='preview'?slide===1?'Tap any answer. The question is replaced by its explanation in the same box, and the doctor appears only after answering.':slide===5?'Select Grade 1–5. The mascot climbs every step in order before Continue unlocks.':'Use Next / Back and the dots to move through the onboarding.': 'Use the bottom navigation to browse the visual app tour.'}</p><div class="mini-list"><span>Mobile-first</span><span>RTL-ready layout</span><span>Reduced-motion aware</span><span>No login screen</span></div>`}
 else if(guideTab==='logic'){box.innerHTML=`<div class="eyebrow">INTERACTION LOGIC</div><h2>Small details make it feel alive.</h2><ul><li><b>ECG:</b> use a refined glowing waveform that pulses in a calm heartbeat rhythm. Do not add a separate red heart sticker or shake the whole screen.</li><li><b>Correct answer:</b> selected option turns mint/green, success feedback appears, mascot celebrates briefly.</li><li><b>Wrong answer:</b> selected option turns soft red, correct answer is revealed in green, mascot looks mildly disappointed (not furious or shaming) then encourages the learner.</li><li><b>Thinking:</b> during explanation the mascot uses a thoughtful expression.</li><li><b>Grade selection:</b> mascot climbs to the exact selected step; highlight and checkmark update; Continue appears after selection.</li><li><b>Haptics:</b> optional light vibration only on a deliberate tap and only where supported. Default should be off; respect reduced-motion and device settings.</li><li><b>Demo isolation:</b> onboarding sample answers must never change real bank answers, quiz history, Smart Review, statistics, notes, or localStorage records.</li></ul><div class="warn">Do not make wrong-answer feedback insulting, angry, or punitive. It should be playful, supportive, and educational.</div>`}
 else{box.innerHTML=`<div class="eyebrow">HANDOFF FOR THE NEXT AI</div><h2>Give the next AI the whole picture.</h2><p>Send this standalone HTML together with the exact production HTML used by the APK. Ask the next AI to inspect the real app before changing it.</p><div class="callout">This file is an interactive design prototype and a requirements brief. It is not the live app, does not contain the real question bank, and must never replace the real storage or quiz engine.</div><h3>Copy-ready instruction</h3><textarea id="handoffPrompt" class="code-note" readonly style="width:100%;min-height:245px;resize:vertical;color:#c7e1e8;background:#06121d"></textarea><div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap;margin-top:9px"><button class="copy-btn" onclick="copyHandoff()">Copy full AI handoff prompt</button><span class="tiny">The text is visible here too, so it can be selected manually.</span></div><h3>Suggested integration order</h3><ol><li>Audit current production HTML, data schema, localStorage key, and Capacitor update flow.</li><li>Make a function-by-function inventory and backup before edits.</li><li>Implement onboarding as a separate module and isolate demo answers from real state.</li><li>Apply the design system to existing screens without changing business logic.</li><li>Run regression tests for every feature in the Preserve Functions checklist.</li></ol>`;const promptBox=document.getElementById('handoffPrompt');if(promptBox)promptBox.value=getHandoffPrompt();}}
function renderDoc(){let d=document.getElementById('docView');if(mode==='decisions'){d.innerHTML=`<div class="doc-hero"><span class="pill">AGREED DESIGN DECISIONS</span><h2>One identity, from first launch to every question.</h2><p>These decisions came from the discussion with the project owner. Treat them as approved unless the owner changes them.</p></div><div class="decision"><div class="approved"><b class="good">APPROVED</b><ul><li>Full visual redesign while preserving existing functions and data.</li><li>Original supplied Shbace Medical icon is the master brand reference.</li><li>Palette: deep navy / black, mint-teal, white; blue only as a restrained secondary accent.</li><li>Tagline exactly: “A World of Knowledge. A Future of Possibilities.”</li><li>Owner credit on the recurring five-second splash: “Dr. Abdulsalam Muhammad Abu Saada” and “A Palestinian Medical Student's Project”.</li><li>Palestinian flag in background only, correct four colours and red triangle, very transparent.</li><li>Dome of the Rock as a small, very faint background silhouette only.</li><li>The splash poster is a full composition with no staircase or small climbing figure. The Grade staircase exists only as interface UI and the movable mascot must be a separate image asset.</li><li>Next AI should refine the same character into a clearer stylized 3D mascot while preserving the owner’s likeness; do not replace it with a generic or bald character.</li><li>Dark navy scrubs and visible stethoscope around the neck.</li><li>Shbace logo on sleeve; heart anatomy + ECG + small surgical scalpel on chest pocket, symbolizing aspiration to become a cardiac surgeon.</li><li>Clinicoid-inspired onboarding structure and micro-interactions, not a copy of its brand or assets.</li><li>Question demo showing correct / incorrect states and mascot reactions.</li><li>Grade 1–5 staircase: mascot climbs to selected grade then Continue.</li><li>Refined ECG waveform with a subtle moving heartbeat glow; no separate red heart sticker.</li><li>No account system: user explicitly said there are no accounts.</li></ul></div><div class="rejected"><b class="danger">REJECTED / DO NOT REPEAT</b><ul><li>Photorealistic or almost-human doctor render.</li><li>Bald, plain white blob, or generic mascot unrelated to the owner.</li><li>Large, sharp, dominant Al-Aqsa / Dome of the Rock scene.</li><li>Busy skyline, crowded trees, clouds, buildings, and decorative scenery.</li><li>Wrong flag (Jordanian flag was accidentally shown before); must be the Palestinian flag.</li><li>Flag patch on clothing. Owner wants the flag in the background, not on the scrubs.</li><li>Flag as a large obvious flag on a pole. Make it a soft transparent background textile/watermark.</li><li>Shbace logo on chest pocket. The logo belongs on sleeve; chest pocket is for cardiac aspiration emblem.</li><li>Generic book + stethoscope as the only meaning of the brand.</li><li>Overcrowded screens, huge glowing effects, excessive decorative objects.</li><li>Login / Google / email sign-in screen.</li><li>Replacing the production HTML, question data, or storage logic with this prototype.</li></ul></div><div class="doc-section"><h3>Visual hierarchy for the welcome screen</h3><p>1) Stylized owner-inspired mascot as main focus; 2) Shbace Medical wordmark/icon; 3) tagline; 4) subtle Palestinian background watermark; 5) small faint Dome of the Rock silhouette; 6) owner credit at the bottom. Avoid giving the flag or dome more visual weight than the product.</p></div>`}
 else if(mode==='preserve'){d.innerHTML=`<div class="doc-hero"><span class="pill">FUNCTION PRESERVATION CHECKLIST</span><h2>Redesign the experience, not the engine.</h2><p>Checked against the uploaded <b>ShbaceMedical.html</b> (included unchanged in the companion ZIP). Confirm it is the same HTML currently packaged in the owner’s latest APK before merging.</p></div><div class="doc-section"><h3>Learning structure</h3><ul><li>Subjects → Pediatrics → Specialties (Endocrinology available; Nephrology and Urology represented as future specialties where applicable) → Topics → Question Bank.</li><li>Recent topics and pinned topics.</li><li>Question bank navigation, topic selector, single / list view, fullscreen and PDF export.</li><li>Search question stem, answer options, explanation, and source; fuzzy search and topic filters.</li><li>Filters: all, unanswered, correct, incorrect, bookmarked, and tags.</li></ul></div><div class="doc-section"><h3>Learning, review and assessment</h3><ul><li>Answer selection and correctness states; preserve unknown / unverified answer-key handling and do not score ambiguous or missing keys as certain.</li><li>Saved questions / bookmarks, per-question notes, and question reports with report resolution.</li><li>Wrong Answers collection.</li><li>Smart Review queue, due / upcoming reviews, Again / Hard / Good / Easy ratings, scheduled intervals, and review history.</li><li>The checked reference HTML has Smart Review but no separate Flashcards module. Do not invent or advertise a Flashcards feature unless the owner confirms it exists in the production version.</li><li>Quiz configuration: all questions / selected topics / custom count, practice or timed, instant or end review, random or original order, duration setting.</li><li>Quiz resume, timer, question navigation, mark for review, submit, results, and incorrect/unanswered review.</li></ul></div><div class="doc-section"><h3>Progress, utilities and support</h3><ul><li>Study statistics: answered, correct, incorrect, completion, topic accuracy, topic needing review, and saved quiz attempts.</li><li>Notifications, read / unread state, mark all read.</li><li>Changelog, About, Contact & Feedback, rating.</li><li>Settings, theme preference, content update settings, manifest validation, update checks and cache-busting behaviour.</li><li>Backup to JSON and restore from JSON; reset topic / subject / all progress with existing confirmation rules.</li><li>Persistence: preserve the exact existing storage schema, key, migrations and compatibility. Do not silently reset or rename it.</li><li>Capacitor / APK web asset structure and current manual content update mechanism must remain intact.</li></ul></div><div class="warn"><b>Regression rule:</b> every existing feature must be tested after styling. Do not “simplify” by removing tools that are not visible in the new home screen.</div>`}
 else{d.innerHTML=`<div class="doc-hero"><span class="pill">IMPLEMENTATION BRIEF</span><h2>Build a responsive, native-feeling HTML experience.</h2><p>Use this prototype as the visual and behavioural reference, then integrate into the actual Shbace Medical codebase only after auditing it.</p></div><div class="doc-section"><h3>Onboarding sequence (proposed final order)</h3><ol><li><b>Recurring Splash / identity:</b> show the full approved poster at every launch for exactly seven seconds, including founder name and Palestinian project credit; then route automatically.</li><li><b>First-run Welcome:</b> show once after the recurring splash. Do not repeat the splash poster or duplicate its flag and Dome on all internal pages.</li><li><b>Try a question:</b> an interactive sample MCQ; user taps an answer. Correct = mint/green, short celebration. Incorrect = soft red, correct option revealed, playful disappointed expression and a supportive message. This demo must not write to production answers or stats.</li><li><b>Every answer explained:</b> show why the key is correct and why the other options are wrong. Use real bank explanation content when available; use this prototype's sample only as an example.</li><li><b>Smart Review:</b> its own focused page, not grouped with other tools.</li><li><b>Timed Tests:</b> its own focused page with timer preview.</li><li><b>Question Bank:</b> its own focused page for search, topics, and filters.</li><li><b>Study Progress:</b> its own focused page for accuracy and progress.</li><li><b>Choose your grade:</b> Grade 1–5 staircase; selecting Grade 5 visibly animates the mascot through 1, 2, 3, 4, then 5; only then enable Continue. Do not assume grade-to-content mapping until confirmed by the real data.</li><li><b>Start:</b> finish the introduction and enter the existing app; no login / signup page. On every later open, show only the five-second splash then go to Home.</li></ol></div><div class="doc-section"><h3>Mascot art direction</h3><ul><li>Distinctive stylized 3D / cartoon look, clearly non-photorealistic. Do not copy Clinicoid’s white mascot.</li><li>Dark textured hair with volume, close sides, full tidy beard, brows and general facial proportions inspired by the supplied user photo; avoid exact photo-real likeness.</li><li>Navy scrubs, visible stethoscope, Shbace logo on sleeve. Chest pocket emblem: anatomical heart + ECG + small scalpel, as a personal symbol of the owner’s cardiac-surgery ambition.</li><li>Expressions / poses needed as a reusable asset set: neutral, thinking, happy/celebrating, mildly disappointed/encouraging, explaining, climbing, and achievement.</li><li>Keep the character consistent across all screens. Prefer transparent-background SVG/PNG/WebP assets or sprite variants.</li></ul></div><div class="doc-section"><h3>Palestinian identity — restrained</h3><ul><li>Use a correct Palestinian flag: black top stripe, white middle, green bottom, red triangle at the hoist. Make it faint and translucent in the splash background only. Do not substitute the Jordanian flag.</li><li>Flag is a translucent background layer only, not a sleeve patch and not a flagpole scene. Keep opacity low enough that it never competes with text or mascot.</li><li>Dome of the Rock is a separate, very small and faint silhouette in the splash background only. Avoid large dome, detailed city, forest, trees or crowded landscape.</li></ul></div><div class="doc-section"><h3>Technical guardrails</h3><ul><li>Prototype is self-contained HTML. For production, integrate styles/components into existing app rather than replacing its data or business logic.</li><li>No framework or external CDN required unless the current project already uses one. Avoid network-dependent assets; bundle images locally.</li><li>Keep mobile-first layout, keyboard navigation, semantic buttons, readable contrast, reduced-motion support, and safe-area spacing.</li><li>ECG pulse should be subtle and periodic; optional haptic feedback only after a user gesture and only where supported; disabled by default.</li><li>Store onboarding completion / selected grade separately and safely. Do not overwrite existing question-bank state. Confirm whether grade is only a profile preference or filters content before binding it to data.</li><li>Respect existing versioning, content update flow, service worker/cache-busting, Capacitor paths and backup compatibility.</li></ul></div><div class="doc-section"><h3>Acceptance tests before delivery</h3><ul><li>Every onboarding Next / Back / Skip / dot navigation works.</li><li>Demo MCQ shows correct and incorrect feedback and mascot expressions; no production data changes.</li><li>Grade selection moves mascot to the correct stair and Continue proceeds.</li><li>Owner name, project line, tagline and Palestinian flag colours are spelled/rendered exactly.</li><li>All current bank functions listed in “Preserve functions” still work.</li><li>Saved progress and backup/restore work before and after the redesign.</li><li>Test narrow Android screens, rotation, touch targets, reduced-motion and offline launch.</li><li>Confirm the APK / online update workflow still works and no APK rebuild is introduced unintentionally for web-only changes.</li></ul></div><div class="doc-section"><h3>Suggested handoff bundle</h3><p>Give the next AI this HTML plus the exact production HTML currently used by the APK, related content JSON / data files, and current logo / character assets. Ask it to return a changed file plus a list of touched functions and regression results.</p></div>`}}
function getHandoffPrompt(){return `You are redesigning the existing Shbace Medical app. Use the supplied production HTML as the only functional source of truth. Treat the earlier AI-modified HTML and this v3 prototype as visual/interaction references only. Never replace the production app with this prototype.

FIRST inspect both HTML files completely. Inventory every feature, function, state field, localStorage key, content schema, event handler, Capacitor path, and updater flow. Preserve all of them. Back up the original before modifying anything. Verify the original is the same version currently packaged in the owner's APK; report differences instead of guessing.

BRAND: Shbace Medical. Palette: deep navy/near-black, mint-teal, white, restrained blue accents. Keep the original supplied app icon. Exact splash slogan: “A World of Knowledge.” and “A Future of Possibilities.” Exact credit: “Dr. Abdulsalam Muhammad Abu Saada” and “A Palestinian Medical Student's Project”. Do not write “Personal Learning”; the founder credit must say Palestinian exactly as above. No accounts, no login, no Google/email sign-in.

RECURRING STARTUP SPLASH: Show the full approved poster image every time the app opens, for exactly seven seconds, then route automatically. Do not keep this poster in the background of other pages. The poster contains the large owner-inspired 3D character, correct Palestinian flag in the background, a small faint Dome of the Rock, Shbace logo top-right, four purpose panels at left (Learn Smarter, Practice More, Track Your Progress, Reach Your Goals), black/navy scrubs, visible stethoscope, Shbace logo on sleeve, anatomical heart + ECG + small scalpel emblem on the chest pocket, premium ECG waveform, the two-line slogan, and exact founder credit at the bottom. Remove the staircase and the small climbing character from the splash poster only; preserve all other details. Do not add a red floating heart sticker to the ECG. Use a refined animated ECG line instead. The Palestinian flag is background-only, with exact geometry: red triangle at hoist, horizontal black top, white middle, green bottom. Make it translucent and elegant. The Dome of the Rock must be small, faint, and alone; no skyline, trees, extra buildings, or clutter.

FIRST-RUN ONBOARDING: After the recurring five-second splash, show the interactive onboarding once only on a fresh install. Save completion in a new namespaced preference. On later app launches, show the splash for seven seconds then go directly to the inside home page. Never replay onboarding just because the app was reopened. The onboarding pages should be separate and uncluttered: (1) Welcome, (2) a real sample MCQ with correct and wrong choices and character feedback, (3) explanation of why the key is correct and distractors are wrong, (4) Smart Review on its own page, (5) Timed Tests on its own page with a timer preview, (6) Question Bank/search/filters on its own page, (7) Study Progress on its own page, (8) Grade selection, (9) finish/enter app. Do not combine all tools into one crowded poster. Do not advertise Flashcards unless the production source actually implements it.

GRADE STAIRCASE: Keep a distinct Grade 1–5 staircase screen during first-run onboarding. The staircase is HTML/CSS/SVG, not baked into the mascot image or splash poster. If the learner chooses Grade 5, animate the mascot step by step: Grade 1, then 2, then 3, then 4, then 5. Never teleport directly to the selected grade. Only enable Continue after the animation. Persist the preference in a new namespaced key, but do not filter or alter the question bank until the owner confirms the mapping of grades to real content.

MASCOT: Use the supplied full poster and separated mascot reference assets. Preserve the owner's general face, thick dark textured hair with fade, full neat beard, brows and complexion. It must be a friendly stylized 3D/cartoon character, not photorealistic, bald, a white blob, or a generic doctor. Outfit: dark navy scrubs, visible stethoscope; Shbace logo on sleeve; cardiac-surgery emblem (anatomical heart + ECG + tiny scalpel) on heart-side chest pocket. No Palestinian flag on clothing. Create or request separate consistent expressions/poses: neutral, thinking, happy, mildly disappointed/encouraging, explaining, climbing. Do not paste the full poster into every screen. Reuse the mascot asset only where it adds value, and use different small poses/reactions rather than duplicating the splash artwork.

QUESTION INTERACTION: Correct answer turns mint/green and gives a small celebration. Wrong answer gets a soft red state, the correct answer is revealed, the character looks briefly displeased in a playful—not angry or shaming—way, then encourages learning. Explanation state uses a thoughtful pose. Sample answers must never change actual history, stats, bookmarks, notes, reports, or Smart Review. ECG should have a refined glowing waveform with a subtle heartbeat rhythm; no separate red heart sticker and no whole-screen shaking. Respect reduced-motion settings.

INSIDE HOME AFTER ONBOARDING: The recurring splash appears first on every launch, then show the actual app home. Keep the mascot visible as a smaller home companion with rotating daily learning insight / short medical tip / optional quick challenge. Do not repeat the splash poster or repeat the same feature panels on every internal page. Each internal section has its own focused design, consistent colours and typography.

PRESERVE ALL EXISTING PRODUCTION FUNCTIONS: Subjects, Pediatrics, specialties, topics, Question Bank, question navigation, search, filters, list/single/fullscreen views, PDF/print export, answer-key validation and ambiguity handling, saved/bookmarked questions, notes, reports, Wrong Answers, Smart Review scheduling/Again-Hard-Good-Easy/history, quiz configuration and modes, timed quiz/resume/timer/results/review, statistics, pinned/recent topics, notifications, settings/theme/font, update manifest validation and hash checks, update deferral during active quiz, cache behaviour, JSON backup/restore, resets, offline operation, Capacitor / www / APK structure, and the current update mechanism. Do not add a backend, account system, analytics service, external CDN, or unnecessary library.

DATA SAFETY: Use new namespaced keys only for onboarding completion, selected Grade, and rotating home tip if needed. Do not repurpose production keys such as shbace_medical_v1 or shbace_medical_content_v1. Do not store demo answers in the real question history. Keep original HTML as backup. Do not overwrite it until the owner approves a tested replacement.

TEST BEFORE DELIVERY: First launch shows splash for seven seconds then onboarding; finish onboarding and store completion; second launch shows splash for seven seconds then home only; daily home insight rotates; sample correct and wrong answers; explanation; Smart Review page; timed test control; question bank preview; Grade 5 animates 1→2→3→4→5; selected grade persists; app data remains unchanged by demo; all existing production features still work; mobile, desktop, offline, reduced-motion, Capacitor file paths and existing updates remain supported. Report actual test results and any feature not preserved. Never claim a prototype is production-ready unless integrated and regression-tested.`}

function copyHandoff(){const txt=getHandoffPrompt();if(!navigator.clipboard?.writeText){const el=document.getElementById('handoffPrompt');if(el){el.focus();el.select();}alert('Clipboard access is unavailable here. The full prompt has been selected for manual copying.');return;}navigator.clipboard.writeText(txt).then(()=>alert('Handoff prompt copied.')).catch(()=>{const el=document.getElementById('handoffPrompt');if(el){el.focus();el.select();}alert('Clipboard access failed. The full prompt has been selected for manual copying.');});}

/* True while the start-up splash overlay is still in the DOM. Nothing behind it may be built, so the
   onboarding entrance animations start only after the splash has fully faded and been removed. */
function splashHolding(){return !!document.getElementById('startupSplash')}

/* ===== Onboarding completion state: ONE source of truth =====
   Reuses the existing persistent key (shbace_onboarding_v3_complete) so students who already finished onboarding are never sent back to it after an update.
   Completion is written ONLY by markOnboardingDone(), which enterAppDemo() calls when the student presses "Enter Shbace Medical" on the Completion screen. */
const OB_DONE_KEY='shbace_onboarding_v3_complete',OB_GRADE_KEY='shbace_onboarding_v3_grade';
let obMemDone=false; /* in-memory fallback if storage is blocked (private mode); lasts for the current session only */
/* keys that only exist after REAL use of the app (written on user action, never automatically at launch) */
const OB_USAGE_KEYS=['shbace_qb_v6','shbace_quiz_v1','shbace_quizcfg_v1','shbace_pins_v1','shbace_recent_v1','shbace_rating_v1','shbace_feedback_v1','shbace_home_pediatrics_resume_v1','shbace_daily_facts_v1'];
function obNonEmpty(raw){
 if(!raw)return false;let v;try{v=JSON.parse(raw)}catch(e){return false}
 if(Array.isArray(v))return v.length>0;
 if(v&&typeof v==='object')return Object.values(v).some(x=>x&&(typeof x!=='object'||Object.keys(x).length>0));
 return !!v;
}
/* one-time upgrade migration, run once at startup: an existing student (study data already on the device, but no completion flag because the flag did not exist in their old version) must not see onboarding again */
function obMigrateExistingStudent(){
 try{
  if(localStorage.getItem(OB_DONE_KEY)==='1')return;
  if(OB_USAGE_KEYS.some(k=>obNonEmpty(localStorage.getItem(k))))localStorage.setItem(OB_DONE_KEY,'1');
 }catch(e){}
}
function onboardingDone(){try{if(localStorage.getItem(OB_DONE_KEY)==='1')return true}catch(e){}return obMemDone}
function markOnboardingDone(){obMemDone=true;try{localStorage.setItem(OB_DONE_KEY,'1')}catch(e){}}
function clearOnboardingState(){obMemDone=false;try{localStorage.removeItem(OB_DONE_KEY);localStorage.removeItem(OB_GRADE_KEY)}catch(e){}}
/* ===== v46 · Onboarding page visibility (Settings → First / Last Onboarding Page) =====
   Fresh install: every page is shown once (unchanged behaviour). After onboarding is complete the two switches (default OFF) decide
   whether the first page / the last page are shown again at app start. The two settings are independent. */
let obReplay=false;
function obSetOn(k){
 /* v47 fix: SET is declared INSIDE the question-bank IIFE, so `typeof SET` in this global script was always 'undefined' and every
    switch read as OFF no matter what was saved. The IIFE now publishes the live object on window.__SET; before it has run (or if it
    failed) the persisted copy is read straight from storage. Nothing here ever writes a value. */
 try{const s=window.__SET;if(s&&typeof s==='object'&&(s[k]==='on'||s[k]==='off'))return s[k]==='on'}catch(e){}
 try{const raw=localStorage.getItem('shbace_settings_v1');if(raw){const o=JSON.parse(raw);if(o&&typeof o==='object')return o[k]==='on'}}catch(e){}
 return false}
function obVisible(){const all=screenTitles.map((_,i)=>i);if(!obReplay)return all;const v=[];if(obSetOn('obFirst'))v.push(0);if(obSetOn('obLast'))v.push(all.length-1);return v.length?v:all}
function obNb(d){const v=obVisible();if(d>0){for(let k=0;k<v.length;k++)if(v[k]>slide)return v[k]}else{for(let k=v.length-1;k>=0;k--)if(v[k]<slide)return v[k]}return -1}
function obCanExit(){return obReplay&&slide!==screenTitles.length-1&&obNb(1)<0}
/* ===== v46 · Grade → Home content. Each grade has a fixed id; Home shows ONLY what is registered (and really loaded) for it. ===== */
const GRADE_ID={1:'grade-1',2:'grade-2',3:'grade-3',4:'grade-4',5:'grade-5'};
const GRADE_HOME_CONTENT={'grade-5':{pediatrics:true}};   /* add a grade's real subjects here when its content exists */
function obGradeNow(){let g=Number(selectedGrade);if(!(g>=1&&g<=5)){try{g=Number(localStorage.getItem(OB_GRADE_KEY))}catch(e){g=0}}return(g>=1&&g<=5)?g:0}
function gradeHasPediatrics(){const g=obGradeNow()||5;   /* 0 = older install that never stored a grade: keep its existing Grade 5 content */
 const c=GRADE_HOME_CONTENT[GRADE_ID[g]];return !!(c&&c.pediatrics)}   /* registry only; the real-data check (QB.length) is done inside home(), where QB is in scope */

/* ===== Splash haptics: native-first Capacitor bridge + safe browser fallback =====
   Android can vibrate automatically only through the native Haptics bridge.
   The Web Vibration API remains gated by browser sticky user activation. */
const SP_HAPTIC=[24,80,16];
const SPLASH_DURATION_MS=7000;      /* Splash stays fully visible for exactly 7 s; the dissolve starts AFTER this and is not part of it */
const SPLASH_FADE_MS=(window.matchMedia&&matchMedia('(prefers-reduced-motion: reduce)').matches)?350:1900;           /* dissolve duration (1.8–2 s). The real screen is already drawn under the splash */
let spBeats=0,spHapticTimer=null,spHapticDubTimer=null,spHapticLoopTimer=null;
let splashDeadline=0,splashCompletionTimer=null,splashFinalized=false,splashRouteDone=false,splashPre=false;
function nativeHapticsBridge(){
 try{
  const cap=window.Capacitor||window.capacitor||null;
  return (cap&&cap.Plugins&&cap.Plugins.Haptics)||window.ShbaceHaptics||window.Haptics||null;
 }catch(e){return null}
}
function hapticsAllowed(){
 try{
  if(window.matchMedia&&matchMedia('(prefers-reduced-motion: reduce)').matches)return false;
  if(document.hidden)return false;
  const native=nativeHapticsBridge();
  if(native&&(typeof native.vibrate==='function'||typeof native.impact==='function'))return true;
  if(typeof navigator.vibrate!=='function')return false;
  if(navigator.userActivation&&!navigator.userActivation.hasBeenActive)return false;
  return true;
 }catch(e){return false}
}
function issueOneHeartPulse(ms){
 const native=nativeHapticsBridge();
 if(native){
  try{
   if(typeof native.vibrate==='function'){
    const p=native.vibrate({duration:ms});if(p&&typeof p.catch==='function')p.catch(()=>{});return true;
   }
   if(typeof native.impact==='function'){
    const p=native.impact({style:'LIGHT'});if(p&&typeof p.catch==='function')p.catch(()=>{});return true;
   }
  }catch(e){}
 }
 /* Ordinary browsers require prior user activation for navigator.vibrate(). */
 try{
  if(typeof navigator.vibrate==='function'&&(!navigator.userActivation||navigator.userActivation.hasBeenActive))return !!navigator.vibrate(ms);
 }catch(e){}
 return false;
}
function cancelSplashHaptics(){
 clearTimeout(spHapticTimer);spHapticTimer=null;
 clearTimeout(spHapticDubTimer);spHapticDubTimer=null;
 clearTimeout(spHapticLoopTimer);spHapticLoopTimer=null;
 try{if(typeof navigator.vibrate==='function'&&(!navigator.userActivation||navigator.userActivation.hasBeenActive))navigator.vibrate(0)}catch(e){}
}
function splashHaptic(){
 const el=document.getElementById('startupSplash');
 if(!el||el.classList.contains('is-leaving')||el.classList.contains('is-paused')||spBeats>=8||!hapticsAllowed())return;
 spBeats++;
 clearTimeout(spHapticTimer);clearTimeout(spHapticDubTimer);
 spHapticTimer=setTimeout(()=>{
  const active=document.getElementById('startupSplash');
  if(!active||active.classList.contains('is-leaving')||active.classList.contains('is-paused')||!hapticsAllowed())return;
  if(nativeHapticsBridge()){
   issueOneHeartPulse(24);
   spHapticDubTimer=setTimeout(()=>{
    const live=document.getElementById('startupSplash');
    if(live&&!live.classList.contains('is-leaving')&&!live.classList.contains('is-paused')&&hapticsAllowed())issueOneHeartPulse(16);
   },104);
  }else if(typeof navigator.vibrate==='function'&&(!navigator.userActivation||navigator.userActivation.hasBeenActive)){
   try{navigator.vibrate(SP_HAPTIC)}catch(e){}
  }
 },60);
}
/* One 833ms JS cadence mirrors the CSS heart cycle. This is more reliable than
   animationiteration events, which can be missed while a WebView is starting. */
window.__spR=function(){try{splashHaptic()}catch(e){}};
function startSplashHaptics(){return; /* v16: haptics now fire from the ECG R-peak event (same clock as the heart) */
 clearTimeout(spHapticLoopTimer);spHapticLoopTimer=null;
 const beat=()=>{
  const el=document.getElementById('startupSplash');
  if(!el||el.classList.contains('is-leaving')||el.classList.contains('is-paused')||document.hidden||spBeats>=8)return;
  splashHaptic();
  if(spBeats<8)spHapticLoopTimer=setTimeout(beat,833);
 };
 beat();
}
function stopSplashMotion(){
 cancelSplashHaptics();
 const el=document.getElementById('startupSplash');if(el)el.classList.add('is-leaving');
}
const SPLASH_PRE_MS=900;            /* destination (Onboarding or Home) is drawn this long BEFORE the dissolve starts, hidden under the opaque splash */
const SPLASH_DISSOLVE_X=.42;        /* dissolve origin: slightly LEFT of the screen centre */
/* Radial dissolve from a point slightly left of centre. Same dissolve for Splash -> Onboarding and Splash -> Home. */
function splashDissolve(overlay,ms,done){
 /* Left -> right reveal: the new page enters from the LEFT edge and the soft front travels to the RIGHT edge (no centre-originating dissolve). */
 let finished=false;const fin=()=>{if(finished)return;finished=true;try{done()}catch(e){}};
 const W=overlay.clientWidth||window.innerWidth||360,F=W*.55,total=W+F;
 const ease=t=>t*t*(3-2*t);
 const apply=t=>{const r=ease(t)*total,inner=Math.max(0,r-F),outer=Math.max(.01,r);
  const g='linear-gradient(90deg,rgba(0,0,0,0) 0,rgba(0,0,0,0) '+inner.toFixed(1)+'px,#000 '+outer.toFixed(1)+'px)';
  overlay.style.webkitMaskImage=g;overlay.style.maskImage=g};
 apply(0);
 const t0=performance.now();
 const step=now=>{if(finished)return;const t=Math.min(1,(now-t0)/ms);apply(t);if(t>=1)fin();else requestAnimationFrame(step)};
 requestAnimationFrame(step);
 setTimeout(fin,ms+500);              /* safety: a WebView that pauses animation frames still removes the overlay */
}
function completeSplashOnce(overlay,instant){
 if(splashFinalized)return;
 splashFinalized=true;
 clearTimeout(splashCompletionTimer);splashCompletionTimer=null;
 /* normally the destination was already drawn SPLASH_PRE_MS earlier; this is only the fallback */
 splashPre=true;
 if(!splashRouteDone){splashRouteDone=true;routeAfterSplash();}
 cancelSplashHaptics();
 const fin=()=>{if(overlay&&overlay.isConnected)overlay.remove();splashPre=false};
 if(instant||!overlay||!overlay.isConnected){fin();return}
 /* same cinematic transition as Onboarding -> Home (defined in #shb-portal-js); the old left->right dissolve stays only as a fallback */
 if(window.shbPortalSplash&&window.shbPortalSplash(overlay,fin))return;
 splashDissolve(overlay,SPLASH_FADE_MS,fin);
}
function syncSplashOnForeground(){
 const overlay=document.getElementById('startupSplash');if(!overlay||splashFinalized||window.__shbBooted!==true)return;
 const r=splashDeadline-Date.now();
 if(r<=-SPLASH_FADE_MS)completeSplashOnce(overlay,true);      /* the whole hold + dissolve already passed while the app was in the background */
 else if(r<=0)completeSplashOnce(overlay);
 else if(r<=SPLASH_PRE_MS&&!splashRouteDone){splashRouteDone=true;splashPre=true;routeAfterSplash();}
}
document.addEventListener('visibilitychange',()=>{
 const el=document.getElementById('startupSplash');if(!el)return;
 el.classList.toggle('is-paused',document.hidden);
 if(document.hidden)cancelSplashHaptics();
 else{syncSplashOnForeground();if(!splashFinalized)startSplashHaptics();}
});
window.addEventListener('pageshow',syncSplashOnForeground);
window.addEventListener('focus',syncSplashOnForeground);
/* The hand-off to Onboarding / Home starts only once the ECG head has really reached the right edge (published by the splash ECG). Safety: never waits longer than ~0.8 s. */
function whenSplashEcgDone(fn){const e=window.__spEcg;if(!e||e.done||document.hidden){fn();return}let n=0;const w=()=>{if(splashFinalized)return;if(e.done||++n>50){fn();return}setTimeout(w,16)};w()}
let splashLoadAt=0;window.addEventListener('load',()=>{splashLoadAt=performance.now()});
const splashPreReady=()=>splashLoadAt>0&&performance.now()-splashLoadAt>700&&performance.now()-splashLoadAt<4000;   /* the page overrides (hologram, cards, backgrounds) are defined further down the file: drawing before 'load' produced the old plain first page */
function launchExperience(){
 /* Warm up artwork while the seven-second splash is visible. */
 try{[IMG.iconBig,IMG.icon].forEach(src=>{if(!src)return;const im=new Image();im.src=src;im.decode&&im.decode().catch(()=>{})})}catch(e){}
 try{const raw=localStorage.getItem('shbace_home_tip_index_v3');activeDailyTip=(Number(raw||'-1')+1)%5;localStorage.setItem('shbace_home_tip_index_v3',String(activeDailyTip));}catch(e){}
 const overlay=document.getElementById('startupSplash');
 if(!overlay){routeAfterSplash();return;}
 splashDeadline=(function(){const e=window.__spEcg;return Date.now()-((e&&e.t0!==null)?Math.max(0,performance.now()-e.t0):0)})()+SPLASH_DURATION_MS;      /* end of the 7 s hold (same clock as the ECG head); the transition starts here */
 splashFinalized=false;splashRouteDone=false;spBeats=0;
 startSplashHaptics();
 const tick=()=>{
  if(splashFinalized)return;
  const remaining=splashDeadline-Date.now();
  if(!splashRouteDone&&window.__shbBooted===true&&(remaining<=SPLASH_PRE_MS||splashPreReady())){splashRouteDone=true;splashPre=true;routeAfterSplash();}   /* wait for the deferred script queue: on a cold first install the hologram override arrives after the base app script */
  if(remaining<=0){if(window.__shbBooted!==true){splashCompletionTimer=window.setTimeout(tick,80);return;}whenSplashEcgDone(()=>completeSplashOnce(overlay));return;}
  clearTimeout(splashCompletionTimer);
  splashCompletionTimer=window.setTimeout(tick,Math.max(8,splashRouteDone?remaining:Math.min(150,remaining-SPLASH_PRE_MS)));
 };
 tick();
}
/* The ONLY routing decision after the splash:  first run -> Onboarding;  already completed -> Home directly (no onboarding, no Completion). */
function routeAfterSplash(){
 try{const g=Number(localStorage.getItem(OB_GRADE_KEY));if(g>=1&&g<=5)selectedGrade=g;}catch(e){}
 if(onboardingDone()){returningUser=true;appPage='subjects';
  const rv=[];if(obSetOn('obFirst'))rv.push(0);if(obSetOn('obLast'))rv.push(screenTitles.length-1);
  if(rv.length){obReplay=true;mode='preview';slide=rv[0]}else{obReplay=false;mode='app'}}
 else{obReplay=false;returningUser=false;mode='preview';slide=0;appPage='subjects';}
 setModeUI();
}
function restartFirstRun(){obReplay=false;returningUser=false;clearOnboardingState();slide=0;selectedGrade=null;demoAnswer=null;flashcardFlipped=false;demoSeconds=600;if(demoTimerHandle){clearInterval(demoTimerHandle);demoTimerHandle=null;}mode='preview';guideTab='screen';setModeUI();}

function renderDocInit(){renderDoc()}
function renderModeDoc(){setModeUI()}
// Sidebar modes
 document.querySelectorAll('.rail [data-mode]').forEach(b=>b.addEventListener('click',()=>{mode=b.dataset.mode;setModeUI()}));
 document.querySelectorAll('[data-guide]').forEach(b=>b.addEventListener('click',()=>{guideTab=b.dataset.guide;renderGuide()}));
 document.getElementById('resetDemo').addEventListener('click',()=>{restartFirstRun()});
// expose handlers used by inline prototype buttons
Object.assign(window,{nextSlide,prevSlide,chooseDemo,selectGrade,enterAppDemo,copyHandoff,flipFlashcard,toggleDemoTimer,showReviewSample,restartFirstRun});


/* Live ECG: one realistic beat (P wave, PR segment, Q, R, S, ST segment, T wave) repeated and scrolled; 72 bpm = 833 ms per beat */
const BEAT_MS=833;let heartTimer=null;
function ecgLive(){
 const beat=(x)=>`M${x} 75 H${x+18} C${x+26} 63 ${x+38} 63 ${x+46} 75 H${x+60} L${x+66} 82 L${x+75} 10 L${x+84} 108 L${x+91} 75 H${x+108} C${x+124} 46 ${x+150} 46 ${x+162} 75 H${x+200}`;
 let d='';for(let i=0;i<5;i++){d+=beat(i*200)+' ';}
 return `<div class="live-ecg" id="liveEcg" role="img" aria-label="Live ECG heartbeat, about 72 beats per minute"><svg viewBox="0 0 600 120" preserveAspectRatio="none" aria-hidden="true"><defs><linearGradient id="ecgFade" x1="0" x2="1"><stop offset="0" stop-color="#000"/><stop offset=".16" stop-color="#fff"/><stop offset=".9" stop-color="#fff"/><stop offset="1" stop-color="#000"/></linearGradient><mask id="ecgMask"><rect width="600" height="120" fill="url(#ecgFade)"/></mask></defs><g mask="url(#ecgMask)"><g class="scroll"><path class="trace" d="${d.trim()}"/></g></g><line class="cursor" x1="300" x2="300" y1="0" y2="120"/></svg></div>`;
}
function stopHeartbeat(){if(heartTimer){clearInterval(heartTimer);heartTimer=null;}}
function heartbeatTick(){
 const el=document.getElementById('liveEcg');
 if(!el){stopHeartbeat();return;}
 el.classList.remove('beat');void el.offsetWidth;el.classList.add('beat');
 const calm=window.matchMedia&&window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}
function syncHeartbeat(){
 stopHeartbeat();
 if(!document.getElementById('liveEcg'))return;
 heartbeatTick();heartTimer=setInterval(heartbeatTick,BEAT_MS);
}
const __renderSlide=renderSlide;
renderSlide=function(){__renderSlide.apply(this,arguments);syncHeartbeat();};
document.addEventListener('visibilitychange',()=>{if(document.hidden)stopHeartbeat();else syncHeartbeat();});
function applyAppMode(){document.body.classList.toggle('app-mode',location.hash!=='#notes');}
window.addEventListener('hashchange',applyAppMode);applyAppMode();

/* ===================== v8 SWIPE-ONLY ONBOARDING ===================== */
(function(){
const FN=()=>[introScreen,quizDemo,smartReviewScreen,timedTestScreen,progressScreen,gradeScreen,finishScreen];
const N=()=>screenTitles.length,reduce=()=>!!(window.matchMedia&&matchMedia('(prefers-reduced-motion: reduce)').matches);
const gradeIdx=()=>FN().indexOf(gradeScreen);
const canGo=d=>d<0?obNb(-1)>=0:((obNb(1)>=0||obCanExit())&&!(slide===gradeIdx()&&(!selectedGrade||(window.gxIsBusy&&window.gxIsBusy()))));
window.SWIPE_ENABLED=false; /* onboarding swipe gesture is off; set true to bring it back */
let drag=null,busy=false,swallow=false;
/* ---------- indicators: dots + tiny chevrons (accessibility only; swiping is the main way) ---------- */
footer=function(){return `<div class="screen-foot sw-foot"><button type="button" class="sw-chev" onclick="swGo(-1)" aria-label="Previous slide" ${obNb(-1)<0?'disabled':''}>‹</button>${dots()}<button type="button" class="sw-chev" onclick="swGo(1)" aria-label="Next slide" ${(obNb(1)<0&&!obCanExit())?'disabled':''}>›</button></div>`};
function toast(t){const pc=phoneContent;pc.querySelectorAll('.sw-toast').forEach(x=>x.remove());const e=document.createElement('div');e.className='sw-toast';e.textContent=t;pc.appendChild(e);setTimeout(()=>e.remove(),1800)}
/* ---------- v33: onboarding page change = the Home page-transition language ----------
   Outgoing page: frozen ghost (same state, same scroll position) that fades out while drifting ~10px away. Incoming page: fades in from ~10px on the other side, at the same time.
   While dragging, only the current page follows the finger (no neighbour pages are built, so a swipe never stalls on its first frame). */
const tf=x=>`translate3d(${x}px,0,0)`;
function setup(){const pc=phoneContent,cur=pc.querySelector(':scope>.screen:not(.ob-ghost)');if(!cur)return null;return{cur,W:pc.clientWidth||360}}
function place(o,dx){o.cur.style.transform=tf(dx);o.cur.style.opacity=String(1-Math.min(.4,Math.abs(dx)/o.W*.5))}
function cleanup(o){o.cur.style.transform='';o.cur.style.opacity='';o.cur.style.transition='';document.body.classList.remove('sw-dragging')}
function offsetNow(cur){try{const m=new DOMMatrix(getComputedStyle(cur).transform);return Number.isFinite(m.m41)?m.m41:0}catch(e){return 0}}
const OB_T=440;   /* v47: page change = 440 ms crossfade with a 24 px subtle slide (outgoing and incoming run at the SAME time) */
function obSnapCanvases(from,to){try{const a=from.querySelectorAll('canvas'),b=to.querySelectorAll('canvas');a.forEach((c,i)=>{const g=b[i];if(!g||!c.width||!c.height)return;g.width=c.width;g.height=c.height;g.getContext('2d').drawImage(c,0,0)})}catch(e){}}
function commit(o,dir,target){
 const pc=phoneContent,cur=o.cur,rm=reduce()||document.hidden;
 let ghost=null,times=null,bgGhost=null,obEl=null;
 const nx=(target!=null)?target:obNb(dir);
 const pwaPolish=!(window.Capacitor&&typeof window.Capacitor.isNativePlatform==='function'&&window.Capacitor.isNativePlatform());
 const obFree=()=>{try{if(obEl)obEl.style.transition=''}catch(e){}obEl=null};
 if(nx<0){cleanup(o);if(dir>0&&obCanExit())enterAppDemo();return}
 if(!rm){try{
  const dx=offsetNow(cur),op=getComputedStyle(cur).opacity||'1';
  ghost=cur.cloneNode(true);
  ghost.querySelectorAll('[id]').forEach(n=>n.removeAttribute('id'));ghost.removeAttribute('id');
  ghost.classList.add('sw-pane','ob-ghost');ghost.setAttribute('aria-hidden','true');ghost.setAttribute('inert','');
  ghost.style.cssText=`left:${cur.offsetLeft}px;top:${cur.offsetTop}px;width:${cur.offsetWidth}px;height:${cur.offsetHeight}px;--gx:${dx}px;--go:${op};transform:${tf(dx)};opacity:${op}`;
  obSnapCanvases(cur,ghost);     /* a cloned <canvas> is blank: copy its pixels so the outgoing page never loses its drawing */
  if(cur.getAnimations)times=cur.getAnimations({subtree:true}).map(a=>a.currentTime);
  /* the shared Onboarding sky belongs to the .phone, not to the page: when the background itself changes (last page <-> others) keep the old one as a fading layer */
  const lastI=screenTitles.length-1;
  if(pc.hasAttribute('data-ob-final')!==(nx===lastI)||(pwaPolish&&(slide===0)!==(nx===0))){
   const ph=pc.closest('.phone'),cs=ph&&getComputedStyle(ph);
   if(cs){bgGhost=document.createElement('div');bgGhost.className='ob-bgghost';bgGhost.setAttribute('aria-hidden','true');
    bgGhost.style.cssText=`position:absolute;left:0;top:0;width:${pc.clientWidth}px;height:${pc.clientHeight}px;z-index:4;pointer-events:none;background-color:${cs.backgroundColor};background-image:${cs.backgroundImage};background-size:${cs.backgroundSize};background-position:${cs.backgroundPosition};background-repeat:${cs.backgroundRepeat}`;
    /* PWA only: preserve the page-1 backdrop while its live layer switches state. */
    if(pwaPolish){
     try{const ob=ph.querySelector(':scope>.shb-obbg');if(ob){const oc=getComputedStyle(ob),oo=parseFloat(oc.opacity)||0;
      if(oo>.01){const layer=document.createElement('i');layer.style.cssText=`position:absolute;left:0;top:0;right:0;bottom:0;pointer-events:none;background-color:${oc.backgroundColor};background-image:${oc.backgroundImage};background-size:${oc.backgroundSize};background-position:${oc.backgroundPosition};background-repeat:${oc.backgroundRepeat};opacity:${oc.opacity}`;bgGhost.appendChild(layer)}
      obEl=ob;ob.style.transition='none';}}
     catch(e){}
    }
   }}
 }catch(e){ghost=null;bgGhost=null;obFree();console.error('ob ghost',e)}}
 cleanup(o);
 slide=nx;renderSlide();
 pc.classList.add('ob-still');       /* the new page does not replay its children's entrances: the page as a whole carries the transition (nothing blinks twice) */
 if(rm){obFree();return}
 try{
  const ns=pc.querySelector(':scope>.screen:not(.ob-ghost)');
  if(!ns){if(ghost)ghost=null;obFree();return}
  const fwd=dir>0;
  if(!ghost){obFree();ns.classList.add(fwd?'ob-in-r':'ob-in-l');setTimeout(()=>{try{ns.classList.remove('ob-in-r','ob-in-l')}catch(e){}},OB_T+60);return}
  ns.style.opacity='0';              /* hold the new page invisible (the frozen old page covers it) until its images are decoded: no blank frame, no pop-in */
  if(bgGhost)pc.appendChild(bgGhost);
  pc.appendChild(ghost);
  try{const ga=ghost.getAnimations?ghost.getAnimations({subtree:true}):[];
   if(times&&ga.length===times.length)ga.forEach((a,i)=>{try{a.pause();if(times[i]!=null)a.currentTime=times[i]}catch(e){}});   /* freeze every looping/entrance animation exactly where it was */
   else ga.forEach(a=>{try{a.finish()}catch(e){try{a.pause()}catch(_){}}})}catch(e){}
  let started=false;
  const start=()=>{if(started)return;started=true;
   ns.style.opacity='';
   ghost.classList.add(fwd?'ob-out-l':'ob-out-r');
   if(bgGhost)bgGhost.classList.add('ob-bg-out');
   ns.classList.add(fwd?'ob-in-r':'ob-in-l');
   let cleaned=false;
   const clean=()=>{if(cleaned)return;cleaned=true;try{ghost.remove()}catch(e){}try{bgGhost&&bgGhost.remove()}catch(e){}obFree();try{ns.classList.remove('ob-in-r','ob-in-l')}catch(e){}};
   if(!pwaPolish){setTimeout(clean,OB_T+60);return}
   /* PWA only: wait for actual animation completion; keep a safety timeout for interrupted animations. */
   try{const animations=[].concat(ghost.getAnimations?ghost.getAnimations():[],bgGhost&&bgGhost.getAnimations?bgGhost.getAnimations():[],ns.getAnimations?ns.getAnimations():[]);
    if(animations.length)Promise.all(animations.map(a=>a.finished.catch(()=>{}))).then(()=>requestAnimationFrame(clean));
    else setTimeout(clean,OB_T+60);
   }catch(e){setTimeout(clean,OB_T+60)}
   setTimeout(clean,OB_T+900)};
  try{const imgs=[...ns.querySelectorAll('img')].filter(i=>i.decode&&!(i.complete&&i.naturalWidth));
   if(imgs.length){Promise.all(imgs.map(i=>i.decode().catch(()=>{}))).then(start);setTimeout(start,pwaPolish?220:90)}else requestAnimationFrame(start)}catch(e){start()}
 }catch(e){console.error('ob transition',e)}
}
function settle(o,dx,commitDir){busy=true;
 if(commitDir){try{commit(o,commitDir)}finally{setTimeout(()=>{busy=false},reduce()?0:OB_T+130)}return}
 const dur=reduce()?0:220;o.cur.style.transition=`transform ${dur}ms cubic-bezier(.22,.8,.25,1),opacity ${dur}ms ease`;
 requestAnimationFrame(()=>{place(o,0);setTimeout(()=>{cleanup(o);busy=false},dur+30)})}
/* programmatic move (chevrons, keyboard, Android back via history) uses the same transition */
window.swJump=function(i){if(busy||drag||mode!=='preview'||splashHolding()||i===slide)return;const o=setup();if(!o){slide=i;renderSlide();return}busy=true;try{commit(o,i>slide?1:-1,i)}finally{setTimeout(()=>{busy=false},reduce()?0:OB_T+130)}};
window.swGo=function(d){if(busy||drag||mode!=='preview'||splashHolding())return;if(!canGo(d)){if(d>0&&slide===gradeIdx()&&!selectedGrade)toast('Choose your grade to continue');return}
 const o=setup();if(!o)return;busy=true;try{commit(o,d>0?1:-1)}finally{setTimeout(()=>{busy=false},reduce()?0:OB_T+130)}};
/* ---------- pointer handling (touch + mouse + pen) ---------- */
const pc=phoneContent;
pc.addEventListener('pointerdown',e=>{if(!window.SWIPE_ENABLED||busy||mode!=='preview'||splashHolding()||!e.isPrimary||(e.pointerType==='mouse'&&e.button!==0))return;
 if(e.clientX<24||e.clientX>innerWidth-24)return; /* leave the Android edge-back gesture to the system */
 if(e.target.closest('input,textarea,select,[data-noswipe]'))return;
 drag={id:e.pointerId,x0:e.clientX,y0:e.clientY,lx:e.clientX,lt:e.timeStamp,v:0,locked:false,o:null,dx:0}});
pc.addEventListener('pointermove',e=>{const d=drag;if(!d||e.pointerId!==d.id)return;const dx=e.clientX-d.x0,dy=e.clientY-d.y0;
 if(!d.locked){if(Math.abs(dy)>10&&Math.abs(dy)>Math.abs(dx)){drag=null;return} /* vertical scroll wins */
  if(Math.abs(dx)<8||Math.abs(dx)<Math.abs(dy)*1.15)return;
  d.o=setup();if(!d.o){drag=null;return}d.locked=true;document.body.classList.add('sw-dragging');try{pc.setPointerCapture(e.pointerId)}catch(x){}}
 const dt=e.timeStamp-d.lt;if(dt>0){d.v=.8*d.v+.2*((e.clientX-d.lx)/dt)}d.lx=e.clientX;d.lt=e.timeStamp;
 let x=dx;const dir=dx<0?1:-1;if(!canGo(dir))x=dx*.22; /* rubber-band at the ends / before the grade is chosen */
 d.dx=dx;place(d.o,x)});
function release(e,cancel){const d=drag;if(!d||(e&&e.pointerId!==d.id))return;drag=null;if(!d.locked)return;
 try{pc.releasePointerCapture(d.id)}catch(x){}swallow=true;setTimeout(()=>{swallow=false},60);
 const dir=d.dx<0?1:-1,ok=canGo(dir),W=d.o.W;
 if(!ok&&dir>0&&slide===gradeIdx()&&!selectedGrade&&Math.abs(d.dx)>40)toast('Choose your grade to continue');
 const commit=!cancel&&ok&&(Math.abs(d.dx)>W*.2||Math.abs(d.v)>.5&&Math.sign(d.v)===Math.sign(d.dx));
 settle(d.o,d.dx*(ok?1:.22),commit?dir:0)}
pc.addEventListener('pointerup',e=>release(e,false));pc.addEventListener('pointercancel',e=>release(e,true));
pc.addEventListener('click',e=>{if(swallow){e.stopPropagation();e.preventDefault()}},true);
document.addEventListener('keydown',e=>{if(mode!=='preview'||splashHolding()||e.target.closest&&e.target.closest('input,textarea,select'))return;if(e.key==='ArrowRight')swGo(1);else if(e.key==='ArrowLeft')swGo(-1)});
})();

/* ===================== v8 LIVE FEATURE SLIDES ===================== */
const SWX={raf:0,stop(){if(this.raf)cancelAnimationFrame(this.raf);this.raf=0;this.on=false}};
const swReduce=()=>!!(window.matchMedia&&matchMedia('(prefers-reduced-motion: reduce)').matches);
const swFmt=n=>Number(n).toLocaleString('en-US');
function swStats(){let d=null;try{d=window.__shbStats&&window.__shbStats()}catch(e){}return d||{bankTotal:0,answered:0,correct:0,accuracy:null,completion:0,topicsTotal:0,topicsStarted:0,topicsDone:0,studyMs:0,sessions:0}}
const swHuman=ms=>{const m=Math.round(ms/60000);return ms<60000?(Math.round(ms/1000)+'s'):(m<60?m+'m':Math.floor(m/60)+'h '+String(m%60).padStart(2,'0')+'m')};
/* ---- Study Timer slide ---- */
const SWT_TOTAL=25*60;
const SWT_CHRONO=(()=>{let t='';for(let i=0;i<60;i++){const mj=i%5===0,a=i*Math.PI/30,r1=mj?90.5:93.5,r2=98,X=r=>(100+r*Math.sin(a)).toFixed(2),Y=r=>(100-r*Math.cos(a)).toFixed(2);
 t+='<line class="swt-tk'+(mj?' mj':'')+'" x1="'+X(r1)+'" y1="'+Y(r1)+'" x2="'+X(r2)+'" y2="'+Y(r2)+'"/>'}
 return '<defs><linearGradient id="swtBz" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#5b4dff"/><stop offset=".5" stop-color="#35e6ff"/><stop offset="1" stop-color="#2f8bff"/></linearGradient><linearGradient id="swtMt" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#8cc4ff"/><stop offset="1" stop-color="#1d3f9c"/></linearGradient></defs>'+
 '<circle class="swt-bz" cx="100" cy="100" r="100.5"/>'+t+'<rect class="swt-mt" x="90" y="-9" width="20" height="10" rx="2.5"/>'+
 '<g transform="rotate(60 100 100)"><rect class="swt-mt" x="93" y="-7" width="14" height="9" rx="2.5"/></g><g transform="rotate(120 100 100)"><rect class="swt-mt" x="93" y="-7" width="14" height="9" rx="2.5"/></g>'})();
function timedTestScreen(){const st=swStats();
 const C=2*Math.PI*84;
 const real=st.sessions?`<b>${swHuman(st.studyMs)}</b> studied across <b>${st.sessions}</b> session${st.sessions===1?'':'s'} so far.`:`Your first session starts when you tap <b>Start</b> on the Study Timer bar inside the <b>Question Bank</b>.`;
 return screenShell(`<div class="screen-kicker sw-in" style="--i:0">STUDY TIMER</div><div class="screen-heading sw-in" style="--i:1">Time every study session.</div><p class="hero-sub sw-in" style="--i:2">See exactly how long you really study. Pause whenever you need — paused time is never counted.</p>
 <div class="swt-wrap sw-in" id="swtWrap" style="--i:3"><svg viewBox="0 0 200 200" aria-hidden="true" style="overflow:visible"><defs><linearGradient id="swtG" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#27d3ff"/><stop offset="1" stop-color="#2f8bff"/></linearGradient></defs>
  ${SWT_CHRONO}
  <circle cx="100" cy="100" r="84" fill="none" stroke="rgba(94,182,255,.14)" stroke-width="10"/>
  <circle id="swtArc" cx="100" cy="100" r="84" fill="none" stroke="url(#swtG)" stroke-width="10" stroke-linecap="round" stroke-dasharray="${C.toFixed(2)}" stroke-dashoffset="0" transform="rotate(-90 100 100)"/>
  <g id="swtKnob" style="transform-origin:100px 100px"><circle cx="100" cy="16" r="6.5" fill="#eaf6ff"/><circle cx="100" cy="16" r="11" fill="rgba(39,211,255,.28)"/></g><g id="swtHand" style="transform-origin:100px 100px"><line class="swt-hn" x1="100" y1="112" x2="100" y2="8"/><circle class="swt-hb" cx="100" cy="100" r="4"/></g></svg>
  <div class="swt-center"><b class="swt-digits" id="swtDigits">25:00</b><small>FOCUS SESSION</small><span class="swt-state"><i></i><span id="swtState">Studying · counting</span></span></div>
  <div class="sw-fchip sw-glass" style="left:-14px;top:14%;animation-delay:-1.2s">❚❚ Pause-safe</div><div class="sw-fchip sw-glass" style="right:-14px;bottom:12%">✓ Saved</div></div>
 <div class="swt-btns sw-in" style="--i:4"><button type="button" class="swt-btn" id="swtBtn" data-noswipe onclick="swtToggle()"><span id="swtBtnIc">❚❚</span><span id="swtBtnTx">Pause</span></button></div>
 <div class="swt-split sw-in" style="--i:5"><div class="sw-glass"><b id="swtActive">00:00</b><small>ACTIVE TIME</small></div><div class="sw-glass"><b id="swtPaused">00:00</b><small>PAUSED · NOT COUNTED</small></div></div>
 <div class="swt-real sw-glass sw-in" style="--i:6">${real}</div>${footer()}`,'swt')}
const swt={active:0,paused:0,run:true,last:0};
function swtRender(){const t=Math.max(0,SWT_TOTAL-swt.active/1000),C=2*Math.PI*84,arc=document.getElementById('swtArc');if(!arc)return false;
 arc.style.strokeDashoffset=String(C*(1-t/SWT_TOTAL));const k=document.getElementById('swtKnob');if(k)k.style.transform=`rotate(${(1-t/SWT_TOTAL)*360}deg)`;const hd=document.getElementById('swtHand');if(hd)hd.style.transform='rotate('+((swt.active/1000%60)*6)+'deg)';
 const f=m=>{const s=Math.floor(m/1000);return String(Math.floor(s/60)).padStart(2,'0')+':'+String(s%60).padStart(2,'0')};
 const set=(id,v)=>{const e=document.getElementById(id);if(e&&e.textContent!==v)e.textContent=v};
 set('swtDigits',f(Math.ceil(t)*1000));set('swtActive',f(swt.active));set('swtPaused',f(swt.paused));return true}
function swtLoop(now){if(!swtRender()){SWX.raf=0;return}const d=Math.min(100,now-swt.last);swt.last=now;
 if(!document.hidden){if(swt.run){swt.active+=d;if(swt.active>=SWT_TOTAL*1000){swt.active=0;swt.paused=0}}else swt.paused+=d}
 SWX.raf=requestAnimationFrame(swtLoop)}
function swtToggle(){swt.run=!swt.run;const w=document.getElementById('swtWrap'),sc=w&&w.closest('.swt');if(sc)sc.classList.toggle('swt-paused',!swt.run);
 const q=(id,v)=>{const e=document.getElementById(id);if(e)e.textContent=v};q('swtBtnIc',swt.run?'❚❚':'▶');q('swtBtnTx',swt.run?'Pause':'Resume');q('swtState',swt.run?'Studying · counting':'Paused · not counting')}
function swtStart(){swt.active=0;swt.paused=0;swt.run=true;swt.last=performance.now();swtRender();SWX.raf=requestAnimationFrame(swtLoop)}
/* ---- Study Statistics slide (real numbers; honest start state) ---- */
/* Onboarding preview only: illustrative numbers. They are computed here, shown here, and never written to any store or mixed with real statistics. */
function swsSample(){const r=swStats(),bank=r.bankTotal||0,ans=Math.round(bank*.46);
 return {bankTotal:bank,answered:ans,correct:Math.round(ans*.82),accuracy:82,completion:bank?Math.round(ans/bank*100):0,topicsTotal:r.topicsTotal,topicsStarted:Math.ceil(r.topicsTotal*.55),topicsDone:Math.floor(r.topicsTotal*.2),studyMs:45720000,sessions:0}}
function progressScreen(){const st=swsSample(),C=2*Math.PI*64,empty=false;
 const acc=st.accuracy===null?'—':st.accuracy+'%';
 return screenShell(`<div class="screen-kicker sw-in" style="--i:0">STUDY STATISTICS</div><div class="screen-heading sw-in" style="--i:1">Watch yourself improve.</div><p class="hero-sub sw-in" style="--i:2">Sample numbers, for preview only — this is how your Statistics will look and glow.</p>
 <div class="sws-ringwrap sw-in" id="swsWrap" style="--i:3"><svg viewBox="0 0 160 160" aria-hidden="true"><defs><linearGradient id="swsG" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#27d3ff"/><stop offset="1" stop-color="#2f8bff"/></linearGradient></defs>
  <circle cx="80" cy="80" r="64" fill="none" stroke="rgba(94,182,255,.16)" stroke-width="12"/>
  ${true?`<g class="sws-glint"><path d="M80 16 A64 64 0 0 1 120 28" fill="none" stroke="rgba(39,211,255,.55)" stroke-width="3" stroke-linecap="round"/></g>`:''}
  <circle id="swsArc" cx="80" cy="80" r="64" fill="none" stroke="url(#swsG)" stroke-width="12" stroke-linecap="round" stroke-dasharray="${C.toFixed(2)}" stroke-dashoffset="${C.toFixed(2)}" transform="rotate(-90 80 80)"/></svg>
  <div class="sws-center"><div class="sws-pct"><span id="swsPct" data-to="${st.completion}">0</span><sup>%</sup></div><small>OF THE BANK</small></div></div>
 <div class="sws-cap sw-in" style="--i:4"><b id="swsAns" data-to="${st.answered}">0</b> of <b>${swFmt(st.bankTotal)}</b> questions answered</div>
 <div class="sws-cards"><div class="sws-card sw-glass sw-in" style="--i:5"><b data-cnt="${st.answered}">0</b><small>ANSWERED</small></div><div class="sws-card sw-glass sw-in" style="--i:6"><b ${st.accuracy===null?'':`data-cnt="${st.accuracy}" data-suf="%"`}>${st.accuracy===null?'—':'0%'}</b><small>ACCURACY</small>${st.accuracy===null?'<em>after your first answer</em>':''}</div><div class="sws-card sw-glass sw-in" style="--i:7"><b>${swHuman(st.studyMs)}</b><small>STUDY TIME</small></div></div>
 <div class="sws-mini sw-in" style="--i:8"><div class="sws-mr sw-glass"><svg viewBox="0 0 60 60" aria-hidden="true"><circle class="t" cx="30" cy="30" r="24"/><circle class="a" data-ring="86" cx="30" cy="30" r="24" stroke-dasharray="150.80" stroke-dashoffset="150.80"/></svg><div><b data-cnt="6" data-suf=" days">0</b><small>STUDY STREAK</small></div></div><div class="sws-mr sw-glass"><svg viewBox="0 0 60 60" aria-hidden="true"><circle class="t" cx="30" cy="30" r="24"/><circle class="a" data-ring="70" cx="30" cy="30" r="24" stroke-dasharray="150.80" stroke-dashoffset="150.80"/></svg><div><b data-cnt="70" data-suf="%">0</b><small>DAILY GOAL</small></div></div></div>
 <div class="sws-note sw-in" style="--i:9">Sample data for this preview only — never saved, never mixed with your real statistics.</div>${footer()}`,'sws')}
function swsStart(){const C=2*Math.PI*64,st=swsSample(),arc=document.getElementById('swsArc');if(!arc)return;const to=st.completion,dur=swReduce()?0:1400;
 const t0=performance.now();const step=now=>{const el=document.getElementById('swsArc');if(!el){SWX.raf=0;return}const p=dur?Math.min(1,(now-t0)/dur):1,e=1-Math.pow(1-p,3);
  el.style.strokeDashoffset=String(C*(1-(to/100)*e));
  const g=(id,v)=>{const x=document.getElementById(id);if(x)x.textContent=String(Math.round(v*e))};g('swsPct',to);
  document.querySelectorAll('.sws [data-cnt]').forEach(n=>{n.textContent=swFmt(Math.round(Number(n.dataset.cnt)*e))+(n.dataset.suf||'')});
  const a=document.getElementById('swsAns');if(a)a.textContent=swFmt(Math.round(st.answered*e));document.querySelectorAll('.sws [data-ring]').forEach(c=>{const L=2*Math.PI*Number(c.getAttribute('r'));c.style.strokeDashoffset=String(L*(1-(Number(c.dataset.ring)/100)*e))});
  if(p<1)SWX.raf=requestAnimationFrame(step);else SWX.raf=0};
 SWX.raf=requestAnimationFrame(step)}
/* every time a slide is drawn: stop whatever the previous slide was animating, then start this slide's live motion (never moves to another slide) */
const __swRender=renderSlide;renderSlide=function(){SWX.stop();__swRender.apply(this,arguments);try{if(document.getElementById('swtWrap'))swtStart();else if(document.getElementById('swsWrap'))swsStart()}catch(e){console.error(e)}};
Object.assign(window,{swtToggle});

launchExperience();