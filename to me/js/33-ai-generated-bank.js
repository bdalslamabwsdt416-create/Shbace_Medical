/* Shbace Medical · AI Generated */
(function(){
'use strict';
const TOTAL=1881, STORE='shbace_ai_generated_answers_v1';
const esc=v=>String(v==null?'':v).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const safe=v=>/^[A-Za-z0-9_-]+$/.test(String(v||''));
let data=null,promise=null,error='',systemId='',topicId='',answers=load();
function load(){try{let v=JSON.parse(localStorage.getItem(STORE)||'{}');return v&&typeof v==='object'&&!Array.isArray(v)?v:{};}catch(e){return {};}}
function save(){try{localStorage.setItem(STORE,JSON.stringify(answers));}catch(e){try{toast('Could not save AI Generated progress on this device.');}catch(_){}}}
function all(){let a=[];if(data)data.systems.forEach(s=>s.topics.forEach(t=>t.questions.forEach(q=>a.push(q))));return a;}
function sys(){return data&&data.systems.find(s=>s.id===systemId);}
function topic(){let s=sys();return s&&s.topics.find(t=>t.id===topicId);}
function count(a){return a.reduce((n,q)=>n+(answers[q.id]&&answers[q.id].selected?1:0),0);}
function pct(a,b){return b?Math.round(a*100/b):0;}
function txt(v){return esc(v||'').replace(/\*\*(.+?)\*\*/g,'<strong>$1</strong>').replace(/^- /gm,'• ').replace(/\n/g,'<br>');}


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
    return '<svg class="shb-bank-emblem shb-bank-emblem-07" viewBox="0 0 80 80" role="img" aria-label="Clinical Case"><defs><linearGradient id="shb07g" x1="8" y1="8" x2="70" y2="72"><stop stop-color="#C8FFF0"/><stop offset=".55" stop-color="#55D9BC"/><stop offset="1" stop-color="#278FA5"/></linearGradient></defs><path d="M24 10h23l12 12v40a6 6 0 0 1-6 6H24a6 6 0 0 1-6-6V16a6 6 0 0 1 6-6Z" fill="#102F42" stroke="url(#shb07g)" stroke-width="2.4"/><path d="M47 11v11h11" fill="none" stroke="#C8FFF0" stroke-width="2.2" stroke-linejoin="round"/><path d="M24 39h9l5-11 7 22 5-11h7" fill="none" stroke="#D9FFF5" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/><path d="M27 54h26M27 60h17" stroke="#6FDAC6" stroke-width="2" stroke-linecap="round"/></svg>';
  }
  function shbBankEmblem08() {
    return '<svg class="shb-bank-emblem shb-bank-emblem-08" viewBox="0 0 80 80" role="img" aria-label="AI Generated"><defs><linearGradient id="shb08g" x1="10" y1="8" x2="69" y2="71"><stop stop-color="#C9E9FF"/><stop offset=".55" stop-color="#6BCBFF"/><stop offset="1" stop-color="#9A8CFF"/></linearGradient></defs><ellipse cx="40" cy="40" rx="28" ry="12" transform="rotate(-34 40 40)" fill="none" stroke="url(#shb08g)" stroke-width="2.2"/><ellipse cx="40" cy="40" rx="28" ry="12" transform="rotate(38 40 40)" fill="none" stroke="url(#shb08g)" stroke-width="2.2" opacity=".7"/><path d="m40 23 15 17-15 17-15-17 15-17Z" fill="#153D5C" stroke="url(#shb08g)" stroke-width="2.5"/><path d="m40 31 7 9-7 9-7-9 7-9Z" fill="#A8E8FF" fill-opacity=".2" stroke="#D4F4FF" stroke-width="1.8"/><path d="m17 19 2.5 5.5L25 27l-5.5 2.5L17 35l-2.5-5.5L9 27l5.5-2.5L17 19Zm47 24 2 4 4 2-4 2-2 4-2-4-4-2 4-2 2-4Z" fill="#B9E7FF"/></svg>';
  }

  function shbCaseIcon() {
    return '<svg class="shb-bank-line-icon" viewBox="0 0 48 48" aria-hidden="true"><path d="M14 7h14l8 8v26H14a3 3 0 0 1-3-3V10a3 3 0 0 1 3-3Z"/><path d="M28 7v9h8M17 25h16M17 31h12M17 19h5"/><path d="m23 13 3 3-3 3"/></svg>';
  }

function shell(k,title,sub,body){return '<div class="rs ai08-page"><div class="ai08-topline"><span class="ai08-kicker">'+esc(k)+'</span></div><h1>'+esc(title)+'</h1>'+(sub?'<p class="sub">'+esc(sub)+'</p>':'')+body+'</div>';}
function bar(done,total){let p=pct(done,total);return '<div class="ai08-progress"><div class="ai08-progress-meta"><span>'+done+' / '+total+' answered</span><b>'+p+'%</b></div><div class="bar"><span style="width:'+p+'%"></span></div></div>';}
function back(label){return '<button type="button" class="backb ai08-back" onclick="bank08AiGeneratedBack()"><span aria-hidden="true">‹</span> '+esc(label||'Back')+'</button>';}
function loading(){return shell('AI-GENERATED MCQ BANK','AI Generated','Single-best-answer questions organized by medical system and topic.','<div class="card setcard ai08-loading"><div class="ai08-loader"></div><h3>Loading questions…</h3><p class="meta">The bank is being prepared on this device.</p></div>');}
function fail(){return shell('AI-GENERATED MCQ BANK','AI Generated','The source data could not be loaded.','<div class="card setcard"><h3>AI Generated bank unavailable</h3><p class="meta">'+esc(error||'The data file could not be opened.')+'</p><button type="button" class="btn primary block" onclick="bank08RetryAiGeneratedData()">Try again</button></div>');}
function systemsPage(){
 if(!data)return error?fail():loading();
 let cards=data.systems.map(s=>{let qs=s.topics.reduce((a,t)=>a.concat(t.questions),[]),done=count(qs),p=pct(done,qs.length);return '<button type="button" class="card sc ai08-list-card" onclick="bank08OpenAiGeneratedSystem(\''+s.id+'\')"><span class="ai08-sys-icon ai08-icon-art">'+shbSystemIcon(s.name)+'</span><span class="ai08-list-copy"><strong>'+esc(s.name)+'</strong><small>'+s.topics.length+' topics · '+qs.length+' questions</small><span class="bar"><span style="width:'+p+'%"></span></span></span><span class="chev">›</span></button>';}).join('');
 let qs=all(),done=count(qs);
 return shell('AI-GENERATED MCQ BANK','AI Generated',data.systems.length+' medical systems · '+qs.length+' questions',bar(done,qs.length)+'<div class="ai08-description card"><b>How this bank is organized</b><p>Choose a medical system, open a topic, then answer its MCQs. Submit an answer to see the correct option and initial explanation. Use Read More for detailed explanation, high-yield points and source reference.</p></div><div class="ai08-section-heading">Medical Systems <span>'+data.systems.length+'</span></div><div class="ai08-list">'+cards+'</div>');
}
function topicsPage(){
 let s=sys();if(!s)return systemsPage();
 let cards=s.topics.map(t=>{let qs=t.questions,done=count(qs),p=pct(done,qs.length);return '<button type="button" class="card sc ai08-list-card" onclick="bank08OpenAiGeneratedTopic(\''+t.id+'\')"><span class="ai08-topic-number ai08-icon-art">'+shbTopicIcon(t.name,s.name)+'</span><span class="ai08-list-copy"><strong>'+esc(t.name)+'</strong><small>'+qs.length+' questions</small><span class="bar"><span style="width:'+p+'%"></span></span></span><span class="chev">›</span></button>';}).join('');
 let qs=s.topics.reduce((a,t)=>a.concat(t.questions),[]),done=count(qs);
 return shell(s.name.toUpperCase(),s.name,s.topics.length+' topics · '+qs.length+' questions',back('Medical Systems')+bar(done,qs.length)+'<div class="ai08-section-heading">Topics <span>'+s.topics.length+'</span></div><div class="ai08-list">'+cards+'</div>');
}
function questionCard(q,i){
 let saved=answers[q.id]||null,selected=saved&&saved.selected?saved.selected:'',done=!!selected,correct=q.correctAnswer;
 let opts=q.options.map(o=>{let good=o.label===correct,chosen=o.label===selected,cls=!done?'':good?' correct':chosen?' incorrect':' dim',disabled=done?' disabled':'',mark=done&&good?'<span class="ck">✓</span>':done&&chosen&&!good?'<span class="ck x">×</span>':'';return '<button type="button" class="qopt'+cls+'"'+disabled+' onclick="bank08AnswerAiGeneratedQuestion(\''+q.id+'\',\''+o.label+'\')"><i>'+o.label+'</i><span>'+esc(o.text)+'</span>'+mark+'</button>';}).join('');
 let answer=q.options.find(o=>o.label===correct),correctText=answer?answer.text:(q.correctAnswerText||correct);
 let feedback=done?'<div class="ai08-feedback'+(saved.correct?'':' no')+'"><b>'+(saved.correct?'Correct answer':'Not quite — review the correct answer')+'</b><p><strong>'+correct+'. '+esc(correctText)+'</strong></p><p>'+txt(q.initialExplanation)+'</p></div>':'';
 let more='';
 if(done){let expanded='';if(saved.readMore){expanded='<div class="ai08-expanded"><section><h4>Detailed Explanation</h4><div class="ai08-rich">'+txt(q.detailedExplanation)+'</div></section>'+(q.highYieldPoints?'<section><h4>High-Yield Points</h4><div class="ai08-rich">'+txt(q.highYieldPoints)+'</div></section>':'')+'<section class="ai08-source"><h4>Source</h4><div><b>'+esc(q.source.sheet||q.source.raw||'Course sheet')+'</b>'+(q.source.pages?'<span>Pages '+esc(q.source.pages)+'</span>':'')+'<small>'+esc(q.source.raw||'')+'</small></div></section></div>';}
 more='<div class="ai08-readmore"><button type="button" class="btn sm" aria-expanded="'+(saved.readMore?'true':'false')+'" onclick="bank08ToggleAiGeneratedReadMore(\''+q.id+'\')">'+(saved.readMore?'Show less':'Read More')+'</button>'+expanded+'</div>';}
 return '<article class="qcard ai08-question" id="ai08q-'+q.id+'"><div class="ai08-question-head"><span class="qid">QUESTION '+(i+1)+'</span></div><div class="qstem">'+esc(q.stem)+'</div><div class="ai08-options">'+opts+'</div>'+feedback+more+'</article>';
}
function questionsPage(){
 let s=sys(),t=topic();if(!s||!t)return topicsPage();
 let qs=t.questions,done=count(qs);
 return shell(s.name.toUpperCase()+' · '+t.name.toUpperCase(),t.name,qs.length+' questions · '+done+' answered',back(s.name)+bar(done,qs.length)+'<div class="ai08-section-heading">Questions <span>'+qs.length+'</span></div><div class="ai08-question-list">'+qs.map(questionCard).join('')+'</div>');
}
function current(){if(appPage==='ai08Systems')return systemsPage();if(appPage==='ai08Topics')return topicsPage();if(appPage==='ai08Questions')return questionsPage();return '';}
const SHARDS=[
'data/ai-generated/01-cns.json','data/ai-generated/02-comprehensive-pediatrics.json',
'data/ai-generated/03-cvs.json','data/ai-generated/04-developmental-assessment-and-milestones.json',
'data/ai-generated/05-endocrine.json','data/ai-generated/06-git.json',
'data/ai-generated/07-growth-and-nutrition.json','data/ai-generated/08-hematology.json',
'data/ai-generated/09-infectious.json','data/ai-generated/10-neonatology.json',
'data/ai-generated/11-nephrology.json','data/ai-generated/12-pediatric-dermatology-allergy-hepatology-tumors-child-abuse.json',
'data/ai-generated/13-pediatric-genetics.json','data/ai-generated/14-pediatric-vaccination.json',
'data/ai-generated/15-respiratory.json','data/ai-generated/16-rheumatology-metabolic-poisoning-immunology.json'
];
function fetchShard(path){
 let attempt=0;
 function request(){
  const url=new URL(path,document.baseURI);
  if(attempt)url.searchParams.set('__shbace_reload',String(Date.now()));
  const controller=window.AbortController?new AbortController():null;
  let timer=null;
  const timeout=new Promise(function(_,reject){
   timer=setTimeout(function(){if(controller)controller.abort();reject(new Error(path+' timed out while loading'));},18000);
  });
  const network=fetch(url.href,{cache:'no-cache',signal:controller?controller.signal:undefined})
   .then(function(r){if(!r.ok)throw new Error(path+' HTTP '+r.status);return r.json();});
  return Promise.race([network,timeout]).then(function(value){if(timer)clearTimeout(timer);return value;})
   .catch(function(err){if(timer)clearTimeout(timer);if(attempt<1){attempt++;return request();}throw err;});
 }
 return request();
}
function loadShards(){
 const result=new Array(SHARDS.length);let cursor=0;
 function worker(){
  const index=cursor++;if(index>=SHARDS.length)return Promise.resolve();
  return fetchShard(SHARDS[index]).then(function(part){result[index]=part;return worker();});
 }
 return Promise.all([worker(),worker(),worker(),worker()]).then(function(){return result;});
}
function ensure(){
 if(data)return Promise.resolve(data);if(promise)return promise;
 promise=loadShards().then(parts=>{
  const map=new Map();let total=0;
  parts.forEach(part=>{
   if(!part||part.schema!=='shbace-ai-generated-mcq-source-v1'||part.bankNumber!==8||!Array.isArray(part.systems))throw new Error('AI Generated source shard validation failed.');
   total+=Number(part.totalQuestions||0);
   part.systems.forEach(s=>{
    let target=map.get(s.id);
    if(!target){target={id:s.id,name:s.name,topics:[]};map.set(s.id,target);}
    s.topics.forEach(t=>{
     let dst=target.topics.find(x=>x.id===t.id);
     if(!dst){dst={id:t.id,name:t.name,questions:[]};target.topics.push(dst);}
     dst.questions.push(...t.questions);
    });
   });
  });
  const systems=Array.from(map.values());
  const questions=systems.flatMap(s=>s.topics.flatMap(t=>t.questions));
  const ids=questions.map(q=>q.id);
  const invalid=questions.filter(q=>!q||!Array.isArray(q.options)||q.options.length!==5||!q.options.some(o=>o.label===q.correctAnswer)).length;
  if(total!==1881||questions.length!==1881||new Set(ids).size!==1881||invalid)throw new Error('AI Generated bank integrity check failed.');
  data={schema:'shbace-ai-generated-mcq-bank-v1',bankNumber:8,totalQuestions:total,systems:systems,validation:{passed:true,questionCount:total,uniqueQuestionIds:new Set(ids).size,invalidQuestionRecords:invalid}};
  error='';return data;
 }).catch(e=>{error=e&&e.message?e.message:'Unknown data loading error';promise=null;throw e;});
 return promise;
}
window.openAiGeneratedBank08=function(){window.__SHB_PED_COLLECTION__='ai-generated-bank08';appPage='ai08Systems';renderAppDemo();ensure().then(()=>renderAppDemo()).catch(()=>renderAppDemo());};
window.bank08RetryAiGeneratedData=function(){promise=null;error='';renderAppDemo();ensure().then(()=>renderAppDemo()).catch(()=>renderAppDemo());};
window.bank08OpenAiGeneratedSystem=function(id){if(!data||!safe(id)||!data.systems.some(s=>s.id===id))return;systemId=id;topicId='';appPage='ai08Topics';renderAppDemo();};
window.bank08OpenAiGeneratedTopic=function(id){let s=sys();if(!s||!safe(id)||!s.topics.some(t=>t.id===id))return;topicId=id;appPage='ai08Questions';renderAppDemo();};
window.bank08AiGeneratedBack=function(){if(appPage==='ai08Questions')appPage='ai08Topics';else if(appPage==='ai08Topics')appPage='ai08Systems';else{appPage='specialties';window.__SHB_PED_COLLECTION__='';}renderAppDemo();};
window.bank08AnswerAiGeneratedQuestion=function(id,label){if(!safe(id)||!'ABCDE'.includes(label))return;let q=all().find(x=>x.id===id);if(!q||answers[id])return;answers[id]={selected:label,correct:label===q.correctAnswer,answeredAt:Date.now(),readMore:false};save();renderAppDemo();};
window.bank08ToggleAiGeneratedReadMore=function(id){let a=answers[id];if(!a)return;a.readMore=!a.readMore;save();renderAppDemo();};
const priorSpecialties=typeof specialtiesView==='function'?specialtiesView:null;
if(priorSpecialties)specialtiesView=function(){let html=priorSpecialties.apply(this,arguments);if(!String(html).includes('ped-collections-grid')||String(html).includes('ped-collection-bank08'))return html;let card='<button type="button" class="ped-collection-card ped-collection-allonce ped-collection-bank08" onclick="openAiGeneratedBank08()"><div class="ped-collection-avatar ped-avatar-allonce ped-avatar-icon">'+shbBankEmblem08()+'</div><span class="ped-collection-copy"><span class="eyebrow">AI-GENERATED MCQ BANK</span><b>AI Generated</b><small>AI-generated single-best-answer MCQs, organized by medical system and topic.</small><span class="ped-collection-count">'+TOTAL.toLocaleString()+' questions · 16 source files</span></span><span class="ped-collection-arrow">›</span></button>';html=html.replace('</div><div class="ped-collection-footnote">',card+'</div><div class="ped-collection-footnote">');html=html.replace('The seven collections remain separate.','The eight collections remain separate.');return html;};
const priorNav=appNav;
appNav=function(){let p=appPage;if(String(p).startsWith('ai08'))appPage='subjects';try{return priorNav.apply(this,arguments);}finally{appPage=p;}};
const priorRender=renderAppDemo;
renderAppDemo=function(){let p=appPage;if(String(p).startsWith('ai08'))appPage='subjects';let res;try{res=priorRender.apply(this,arguments);}finally{appPage=p;}if(String(p).startsWith('ai08')){try{let screen=document.querySelector('#phoneContent .screen');if(screen)screen.innerHTML=appHeader('AI Generated')+'<div class="app-scroll">'+current()+'</div>'+appNav();}catch(e){console.error('AI Generated render failed',e);}}return res;};
window.__shbAiGeneratedBank08={count:()=>data?all().length:TOTAL,systems:()=>data?data.systems.length:null,topics:()=>data?data.systems.reduce((n,s)=>n+s.topics.length,0):null,answered:()=>count(all()),dataLoaded:()=>!!data,validation:()=>data?data.validation:null};
})();
