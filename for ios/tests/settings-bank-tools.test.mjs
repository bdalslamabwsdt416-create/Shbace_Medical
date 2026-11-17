import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const read = (relative) => fs.readFileSync(fileURLToPath(new URL(relative, import.meta.url)), 'utf8');
const features = read('../js/09-app-features-v6.js');
const voice = read('../js/33-unified-voice.js');
const settings = read('../js/36-exam-planner-settings-smartreview.js');
const index = read('../index.html');
const drawer = read('../js/06-drawer-menu.js');
const returning = read('../js/07-returning-student-migration.js');
const toMe = read('../../to%20me/js/30-android-enhancements.js');

function extractFunction(source, name) {
  const start = source.indexOf('function ' + name + '(');
  assert.notEqual(start, -1, name + ' exists');
  const end = source.indexOf('\n}', start);
  assert.notEqual(end, -1, name + ' has a closing brace');
  return source.slice(start, end + 2);
}

function bankHelpers() {
  const start = features.indexOf('/* SHB-BANK-SCOPE:');
  const end = features.indexOf('/* ---------- state ---------- */', start);
  assert.ok(start >= 0 && end > start, 'bank classification source is present');
  const helpers = [
    extractFunction(features, 'resetScopeMatches'),
    extractFunction(features, 'resetScopeFromStudyContext')
  ].join('\n');
  return vm.runInNewContext(features.slice(start, end) + '\n' + helpers +
    '\n({BANK_OPTS,bankOf,bankValid,bankOk,resetScopeMatches,resetScopeFromStudyContext})', {
      BANK_ON: false, FULL_TAGS: [], DEMO_QB: [], QB: [], window: {}
    });
}


test('Settings navigation opens the actual Settings renderer from the header and drawer', () => {
  assert.ok(drawer.includes("if(n==='Settings'){appPage='settings';renderAppDemo();return}"),
    'header Settings control must navigate instead of showing a placeholder toast');
  assert.ok(drawer.includes("['Settings','settings']"),
    'legacy drawer Settings item must carry a real route');
  assert.ok(returning.includes("['Settings','settings','<circle"),
    'current drawer Settings item must carry a real route');
  assert.ok(features.includes("window.__shbRenderSettings=function(){return settingsView()}"),
    'the real Settings renderer must be exported for the navigation bridge');
  assert.ok(features.includes("window.__shbOpenSettings=function(){appPage='settings';renderAppDemo();return true}"),
    'the explicit Settings navigation action must set the route and render');
  assert.ok(features.includes("PAGES.settings=settingsView"),
    'the Settings route must be registered in the final page renderer');
});

test('iOS Settings retains appearance, onboarding, notifications, backup and progress controls', () => {
  for (const marker of [
    'function settingsView()', 'id="shbAppUpdates"', 'function u10PrefCard()',
    'Student data backup', 'Export full backup', 'Restore / Merge',
    'Reset by bank, system or topic', "First Onboarding Page", "Last Onboarding Page"
  ]) assert.ok(features.includes(marker), 'missing settings feature: ' + marker);
  assert.ok(voice.includes("card.id='shbUnifiedVoiceSettings'"));
  assert.ok(voice.includes("tools.id='shbQuestionToolsSettings'"));
  assert.ok(voice.includes("tools.id='shbQuestionToolsSettings'"));
  assert.ok(voice.includes("tools.innerHTML='<h3>Study experience</h3>'"));
  assert.ok(voice.includes("iosStudyToggleMarkup('keepScreenAwake','Keep screen awake'"));
  assert.ok(voice.includes("iosStudyToggleMarkup('followSystemTheme','Follow device theme'"));
  assert.ok(voice.includes("getElementById('shbQuestionToolsSettings')"));
  assert.ok(!voice.includes('shbIosStudyExperienceSettings'));
  assert.ok(voice.includes("navigator.wakeLock.request('screen')"));
  assert.ok(voice.includes('prefers-color-scheme: light'));
  assert.ok(voice.includes("localStorage.setItem(IOS_EXPERIENCE_KEY"));
});

