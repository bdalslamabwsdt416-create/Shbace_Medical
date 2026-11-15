/* Shbace Medical · Bank 07 · Clinical Case
   Separate case-based collection. Original Pediatrics QB state and records are never mutated. */
(function () {
  'use strict';

  const BANK_TOTAL = 1598;
  const STORE_KEY = 'shbace_clinical_case_answers_v1';
  const $esc = value => String(value == null ? '' : value).replace(/[&<>"']/g, c => ({
    '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'
  }[c]));
  const safeId = value => /^[A-Za-z0-9_-]+$/.test(String(value || ''));
  let data = null;
  let dataPromise = null;
  let dataError = '';
  let selectedSystem = '';
  let selectedTopic = '';
  let selectedCase = '';
  let answers = loadAnswers();

  function loadAnswers() {
    try {
      const value = JSON.parse(localStorage.getItem(STORE_KEY) || '{}');
      return value && typeof value === 'object' && !Array.isArray(value) ? value : {};
    } catch (_) { return {}; }
  }
  function saveAnswers() {
    try { localStorage.setItem(STORE_KEY, JSON.stringify(answers)); }
    catch (_) { try { toast('Could not save Clinical Case progress on this device.'); } catch (e) {} }
  }
  function allQuestions() {
    if (!data) return [];
    const result = [];
    data.systems.forEach(system => system.topics.forEach(topic => topic.cases.forEach(item => {
      item.questions.forEach(question => result.push(question));
    })));
    return result;
  }
  function answerCount(items) {
    return items.reduce((n, q) => n + (answers[q.id] && answers[q.id].selected ? 1 : 0), 0);
  }
  function percent(done, total) { return total ? Math.round(done * 100 / total) : 0; }
  function systemQuestions(system) {
    return system.topics.flatMap(topic => topic.cases.flatMap(item => item.questions));
  }
  function topicQuestions(topic) {
    return topic.cases.flatMap(item => item.questions);
  }
  function findSystem() { return data && data.systems.find(x => x.id === selectedSystem); }
  function findTopic() { const s=findSystem(); return s && s.topics.find(x => x.id === selectedTopic); }
  function findCase() { const t=findTopic(); return t && t.cases.find(x => x.id === selectedCase); }
  function formatText(value) {
    let html = $esc(value || '');
    html = html.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
    html = html.replace(/`([^`]+)`/g, '<code>$1</code>');
    html = html.replace(/^- /gm, '• ');
    return html.replace(/\n/g, '<br>');
  }
  function pageShell(kicker, title, subtitle, inner) {
    return `<div class="rs cc-page">
      <div class="cc-topline"><span class="cc-bank-number">BANK 07</span><span class="cc-kicker">${$esc(kicker)}</span></div>
      <h1>${$esc(title)}</h1>${subtitle ? `<p class="sub">${$esc(subtitle)}</p>` : ''}
      ${inner}
    </div>`;
  }
  function progress(done, total) {
    const p=percent(done,total);
    return `<div class="cc-progress"><div class="cc-progress-meta"><span>${done} / ${total} answered</span><b>${p}%</b></div><div class="bar"><span style="width:${p}%"></span></div></div>`;
  }
  function backButton(label) {
    return `<button type="button" class="backb cc-back" onclick="bank07ClinicalCaseBack()"><span aria-hidden="true">‹</span> ${$esc(label || 'Back')}</button>`;
  }
  function loadingPage() {
    return pageShell('CLINICAL CASE-BASED QUESTION BANK','Clinical Case','Based on Dr. Abdulrahman Al-Juaiki’s course sheets and teaching materials.',
      `<div class="card setcard cc-loading"><div class="cc-loader"></div><h3>Loading clinical cases…</h3><p class="meta">The bank is being prepared on this device.</p></div>`);
  }
  function errorPage() {
    return pageShell('CLINICAL CASE-BASED QUESTION BANK','Clinical Case','The source data could not be loaded.',
      `<div class="card setcard"><h3>Clinical Case bank unavailable</h3><p class="meta">${$esc(dataError || 'The data file could not be opened.')}</p><button type="button" class="btn primary block" onclick="bank07RetryClinicalCaseData()">Try again</button></div>`);
  }
  function systemsPage() {
    if (!data) return dataError ? errorPage() : loadingPage();
    const cards=data.systems.map(system=>{
      const qs=systemQuestions(system),done=answerCount(qs),p=percent(done,qs.length);
      return `<button type="button" class="card sc cc-list-card" onclick="bank07OpenClinicalCaseSystem('${system.id}')">
        <span class="cc-sys-icon" aria-hidden="true">${$esc(system.name.split(/\s+/).map(w=>w[0]).slice(0,2).join(''))}</span>
        <span class="cc-list-copy"><strong>${$esc(system.name)}</strong><small>${system.topics.length} topics · ${qs.length} questions</small>
        <span class="bar"><span style="width:${p}%"></span></span></span><span class="chev">›</span></button>`;
    }).join('');
    const total=allQuestions(),done=answerCount(total);
    return pageShell('SEVENTH QUESTION BANK','Clinical Case',
      'A clinical case-based question bank developed from Dr. Abdulrahman Al-Juaiki’s course sheets and teaching materials.',
      `${progress(done,total)}
       <div class="cc-description card"><b>How this bank is organized</b><p>Choose a medical system, open a topic, then study each clinical case and its linked questions. The shared case history is shown once before its questions.</p></div>
       <div class="cc-section-heading">Medical Systems <span>${data.systems.length}</span></div>
       <div class="cc-list">${cards}</div>`);
  }
  function topicsPage() {
    const system=findSystem();
    if (!system) return systemsPage();
    const cards=system.topics.map(topic=>{
      const qs=topicQuestions(topic),done=answerCount(qs),p=percent(done,qs.length);
      return `<button type="button" class="card sc cc-list-card" onclick="bank07OpenClinicalCaseTopic('${topic.id}')">
        <span class="cc-topic-number">${String(topic.number || 0).padStart(2,'0')}</span>
        <span class="cc-list-copy"><strong>${$esc(topic.name)}</strong><small>${topic.cases.length} clinical cases · ${qs.length} questions</small>
        <span class="bar"><span style="width:${p}%"></span></span></span><span class="chev">›</span></button>`;
    }).join('');
    const qs=systemQuestions(system),done=answerCount(qs);
    return pageShell(system.name.toUpperCase(),system.name,
      `${system.topics.length} topics · ${qs.length} clinical case questions`,
      `${backButton('Medical Systems')}${progress(done,qs.length)}
       <div class="cc-section-heading">Topics <span>${system.topics.length}</span></div><div class="cc-list">${cards}</div>`);
  }
  function casesPage() {
    const system=findSystem(),topic=findTopic();
    if (!system || !topic) return topicsPage();
    const cards=topic.cases.map(item=>{
      const qs=item.questions,done=answerCount(qs),p=percent(done,qs.length);
      const label=item.sourceHeadingPresent ? item.title : 'Topic Questions';
      return `<button type="button" class="card sc cc-case-card" onclick="bank07OpenClinicalCase('${item.id}')">
        <span class="cc-case-icon" aria-hidden="true">${item.number ? String(item.number).padStart(2,'0') : 'Q'}</span>
        <span class="cc-list-copy"><strong>${$esc(label)}</strong><small>${qs.length} questions${item.hasSharedCaseText ? ' · Shared clinical history' : ' · No separate case narrative in source'}</small>
        <span class="bar"><span style="width:${p}%"></span></span></span><span class="chev">›</span></button>`;
    }).join('');
    const qs=topicQuestions(topic),done=answerCount(qs);
    return pageShell(topic.name.toUpperCase(),topic.name,
      `${topic.cases.length} clinical cases · ${qs.length} questions`,
      `${backButton(system.name)}${progress(done,qs.length)}
       <div class="cc-section-heading">Clinical Cases <span>${topic.cases.length}</span></div><div class="cc-list">${cards}</div>`);
  }
  function questionCard(q,index) {
    const saved=answers[q.id] || null;
    const selected=saved && saved.selected ? saved.selected : '';
    const isDone=!!selected;
    const correct=q.correctAnswer;
    const optionHtml=q.options.map(option=>{
      const label=option.label;
      const isCorrect=label===correct;
      const isSelected=label===selected;
      const cls=!isDone?'':isCorrect?' correct':isSelected?' incorrect':' dim';
      const disabled=isDone?' disabled':'';
      const mark=isDone&&isCorrect?'<span class="ck">✓</span>':isDone&&isSelected&&!isCorrect?'<span class="ck x">×</span>':'';
      return `<button type="button" class="qopt${cls}"${disabled} onclick="bank07AnswerClinicalCaseQuestion('${q.id}','${label}')">
        <i>${label}</i><span>${$esc(option.text)}</span>${mark}</button>`;
    }).join('');
    const initial=isDone?`<div class="qfb${saved.correct?'':' no'}">
       <b>${saved.correct?'Correct answer':'Not quite — review the correct answer'}</b>
       <p><strong>${correct}. ${$esc(q.options.find(x=>x.label===correct)?.text || q.correctAnswerText)}</strong></p>
       <p>${formatText(q.initialExplanation)}</p>
     </div>`:'';
    const readMore=isDone?`<div class="cc-readmore">
       <button type="button" class="btn sm" aria-expanded="${saved.readMore?'true':'false'}" onclick="bank07ToggleClinicalCaseReadMore('${q.id}')">${saved.readMore?'Show less':'Read More'}</button>
       ${saved.readMore?`<div class="cc-expanded">
         <section><h4>Detailed Explanation</h4><div class="cc-rich">${formatText(q.detailedExplanation)}</div></section>
         <section><h4>High-Yield Points</h4><div class="cc-rich">${formatText(q.highYieldPoints)}</div></section>
         <section class="cc-source"><h4>Source</h4><div><b>${$esc(q.source.sheet || q.source.raw || 'Course sheet')}</b>
         ${q.source.pages?`<span>Page${/[-??,]|and/i.test(String(q.source.pages))?'s':''} ${$esc(q.source.pages)}</span>`:''}
         <small>${$esc(q.source.raw || '')}</small></div></section>
       </div>`:''}
     </div>`:'';
    return `<article class="qcard cc-question" id="ccq-${q.id}">
      <div class="cc-question-head"><span class="qid">QUESTION ${index+1}</span><span class="cc-difficulty ${q.difficulty.toLowerCase()}">${$esc(q.difficulty)}</span></div>
      <div class="qstem">${$esc(q.stem)}</div>
      <div class="cc-options">${optionHtml}</div>${initial}${readMore}
    </article>`;
  }
  function questionsPage() {
    const system=findSystem(),topic=findTopic(),item=findCase();
    if (!system || !topic || !item) return casesPage();
    const qs=item.questions,done=answerCount(qs);
    const vignette=item.hasSharedCaseText
      ? `<div class="cc-vignette"><div class="cc-vignette-title"><span>CLINICAL CASE</span>${item.number ? `<b>CASE ${String(item.number).padStart(2,'0')}</b>`:''}</div><h2>${$esc(item.title)}</h2><div class="cc-rich">${formatText(item.vignette)}</div></div>`
      : `<div class="cc-vignette cc-vignette-note"><div class="cc-vignette-title"><span>TOPIC QUESTIONS</span></div><p>The supplied Markdown file contains these questions under this topic but does not provide a separate shared clinical case narrative.</p></div>`;
    return pageShell(system.name.toUpperCase()+' · '+topic.name.toUpperCase(),item.title,
      `${qs.length} questions · ${done} answered`,
      `${backButton('Clinical Cases')}${progress(done,qs.length)}
       ${vignette}<div class="cc-section-heading">Questions <span>${qs.length}</span></div>
       <div class="cc-question-list">${qs.map((q,i)=>questionCard(q,i)).join('')}</div>`);
  }
  function currentView() {
    if (appPage==='clinicalSystems') return systemsPage();
    if (appPage==='clinicalTopics') return topicsPage();
    if (appPage==='clinicalCases') return casesPage();
    if (appPage==='clinicalQuestions') return questionsPage();
    return '';
  }
  function ensureData() {
    if (data) return Promise.resolve(data);
    if (dataPromise) return dataPromise;
    dataPromise=fetch(new URL('data/clinicalCaseBank.json',document.baseURI).href,{cache:'no-cache'})
      .then(response=>{if(!response.ok)throw new Error('HTTP '+response.status);return response.json();})
      .then(json=>{
        if(!json || json.schema!=='shbace-clinical-case-bank-v1' || !Array.isArray(json.systems) || json.systems.length!==10) {
          throw new Error('Clinical Case data validation failed.');
        }
        data=json;
        dataError='';
        return data;
      }).catch(error=>{
        dataError=error && error.message ? error.message : 'Unknown data loading error';
        dataPromise=null;
        throw error;
      });
    return dataPromise;
  }

  window.openClinicalCaseBank07=function() {
    window.__SHB_PED_COLLECTION__='clinicalcase-bank07';
    appPage='clinicalSystems';
    renderAppDemo();
    ensureData().then(()=>renderAppDemo()).catch(()=>renderAppDemo());
  };
  window.bank07RetryClinicalCaseData=function() {
    dataPromise=null;dataError='';
    renderAppDemo();
    ensureData().then(()=>renderAppDemo()).catch(()=>renderAppDemo());
  };
  window.bank07OpenClinicalCaseSystem=function(id) {
    if(!data || !safeId(id))return;
    if(!data.systems.some(x=>x.id===id))return;
    selectedSystem=id;selectedTopic='';selectedCase='';
    appPage='clinicalTopics';renderAppDemo();
  };
  window.bank07OpenClinicalCaseTopic=function(id) {
    const system=findSystem();
    if(!system || !safeId(id) || !system.topics.some(x=>x.id===id))return;
    selectedTopic=id;selectedCase='';
    appPage='clinicalCases';renderAppDemo();
  };
  window.bank07OpenClinicalCase=function(id) {
    const topic=findTopic();
    if(!topic || !safeId(id) || !topic.cases.some(x=>x.id===id))return;
    selectedCase=id;
    appPage='clinicalQuestions';renderAppDemo();
  };
  window.bank07ClinicalCaseBack=function() {
    if(appPage==='clinicalQuestions')appPage='clinicalCases';
    else if(appPage==='clinicalCases')appPage='clinicalTopics';
    else if(appPage==='clinicalTopics')appPage='clinicalSystems';
    else { appPage='specialties'; window.__SHB_PED_COLLECTION__=''; }
    renderAppDemo();
  };
  window.bank07AnswerClinicalCaseQuestion=function(id,label) {
    if(!safeId(id) || !'ABCDE'.includes(label))return;
    const q=allQuestions().find(x=>x.id===id);
    if(!q || answers[id])return;
    answers[id]={selected:label,correct:label===q.correctAnswer,answeredAt:Date.now(),readMore:false};
    saveAnswers();
    renderAppDemo();
  };
  window.bank07ToggleClinicalCaseReadMore=function(id) {
    const saved=answers[id];
    if(!saved)return;
    saved.readMore=!saved.readMore;
    saveAnswers();
    renderAppDemo();
  };

  const oldSpecialtiesView=typeof specialtiesView==='function'?specialtiesView:null;
  if(oldSpecialtiesView) specialtiesView=function() {
    let html=oldSpecialtiesView.apply(this,arguments);
    if(!String(html).includes('ped-collections-grid') || String(html).includes('ped-collection-bank07')) return html;
    const card=`<button type="button" class="ped-collection-card ped-collection-clinicalcase ped-collection-bank07" onclick="openClinicalCaseBank07()">
      <div class="ped-collection-avatar ped-avatar-allonce ped-avatar-icon ped-avatar-clinical" role="img" aria-label="Clinical Case question bank"><span class="ped-avatar-initials">07</span></div>
      <span class="ped-collection-copy"><span class="eyebrow">CLINICAL CASE QUESTION BANK</span><b>Clinical Case</b>
      <small>Clinical case-based questions, organized by medical system, topic and case.</small>
      <span class="ped-collection-count">${BANK_TOTAL.toLocaleString()} questions · 10 medical systems</span></span><span class="ped-collection-arrow">›</span></button>`;
    html=html.replace('</div><div class="ped-collection-footnote">',card+'</div><div class="ped-collection-footnote">');
    html=html.replace('The six collections remain separate.','The seven collections remain separate.');
    return html;
  };

  const oldAppNav=appNav;
  appNav=function() {
    const page=appPage;
    if(String(page).startsWith('clinical'))appPage='subjects';
    try{return oldAppNav.apply(this,arguments);}
    finally{appPage=page;}
  };
  const oldRender=renderAppDemo;
  renderAppDemo=function() {
    const page=appPage;
    const result=oldRender.apply(this,arguments);
    if(String(page).startsWith('clinical')) {
      try {
        const screen=document.querySelector('#phoneContent .screen');
        const scroll=screen && (screen.querySelector(':scope > .app-scroll') || screen);
        if(scroll)scroll.innerHTML=appHeader('Clinical Case')+currentView()+appNav();
      } catch(error) { console.error('Clinical Case render failed',error); }
    }
    return result;
  };

  window.__shbClinicalCaseBank={
    count:()=>data?allQuestions().length:BANK_TOTAL,
    systems:()=>data?data.systems.length:10,
    answered:()=>answerCount(allQuestions()),
    dataLoaded:()=>!!data,
    validation:()=>data?data.validation:null
  };
})();