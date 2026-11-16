/* Shbace Medical · AI Generated (Bank 08)
   Systems and topics use the same cards, large icons and layout as the Dr. Al-Joaki bank;
   question cards are identical to AI Clinical Cases (Bank 07) and the core question bank. */
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
function txt(v){return esc(v||'').replace(/\*\*(.+?)\*\*/g,'<strong>$1</strong>').replace(/`([^`]+)`/g,'<code>$1</code>').replace(/^- /gm,'• ').replace(/\n/g,'<br>');}
function systemQs(s){return s.topics.reduce((a,t)=>a.concat(t.questions),[]);}
/* Shared names and icons (js/42-pediatrics-collection-polish.js): one spelling per system/topic, one picture per different system/topic. */
function icons(){return window.__SHB_BANK_ICONS__||null;}
function sysLabel(s){const I=icons();return I?I.canonicalSystem(s.name):String(s.name||'');}
function topicLabel(n){const I=icons();return I?I.topicName(n):String(n||'');}
const FALLBACK_TILE='<div class="tno ti"><span>✚</span></div>';
function systemTiles(list){const I=icons();return I?I.systems(list.map(s=>s.name)):list.map(()=>FALLBACK_TILE);}
function topicTiles(sysName,names){const I=icons();return I?I.topics(sysName,names):names.map(()=>FALLBACK_TILE);}

  function shbBankEmblem08() {
    return '<svg class="shb-bank-emblem shb-bank-emblem-08" viewBox="0 0 80 80" role="img" aria-label="AI Generated"><defs><linearGradient id="shb08g" x1="10" y1="8" x2="69" y2="71"><stop stop-color="#C9E9FF"/><stop offset=".55" stop-color="#6BCBFF"/><stop offset="1" stop-color="#9A8CFF"/></linearGradient></defs><ellipse cx="40" cy="40" rx="28" ry="12" transform="rotate(-34 40 40)" fill="none" stroke="url(#shb08g)" stroke-width="2.2"/><ellipse cx="40" cy="40" rx="28" ry="12" transform="rotate(38 40 40)" fill="none" stroke="url(#shb08g)" stroke-width="2.2" opacity=".7"/><path d="m40 23 15 17-15 17-15-17 15-17Z" fill="#153D5C" stroke="url(#shb08g)" stroke-width="2.5"/><path d="m40 31 7 9-7 9-7-9 7-9Z" fill="#A8E8FF" fill-opacity=".2" stroke="#D4F4FF" stroke-width="1.8"/><path d="m17 19 2.5 5.5L25 27l-5.5 2.5L17 35l-2.5-5.5L9 27l5.5-2.5L17 19Zm47 24 2 4 4 2-4 2-2 4-2-4-4-2 4-2 2-4Z" fill="#B9E7FF"/></svg>';
  }

/* One shell for every page: Back on top, then kicker, title and sub-line (same as the Dr. Al-Joaki screens). */
function shell(k,title,sub,body,cls,backHtml){return '<div class="rs '+(cls||'ped-bank-topics')+'">'+(backHtml||'')+'<div class="ped-collection-kicker">'+esc(k)+'</div><h1>'+esc(title)+'</h1>'+(sub?'<p class="sub">'+esc(sub)+'</p>':'')+body+'</div>';}
function bar(done,total){let p=pct(done,total);return '<div class="cc-progress"><div class="cc-progress-meta"><span>'+done+' / '+total+' answered</span><b>'+p+'%</b></div><div class="bar"><span style="width:'+p+'%"></span></div></div>';}
function back(label){return '<button type="button" class="backb cc-back" onclick="bank08AiGeneratedBack()"><span aria-hidden="true">‹</span> '+esc(label||'Back')+'</button>';}
function loading(){return shell('AI-GENERATED MCQ BANK','AI Generated','Single-best-answer questions organized by medical system and topic.','<div class="card setcard ai08-loading"><div class="ai08-loader"></div><h3>Loading questions…</h3><p class="meta">The bank is being prepared on this device.</p></div>','ped-systems-page',back('Back'));}
function fail(){return shell('AI-GENERATED MCQ BANK','AI Generated','The source data could not be loaded.','<div class="card setcard"><h3>AI Generated bank unavailable</h3><p class="meta">'+esc(error||'The data file could not be opened.')+'</p><button type="button" class="btn primary block" onclick="bank08RetryAiGeneratedData()">Try again</button></div>','ped-systems-page',back('Back'));}
function systemsPage(){
 if(!data)return error?fail():loading();
 const tiles=systemTiles(data.systems);
 let cards=data.systems.map((s,i)=>{let qs=systemQs(s),done=count(qs),p=pct(done,qs.length);return '<div class="card sc spc ped-system-card" onclick="bank08OpenAiGeneratedSystem(\''+s.id+'\')">'+tiles[i]+'<div class="spc-tx"><h3>'+esc(sysLabel(s))+'</h3><div class="meta"><b>'+qs.length+'</b> questions · <b>'+s.topics.length+'</b> topics</div><div class="bar"><span style="width:'+p+'%"></span></div></div><span class="chev">›</span></div>';}).join('');
 let total=all().length;
 return shell('AI-GENERATED MCQ BANK','Choose a medical system',data.systems.length+' systems · '+total.toLocaleString()+' questions','<div class="ped-systems-grid">'+cards+'</div>','ped-systems-page',back('Back'));
}
function topicsPage(){
 let s=sys();if(!s)return systemsPage();
 const label=sysLabel(s);
 const tiles=topicTiles(label,s.topics.map(t=>t.name));
 let cards=s.topics.map((t,i)=>{let qs=t.questions,done=count(qs),p=pct(done,qs.length);return '<div class="card sc tpc" onclick="bank08OpenAiGeneratedTopic(\''+t.id+'\')">'+tiles[i]+'<div class="tpc-tx"><h3>'+esc(topicLabel(t.name))+'</h3><div class="meta">'+qs.length+' questions'+(done?' · '+done+' answered':'')+'</div><div class="bar"><span style="width:'+p+'%"></span></div></div><span class="chev">›</span></div>';}).join('');
 let qs=systemQs(s);
 return shell('AI-GENERATED MCQ BANK',label,s.topics.length+' topics · '+qs.length+' questions','<div class="ped-topics-grid">'+cards+'</div>','ped-bank-topics',back('Medical Systems'));
}
function questionCard(q,i){
 let saved=answers[q.id]||null,selected=saved&&saved.selected?saved.selected:'',done=!!selected,correct=q.correctAnswer;
 let opts=q.options.map(o=>{let good=o.label===correct,chosen=o.label===selected,cls=!done?'':good?' correct':chosen?' incorrect':' dim',disabled=done?' disabled':'',mark=done&&good?'<span class="ck">✓</span>':done&&chosen&&!good?'<span class="ck x">×</span>':'';return '<button type="button" class="qopt'+cls+'"'+disabled+' onclick="bank08AnswerAiGeneratedQuestion(\''+q.id+'\',\''+o.label+'\')"><i>'+o.label+'</i><span>'+esc(o.text)+'</span>'+mark+'</button>';}).join('');
 let answer=q.options.find(o=>o.label===correct),correctText=answer?answer.text:(q.correctAnswerText||correct);
 const initial=done?'<div class="qreact '+(saved.correct?'ok':'no')+'"><div><b>'+(saved.correct?'Correct':'Incorrect')+'</b><span>'+(saved.correct?'Well done. Review the key explanation below.':'Review the correct answer and explanation below.')+'</span></div></div>'+
  '<div class="qfb '+(saved.correct?'':'no')+'"><b>Correct answer: '+correct+'. '+esc(correctText)+'</b><p>'+txt(q.initialExplanation)+'</p></div>':'';
 const source=q.source||{};
 const pages=source.pages?'<span> · Page'+(/[-–—,]|and/i.test(String(source.pages))?'s':'')+' '+esc(source.pages)+'</span>':'';
 const more=done?'<details class="nl-more" '+(saved.readMore?'open':'')+' ontoggle="bank08SetAiGeneratedReadMore(\''+q.id+'\',this.open)"><summary>Read More</summary><div class="nl-more-body">'+
  '<section><h4>Detailed Explanation</h4><div>'+txt(q.detailedExplanation)+'</div></section>'+
  (q.highYieldPoints?'<section><h4>High-Yield Points</h4><div>'+txt(q.highYieldPoints)+'</div></section>':'')+
  '<p class="nl-source">Source: '+esc(source.sheet||source.raw||'Course sheet')+pages+(source.raw?'<br><small>'+esc(source.raw)+'</small>':'')+'</p></div></details>':'';
 return '<article class="qcard" id="ai08q-'+q.id+'" data-id="'+q.id+'"><div class="qtop"><span class="qid">QUESTION '+(i+1)+'</span></div><h3 class="qstem">'+esc(q.stem)+'</h3><div class="qopts">'+opts+'</div>'+initial+more+'</article>';
}
function questionsPage(){
 let s=sys(),t=topic();if(!s||!t)return topicsPage();
 let qs=t.questions,done=count(qs);
 return shell('AI-GENERATED MCQ BANK · '+sysLabel(s).toUpperCase(),topicLabel(t.name),qs.length+' questions · '+done+' answered',bar(done,qs.length)+'<div class="cc-question-list">'+qs.map(questionCard).join('')+'</div>','qb ped-bank-topics',back(sysLabel(s)));
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
window.bank08SetAiGeneratedReadMore=function(id,isOpen){let a=answers[id];if(!a)return;a.readMore=!!isOpen;save();};
window.bank08ToggleAiGeneratedReadMore=function(id){let a=answers[id];if(!a)return;a.readMore=!a.readMore;save();renderAppDemo();};
const priorSpecialties=typeof specialtiesView==='function'?specialtiesView:null;
if(priorSpecialties)specialtiesView=function(){let html=priorSpecialties.apply(this,arguments);if(!String(html).includes('ped-collections-grid')||String(html).includes('ped-collection-bank08'))return html;let card='<button type="button" class="ped-collection-card ped-collection-allonce ped-collection-bank08" onclick="openAiGeneratedBank08()"><div class="ped-collection-avatar ped-avatar-allonce ped-avatar-icon">'+shbBankEmblem08()+'</div><span class="ped-collection-copy"><span class="eyebrow">AI-GENERATED MCQ BANK</span><b>AI Generated</b><small>AI-generated single-best-answer MCQs, organized by medical system and topic.</small><span class="ped-collection-count">'+TOTAL.toLocaleString()+' questions · 16 source files</span></span><span class="ped-collection-arrow">›</span></button>';html=html.replace('</div><div class="ped-collection-footnote">',card+'</div><div class="ped-collection-footnote">');html=html.replace('The seven collections remain separate.','The eight collections remain separate.');return html;};
const priorNav=appNav;
appNav=function(){let p=appPage;if(String(p).startsWith('ai08'))appPage='subjects';try{return priorNav.apply(this,arguments);}finally{appPage=p;}};
const priorRender=renderAppDemo;
renderAppDemo=function(){let p=appPage;if(String(p).startsWith('ai08'))appPage='subjects';let res;try{res=priorRender.apply(this,arguments);}finally{appPage=p;}if(String(p).startsWith('ai08')){try{let screen=document.querySelector('#phoneContent .screen');if(screen)screen.innerHTML=appHeader('AI Generated')+'<div class="app-scroll">'+current()+'</div>'+appNav();}catch(e){console.error('AI Generated render failed',e);}}return res;};
window.__shbAiGeneratedBank08={count:()=>data?all().length:TOTAL,systems:()=>data?data.systems.length:null,topics:()=>data?data.systems.reduce((n,s)=>n+s.topics.length,0):null,answered:()=>count(all()),dataLoaded:()=>!!data,validation:()=>data?data.validation:null};
})();