test('question cards in the iOS bank receive Share, Copy and Read aloud controls', () => {
  assert.match(voice, /function computerVoiceDecorateQuestions\(\)[\s\S]*?data-shb-question-tool="share"/);
  assert.ok(voice.includes('data-shb-question-tool="copy"'));
  assert.ok(voice.includes('data-shb-question-tool="readAloud"'));
  assert.ok(voice.includes('computerVoiceToggleQuestionReadAloud(qcard,qtext,questionTool)'));
  assert.ok(voice.includes('computerVoiceCopyQuestion(qtext)'));
  assert.ok(voice.includes('computerVoiceShareQuestion(qtext)'));
  assert.ok(voice.includes('observe(questionHost,{childList:true})'));
  assert.ok(!voice.includes('observe(document.body,{childList:true,subtree:true})'));
  assert.ok(features.includes('function u11DataKeys()') && features.includes("k.startsWith('shbace_')"),
    'the new question-tools preference is included in the existing app-prefixed backup');
});

test('Settings groups Question Bank Version and question actions, while retaining iOS App updates', () => {
  assert.ok(settings.includes("makeSettingZone(order,'appearance','Appearance & study experience'"));
  assert.ok(settings.includes("makeSettingZone(order,'banks','Question banks & question voice'"));
  assert.ok(settings.includes("findSettingCard(root,'Question Bank Version')"));
  assert.ok(settings.includes("root.querySelector('#shbQuestionToolsSettings')"));
  assert.ok(settings.includes("root.querySelector('#shbAppUpdates')"));
  assert.ok(settings.includes("target('updates').appendChild(updates)"));
  assert.ok(settings.includes("target('banks').appendChild(bankVersion)"));
  assert.ok(settings.includes("target('appearance').appendChild(questionTools)"));
  assert.ok(!settings.includes('studyExperience'));
});

test('opening Settings from a Question Bank captures active source bank, system and topic', () => {
  const api = bankHelpers();
  const bank = [
    {id:'previous-cardio-topic-1', py:1, spec:'cardio', topic:101},
    {id:'aljoaki-cardio-topic-1', spec:'cardio', topic:101},
    {id:'previous-respiratory-topic-2', py:1, spec:'respiratory', topic:202},
    {id:'nelson-cardio-topic-1', nl:1, spec:'cardio', topic:101}
  ];
  const scope = api.resetScopeFromStudyContext('questions','previous','cardio',101,bank);
  assert.deepEqual(JSON.parse(JSON.stringify(scope)), {bank:'previous',system:'cardio',topic:101});
  assert.equal(api.resetScopeFromStudyContext('subjects','previous','cardio',101,bank), null);
  const fallback = api.resetScopeFromStudyContext('questions','previous','cardio',999,bank);
  assert.deepEqual(JSON.parse(JSON.stringify(fallback)), {bank:'previous',system:'cardio',topic:0});
});

test('reset scope matching never crosses bank, system or topic boundaries', () => {
  const api = bankHelpers();
  const bank = [
    {id:'p-cardio-101', py:1, spec:'cardio', topic:101},
    {id:'p-cardio-102', py:1, spec:'cardio', topic:102},
    {id:'p-respiratory-101', py:1, spec:'respiratory', topic:101},
    {id:'aj-cardio-101', spec:'cardio', topic:101},
    {id:'nelson-cardio-101', nl:1, spec:'cardio', topic:101}
  ];
  const selected = bank.filter(q => api.resetScopeMatches(q,'previous','cardio',101)).map(q => q.id);
  assert.deepEqual(selected, ['p-cardio-101']);
  const system = bank.filter(q => api.resetScopeMatches(q,'previous','cardio',0)).map(q => q.id);
  assert.deepEqual(system, ['p-cardio-101','p-cardio-102']);
  const allSources = bank.filter(q => api.resetScopeMatches(q,'all','cardio',101)).map(q => q.id);
  assert.deepEqual(allSources, ['p-cardio-101','aj-cardio-101','nelson-cardio-101']);
});

test('iOS loads shared voice and bank controls without importing Android-only scripts', () => {
  for (const path of ['js/09-app-features-v6.js','js/29-reviewed-bank-controls.js',
    'js/33-unified-voice.js','js/36-exam-planner-settings-smartreview.js']) {
    assert.ok(index.includes('data-src="' + path + '"'), 'iOS must load ' + path);
  }
  assert.ok(!/js\/(?:30-android-enhancements|31-android-v13|32-chrome-android)\.js/.test(index));
  assert.ok(index.indexOf('js/09-app-features-v6.js') < index.indexOf('js/29-reviewed-bank-controls.js'));
  assert.ok(index.indexOf('js/29-reviewed-bank-controls.js') < index.indexOf('js/33-unified-voice.js'));
  assert.ok(index.indexOf('js/33-unified-voice.js') < index.indexOf('js/36-exam-planner-settings-smartreview.js'));
});

