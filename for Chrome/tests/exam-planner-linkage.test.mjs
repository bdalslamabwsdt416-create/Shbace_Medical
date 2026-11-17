import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const planner = readFileSync(new URL('../js/36-exam-planner-settings-smartreview.js', import.meta.url), 'utf8');
const hub = readFileSync(new URL('../js/37-study-hub-linkage.js', import.meta.url), 'utf8');
const offline = readFileSync(new URL('../js/29-offline-setup.js', import.meta.url), 'utf8');

function key(source, pattern, label) {
  const match = source.match(pattern);
  assert.ok(match, label + ' storage key is present');
  return match[1];
}

test('Exam Planner, Study Hub and update quiet-period use one exam-goal store', () => {
  const plannerKey = key(planner, /var EXAM_KEY='([^']+)'/, 'Planner');
  const hubKey = key(hub, /var GOALS_KEY='([^']+)'/, 'Study Hub');
  const offlineKey = key(offline, /EXAM_KEY='([^']+)'/, 'Offline updater');
  assert.equal(hubKey, plannerKey);
  assert.equal(offlineKey, plannerKey);
});
