import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = (path) => readFileSync(new URL(path, import.meta.url), 'utf8');
const collections = read('../js/35-pediatrics-collections.js');
const integration = read('../js/39-clinical-case-pediatrics.js');
const bank07 = read('../js/33-clinical-case-bank.js');
const polish = read('../js/42-pediatrics-collection-polish.js');
const index = read('../index.html');
const data = JSON.parse(read('../data/clinicalCaseBank.json'));

test('the former empty Previous Questions slot opens one populated AI Clinical Case bank', () => {
  const start = collections.indexOf('function collectionView(){');
  const end = collections.indexOf('}window.openPediatricCollections=', start);
  assert.ok(start >= 0 && end > start, 'collection chooser source must exist');
  const view = collections.slice(start, end);
  const entries = view.match(/class="ped-collection-card [^"]*ped-collection-bank07/g) || [];
  assert.equal(entries.length, 1, 'there must be exactly one clinical-case entry');
  assert.match(view, /ped-collection-previous ped-collection-clinicalcase ped-collection-bank07/);
  assert.match(view, /onclick="openClinicalCaseBank07\(\)"/);
  assert.match(view, /<b>AI Clinical Case<\/b>/);
  assert.doesNotMatch(view, /<b>Previous Questions<\/b>/);
  assert.doesNotMatch(view, /<b>Clinical Cases<\/b>/);
});

test('the legacy zero-count card is suppressed while the canonical bank loader remains available', () => {
  assert.match(index, /id="clinical-case-pediatrics" data-src="js\/39-clinical-case-pediatrics\.js"/);
  assert.match(integration, /html\.indexOf\('ped-collection-clinicalcase'\)<0/);
  assert.match(viewSource(), /ped-collection-clinicalcase ped-collection-bank07/);
  assert.match(bank07, /const BANK_TOTAL = 1598/);
  assert.match(bank07, /shbace_clinical_case_answers_v1/);
  assert.match(polish, /bank-ai-clinical-cases\.webp/);
});
function viewSource() {
  const start = collections.indexOf('function collectionView(){');
  const end = collections.indexOf('}window.openPediatricCollections=', start);
  return collections.slice(start, end);
}
test('AI Clinical Case data is complete and internally consistent', () => {
  assert.equal(data.schema, 'shbace-clinical-case-bank-v1');
  assert.equal(data.validation?.passed, true);
  assert.equal(data.systems.length, 10);
  const topics = data.systems.flatMap(system => system.topics);
  const cases = topics.flatMap(topic => topic.cases);
  const questions = cases.flatMap(item => item.questions);
  assert.equal(topics.length, 284);
  assert.equal(cases.length, 330);
  assert.equal(questions.length, 1598);
  assert.equal(data.totalQuestions, questions.length);
  assert.equal(new Set(questions.map(question => question.id)).size, questions.length, 'question IDs must be unique');
});