function questionToolbarHarness() {
  const state = { toolbar: null, created: 0, removed: 0 };
  const stem = {
    insertAdjacentElement(position, element) {
      assert.equal(position, 'afterend');
      state.toolbar = element;
    }
  };
  const card = {
    querySelector(selector) {
      if (selector === '.shb-question-tools') return state.toolbar;
      if (selector === '.qstem') return stem;
      return null;
    }
  };
  const host = { querySelectorAll: () => [card] };
  const document = {
    querySelector(selector) { return selector === '#phoneContent' ? host : null; },
    createElement() {
      state.created++;
      return {
        dataset: {},
        setAttribute() {},
        remove() {
          state.removed++;
          if (state.toolbar === this) state.toolbar = null;
        }
      };
    }
  };
  const prefs = { shareQuestion: true, copyQuestion: true, readAloud: true };
  const api = vm.runInNewContext(
    extractFunction(voice, 'computerVoiceDecorateQuestions') +
      String.fromCharCode(10) + '({computerVoiceDecorateQuestions})',
    { document, computerQuestionTools: prefs }
  );
  return { state, prefs, api };
}

test('question toolbar decoration is idempotent and only rebuilds when preferences change', () => {
  const { state, prefs, api } = questionToolbarHarness();
  api.computerVoiceDecorateQuestions();
  const first = state.toolbar;
  assert.ok(first);
  assert.equal(first.dataset.sig, '1:1:1');
  api.computerVoiceDecorateQuestions();
  assert.equal(state.toolbar, first, 'unchanged toolbar must be preserved');
  assert.equal(state.created, 1, 'a second pass must not create another toolbar');
  assert.equal(state.removed, 0, 'a second pass must not remove the existing toolbar');

  prefs.readAloud = false;
  api.computerVoiceDecorateQuestions();
  assert.notEqual(state.toolbar, first, 'changed settings create a new toolbar');
  assert.equal(state.created, 2);
  assert.equal(state.removed, 1);

  prefs.shareQuestion = false;
  prefs.copyQuestion = false;
  api.computerVoiceDecorateQuestions();
  assert.equal(state.toolbar, null, 'no toolbar remains when every action is disabled');
  assert.equal(state.created, 2);
  assert.equal(state.removed, 2);
});

test('shared Study experience controls follow the To Me labels, descriptions and defaults', () => {
  const defaultsDecl = toMe.match(/var DEFAULTS = \{[\s\S]*?\n  \};/);
  assert.ok(defaultsDecl, 'To Me Study experience defaults are present');
  const toMeMarkup = vm.runInNewContext(defaultsDecl[0] + '\nvar prefs=Object.assign({},DEFAULTS);\n' +
    extractFunction(toMe, 'toggleMarkup') + '\n' +
    extractFunction(toMe, 'featureSettingsHTML') +
    '\nfeatureSettingsHTML()', {});
  const prefs = vm.runInNewContext(
    extractFunction(voice, 'computerVoiceReadQuestionTools') + '\ncomputerVoiceReadQuestionTools()',
    { localStorage: { getItem() { return null; } }, Object, JSON }
  );
  const iosExperience = vm.runInNewContext(
    "var IOS_EXPERIENCE_KEY='shbace_ios_study_experience_v1';" +
    voice.slice(voice.indexOf('var iosStudyPrefs='), voice.indexOf('var iosStudyMedia=')) +
    '\n({keepScreenAwake:iosStudyPrefs.keepScreenAwake,followSystemTheme:iosStudyPrefs.followSystemTheme})',
    { localStorage: { getItem() { return null; } }, Object, JSON }
  );
  assert.equal(prefs.shareQuestion, true);
  assert.equal(prefs.copyQuestion, true);
  assert.equal(prefs.readAloud, true);
  assert.equal(prefs.readingSpeed, 'normal');
  assert.equal(iosExperience.keepScreenAwake, true);
  assert.equal(iosExperience.followSystemTheme, true);
  assert.equal(/haptics: true/.test(defaultsDecl[0]), true, 'To Me keeps haptics ON; the native-only control is intentionally absent on iOS');
  for (const [label, description] of [
    ['Share a question', 'Show the question-sharing action.'],
    ['Copy question text', 'Show the copy action for notes or AI tools.'],
    ['Read questions aloud', 'Show voice playback controls on questions.'],
    ['Keep screen awake', 'Prevent the display from sleeping while the Question Bank is open.'],
    ['Follow device theme', 'Automatically match the device light or dark appearance.'],
    ['Reading speed', 'Applies to spoken question text.']
  ]) {
    assert.ok(toMeMarkup.includes(label), 'To Me source contains ' + label);
    assert.ok(voice.includes(label), 'iOS source contains ' + label);
    assert.ok(toMeMarkup.includes(description), 'To Me helper text matches for ' + label);
    assert.ok(voice.includes(description), 'iOS helper text matches for ' + label);
  }
  assert.ok(voice.includes('Copy app information'));
  assert.ok(voice.includes('Send the copied details when reporting an app issue. No account or personal data is included.'));
  assert.ok(voice.includes('shbace_question_tools_v1'));
  assert.ok(voice.includes('shbace_ios_study_experience_v1'));
});

