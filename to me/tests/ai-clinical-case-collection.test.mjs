import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';

const read = (path) => readFileSync(new URL(path, import.meta.url), 'utf8');
const collections = read('../js/35-pediatrics-collections.js');
const integration90 = read('../js/39-clinical-case-pediatrics.js');
const bank07 = read('../js/33-clinical-case-bank.js');
const mainBank = read('../js/09-app-features-v6.js');
const polish = read('../js/42-pediatrics-collection-polish.js');
const previousData = JSON.parse(read('../data/qbData.json')).questions;
const bank07Data = JSON.parse(read('../data/clinicalCaseBank.json'));

const legacy90Window = { __SHB_CLINICAL_CASE_QUESTIONS__: [] };
runInNewContext(read('../data/clinical-case/clinical-case-bank-01.js'), { window: legacy90Window });
const aiClinical90 = legacy90Window.__SHB_CLINICAL_CASE_QUESTIONS__;

test('Previous Questions is restored with all 399 source-marked questions', () => {
  const questions = previousData.filter(question => question.py === 1);
  assert.equal(questions.length, 399);
  assert.match(collections, /previousCount=previousQuestions\(\)\.length/);
  assert.match(collections, /ped-collection-previous[^"]*" onclick="selectPediatricCollection\('previous'\)"/);
  assert.match(collections, /<b>Previous Questions<\/b>/);
  assert.match(collections, /\$\{previousCount\.toLocaleString\(\)\} questions/);
  assert.doesNotMatch(collections, /ped-collection-previous ped-collection-clinicalcase ped-collection-bank07/);
});

test('The 1,598-question Clinical Case bank and the 90-question AI Clinical Cases bank stay independent', () => {
  assert.equal(bank07Data.totalQuestions, 1598);
  assert.equal(bank07Data.systems.length, 10);
  const bank07Questions = bank07Data.systems.flatMap(system => system.topics.flatMap(topic => topic.cases.flatMap(item => item.questions)));
  assert.equal(bank07Questions.length, 1598);
  assert.equal(new Set(bank07Questions.map(question => question.id)).size, 1598);

  assert.equal(aiClinical90.length, 90);
  assert.ok(aiClinical90.every(question => question.cc === true));
  assert.equal(new Set(aiClinical90.map(question => question.id)).size, 90);
  assert.equal(aiClinical90.filter(question => bank07Questions.some(item => item.id === question.id)).length, 0);

  assert.match(bank07, /const BANK_TOTAL = 1598/);
  assert.match(bank07, /shbace_clinical_case_answers_v1/);
  assert.match(integration90, /AI CLINICAL CASES QUESTION BANK/);
  assert.match(integration90, /clinicalCaseQuestions\(\)\.length\.toLocaleString\(\)/);
  assert.match(integration90, /if\(ccActive==='clinicalcase'\)/);
  assert.match(integration90, /B\.bankOf\(q\)!=="clinical"/);
});

test('All three banks share the same question-card presentation language', () => {
  const mainCard = mainBank.slice(mainBank.indexOf('function cardHTML(q,n,single){'), mainBank.indexOf('function bankBody(){'));
  const bank07Card = bank07.slice(bank07.indexOf('function questionCard(q,index) {'), bank07.indexOf('function questionsPage() {'));
  for (const cls of ['qcard', 'qstem', 'qopts', 'qopt', 'qfb']) {
    assert.ok(mainCard.includes(cls), 'the core question renderer includes .' + cls);
    assert.ok(bank07Card.includes(cls), 'Bank 07 uses .' + cls);
  }
  assert.match(bank07Card, /class="qreact /);
  assert.match(bank07Card, /class="nl-more"/);
  assert.doesNotMatch(bank07Card, /cc-difficulty|cc-options|cc-question-head/);
  // Previous Questions and the 90-question AI Clinical Cases bank both use the same core QB renderer.
  assert.match(mainBank, /function cardHTML\(q,n,single\)/);
  assert.match(integration90, /return oldInTopic\.apply\(this,arguments\)\.filter/);
});

test('Bank 07 opens a topic directly to all its case histories and linked questions', () => {
  const topicAction = bank07.slice(bank07.indexOf('window.bank07OpenClinicalCaseTopic=function(id)'), bank07.indexOf('window.bank07OpenClinicalCase=function(id)'));
  assert.match(topicAction, /appPage='clinicalQuestions'/);
  const page = bank07.slice(bank07.indexOf('function questionsPage() {'), bank07.indexOf('function currentView() {'));
  assert.match(page, /topic\.cases\.map/);
  assert.match(page, /item\.hasSharedCaseText/);
  assert.match(page, /'qb ped-bank-topics'/);
  const back = bank07.slice(bank07.indexOf('window.bank07ClinicalCaseBack=function()'), bank07.indexOf('window.bank07AnswerClinicalCaseQuestion=function'));
  assert.match(back, /if\(appPage==='clinicalQuestions'\)appPage='clinicalTopics'/);
});

test('The collection icons distinguish the two case banks', () => {
  assert.match(polish, /\.ped-collection-bank07', 'bank-clinical-case\.webp', 'Clinical Cases'/);
  assert.match(polish, /\.ped-collection-clinicalcase:not\(\.ped-collection-bank07\)', 'bank-ai-clinical-cases\.webp', 'AI Clinical Cases'/);
});