/* Shbace Medical · Bank 08 · AI Generated */
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

  function shbSystemIcon(name) {
    const n=String(name||'').toLowerCase(), B=window.__SHB_BRIDGE;
    const map=[
      [/central nervous|neurolog|\bcns\b/,'cns'],
      [/cardio|cardiovascular|heart/,'cardio'],
      [/respirat|lung/,'respiratory'],
      [/gastro|digestive|hepat|\bgit\b/,'git'],
      [/nephro|renal|kidney/,'nephrology'],
      [/endocrin|hormone/,'endocrinology'],
      [/neonat|newborn/,'neonatology'],
      [/infect|vaccin|immuniz/,'infectious'],
      [/haemat|hemat|blood/,'haematology'],
      [/growth|development|nutrition/,'growth'],
      [/genetic|dermat/,'genetics'],
      [/rheumat|metabolic|poison|immunolog|musculoskeletal/,'rheum'],
      [/urolog/,'urology']
    ];
    const row=map.find(x=>x[0].test(n)),code=row?row[1]:'growth';
    if(B&&typeof B.sysIcon==='function'&&B.SYS){
      const sys=B.SYS.find(x=>x[0]===code);
      if(sys&&sys[2])return B.sysIcon(sys[2],'lg');
    }
    return '<svg class="shb-bank-line-icon" viewBox="0 0 48 48" aria-hidden="true"><path d="M24 5 39 14v20L24 43 9 34V14L24 5Z"/><path d="M15 24h18M24 15v18"/><circle cx="24" cy="24" r="5"/></svg>';
  }
  function shbTopicIcon(name,systemName) {
    const n=String(name||'').toLowerCase(),sys=String(systemName||'').toLowerCase(),B=window.__SHB_BRIDGE;
    const map=[
      [/central nervous|neurolog|\bcns\b/,'cns'],[/cardio|cardiovascular|heart/,'cardio'],
      [/respirat|lung/,'respiratory'],[/gastro|digestive|hepat|\bgit\b/,'git'],
      [/nephro|renal|kidney/,'nephrology'],[/endocrin|hormone/,'endocrinology'],
      [/neonat|newborn/,'neonatology'],[/infect|vaccin|immuniz/,'infectious'],
      [/haemat|hemat|blood/,'haematology'],[/growth|development|nutrition/,'growth'],
      [/genetic|dermat/,'genetics'],[/rheumat|metabolic|poison|immunolog/,'rheum']
    ];
    const row=map.find(x=>x[0].test(sys)),code=row?row[1]:'growth';
    if(B&&typeof B.topicIcon==='function')return B.topicIcon(code,String(name||''),0);
    return '<svg class="shb-bank-line-icon" viewBox="0 0 48 48" aria-hidden="true"><path d="M24 5 39 14v20L24 43 9 34V14L24 5Z"/><path d="M17 24h14M24 17v14"/></svg>';
  }
  function shbCaseIcon() {
    return '<svg class="shb-bank-line-icon" viewBox="0 0 48 48" aria-hidden="true"><path d="M14 7h14l8 8v26H14a3 3 0 0 1-3-3V10a3 3 0 0 1 3-3Z"/><path d="M28 7v9h8M17 25h16M17 31h12M17 19h5"/><path d="m23 13 3 3-3 3"/></svg>';
  }

