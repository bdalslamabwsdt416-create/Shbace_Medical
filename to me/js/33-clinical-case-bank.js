/* Shbace Medical · AI Clinical Cases
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
      <div class="cc-topline"><span class="cc-kicker">${$esc(kicker)}</span></div>
      <h1>${$esc(title)}</h1>${subtitle ? `<p class="sub">${$esc(subtitle)}</p>` : ''}
      ${inner}
    </div>`;
  }


  function shbIconShape(name) {
    const n=String(name||'').toLowerCase();
    const shapes=[
      [/central nervous|neurolog|cns|seizure|epilep|mening|brain/,'<path d="M24 8c-3-4-10-2-10 4-5 1-6 8-2 11-3 5 1 11 6 11 2 5 8 5 10 1 3 4 9 3 10-2 5-1 7-7 3-11 3-5 0-10-5-10-1-6-8-7-12-4Z"/><path d="M24 9v29M14 17c4 0 6 3 6 6m-8 2c4-1 7 1 8 5m14-14c-4 0-6 3-6 6m9 3c-4-1-7 1-8 5m-5-17c-3 2-3 5 0 7"/>'],
      [/cardio|cardiovascular|heart|cardiac|septal|tetralogy|endocard/,'<path d="M24 39S7 29 7 17c0-8 10-12 17-3 7-9 17-5 17 3 0 12-17 22-17 22Z"/><path d="M10 23h8l4-8 5 16 4-8h7"/>'],
      [/respirat|lung|asthma|pneumonia|bronchi|croup/,'<path d="M23 10v13m2-13v13M23 19c-5 0-8 4-10 10l-3 8c-1 3 2 5 5 4l9-4V19Zm2 0c5 0 8 4 10 10l3 8c1 3-2 5-5 4l-9-4V19Z"/><path d="M23 23 17 29m8-6 6 6"/>'],
      [/gastro|digestive|hepat|liver|stomach|intestinal|diarr|coeliac|celiac|git/,'<path d="M17 8c-2 7 1 9 5 11 3 2 2 6-1 7-4 1-5 5-2 9 3 4 11 4 15 0 3-3 2-7-2-9-4-2-3-6 0-9 3-3 2-7-1-9"/><path d="M17 14c-4 0-7 3-7 7m24 5c4 1 6 4 5 8M17 34c-3 1-5 3-5 6"/>'],
      [/nephro|renal|kidney|urinary|urolog/,'<path d="M18 9c-7 0-11 8-9 17 1 7 6 11 11 8 4-2 3-7 2-11-1-5 1-14-4-14Zm12 0c7 0 11 8 9 17-1 7-6 11-11 8-4-2-3-7-2-11 1-5-1-14 4-14Z"/><path d="M19 31c1 5 3 7 5 9m5-9c-1 5-3 7-5 9"/>'],
      [/endocrin|hormone|thyroid|diabet|adrenal/,'<path d="M24 8c-4 5-9 9-9 16a9 9 0 0 0 18 0c0-7-5-11-9-16Z"/><path d="M18 25c3-3 9-3 12 0m-6-5v11"/>'],
      [/neonat|newborn|infant|prematur|birth/,'<circle cx="24" cy="19" r="10"/><path d="M19 19h.1m10 0h.1m-8 5c2 2 4 2 6 0M12 39c2-7 7-10 12-10s10 3 12 10M17 11c2-5 12-6 16 0"/>'],
      [/infect|vaccin|immun|virus|bacter|fever|sepsis/,'<path d="M24 6 39 12v11c0 9-6 15-15 19C15 38 9 32 9 23V12l15-6Z"/><circle cx="24" cy="23" r="7"/><path d="m24 12 0 4m0 14v4m-11-11h4m14 0h4m-19-8 3 3m10 10 3 3m0-16-3 3m-10 10-3 3"/>'],
      [/haemat|hemat|blood|anaemia|anemia|iron|sickle/,'<path d="M24 6c-5 8-13 15-13 23a13 13 0 0 0 26 0C37 21 29 14 24 6Z"/><path d="M17 29c1 5 4 7 8 7m-1-19 0 5"/>'],
      [/growth|development|nutrition|milestone|feeding|obesity/,'<path d="M10 39V9m0 30h29M17 33V25h6v8m5 0V17h6v16m5 0V11h4v22"/><path d="m15 18 7-5 6 2 9-8"/>'],
      [/genetic|dna|chromosom|inherit|dermat/,'<path d="M14 8c0 12 20 20 20 32M34 8C34 20 14 28 14 40"/><path d="M17 13h14M17 22h14M17 31h14M17 36h14"/>'],
      [/rheumat|metabolic|poison|joint|arthritis|musculoskeletal/,'<path d="m12 12 10 10m4 4 10 10M10 10l5-3 8 8-3 5-8-8Zm28 28-5 3-8-8 3-5 8 8Z"/><circle cx="24" cy="24" r="5"/><path d="M24 14v5m0 10v5m-10-10h5m10 0h5"/>']
    ];
    const hit=shapes.find(x=>x[0].test(n));
    return hit?hit[1]:'<path d="M24 6 39 15v18l-15 9L9 33V15l15-9Z"/><path d="M16 24h16m-8-8v16"/>';
  }
  function shbSvgIcon(name,extra) {
    return '<svg class="shb-bank-line-icon '+(extra||'')+'" viewBox="0 0 48 48" role="img" aria-hidden="true">'+shbIconShape(name)+'</svg>';
  }
  function shbSystemIcon(name) { return shbSvgIcon(name,'shb-system-icon'); }
  function shbTopicIcon(name,systemName) { return shbSvgIcon(name+' '+systemName,'shb-topic-icon'); }
  function shbBankEmblem07() {
    return '<svg class="shb-bank-emblem shb-bank-emblem-07" viewBox="0 0 80 80" role="img" aria-label="AI Clinical Cases"><defs><linearGradient id="shb07g" x1="8" y1="8" x2="70" y2="72"><stop stop-color="#C8FFF0"/><stop offset=".55" stop-color="#55D9BC"/><stop offset="1" stop-color="#278FA5"/></linearGradient></defs><path d="M24 10h23l12 12v40a6 6 0 0 1-6 6H24a6 6 0 0 1-6-6V16a6 6 0 0 1 6-6Z" fill="#102F42" stroke="url(#shb07g)" stroke-width="2.4"/><path d="M47 11v11h11" fill="none" stroke="#C8FFF0" stroke-width="2.2" stroke-linejoin="round"/><path d="M24 39h9l5-11 7 22 5-11h7" fill="none" stroke="#D9FFF5" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/><path d="M27 54h26M27 60h17" stroke="#6FDAC6" stroke-width="2" stroke-linecap="round"/></svg>';
  }
  function shbBankEmblem08() {
    return '<svg class="shb-bank-emblem shb-bank-emblem-08" viewBox="0 0 80 80" role="img" aria-label="AI Generated"><defs><linearGradient id="shb08g" x1="10" y1="8" x2="69" y2="71"><stop stop-color="#C9E9FF"/><stop offset=".55" stop-color="#6BCBFF"/><stop offset="1" stop-color="#9A8CFF"/></linearGradient></defs><ellipse cx="40" cy="40" rx="28" ry="12" transform="rotate(-34 40 40)" fill="none" stroke="url(#shb08g)" stroke-width="2.2"/><ellipse cx="40" cy="40" rx="28" ry="12" transform="rotate(38 40 40)" fill="none" stroke="url(#shb08g)" stroke-width="2.2" opacity=".7"/><path d="m40 23 15 17-15 17-15-17 15-17Z" fill="#153D5C" stroke="url(#shb08g)" stroke-width="2.5"/><path d="m40 31 7 9-7 9-7-9 7-9Z" fill="#A8E8FF" fill-opacity=".2" stroke="#D4F4FF" stroke-width="1.8"/><path d="m17 19 2.5 5.5L25 27l-5.5 2.5L17 35l-2.5-5.5L9 27l5.5-2.5L17 19Zm47 24 2 4 4 2-4 2-2 4-2-4-4-2 4-2 2-4Z" fill="#B9E7FF"/></svg>';
  }

  function shbCaseIcon() {
    return '<svg class="shb-bank-line-icon" viewBox="0 0 48 48" aria-hidden="true"><path d="M14 7h14l8 8v26H14a3 3 0 0 1-3-3V10a3 3 0 0 1 3-3Z"/><path d="M28 7v9h8M17 25h16M17 31h12M17 19h5"/><path d="m23 13 3 3-3 3"/></svg>';
  }

  function progress(done, total) {
    const p=percent(done,total);
    return `<div class="cc-progress"><div class="cc-progress-meta"><span>${done} / ${total} answered</span><b>${p}%</b></div><div class="bar"><span style="width:${p}%"></span></div></div>`;
  }
  function backButton(label) {
    return `<button type="button" class="backb cc-back" onclick="bank07ClinicalCaseBack()"><span aria-hidden="true">‹</span> ${$esc(label || 'Back')}</button>`;
  }
  function loadingPage() {
    return pageShell('AI CLINICAL CASES','AI Clinical Cases','Clinical case-based questions, organized by medical system and topic.',
      `<div class="card setcard cc-loading"><div class="cc-loader"></div><h3>Loading clinical cases…</h3><p class="meta">The bank is being prepared on this device.</p></div>`);
  }
  function errorPage() {
    return pageShell('AI CLINICAL CASES','AI Clinical Cases','The source data could not be loaded.',
      `<div class="card setcard"><h3>AI Clinical Cases bank unavailable</h3><p class="meta">${$esc(dataError || 'The data file could not be opened.')}</p><button type="button" class="btn primary block" onclick="bank07RetryClinicalCaseData()">Try again</button></div>`);
  }
  function systemsPage() {
    if (!data) return dataError ? errorPage() : loadingPage();
    const cards=data.systems.map(system=>{
      const qs=systemQuestions(system),done=answerCount(qs),p=percent(done,qs.length);
      return `<button type="button" class="card sc cc-list-card" onclick="bank07OpenClinicalCaseSystem('${system.id}')">
        <span class="cc-sys-icon cc-icon-art" aria-hidden="true">${shbSystemIcon(system.name)}</span>
        <span class="cc-list-copy"><strong>${$esc(system.name)}</strong><small>${system.topics.length} topics · ${qs.length} questions</small>
        <span class="bar"><span style="width:${p}%"></span></span></span><span class="chev">›</span></button>`;
    }).join('');
    const total=allQuestions(),done=answerCount(total);
    return pageShell('AI CLINICAL CASES','AI Clinical Cases',
      'Choose a medical system to browse AI-assisted clinical cases and their topics.',
      `${progress(done,total.length)}
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
        <span class="cc-topic-number cc-icon-art" aria-hidden="true">${shbTopicIcon(topic.name,system.name)}</span>
        <span class="cc-list-copy"><strong>${$esc(topic.name)}</strong><small>${topic.cases.length} clinical cases · ${qs.length} questions</small>
        <span class="bar"><span style="width:${p}%"></span></span></span><span class="chev">›</span></button>`;
    }).join('');
    const qs=systemQuestions(system),done=answerCount(qs);
    return pageShell('MEDICAL SYSTEM',system.name,
      `${system.topics.length} topics · ${qs.length} clinical case questions`,
      `${backButton('Medical Systems')}${progress(done,qs.length)}
       <div class="cc-section-heading">Topics <span>${system.topics.length}</span></div><div class="cc-list">${cards}</div>`);
  }
  function casesPage() {
    const system=findSystem(),topic=findTopic();
    if (!system || !topic) return topicsPage();
    const cards=topic.cases.map(item=>{
      const qs=item.questions,done=answerCount(qs),p=percent(done,qs.length);
      const label=item.sourceHeadingPresent ? item.title : 'Questions';
      return `<button type="button" class="card sc cc-case-card" onclick="bank07OpenClinicalCase('${item.id}')">
        <span class="cc-case-icon cc-icon-art" aria-hidden="true">${shbCaseIcon()}</span>
        <span class="cc-list-copy"><strong>${$esc(label)}</strong><small>${qs.length} questions${item.hasSharedCaseText ? ' · Shared clinical history' : ' · Topic questions'}</small>
        <span class="bar"><span style="width:${p}%"></span></span></span><span class="chev">›</span></button>`;
    }).join('');
    const qs=topicQuestions(topic),done=answerCount(qs);
    return pageShell('TOPIC',topic.name,
      `${topic.cases.length} clinical cases · ${qs.length} questions`,
      `${backButton(system.name)}${progress(done,qs.length)}
       <div class="cc-section-heading">Clinical Cases <span>${topic.cases.length}</span></div><div class="cc-list">${cards}</div>`);
  }
  function questionCard(q,index) {
    const saved=answers[q.id] || null;
    const selected=saved && saved.selected ? saved.selected : '';
    const isDone=!!selected;
    const correct=q.correctAnswer;
    const correctText=q.options.find(option=>option.label===correct)?.text || q.correctAnswerText || '';
    const optionHtml=q.options.map(option=>{
      const label=option.label;
      const isCorrect=label===correct;
      const isSelected=label===selected;
      const cls=!isDone?'':isCorrect?' correct':isSelected?' incorrect':' dim';
      const disabled=isDone?' disabled':'';
      const mark=isDone&&isCorrect?'<span class="ck">✓</span>':isDone&&isSelected&&!isCorrect?'<span class="ck x">×</span>':'';
      return '<button type="button" class="qopt'+cls+'"'+disabled+' onclick="bank07AnswerClinicalCaseQuestion(\''+q.id+'\',\''+label+'\')"><i>'+label+'</i><span>'+$esc(option.text)+'</span>'+mark+'</button>';
    }).join('');
    const initial=isDone?'<div class="qreact '+(saved.correct?'ok':'no')+'"><div><b>'+(saved.correct?'Correct':'Incorrect')+'</b><span>'+(saved.correct?'Well done. Review the key explanation below.':'Review the correct answer and explanation below.')+'</span></div></div>'+
      '<div class="qfb '+(saved.correct?'':'no')+'"><b>Correct answer: '+correct+'. '+$esc(correctText)+'</b><p>'+formatText(q.initialExplanation)+'</p></div>':'';
    const source=q.source||{};
    const pages=source.pages?'<span> · Page'+(/[-–—,]|and/i.test(String(source.pages))?'s':'')+' '+$esc(source.pages)+'</span>':'';
    const readMore=isDone?'<details class="nl-more" '+(saved.readMore?'open':'')+' ontoggle="bank07SetClinicalCaseReadMore(\''+q.id+'\',this.open)"><summary>Read More</summary><div class="nl-more-body">'+
      '<section><h4>Detailed Explanation</h4><div>'+formatText(q.detailedExplanation)+'</div></section>'+
      '<section><h4>High-Yield Points</h4><div>'+formatText(q.highYieldPoints)+'</div></section>'+
      '<p class="nl-source">Source: '+$esc(source.sheet||source.raw||'Course sheet')+pages+(source.raw?'<br><small>'+$esc(source.raw)+'</small>':'')+'</p></div></details>':'';
    return '<article class="qcard" id="qc-'+q.id+'" data-id="'+q.id+'"><div class="qtop"><span class="qid">QUESTION '+(index+1)+'</span></div>'+
      '<h3 class="qstem">'+$esc(q.stem)+'</h3><div class="qopts">'+optionHtml+'</div>'+initial+readMore+'</article>';
  }
  function questionsPage() {
    const system=findSystem(),topic=findTopic();
    if (!system || !topic) return topicsPage();
    const qs=topicQuestions(topic),done=answerCount(qs);
    let questionNumber=0;
    const blocks=topic.cases.map(item=>{
      const heading=item.hasSharedCaseText
        ? '<div class="cc-vignette"><div class="cc-vignette-title"><span>CLINICAL CASE</span>'+(item.number?'<b>CASE '+String(item.number).padStart(2,'0')+'</b>':'')+'</div><h2>'+$esc(item.title)+'</h2><div class="cc-rich">'+formatText(item.vignette)+'</div></div>'
        : (item.sourceHeadingPresent&&topic.cases.length>1?'<div class="cc-section-heading">'+$esc(item.title)+'</div>':'');
      return heading+'<div class="cc-question-list">'+item.questions.map(q=>questionCard(q,questionNumber++)).join('')+'</div>';
    }).join('');
    return pageShell('AI CLINICAL CASES · '+system.name.toUpperCase(),topic.name,
      qs.length+' questions · '+done+' answered',
      backButton(system.name)+progress(done,qs.length)+blocks,
      'qb ped-bank-topics');
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
    appPage='clinicalQuestions';renderAppDemo();
  };
  window.bank07OpenClinicalCase=function(id) {
    const topic=findTopic();
    if(!topic || !safeId(id) || !topic.cases.some(x=>x.id===id))return;
    selectedCase=id;
    appPage='clinicalQuestions';renderAppDemo();
  };
  window.bank07ClinicalCaseBack=function() {
    if(appPage==='clinicalQuestions')appPage='clinicalTopics';
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
  window.bank07SetClinicalCaseReadMore=function(id,isOpen) {
    const saved=answers[id];
    if(!saved)return;
    saved.readMore=!!isOpen;
    saveAnswers();
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
      <div class="ped-collection-avatar ped-avatar-allonce ped-avatar-icon ped-avatar-clinical" role="img" aria-label="AI Clinical Cases question bank">${shbBankEmblem07()}</div>
      <span class="ped-collection-copy"><span class="eyebrow">AI CLINICAL CASES QUESTION BANK</span><b>AI Clinical Cases</b>
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
    if(String(page).startsWith('clinical'))appPage='subjects';
    let result;
    try { result=oldRender.apply(this,arguments); }
    finally { appPage=page; }
    if(String(page).startsWith('clinical')) {
      try {
        const screen=document.querySelector('#phoneContent .screen');
        if(screen)screen.innerHTML=appHeader('AI Clinical Cases')+'<div class="app-scroll">'+currentView()+'</div>'+appNav();
      } catch(error) { console.error('AI Clinical Cases render failed',error); }
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