test('question-screen observer is scoped to the viewport and repeated notifications coalesce', () => {
  const frames = [], observed = { target: null, options: null, callback: null };
  const host = {};
  class FakeMutationObserver {
    constructor(callback) { observed.callback = callback; }
    observe(target, options) { observed.target = target; observed.options = options; }
  }
  const mountCalls = [];
  const sandbox = {
    document: { getElementById(id) { return id === 'phoneContent' ? host : null; }, readyState: 'complete' },
    window: { MutationObserver: FakeMutationObserver, requestAnimationFrame(callback) { frames.push(callback); } },
    MutationObserver: FakeMutationObserver,
    mountVoiceSettings() { mountCalls.push('mount'); },
    computerVoiceDecorateQuestions() { mountCalls.push('decorate'); },
    setTimeout
  };
  const start = voice.indexOf('/* Observe only screen replacement at the app viewport.');
  const end = voice.indexOf("if(document.readyState==='loading')", start);
  assert.ok(start >= 0 && end > start);
  vm.runInNewContext('var questionDecorationScheduled=false;' +
    extractFunction(voice, 'scheduleQuestionDecoration') + '\n' +
    voice.slice(start, end), sandbox);
  assert.equal(observed.target, host);
  assert.deepEqual(Object.keys(observed.options).sort(), ['childList']);
  observed.callback([{ target: host }, { target: host }, { target: host }]);
  assert.equal(frames.length, 1, 'a burst of render mutations schedules one decoration frame');
  assert.equal(mountCalls.length, 3, 'the settings mount is cheap and runs only at screen replacement');
  frames[0]();
  assert.equal(mountCalls.filter(x => x === 'decorate').length, 1);
  assert.equal(mountCalls.filter(x => x === 'mount').length, 3);
  /* A toolbar insertion is nested below the host and cannot be observed by this direct-child observer. */
  assert.equal(observed.options.subtree, undefined);
});