function shell(k,title,sub,body){return '<div class="rs ai08-page"><div class="ai08-topline"><span class="ai08-bank-number">BANK 08</span><span class="ai08-kicker">'+esc(k)+'</span></div><h1>'+esc(title)+'</h1>'+(sub?'<p class="sub">'+esc(sub)+'</p>':'')+body+'</div>';}
function bar(done,total){let p=pct(done,total);return '<div class="ai08-progress"><div class="ai08-progress-meta"><span>'+done+' / '+total+' answered</span><b>'+p+'%</b></div><div class="bar"><span style="width:'+p+'%"></span></div></div>';}
function back(label){return '<button type="button" class="backb ai08-back" onclick="bank08AiGeneratedBack()"><span aria-hidden="true">‹</span> '+esc(label||'Back')+'</button>';}
function loading(){return shell('AI-GENERATED MCQ BANK','AI Generated','Single-best-answer questions organized by medical system and topic.','<div class="card setcard ai08-loading"><div class="ai08-loader"></div><h3>Loading questions…</h3><p class="meta">The bank is being prepared on this device.</p></div>');}
function fail(){return shell('AI-GENERATED MCQ BANK','AI Generated','The source data could not be loaded.','<div class="card setcard"><h3>AI Generated bank unavailable</h3><p class="meta">'+esc(error||'The data file could not be opened.')+'</p><button type="button" class="btn primary block" onclick="bank08RetryAiGeneratedData()">Try again</button></div>');}
function systemsPage(){
 if(!data)return error?fail():loading();
 let cards=data.systems.map(s=>{let qs=s.topics.reduce((a,t)=>a.concat(t.questions),[]),done=count(qs),p=pct(done,qs.length);return '<button type="button" class="card sc ai08-list-card" onclick="bank08OpenAiGeneratedSystem(\''+s.id+'\')"><span class="ai08-sys-icon ai08-icon-art">'+shbSystemIcon(s.name)+'</span><span class="ai08-list-copy"><strong>'+esc(s.name)+'</strong><small>'+s.topics.length+' topics · '+qs.length+' questions</small><span class="bar"><span style="width:'+p+'%"></span></span></span><span class="chev">›</span></button>';}).join('');
 let qs=all(),done=count(qs);
 return shell('EIGHTH QUESTION BANK','AI Generated',data.systems.length+' medical systems · '+qs.length+' questions',bar(done,qs.length)+'<div class="ai08-description card"><b>How this bank is organized</b><p>Choose a medical system, open a topic, then answer its MCQs. Submit an answer to see the correct option and initial explanation. Use Read More for detailed explanation, high-yield points and source reference.</p></div><div class="ai08-section-heading">Medical Systems <span>'+data.systems.length+'</span></div><div class="ai08-list">'+cards+'</div>');
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
function ensure(){
 if(data)return Promise.resolve(data);if(promise)return promise;
 promise=Promise.all(SHARDS.map(path=>fetch(new URL(path,document.baseURI).href,{cache:'no-cache'}).then(r=>{if(!r.ok)throw new Error(path+' HTTP '+r.status);return r.json();}))).then(parts=>{
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
if(priorSpecialties)specialtiesView=function(){let html=priorSpecialties.apply(this,arguments);if(!String(html).includes('ped-collections-grid')||String(html).includes('ped-collection-bank08'))return html;let card='<button type="button" class="ped-collection-card ped-collection-allonce ped-collection-bank08" onclick="openAiGeneratedBank08()"><div class="ped-collection-avatar ped-avatar-allonce ped-avatar-icon"><span class="ped-avatar-initials">08</span></div><span class="ped-collection-copy"><span class="eyebrow">AI-GENERATED MCQ BANK</span><b>AI Generated</b><small>AI-generated single-best-answer MCQs, organized by medical system and topic.</small><span class="ped-collection-count">'+TOTAL.toLocaleString()+' questions · 16 source files</span></span><span class="ped-collection-arrow">›</span></button>';html=html.replace('</div><div class="ped-collection-footnote">',card+'</div><div class="ped-collection-footnote">');html=html.replace('The seven collections remain separate.','The eight collections remain separate.');return html;};
const priorNav=appNav;
appNav=function(){let p=appPage;if(String(p).startsWith('ai08'))appPage='subjects';try{return priorNav.apply(this,arguments);}finally{appPage=p;}};
const priorRender=renderAppDemo;
renderAppDemo=function(){let p=appPage,res=priorRender.apply(this,arguments);if(String(p).startsWith('ai08')){try{let screen=document.querySelector('#phoneContent .screen'),scroll=screen&&(screen.querySelector(':scope > .app-scroll')||screen);if(scroll)scroll.innerHTML=appHeader('AI Generated')+current();}catch(e){console.error('AI Generated Bank 08 render failed',e);}}return res;};
window.__shbAiGeneratedBank08={count:()=>data?all().length:TOTAL,systems:()=>data?data.systems.length:null,topics:()=>data?data.systems.reduce((n,s)=>n+s.topics.length,0):null,answered:()=>count(all()),dataLoaded:()=>!!data,validation:()=>data?data.validation:null};
})();
