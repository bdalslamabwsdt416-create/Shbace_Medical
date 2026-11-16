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
  assert.ok(adapter.includes('number:item.number==null?'':item.number,first:i===0'));
  assert.ok(adapter.includes('out.aiCaseVignette=caseInfo.vignette'));
  assert.ok(adapter.includes('out.aiCaseContinued=true'));
  assert.ok(mainBank.includes('const aiCaseBlock=q.aiCaseVignette'));
  assert.ok(mainBank.includes('CONTINUED — Same clinical case'));
});

test('Quiz and Smart Review include both AI banks and legacy AI routes are blocked', () => {
  assert.ok(adapter.includes('function ensureStudyToolBanks()'));
  assert.ok(adapter.includes("if(id==='quiz'||id==='review')ensureStudyToolBanks()"));
  assert.ok(adapter.includes('LEGACY_AI_PAGES'));
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
