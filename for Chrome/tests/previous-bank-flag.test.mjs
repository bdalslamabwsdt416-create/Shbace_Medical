import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const appSource = readFileSync(new URL('../js/09-app-features-v6.js', import.meta.url), 'utf8');
const bankData = JSON.parse(readFileSync(new URL('../data/qbData.json', import.meta.url), 'utf8')).questions;
const bankFunction = appSource.match(/const bankOf=q=>\{[\s\S]*?\n\};/);
assert.ok(bankFunction, 'bankOf classifier must exist in the main question-bank module');
const BANK_KEYS = new Set(['previous', 'nelson', 'egyptian', 'clinical', 'kasr', 'aj']);
const bankOf = new Function('BANK_KEYS', bankFunction[0] + '; return bankOf;')(BANK_KEYS);

test('Previous Questions numeric source marker py=1 is classified as Previous', () => {
  const previous = bankData.filter(question => question.py === 1);
  assert.equal(previous.length, 399, 'the source bank currently contains 399 Previous Questions');
  assert.ok(previous.every(question => bankOf(question) === 'previous'));
  assert.ok(previous.every(question => question.bank === 'previous'));
});

test('legacy bank flags accept boolean, numeric and string forms without reclassifying ordinary MCQs', () => {
  assert.equal(bankOf({ py: true }), 'previous');
  assert.equal(bankOf({ py: 1 }), 'previous');
  assert.equal(bankOf({ py: '1' }), 'previous');
  assert.equal(bankOf({ py: 1, bank: 'aj' }), 'previous', 'the source exam marker must override a stale cached bank label');
  assert.equal(bankOf({}), 'aj');
});
