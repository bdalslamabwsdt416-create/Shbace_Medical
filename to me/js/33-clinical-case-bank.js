/* Shbace Medical · AI Clinical Cases
   Separate case-based collection. Original Pediatrics QB state and records are never mutated.
   Systems and topics use the same cards, large icons and layout as the Dr. Al-Joaki bank. */
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

  /* Shared names and icons (js/42-pediatrics-collection-polish.js): one spelling per system/topic, one picture per different system/topic. */
  function icons() { return window.__SHB_BANK_ICONS__ || null; }
  function systemLabel(system) { const I = icons(); return I ? I.canonicalSystem(system.name) : String(system.name || ''); }
  function topicLabel(name) { const I = icons(); return I ? I.topicName(name) : String(name || ''); }
  const FALLBACK_TILE = '<div class="tno ti"><span>✚</span></div>';
  function systemTiles(list) { const I = icons(); return I ? I.systems(list.map(s => s.name)) : list.map(() => FALLBACK_TILE); }
  function topicTiles(systemName, names) { const I = icons(); return I ? I.topics(systemName, names) : names.map(() => FALLBACK_TILE); }

  /* One shell for every page: Back on top, then kicker, title and sub-line (same as the Dr. Al-Joaki screens). */
  function pageShell(kicker, title, subtitle, inner, cls, backHtml) {
    return `<div class="rs ${cls || 'ped-bank-topics'}">${backHtml || ''}
      <div class="ped-collection-kicker">${$esc(kicker)}</div>
      <h1>${$esc(title)}</h1>${subtitle ? `<p class="sub">${$esc(subtitle)}</p>` : ''}
      ${inner}
    </div>`;
  }

  function shbBankEmblem07() {
    return '<svg class="shb-bank-emblem shb-bank-emblem-07" viewBox="0 0 80 80" role="img" aria-label="AI Clinical Cases"><defs><linearGradient id="shb07g" x1="8" y1="8" x2="70" y2="72"><stop stop-color="#C8FFF0"/><stop offset=".55" stop-color="#55D9BC"/><stop offset="1" stop-color="#278FA5"/></linearGradient></defs><path d="M24 10h23l12 12v40a6 6 0 0 1-6 6H24a6 6 0 0 1-6-6V16a6 6 0 0 1 6-6Z" fill="#102F42" stroke="url(#shb07g)" stroke-width="2.4"/><path d="M47 11v11h11" fill="none" stroke="#C8FFF0" stroke-width="2.2" stroke-linejoin="round"/><path d="M24 39h9l5-11 7 22 5-11h7" fill="none" stroke="#D9FFF5" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/><path d="M27 54h26M27 60h17" stroke="#6FDAC6" stroke-width="2" stroke-linecap="round"/></svg>';
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
      `<div class="card setcard cc-loading"><div class="cc-loader"></div><h3>Loading clinical cases…</h3><p class="meta">The bank is being prepared on this device.</p></div>`,
      'ped-systems-page', backButton('Back'));
  }
  function errorPage() {
    return pageShell('AI CLINICAL CASES','AI Clinical Cases','The source data could not be loaded.',
      `<div class="card setcard"><h3>AI Clinical Cases bank unavailable</h3><p class="meta">${$esc(dataError || 'The data file could not be opened.')}</p><button type="button" class="btn primary block" onclick="bank07RetryClinicalCaseData()">Try again</button></div>`,
      'ped-systems-page', backButton('Back'));
  }
  function systemsPage() {
    if (!data) return dataError ? errorPage() : loadingPage();
    const tiles = systemTiles(data.systems);
    const cards = data.systems.map((system, i) => {
      const qs=systemQuestions(system),done=answerCount(qs),p=percent(done,qs.length);
      return `<div class="card sc spc ped-system-card" onclick="bank07OpenClinicalCaseSystem('${system.id}')">${tiles[i]}<div class="spc-tx"><h3>${$esc(systemLabel(system))}</h3><div class="meta"><b>${qs.length}</b> questions · <b>${system.topics.length}</b> topics</div><div class="bar"><span style="width:${p}%"></span></div></div><span class="chev">›</span></div>`;
    }).join('');
    const total = allQuestions().length;
    return pageShell('AI CLINICAL CASES · PEDIATRICS','Choose a medical system',
      `${data.systems.length} systems · ${total.toLocaleString()} questions`,
      `<div class="ped-systems-grid">${cards}</div>`,
      'ped-systems-page', backButton('Back'));
  }
  function topicsPage() {
    const system=findSystem();
    if (!system) return systemsPage();
    const label = systemLabel(system);
    const tiles = topicTiles(label, system.topics.map(t => t.name));
    const cards=system.topics.map((topic, i)=>{
      const qs=topicQuestions(topic),done=answerCount(qs),p=percent(done,qs.length);
      return `<div class="card sc tpc" onclick="bank07OpenClinicalCaseTopic('${topic.id}')">${tiles[i]}<div class="tpc-tx"><h3>${$esc(topicLabel(topic.name))}</h3><div class="meta">${topic.cases.length} clinical cases · ${qs.length} questions${done ? ' · ' + done + ' answered' : ''}</div><div class="bar"><span style="width:${p}%"></span></div></div><span class="chev">›</span></div>`;
    }).join('');
    const qs=systemQuestions(system);
    return pageShell('AI CLINICAL CASES',label,
      `${system.topics.length} topics · ${qs.length} questions`,
      `<div class="ped-topics-grid">${cards}</div>`,
      'ped-bank-topics', backButton('Medical Systems'));
  }
  function casesPage() {
    const system=findSystem(),topic=findTopic();
    if (!system || !topic) return topicsPage();
    const tiles = topicTiles(systemLabel(system), topic.cases.map(item => item.sourceHeadingPresent ? item.title : 'Questions'));
    const cards=topic.cases.map((item, i)=>{
      const qs=item.questions,done=answerCount(qs),p=percent(done,qs.length);
      const label=item.sourceHeadingPresent ? item.title : 'Questions';
      return `<div class="card sc tpc" onclick="bank07OpenClinicalCase('${item.id}')">${tiles[i]}<div class="tpc-tx"><h3>${$esc(label)}</h3><div class="meta">${qs.length} questions${item.hasSharedCaseText ? ' · Shared clinical history' : ' · Topic questions'}</div><div class="bar"><span style="width:${p}%"></span></div></div><span class="chev">›</span></div>`;
    }).join('');
    const qs=topicQuestions(topic);
    return pageShell('AI CLINICAL CASES · '+systemLabel(system).toUpperCase(),topicLabel(topic.name),
      `${topic.cases.length} clinical cases · ${qs.length} questions`,
      `<div class="ped-topics-grid">${cards}</div>`,
      'ped-bank-topics', backButton(systemLabel(system)));
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
    return pageShell('AI CLINICAL CASES · '+systemLabel(system).toUpperCase(),topicLabel(topic.name),
      qs.length+' questions · '+done+' answered',
      progress(done,qs.length)+blocks,
      'qb ped-bank-topics', backButton(systemLabel(system)));
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
