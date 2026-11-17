import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const read = path => readFileSync(new URL('../' + path, import.meta.url), 'utf8');
const planner = read('js/36-exam-planner-settings-smartreview.js');
const hub = read('js/37-study-hub-linkage.js');
const offline = read('js/29-offline-setup.js');
const drawerOrder = read('js/20-drawer-order-v12.js');
const appFeatures = read('js/09-app-features-v6.js');

function key(source, pattern, label) {
  const match = source.match(pattern);
  assert.ok(match, label + ' storage key is present');
  return match[1];
}

test('iOS Exam Planner, Study Hub and offline updater keep one exam-goal store', () => {
  const plannerKey = key(planner, /var EXAM_KEY='([^']+)'/, 'Planner');
  const hubKey = key(hub, /var GOALS_KEY='([^']+)'/, 'Study Hub');
  const offlineKey = key(offline, /EXAM_KEY='([^']+)'/, 'Offline updater');
  assert.equal(hubKey, plannerKey);
  assert.equal(offlineKey, plannerKey);
});

function loadDrawerAndPlannerInOrder() {
  const DR2 = [
    ['Learn', [['Subjects', 'subjects', '<svg/>']]],
    ['Review', [
      ['Saved questions', 'saved', '<svg/>', ''],
      ['Wrong answers', 'wrong', '<svg/>', ''],
      ['Smart Review', 'review', '<svg/>', '12'],
      ['Reported questions', 'reported', '<svg/>', ''],
      ['My Notes', 'notes', '<svg/>', '']
    ]],
    ['Progress', [
      ['Statistics', 'stats', '<svg/>', ''],
      ['Pinned & Recent', 'pinned', '<svg/>', ''],
      ['Study timer', 'timer', '<svg/>', '']
    ]],
    ['Account and help', [
      ['Settings', 'settings', '<svg/>', ''],
      ['Contact and feedback', 'feedback', '<svg/>', ''],
      ['Changelog', 'changelog', '<svg/>', ''],
      ['About', 'about', '<svg/>', ''],
      ['Rate this app', 'rate', '<svg/>', '']
    ]]
  ];
  const registered = Object.create(null);
  const document = {
    readyState: 'complete',
    documentElement: null,
    querySelector() { return null; },
    querySelectorAll() { return []; },
    addEventListener() {}
  };
  const window = {
    __shbRegisterPage(id, renderer, backTarget) {
      registered[id] = { renderer, backTarget };
      return true;
    },
    addEventListener() {}
  };
  const context = {
    DR2, window, document,
    localStorage: { getItem() { return null; }, setItem() {}, removeItem() {} },
    requestAnimationFrame() {},
    setTimeout() { return 0; },
    setInterval() { return 0; },
    console: { warn() {}, error() {}, log() {} }
  };
  vm.createContext(context);
  vm.runInContext(drawerOrder, context, { filename: 'js/20-drawer-order-v12.js' });
  vm.runInContext(planner, context, { filename: 'js/36-exam-planner-settings-smartreview.js' });
  return { DR2, registered };
}

test('Exam Planner appears in the iOS drawer after loading 20 then 36', () => {
  const { DR2, registered } = loadDrawerAndPlannerInOrder();
  assert.deepEqual(DR2.map(group => group[0]), ['REVIEW', 'YOUR PROGRESS', 'APP & SUPPORT']);
  const progress = DR2.find(group => group[0] === 'YOUR PROGRESS');
  assert.deepEqual(progress[1].map(item => item[1]), ['examplanner', 'timer', 'stats', 'weak']);
  assert.equal(progress[1][0][0], 'Exam goal planner');
  assert.equal(typeof registered.examplanner?.renderer, 'function');
  assert.equal(registered.examplanner.backTarget, 'subjects');
});

test('Smart Review has no drawer or bottom-navigation count badge', () => {
  const { DR2 } = loadDrawerAndPlannerInOrder();
  const review = DR2.find(group => group[0] === 'REVIEW');
  const smartReview = review[1].find(item => item[1] === 'review');
  assert.ok(smartReview, 'Smart Review remains in the drawer');
  assert.equal(smartReview[3] || '', '', 'the drawer badge field is empty');
  assert.ok(!appFeatures.includes('DR2[1][1][2][3]='), 'drawer count is not written when opened');
  const appNav = appFeatures.match(/appNav=function\(\)\{([\s\S]*?)\n\/\* drawer:/);
  assert.ok(appNav, 'the app navigation renderer is present');
  assert.ok(!/nbadge|dueList\(\)\.length/.test(appNav[1]), 'bottom navigation has no Smart Review count');
  const badgeUpdater = appFeatures.match(/function updateBadges\(\)\{([^}]*)\}/);
  assert.ok(badgeUpdater, 'the badge cleanup function remains available');
  assert.ok(!/insertAdjacentHTML|appendChild/.test(badgeUpdater[1]), 'updateBadges never creates a badge');
});

test('iOS App updates card displays version, check time and pending-file count', () => {
  assert.ok(appFeatures.includes('function shbaceSettingsUpdateMeta()'));
  assert.ok(appFeatures.includes('window.shbaceVersionInfo&&window.shbaceVersionInfo()'));
  assert.ok(appFeatures.includes('window.shbaceLastUpdateCheck&&window.shbaceLastUpdateCheck()'));
  assert.ok(appFeatures.includes('window.shbaceUpdatePending&&window.shbaceUpdatePending()'));
  assert.ok(appFeatures.includes("case 'busy':"));
  assert.ok(appFeatures.includes("case 'unsupported':"));
  assert.ok(!appFeatures.includes('Chrome · Unified'));
  assert.ok(!appFeatures.includes('shbChromeInstall'));
  assert.ok(!appFeatures.includes('shbChromeFullscreen'));
});
