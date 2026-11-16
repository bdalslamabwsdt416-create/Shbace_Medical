import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';

const read = (path) => readFileSync(new URL(path, import.meta.url), 'utf8');
const collections = read('../js/35-pediatrics-collections.js');
const integration90 = read('../js/39-clinical-case-pediatrics.js');
const adapter = read('../js/43-ai-bank-engine-adapter.js');
const mainBank = read('../js/09-app-features-v6.js');
const polish = read('../js/42-pediatrics-collection-polish.js');
const index = read('../index.html');
const build = read('../scripts/build-pwa.mjs');
const previousData = JSON.parse(read('../data/qbData.json')).questions;
const bank07Data = JSON.parse(read('../data/clinicalCaseBank.json'));

const legacy90Window = { __SHB_CLINICAL_CASE_QUESTIONS__: [] };
runInNewContext(read('../data/clinical-case/clinical-case-bank-01.js'), { window: legacy90Window });
const clinicalCases90 = legacy90Window.__SHB_CLINICAL_CASE_QUESTIONS__;

test('Previous Questions is restored with all 399 source-marked questions', () => {
  const questions = previousData.filter(question => question.py === 1);
  assert.equal(questions.length, 399);
  assert.match(collections, /previousCount=previousQuestions\(\)\.length/);
  assert.match(collections, /ped-collection-previous[^"]*" onclick="selectPediatricCollection\('previous'\)"/);
  assert.match(collections, /<b>Previous Questions<\/b>/);
  assert.match(collections, /\$\{previousCount\.toLocaleString\(\)\} questions/);
  assert.doesNotMatch(collections, /ped-collection-previous ped-collection-clinicalcase ped-collection-bank07/);
});

test('The 90-question Clinical Cases bank and 1,598-question AI Clinical Cases bank stay independent', () => {
  assert.equal(bank07Data.totalQuestions, 1598);
  assert.equal(bank07Data.systems.length, 10);
  const bank07Questions = bank07Data.systems.flatMap(system => system.topics.flatMap(topic => topic.cases.flatMap(item => item.questions)));
  assert.equal(bank07Questions.length, 1598);
  assert.equal(new Set(bank07Questions.map(question => question.id)).size, 1598);

  assert.equal(clinicalCases90.length, 90);
  assert.ok(clinicalCases90.every(question => question.cc === true));
  assert.equal(new Set(clinicalCases90.map(question => question.id)).size, 90);
  assert.equal(clinicalCases90.filter(question => bank07Questions.some(item => item.id === question.id)).length, 0);

  assert.ok(adapter.includes("'clinical-ai':{label:'AI Clinical Cases',total:1598"));
  assert.ok(adapter.includes("store:'shbace_clinical_case_answers_v1'"));
  assert.ok(adapter.includes("source:'data/clinicalCaseBank.json'"));
  assert.match(integration90, /CLINICAL CASES QUESTION BANK/);
  assert.match(integration90, /clinicalCaseQuestions\(\)\.length\.toLocaleString\(\)/);
  assert.match(integration90, /if\(ccActive==='clinicalcase'\)/);
  assert.match(integration90, /B\.bankOf\(q\)!=="clinical"/);
});

test('AI Clinical Cases and AI Generated are registered as data providers for the shared question engine', () => {
  assert.ok(adapter.includes("'clinical-ai':{label:'AI Clinical Cases',total:1598"));
  assert.ok(adapter.includes("'generated-ai':{label:'AI Generated',total:1881"));
  assert.ok(adapter.includes("B.registerExternalBank(key,BANKS[key].label,groups)"));
  assert.ok(collections.includes("chosen==='clinical-ai'||chosen==='generated-ai'"));
  assert.ok(core.includes('get coreInTopic(){return coreInTopic}'));
  assert.ok(adapter.includes('B.coreInTopic().filter(function(q){return B.bankOf(q)===currentBank;})'));
  assert.ok(adapter.includes("data/ai-generated/16-rheumatology-metabolic-poisoning-immunology.json"));
  assert.ok(adapter.includes("shbace-ai-generated-mcq-source-v1"));
  assert.ok(adapter.includes("total!==1881||all.length!==1881"));
  assert.ok(mainBank.includes("registerExternalBank:function(key,label,groups)"));
  assert.match(mainBank, /function cardHTML\(q,n,single\)/);
  assert.ok(index.includes('data-src="js/43-ai-bank-engine-adapter.js"'));
  assert.ok(!index.includes('data-src="js/33-clinical-case-bank.js"'));
  assert.ok(!index.includes('data-src="js/33-ai-generated-bank.js"'));
  assert.ok(!build.includes('"js/33-clinical-case-bank.js"'));
  assert.ok(!build.includes('"js/33-ai-generated-bank.js"'));
  assert.ok(build.includes('"js/43-ai-bank-engine-adapter.js"'));
});

test('Shared case vignette is shown in the first question card and marked continued later', () => {
  assert.ok(adapter.includes('item.hasSharedCaseText&&item.vignette'));
  assert.ok(adapter.includes("number:item.number==null?'':item.number,first:i===0"));
  assert.ok(adapter.includes('out.aiCaseVignette=caseInfo.vignette'));
  assert.ok(adapter.includes('out.aiCaseContinued=true'));
  assert.ok(mainBank.includes('const aiCaseBlock=q.aiCaseVignette'));
  assert.ok(mainBank.includes('CONTINUED — Same clinical case'));
});

test('Quiz and Smart Review include both AI banks and legacy AI routes are blocked', () => {
  assert.ok(adapter.includes('function ensureStudyToolBanks()'));
  assert.ok(adapter.includes("if(id==='quiz'||id==='review')ensureStudyToolBanks()"));
  assert.ok(adapter.includes('LEGACY_AI_PAGES'));
  assert.ok(adapter.includes("else if(currentBank&&['specialties','topics','questions'].indexOf(page)<0)"));
  assert.ok(adapter.includes("document.addEventListener('shb-scripts-ready'"));
  assert.ok(adapter.includes('clinicalSystems'));
  assert.ok(adapter.includes('ai08Systems'));
  assert.ok(adapter.includes('shbace_clinical_case_answers_v1'));
  assert.ok(adapter.includes('shbace_ai_generated_answers_v1'));
  assert.ok(adapter.includes('engine_migration_v1'));
  assert.ok(mainBank.includes('qzDeferredBankId'));
  assert.ok(mainBank.includes('ACTIVE_QBANK_TOPICS'));
});

test('The collection icons distinguish the two case banks', () => {
  assert.match(polish, /\.ped-collection-bank07', 'bank-ai-clinical-cases\.webp', 'AI Clinical Cases'/);
  assert.match(polish, /\.ped-collection-clinicalcase:not\(\.ped-collection-bank07\)', 'bank-clinical-case\.webp', 'Clinical Cases'/);
});


test('The adapter registers real AI bank records in the shared engine and migrates previous answers without deleting source stores', async () => {
  const clinical = bank07Data;
  const shardPaths = [
    '01-cns.json','02-comprehensive-pediatrics.json','03-cvs.json','04-developmental-assessment-and-milestones.json',
    '05-endocrine.json','06-git.json','07-growth-and-nutrition.json','08-hematology.json','09-infectious.json',
    '10-neonatology.json','11-nephrology.json','12-pediatric-dermatology-allergy-hepatology-tumors-child-abuse.json',
    '13-pediatric-genetics.json','14-pediatric-vaccination.json','15-respiratory.json',
    '16-rheumatology-metabolic-poisoning-immunology.json'
  ];
  const shardData = shardPaths.map(name => JSON.parse(read('../data/ai-generated/' + name)));
  const clinicalAnswer = clinical.systems.flatMap(s => s.topics.flatMap(t => t.cases.flatMap(c => c.questions)))[0];
  const generatedAnswer = shardData.flatMap(s => s.systems.flatMap(sys => sys.topics.flatMap(t => t.questions)))[0];
  const clinicalKey = clinicalAnswer.options.findIndex(o => o.label === clinicalAnswer.correctAnswer);
  const generatedKey = generatedAnswer.options.findIndex(o => o.label === generatedAnswer.correctAnswer);
  const local = new Map([
    ['shbace_clinical_case_answers_v1', JSON.stringify({[clinicalAnswer.id]:{selected:clinicalAnswer.correctAnswer,correct:true,answeredAt:111,readMore:true}})],
    ['shbace_ai_generated_answers_v1', JSON.stringify({[generatedAnswer.id]:{selected:generatedAnswer.correctAnswer,correct:true,answeredAt:222,readMore:true}})]
  ]);
  const bridge = {
    QB:[],QBY:new Map(),qmap:new Map(),TOPIC_NAME:{},REAL:{spec:{}},SPEC_NAME:{},
    SYS:[['cns','Central Nervous System'],['cardio','Cardiovascular System'],['endocrinology','Endocrinology'],['nephrology','Nephrology'],['respiratory','Respiratory'],['git','Gastrointestinal Tract']],
    BANK_OPTS:[['all','All banks']],BANK_KEYS:new Set(),SRT:[],SRT_BY:new Map(),SRT_Q:new Map(),
    S:{ans:{},saved:{},notes:{},rep:{}},qs:{spec:'all',topic:0,filter:'all',tag:'all',view:'all',idx:0},
    save(){this.savedCount=(this.savedCount||0)+1;},
    setActiveBank(key,topics){this.activeBank=key;this.activeTopics=topics||null;},
    answeredCount(){return 0;},
    registerExternalBank(key,label,groups){
      if(!this.BANK_KEYS.has(key)){this.BANK_KEYS.add(key);this.BANK_OPTS.push([key,label]);}
      let added=0;
      groups.forEach((g,i)=>{
        const topicId=(key==='clinical-ai'?8200000:8400000)+i;
        this.TOPIC_NAME[topicId]=g.topicName;
        if(!this.REAL.spec[g.spec])this.REAL.spec[g.spec]={q:0,topics:[],label:g.systemLabel||g.spec};
        this.REAL.spec[g.spec].topics.push([topicId,g.topicName,g.questions.length,g.systemName]);
        const list=[];
        g.questions.forEach(q=>{q.bank=key;q.topic=topicId;this.QB.push(q);this.QBY.set(q.id,q);this.qmap.set(q.id,q);list.push(q);added++;});
        this.SRT_Q.set(topicId,list);
        const tr={id:topicId,name:g.topicName,sy:g.systemName,spec:g.spec,specLabel:g.systemLabel,key:g.spec+'|'+g.systemName+'|'+g.topicName};
        this.SRT.push(tr);this.SRT_BY.set(topicId,tr);
      });
      return {added,total:this.QB.length,topics:groups.length};
    }
  };
  const generatedMap = Object.fromEntries(shardPaths.map((name,i)=>['data/ai-generated/'+name,shardData[i]]));
  const fetch = async url => {
    const path = new URL(url).pathname.replace(/^\//,'');
    const json = path==='data/clinicalCaseBank.json'?clinical:generatedMap[path];
    assert.ok(json,path);
    return {ok:true,json:async()=>json};
  };
  const docListeners = {};
  let renderCount = 0;
  const window = {
    __SHB_BRIDGE:bridge,
    addEventListener(){},
    renderAppDemo(){renderCount++;},
    specialtiesView(){return '';},
    topicsView(){return '';},
    navBack(){},
    __shbNavTap(){}
  };
  const context = {
    window,
    document:{
      baseURI:'https://shbace.test/',
      addEventListener(name,fn){docListeners[name]=fn;}
    },
    fetch,
    localStorage:{getItem:k=>local.has(k)?local.get(k):null,setItem:(k,v)=>local.set(k,v)},
    appPage:'subjects',mode:'app',
    appHeader:()=>'',renderAppDemo(){renderCount++;},
    console,URL,Promise,Map,Set,Date,Array,Object,String,Number,Math,RegExp,Error,
    setTimeout,clearTimeout
  };
  runInNewContext(adapter,context);
  const clinicalResult=await window.shbAiOpenBank('clinical-ai');
  const generatedResult=await window.shbAiOpenBank('generated-ai');
  assert.equal(clinicalResult.questions,1598);
  assert.equal(generatedResult.questions,1881);
  assert.equal(bridge.QB.length,3479);
  assert.equal(bridge.BANK_KEYS.has('clinical-ai'),true);
  assert.equal(bridge.BANK_KEYS.has('generated-ai'),true);
  assert.equal(bridge.BANK_OPTS.some(x=>x[0]==='clinical-ai'),true);
  assert.equal(bridge.BANK_OPTS.some(x=>x[0]==='generated-ai'),true);
  assert.equal(bridge.SRT_Q.size,clinicalResult.groups.length+generatedResult.groups.length);
  const clinicalSaved=bridge.S.ans['ai07-'+clinicalAnswer.id];
  const generatedSaved=bridge.S.ans['ai08-'+generatedAnswer.id];
  assert.deepEqual(JSON.parse(JSON.stringify(clinicalSaved)),{sel:clinicalKey,ok:true,t:111});
  assert.deepEqual(JSON.parse(JSON.stringify(generatedSaved)),{sel:generatedKey,ok:true,t:222});
  assert.ok(local.has('shbace_clinical_case_answers_v1'));
  assert.ok(local.has('shbace_ai_generated_answers_v1'));
  assert.ok(local.has('shbace_clinical-ai_engine_migration_v1'));
  assert.ok(local.has('shbace_generated-ai_engine_migration_v1'));
  assert.ok(bridge.QB.every(q=>q.ai!==1));
  assert.ok(bridge.QB.every(q=>q.kind===''));
  assert.ok(bridge.QB.every(q=>q.aiBank==='clinical-ai'||q.aiBank==='generated-ai'));
  assert.ok(bridge.QB.some(q=>q.aiCaseVignette));
  assert.ok(bridge.QB.some(q=>q.aiCaseContinued));

  // Direct drawer routes must clear the active bank scope; the startup-ready event
  // is dispatched by the real loader on document, not window.
  context.appPage='saved';
  window.renderAppDemo();
  assert.equal(bridge.activeBank,'all');
  context.appPage='subjects';
  assert.equal(typeof docListeners['shb-scripts-ready'],'function');
  const rendersBeforeStartupReady=renderCount;
  docListeners['shb-scripts-ready']();
  await new Promise(resolve=>setTimeout(resolve,10));
  assert.ok(renderCount>rendersBeforeStartupReady);
});