function settingsOrganizerHarness() {
  let writes = 0;
  const zones = Object.create(null);
  function container(kind) {
    const node = {
      kind, children: [], parentElement: null, attrs: {}, zoneId: '',
      setAttribute(key, value) { this.attrs[key] = value; if (key === 'data-shb-settings-zone') this.zoneId = value; },
      appendChild(child) {
        if (child.parentElement === this) return child;
        if (child.parentElement) {
          const index = child.parentElement.children.indexOf(child);
          if (index >= 0) child.parentElement.children.splice(index, 1);
        }
        child.parentElement = this;
        this.children.push(child);
        writes++;
        return child;
      },
      querySelector(selector) {
        const match = selector.match(/data-shb-settings-items=["']([^"']+)/);
        return match ? zones[match[1]] || null : null;
      }
    };
    Object.defineProperty(node, 'innerHTML', {
      set(value) {
        const match = String(value).match(/data-shb-settings-items="([^"]+)"/);
        if (match) {
          const item = container('items');
          item.zoneId = match[1];
          zones[match[1]] = item;
        }
      }
    });
    return node;
  }
  function card(title, id, className) {
    const node = container('card');
    node.id = id || '';
    node.className = className || 'card setcard';
    node.querySelector = selector => selector === 'h3' ? { textContent: title } : null;
    return node;
  }
  const root = container('root');
  const h1 = { textContent: 'Settings' };
  const cards = [
    card('Appearance'), card('Onboarding'), card('Study progress'),
    card('Student data backup'), card('Question Bank Version'),
    card('Study experience', 'shbQuestionToolsSettings'),
    card('Study reminders', 'shbStudyRemindersSettings'),
    card('Question voice', 'shbUnifiedVoiceSettings'),
    card('Study notifications', '', 'u10-settings-card'),
    card('App updates', 'shbAppUpdates')
  ];
  const file = container('file');
  cards.forEach(node => { node.parentElement = root; root.children.push(node); });
  file.parentElement = root; root.children.push(file);
  root.querySelector = selector => {
    if (selector === 'h1') return h1;
    if (selector === '.shb-settings-order') return root.children.find(node => node.className === 'shb-settings-order') || null;
    if (selector === '#shbQuestionToolsSettings') return cards.find(node => node.id === 'shbQuestionToolsSettings');
    if (selector === '#shbStudyRemindersSettings') return cards.find(node => node.id === 'shbStudyRemindersSettings');
    if (selector === '#shbUnifiedVoiceSettings') return cards.find(node => node.id === 'shbUnifiedVoiceSettings');
    if (selector === '.u10-settings-card') return cards.find(node => node.className === 'u10-settings-card');
    if (selector === '#shbAppUpdates') return cards.find(node => node.id === 'shbAppUpdates');
    if (selector === '#bkFile') return file;
    return null;
  };
  root.querySelectorAll = selector => selector === '.card.setcard' ? cards : [];
  const host = {};
  const observed = { callback: null, target: null, options: null };
  class FakeMutationObserver {
    constructor(callback) { observed.callback = callback; }
    observe(target, options) { observed.target = target; observed.options = options; }
    takeRecords() { return []; }
  }
  const frames = [];
  const sandbox = {
    document: { querySelector(selector) { return selector === '#phoneContent .rs' ? root : null; },
      getElementById(id) { return id === 'phoneContent' ? host : null; }, readyState: 'complete',
      createElement() { return container('section'); } },
    window: { MutationObserver: FakeMutationObserver },
    MutationObserver: FakeMutationObserver,
    requestAnimationFrame(callback) { frames.push(callback); },
    setTimeout(callback) { frames.push(callback); },
    console
  };
  const begin = settings.indexOf('var settingsBusy=false');
  const finish = settings.indexOf('/* Smart Review:', begin);
  const observerStart = settings.indexOf('/* The app replaces this viewport', finish > begin ? finish : begin);
  const observerEnd = settings.lastIndexOf('queueSettingsOrganization();') + 'queueSettingsOrganization();'.length;
  assert.ok(begin >= 0 && observerStart > begin && observerEnd > observerStart);
  const code = settings.slice(begin, finish) + settings.slice(observerStart, observerEnd);
  vm.runInNewContext(code, sandbox);
  return { observed, frames, get writes() { return writes; }, cards, root, host };
}

test('Settings organizer and its observer stay idempotent under repeated callbacks', () => {
  const h = settingsOrganizerHarness();
  assert.equal(h.observed.target, h.host);
  assert.deepEqual(Object.keys(h.observed.options).sort(), ['childList']);
  h.observed.callback([{ target: h.observed.target }, { target: h.observed.target }, { target: h.observed.target }]);
  assert.equal(h.frames.length, 1, 'repeated observer records are coalesced into one frame');
  h.frames.shift()();
  const firstWrites = h.writes;
  for (let i = 0; i < 20; i++) h.observed.callback([{ target: h.observed.target }]);
  assert.equal(h.frames.length, 1);
  h.frames.shift()();
  assert.equal(h.writes, firstWrites, 'a stable Settings tree is left untouched');
  assert.equal(h.root.children.filter(node => node.kind === 'order').length, 1);
  assert.equal(h.cards.filter(node => node.id === 'shbQuestionToolsSettings').length, 1);
});

test('question decoration requests are coalesced into one animation frame', () => {
  const frames = [];
  const calls = [];
  const sandbox = {
    window: { requestAnimationFrame(callback) { frames.push(callback); return frames.length; } },
    computerVoiceDecorateQuestions() { calls.push('decorate'); },
    setTimeout
  };
  const api = vm.runInNewContext(
    'var questionDecorationScheduled=false;' + String.fromCharCode(10) +
      extractFunction(voice, 'scheduleQuestionDecoration') + String.fromCharCode(10) +
      '({scheduleQuestionDecoration})',
    sandbox
  );
  api.scheduleQuestionDecoration();
  api.scheduleQuestionDecoration();
  api.scheduleQuestionDecoration();
  assert.equal(frames.length, 1, 'many observer callbacks in one frame schedule one decoration pass');
  frames[0]();
  assert.deepEqual(calls, ['decorate']);
  assert.ok(voice.includes("observe(questionHost,{childList:true})"));
});
