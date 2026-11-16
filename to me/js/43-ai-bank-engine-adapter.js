/* SHBACE Medical · AI Bank Adapter v1
   Bank 07 and Bank 08 are data providers for the Dr. Al-Joaki question engine.
   They do not own question rendering, answer handling, Quiz or Smart Review state. */
(function(){
'use strict';
var B=window.__SHB_BRIDGE;
if(!B){console.error('AI bank adapter: shared question engine is unavailable.');return;}
var BANKS={
 'clinical-ai':{label:'AI Clinical Cases',total:1598,store:'shbace_clinical_case_answers_v1',source:'data/clinicalCaseBank.json'},
 'generated-ai':{label:'AI Generated',total:1881,store:'shbace_ai_generated_answers_v1'}
};
var registry={},errors={},pending={},currentBank='',currentSystem='',studyToolPromise=null,studyToolReady=false,studyToolLastAttempt=0;
Object.keys(BANKS).forEach(function(key){if(!B.BANK_KEYS.has(key)){B.BANK_KEYS.add(key);B.BANK_OPTS.push([key,BANKS[key].label]);}});
var systemAliases=[
 [/central nervous|neurolog|\bcns\b/,'cns'],
 [/cardiovascular|cardiac|\bheart\b/,'cardio'],
 [/endocrin|inborn errors|metabolic/,'endocrinology'],
 [/gastro|digestive|intestinal|\bgit\b/,'git'],
 [/ha?ematolog|blood/,'haematology'],
 [/infectious|vaccin|immunis|immuniz/,'infectious'],
 [/neonat|newborn/,'neonatology'],
 [/nephrolog|renal|urinar|urolog/,'nephrology'],
 [/respirator|pulmonary|lung/,'respiratory'],
 [/growth|nutrition|development/,'growth'],
 [/genetic|dysmorph/,'genetics'],
 [/general pediatrics|clinical skills/,'general'],
 [/dermatolog|child protection|skin/,'dermatology'],
 [/immunolog|allerg/,'immunology'],
 [/emergency|critical care|toxic|poison/,'emergency'],
 [/final integrated|supplementary.*exam|exam practice|integrated review/,'integrated'],
 [/rheumat|musculoskeletal/,'rheum'],
 [/hepat|liver/,'hepatology']
];
function specFor(name){
 var s=String(name||'').toLowerCase();
 for(var i=0;i<systemAliases.length;i++)if(systemAliases[i][0].test(s))return systemAliases[i][1];
 return 'rheum';
}
function systemLabel(spec){
 var row=(B.SYS||[]).find(function(x){return x&&x[0]===spec;});
 var aliases={general:'General Pediatrics & Clinical Skills',dermatology:'Dermatology / Allergy / Hepatology',immunology:'Immunology & Allergy',emergency:'Emergency & Critical Care',integrated:'Integrated Exam Practice',hepatology:'Hepatology'};
 return row?row[1]:(aliases[spec]||B.SPEC_NAME[spec]||spec);
}
function safeText(value){return String(value==null?'':value);}
function sourceText(src){
 if(!src)return '';
 if(typeof src==='string')return src;
 var out=[];
 if(src.sheet)out.push(src.sheet);
 if(src.pages)out.push('Pages '+src.pages);
 if(src.raw)out.push(src.raw);
 return out.join(' · ');
}
function answerIndex(q){
 var label=safeText(q&&q.correctAnswer).trim().toUpperCase();
 var options=Array.isArray(q&&q.options)?q.options:[];
 return options.findIndex(function(o){return safeText(o&&o.label).trim().toUpperCase()===label;});
}
function normalizeQuestion(q,key,systemSpec,caseInfo){
 var opts=Array.isArray(q&&q.options)?q.options:[];
 var idx=answerIndex(q);
 var more=[q&&q.detailedExplanation,q&&q.highYieldPoints].filter(Boolean).join('\n\nHigh-yield points:\n');
 var out={
  id:(key==='clinical-ai'?'ai07-':'ai08-')+safeText(q&&q.id),
  spec:systemSpec,topic:0,
  tag:key==='clinical-ai'?'Clinical Case':'AI Generated',
  kind:'',
  q:safeText(q&&q.stem),o:opts.map(function(o){return safeText(o&&o.text)}),
  k:idx>=0?idx:0,kx:idx<0,ex:safeText(q&&q.initialExplanation),more:more,
  src:sourceText(q&&q.source),aiBank:key,
  py:false,nl:false,ao:false,cc:false,eb:false,rq:[],rc:[]
 };
 if(caseInfo&&caseInfo.vignette){
  if(caseInfo.first){out.aiCaseVignette=caseInfo.vignette;out.aiCaseTitle=caseInfo.title;out.aiCaseNumber=caseInfo.number;}
  else{out.aiCaseContinued=true;out.aiCaseTitle=caseInfo.title;out.aiCaseNumber=caseInfo.number;}
 }
 if(!out.id||!out.q||out.o.length<2)throw new Error('Invalid question record in '+key+': '+safeText(q&&q.id));
 return out;
}
function clinicalGroups(data){
 var groups=[];
 (data.systems||[]).forEach(function(system){
  var spec=specFor(system.name),sLabel=systemLabel(spec);
  (system.topics||[]).forEach(function(topic){
   var questions=[];
   (topic.cases||[]).forEach(function(item){
    (item.questions||[]).forEach(function(q,i){
     var shared=!!(item.hasSharedCaseText&&item.vignette);
     questions.push(normalizeQuestion(q,'clinical-ai',spec,{
      vignette:shared?item.vignette:'',title:item.title||'Clinical case',
      number:item.number==null?'':item.number,first:i===0
     }));
    });
   });
   if(questions.length)groups.push({spec:spec,systemName:system.name,systemLabel:sLabel,topicName:topic.name,bankLabel:'AI Clinical Cases',questions:questions});
  });
 });
 return groups;
}
function generatedGroups(data){
 var groups=[];
 (data.systems||[]).forEach(function(system){
  var spec=specFor(system.name),sLabel=systemLabel(spec);
  (system.topics||[]).forEach(function(topic){
   var questions=(topic.questions||[]).map(function(q){return normalizeQuestion(q,'generated-ai',spec,null);});
   if(questions.length)groups.push({spec:spec,systemName:system.name,systemLabel:sLabel,topicName:topic.name,bankLabel:'AI Generated',questions:questions});
  });
 });
 return groups;
}
function migrateAnswers(key,groups){
 var config=BANKS[key],legacy={};
 try{legacy=JSON.parse(localStorage.getItem(config.store)||'{}')||{};}catch(e){legacy={};}
 var changed=0;
 groups.forEach(function(group){group.questions.forEach(function(q){
  var sourceId=q.id.replace(/^ai07-|^ai08-/,'');
  var old=legacy[sourceId]||legacy[q.id];
  if(!old||!old.selected||B.S.ans[q.id])return;
  var sel=q.o.findIndex(function(_,i){return String.fromCharCode(65+i)===String(old.selected).toUpperCase();});
  if(sel<0)return;
  B.S.ans[q.id]={sel:sel,ok:sel===q.k,t:Number(old.answeredAt)||Date.now()};changed++;
 });});
 if(changed)B.save();
 try{localStorage.setItem('shbace_'+key+'_engine_migration_v1',JSON.stringify({version:1,at:Date.now(),imported:changed,sourceStore:config.store}));}catch(e){}
 return changed;
}
function installBank(key,data){
 var groups=key==='clinical-ai'?clinicalGroups(data):generatedGroups(data);
 var flat=groups.reduce(function(a,g){return a.concat(g.questions);},[]);
 var unique=new Set(flat.map(function(q){return q.id;}));
 if(flat.length!==BANKS[key].total||unique.size!==flat.length)throw new Error(BANKS[key].label+' failed its question count / unique-ID check.');
 var registration=B.registerExternalBank(key,BANKS[key].label,groups);
 var imported=migrateAnswers(key,groups);
 var systemsMap=new Map();
 groups.forEach(function(g){
  var id=String(g.systemName);
  if(!systemsMap.has(id))systemsMap.set(id,{id:id,name:id,spec:g.spec,groups:[],count:0});
  var s=systemsMap.get(id);s.groups.push(g);s.count+=g.questions.length;
 });
 registry[key]={groups:groups,systems:Array.from(systemsMap.values()),questions:flat.length,validation:{passed:true,questions:flat.length,topics:groups.length,importedAnswers:imported,registered:registration.added}};
 return registry[key];
}
function fetchJson(path){
 return fetch(new URL(path,document.baseURI).href,{cache:'no-cache'}).then(function(r){if(!r.ok)throw new Error(path+' HTTP '+r.status);return r.json();});
}
var generatedShards=[
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
 var tries=0;
 function run(){return fetchJson(path).catch(function(err){if(tries++===0)return fetchJson(path+'?__shbace_reload='+Date.now());throw err;});}
 return run();
}
function loadGenerated(){
 var result=new Array(generatedShards.length),cursor=0;
 function worker(){
  var i=cursor++;if(i>=generatedShards.length)return Promise.resolve();
  return fetchShard(generatedShards[i]).then(function(part){result[i]=part;return worker();});
 }
 return Promise.all([worker(),worker(),worker(),worker()]).then(function(parts){
  var map=new Map(),total=0;
  parts.forEach(function(part){
   if(!part||part.schema!=='shbace-ai-generated-mcq-source-v1'||part.bankNumber!==8||!Array.isArray(part.systems))throw new Error('AI Generated source shard validation failed.');
   total+=Number(part.totalQuestions||0);
   part.systems.forEach(function(s){
    var target=map.get(s.id);if(!target){target={id:s.id,name:s.name,topics:[]};map.set(s.id,target);}
    (s.topics||[]).forEach(function(t){
     var dst=target.topics.find(function(x){return x.id===t.id;});
     if(!dst){dst={id:t.id,name:t.name,questions:[]};target.topics.push(dst);}
     dst.questions=dst.questions.concat(t.questions||[]);
    });
   });
  });
  var data={schema:'shbace-ai-generated-mcq-bank-v1',bankNumber:8,totalQuestions:total,systems:Array.from(map.values())};
  var all=data.systems.reduce(function(a,s){return a.concat((s.topics||[]).reduce(function(b,t){return b.concat(t.questions||[]);},[]));},[]);
  if(total!==1881||all.length!==1881||all.some(function(q){return !Array.isArray(q.options)||q.options.length!==5||answerIndex(q)<0;}))throw new Error('AI Generated bank integrity check failed.');
  return data;
 });
}
var loaders={
 'clinical-ai':function(){return fetchJson(BANKS['clinical-ai'].source).then(function(data){
  if(!data||data.schema!=='shbace-clinical-case-bank-v1'||!Array.isArray(data.systems)||data.systems.length!==10||Number(data.totalQuestions||1598)!==1598)throw new Error('AI Clinical Cases data validation failed.');
  return data;
 });},
 'generated-ai':loadGenerated
};
function ensureBank(key){
 if(registry[key])return Promise.resolve(registry[key]);
 if(pending[key])return pending[key];
 pending[key]=loaders[key]().then(function(data){return installBank(key,data);}).catch(function(err){errors[key]=err&&err.message?err.message:String(err);delete pending[key];throw err;});
 return pending[key];
}
function esc(v){return String(v==null?'':v).replace(/[&<>"']/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c];});}
function icons(){return window.__SHB_BANK_ICONS__||null;}
function active(){return currentBank&&registry[currentBank]?registry[currentBank]:null;}
function systemPage(){
 var data=active();
 if(!data){
  var label=BANKS[currentBank]?BANKS[currentBank].label:'AI Question Bank';
  if(errors[currentBank])return appHeader(label)+'<div class="rs"><div class="card setcard"><h3>'+esc(label)+' unavailable</h3><p class="meta">'+esc(errors[currentBank])+'</p><button type="button" class="btn primary block" onclick="shbAiRetryBank()">Try again</button></div></div>';
  return appHeader(label)+'<div class="rs"><div class="card setcard"><h3>Loading '+esc(label)+'…</h3><p class="meta">Preparing the question collection.</p></div></div>';
 }
 var I=icons(),tiles=I?I.systems(data.systems.map(function(s){return s.name;})):data.systems.map(function(){return '<div class="tno ti">✚</div>';});
 var cards=data.systems.map(function(s,i){
  return '<div class="card sc spc ped-system-card" role="button" tabindex="0" onclick="shbAiOpenSystem(\''+esc(s.id)+'\')">'+tiles[i]+'<div class="spc-tx"><h3>'+esc(s.name)+'</h3><div class="meta"><b>'+s.count.toLocaleString()+'</b> questions · <b>'+s.groups.length+'</b> topics</div></div><span class="chev">›</span></div>';
 }).join('');
 return appHeader(BANKS[currentBank].label)+'<div class="rs ped-systems-page"><div class="ped-collection-kicker">SHBACE MEDICAL · '+esc(BANKS[currentBank].label.toUpperCase())+'</div><h1>Choose a medical system</h1><p class="sub">'+data.systems.length+' systems · '+data.questions.toLocaleString()+' questions</p><div class="ped-systems-grid">'+cards+'</div></div>';
}
function topicPage(){
 var data=active(),sys=data&&data.systems.find(function(s){return s.id===currentSystem;});
 if(!sys)return systemPage();
 var I=icons(),names=sys.groups.map(function(g){return g.topicName;}),tiles=I?I.topics(sys.name,names):names.map(function(){return '<div class="tno">✚</div>';});
 var cards=sys.groups.map(function(g,i){
  var list=g.questions,done=B.answeredCount(list),pct=list.length?Math.round(done*100/list.length):0;
  return '<div class="card sc tpc" role="button" tabindex="0" onclick="openTopic(\''+esc(g.spec)+'\','+g.topicId+')">'+tiles[i]+'<div class="tpc-tx"><h3>'+esc(g.topicName)+'</h3><div class="meta">'+list.length+' questions · '+done+' answered</div><div class="bar"><span style="width:'+pct+'%"></span></div></div><span class="chev">›</span></div>';
 }).join('');
 var count=sys.groups.reduce(function(n,g){return n+g.questions.length;},0);
 return appHeader(BANKS[currentBank].label)+'<div class="rs ped-bank-topics"><div class="ped-collection-kicker">SHBACE MEDICAL · '+esc(sys.name.toUpperCase())+'</div><h1>'+esc(sys.name)+'</h1><p class="sub">'+sys.groups.length+' topics · '+count.toLocaleString()+' questions</p><button type="button" class="btn primary block allq" onclick="openTopic(\''+esc(sys.spec)+'\',0)">All questions →</button>'+cards+'</div>';
}
var priorSpecialties=window.specialtiesView,priorTopics=window.topicsView;
window.specialtiesView=function(){if(currentBank)return systemPage();return typeof priorSpecialties==='function'?priorSpecialties.apply(this,arguments):'';};
window.topicsView=function(){if(currentBank)return topicPage();return typeof priorTopics==='function'?priorTopics.apply(this,arguments):'';};
var coreBack=window.navBack;
window.navBack=function(){
 if(currentBank&&appPage==='specialties'){currentBank='';currentSystem='';B.setActiveBank('all');window.__SHB_PED_COLLECTION__='';appPage='subjects';renderAppDemo();return;}
 return typeof coreBack==='function'?coreBack.apply(this,arguments):undefined;
};
function ensureStudyToolBanks(){
 if(studyToolReady)return Promise.resolve();
 if(studyToolPromise)return studyToolPromise;
 if(Date.now()-studyToolLastAttempt<15000)return Promise.resolve();
 studyToolLastAttempt=Date.now();
 studyToolPromise=Promise.all(Object.keys(BANKS).map(function(key){return ensureBank(key).catch(function(){return null;});})).then(function(results){
  studyToolReady=results.every(Boolean);studyToolPromise=null;
  if(appPage==='quiz'||appPage==='quizrun'||appPage==='quizresult'||appPage==='quizhistory'||appPage==='review')renderAppDemo();
 });
 return studyToolPromise;
}
var coreNavTap=window.__shbNavTap;
window.__shbNavTap=function(id){
 if(id==='subjects'||id==='search'||id==='quiz'||id==='review'||id==='stats'){currentBank='';currentSystem='';B.setActiveBank('all');window.__SHB_PED_COLLECTION__='';}
 var result=typeof coreNavTap==='function'?coreNavTap.apply(this,arguments):(appPage=id,renderAppDemo());
 if(id==='quiz'||id==='review')ensureStudyToolBanks();
 return result;
};
window.shbAiOpenBank=function(key){
 if(!BANKS[key])return Promise.resolve(null);
 currentBank=key;currentSystem='';B.setActiveBank(key);window.__SHB_PED_COLLECTION__=key;appPage='specialties';renderAppDemo();
 return ensureBank(key).then(function(){renderAppDemo();return registry[key];}).catch(function(err){console.error('AI bank load failed',err);renderAppDemo();throw err;});
};
window.shbAiRetryBank=function(){if(!currentBank)return;delete errors[currentBank];delete pending[currentBank];ensureBank(currentBank).then(function(){renderAppDemo();}).catch(function(){renderAppDemo();});};
window.shbAiOpenSystem=function(id){
 var data=active(),sys=data&&data.systems.find(function(s){return s.id===id;});if(!sys)return;
 currentSystem=id;B.setActiveBank(currentBank,sys.groups.map(function(g){return g.topicId;}));B.qs.spec=sys.spec;B.qs.topic=0;B.qs.filter='all';B.qs.tag='all';B.qs.view='all';B.qs.idx=0;
 appPage='topics';renderAppDemo();
};
window.openClinicalCaseBank07=function(){window.shbAiOpenBank('clinical-ai');};
window.openAiGeneratedBank08=function(){window.shbAiOpenBank('generated-ai');};
window.__shbClinicalCaseBank={count:function(){return BANKS['clinical-ai'].total;},dataLoaded:function(){return !!registry['clinical-ai'];},validation:function(){return registry['clinical-ai']&&registry['clinical-ai'].validation;}};
window.__shbAiGeneratedBank08={count:function(){return BANKS['generated-ai'].total;},dataLoaded:function(){return !!registry['generated-ai'];},validation:function(){return registry['generated-ai']&&registry['generated-ai'].validation;}};
function addBankCards(html){
 var root=document.createElement('div');root.innerHTML=String(html||'');
 var grid=root.querySelector('.ped-collections-grid');if(!grid)return html;
 var cards=[
  ['clinical-ai','ped-collection-card ped-collection-clinicalcase ped-collection-bank07','AI CLINICAL CASES QUESTION BANK','AI Clinical Cases','Case-based questions, with every case and its linked questions.','bank-ai-clinical-cases.webp'],
  ['generated-ai','ped-collection-card ped-collection-allonce ped-collection-bank08','AI-GENERATED MCQ BANK','AI Generated','Single-best-answer questions written from the supplied medical sheets.','bank-ai-generated.webp']
 ];
 cards.forEach(function(item){
  if(grid.querySelector('.'+item[1].split(' ').pop()))return;
  var card='<button type="button" class="'+item[1]+'" onclick="shbAiOpenBank(\''+item[0]+'\')"><div class="ped-collection-avatar ped-avatar-allonce ped-avatar-icon"><img src="/assets/img/'+item[5]+'" alt="" loading="lazy"></div><span class="ped-collection-copy"><span class="eyebrow">'+item[2]+'</span><b>'+item[3]+'</b><small>'+item[4]+'</small><span class="ped-collection-count">'+BANKS[item[0]].total.toLocaleString()+' questions</span></span><span class="ped-collection-arrow">›</span></button>';
  grid.insertAdjacentHTML('beforeend',card);
 });
 var firstFour=['ped-collection-aj','ped-collection-previous','ped-collection-bank07','ped-collection-bank08'];
 firstFour.slice().reverse().forEach(function(cls){var card=grid.querySelector('.'+cls);if(card)grid.insertBefore(card,grid.firstChild);});
 return root.innerHTML;
}
var finalSpecialties=window.specialtiesView;
window.specialtiesView=function(){if(currentBank)return systemPage();return addBankCards(finalSpecialties.apply(this,arguments));};
var coreRender=window.renderAppDemo;
var LEGACY_AI_PAGES=['clinicalSystems','clinicalTopics','clinicalCases','clinicalQuestions','ai08Systems','ai08Topics','ai08Questions'];
window.renderAppDemo=function(){
 if(LEGACY_AI_PAGES.indexOf(String(appPage))>=0){currentBank='';currentSystem='';B.setActiveBank('all');window.__SHB_PED_COLLECTION__='';appPage='subjects';}
 var result=coreRender.apply(this,arguments);
 if(appPage==='quiz'||appPage==='quizrun'||appPage==='quizresult'||appPage==='quizhistory'||appPage==='review')ensureStudyToolBanks();
 return result;
};
window.addEventListener('shb-scripts-ready',function(){setTimeout(function(){if(mode==='app'&&appPage==='subjects'&&typeof window.renderAppDemo==='function')window.renderAppDemo();},0)});
if(String(appPage).indexOf('ai08')===0||String(appPage).indexOf('clinical')===0){appPage='specialties';currentBank='';B.setActiveBank('all');}
})();