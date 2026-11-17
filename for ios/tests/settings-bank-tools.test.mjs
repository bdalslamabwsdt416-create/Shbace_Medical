import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const read = (relative) => fs.readFileSync(fileURLToPath(new URL(relative, import.meta.url)), 'utf8');
const features = read('../js/09-app-features-v6.js');
const voice = read('../js/33-unified-voice.js');
const settings = read('../js/36-exam-planner-settings-smartreview.js');
const restoreBuild = read('../scripts/restore-ios-packed.js');
const androidEnhancements = read('./fixtures/to-me/30-android-enhancements.js');
const toMeSettings = read('./fixtures/to-me/36-exam-planner-settings-smartreview.js');
const toMeVoice = read('./fixtures/to-me/33-unified-voice.js');
const index = read('../index.html');
const drawer = read('../js/06-drawer-menu.js');
const returning = read('../js/07-returning-student-migration.js');

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
  assert.ok(voice.includes('queueVoiceSettingsMountFromMutations') && voice.includes('queueQuestionDecorationFromMutations'));
  assert.ok(voice.includes("observe(voiceHost,{childList:true,subtree:true})"));
  assert.ok(!voice.includes('observe(document.body'));
  assert.ok(features.includes('function u11DataKeys()') && features.includes("k.startsWith('shbace_')"),
    'the new question-tools preference is included in the existing app-prefixed backup');
});

test('Settings places Question voice with Appearance and keeps the single Study experience card after the zones', () => {
  assert.ok(settings.includes("makeSettingZone(order,'appearance','Appearance & reading','Theme, text size, doctor character and question-reading voice.')"));
  assert.ok(settings.includes("makeSettingZone(order,'banks','Question bank settings','Choose the question-bank version used for study.')"));
  assert.ok(settings.includes("findSettingCard(root,'Question Bank Version')"));
  assert.ok(settings.includes("root.querySelector('#shbQuestionToolsSettings')"));
  assert.ok(settings.includes("root.querySelector('#shbAppUpdates')"));
  assert.ok(settings.includes("target('updates').appendChild(updates)"));
  assert.ok(settings.includes("target('banks').appendChild(bankVersion)"));
  assert.ok(settings.includes("target('appearance').appendChild(voice)"));
  assert.ok(settings.includes("root.lastElementChild!==questionTools"));
  assert.ok(!settings.includes("target('appearance').appendChild(questionTools)"));
  assert.ok(!settings.includes('studyExperience'));
});

test('PWA build invariants match the single root-level Study experience card and dynamic manifest inventory', () => {
  assert.ok(restoreBuild.includes("root.appendChild(questionTools)"));
  assert.ok(restoreBuild.includes("root.lastElementChild!==questionTools"));
  assert.ok(restoreBuild.includes("target('appearance').appendChild(questionTools)") === false);
  assert.ok(restoreBuild.includes('manifest.fileCount = manifest.files.length'));
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
  const state = { toolbar: null, created: 0, removed: 0, writes: 0 };
  let card;
  const stem = {
    closest(selector) { return selector === '.qcard' ? card : null; },
    insertAdjacentElement(position, element) {
      assert.equal(position, 'afterend');
      state.writes++;
      state.toolbar = element;
    }
  };
  card = {
    closest(selector) { return selector === '.qcard' ? card : null; },
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
      state.writes++;
      return {
        nodeType: 1,
        dataset: {},
        matches(selector) { return selector === '.shb-question-tools'; },
        setAttribute() {},
        remove() {
          state.removed++;
          state.writes++;
          if (state.toolbar === this) state.toolbar = null;
        }
      };
    }
  };
  const frames = [];
  const prefs = { shareQuestion: true, copyQuestion: true, readAloud: true };
  const api = vm.runInNewContext(
    'var questionDecorationScheduled=false,questionDecorationRunning=false;' + String.fromCharCode(10) +
      extractFunction(voice, 'scheduleQuestionDecoration') + String.fromCharCode(10) +
      extractFunction(voice, 'computerVoiceQuestionMutationRelevant') + String.fromCharCode(10) +
      extractFunction(voice, 'queueQuestionDecorationFromMutations') + String.fromCharCode(10) +
      extractFunction(voice, 'computerVoiceDecorateQuestions') + String.fromCharCode(10) +
      '({scheduleQuestionDecoration,computerVoiceQuestionMutationRelevant,queueQuestionDecorationFromMutations,computerVoiceDecorateQuestions})',
    {
      document, computerQuestionTools: prefs,
      window: { requestAnimationFrame(callback) { frames.push(callback); return frames.length; } },
      setTimeout
    }
  );
  return { state, prefs, api, frames, stem, card };
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
  const unchangedWrites = state.writes;
  api.computerVoiceDecorateQuestions();
  assert.equal(state.writes, unchangedWrites, 'unchanged DOM is not written a second time');

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
  assert.ok(voice.includes("observe(voiceHost,{childList:true,subtree:true})"));
  assert.ok(!voice.includes("observe(document.body"));
});

test('behavior: repeated question observer callbacks cannot recreate their own toolbar', () => {
  const { state, api, frames, stem } = questionToolbarHarness();
  const actualQuestionChange = { target: stem, addedNodes: [{ nodeType: 3 }], removedNodes: [] };
  for (let i = 0; i < 20; i++) api.queueQuestionDecorationFromMutations([actualQuestionChange]);
  assert.equal(frames.length, 1, 'repeated records coalesce to one rAF');
  frames.shift()();
  assert.equal(state.created, 1);
  assert.equal(state.removed, 0);
  const writesAfterCreate = state.writes;
  const selfMutation = { target: stem, addedNodes: [state.toolbar], removedNodes: [] };
  for (let i = 0; i < 50; i++) api.queueQuestionDecorationFromMutations([selfMutation]);
  assert.equal(frames.length, 0, 'observer ignores its own toolbar insertion records');
  assert.equal(state.created, 1, 'no endless create cycle');
  assert.equal(state.removed, 0, 'no endless remove cycle');
  assert.equal(state.writes, writesAfterCreate, 'bounded writes; unchanged toolbar stays untouched');
});


test('shared Study experience controls, labels, order, defaults and legacy preference keys match To Me', () => {
  const defaultsMatch = androidEnhancements.match(/var DEFAULTS = \{([\s\S]*?)\n  \};/);
  assert.ok(defaultsMatch, 'To Me DEFAULTS object is the reference source');
  const toMeDefaults = vm.runInNewContext('({' + defaultsMatch[1] + '})');
  const featureBlock = androidEnhancements.slice(
    androidEnhancements.indexOf('function featureSettingsHTML()'),
    androidEnhancements.indexOf('function mountSettings()', androidEnhancements.indexOf('function featureSettingsHTML()'))
  );
  const toMeRows = [...featureBlock.matchAll(/toggleMarkup\('([^']+)', '([^']+)', '([^']+)'\)/g)]
    .map(match => ({key:match[1], title:match[2], description:match[3]}));
  const sharedRows = toMeRows.filter(row => ['shareQuestion','copyQuestion','readAloud','keepScreenOn','autoTheme'].includes(row.key));
  assert.deepEqual(sharedRows.map(row => row.key), ['shareQuestion','copyQuestion','readAloud','keepScreenOn','autoTheme']);

  const iosQuestionRows = [...voice.matchAll(/computerVoiceQuestionToolSetting\('([^']+)','([^']+)','([^']+)'\)/g)]
    .map(match => ({key:match[1], title:match[2], description:match[3]}));
  const iosStudyMap = {keepScreenOn:'keepScreenAwake', autoTheme:'followSystemTheme'};
  const iosRows = sharedRows.map(row => {
    const mapped = iosStudyMap[row.key] || row.key;
    const found = iosQuestionRows.find(item => item.key === mapped) || (() => {
      const re = new RegExp("iosStudyToggleMarkup\\('" + mapped + "','([^']+)','([^']+)'");
      const match = voice.match(re);
      return match ? {key:mapped,title:match[1],description:match[2]} : null;
    })();
    assert.ok(found, 'iOS shared setting exists: ' + row.key);
    return {key:row.key,title:found.title,description:found.description};
  });
  assert.deepEqual(iosRows, sharedRows, 'shared labels and helper text must match the To Me source');

  const toMeOrder = [...featureBlock.matchAll(/toggleMarkup\('([^']+)'/g)].map(match=>match[1]);
  assert.deepEqual(toMeOrder.filter(key=>['shareQuestion','copyQuestion','readAloud','keepScreenOn','autoTheme'].includes(key)),
    ['shareQuestion','copyQuestion','readAloud','keepScreenOn','autoTheme']);
  const toolsStart=voice.indexOf('function computerVoiceMountSettings()');
  const toolsEnd=voice.indexOf('function computerVoiceQuestionText',toolsStart);
  const iosStudyStart=voice.indexOf('function iosStudyMountSettings()');
  const iosStudyEnd=voice.indexOf('function iosStudyUpdateUI',iosStudyStart);
  const studyMarkup=voice.slice(toolsStart,toolsEnd)+voice.slice(iosStudyStart,iosStudyEnd);
  const iosPositions = ['shareQuestion','copyQuestion','readAloud','Reading speed','keepScreenAwake','followSystemTheme','Copy app information']
    .map(term=>studyMarkup.indexOf(term));
  assert.ok(iosPositions.every(position=>position>=0),'all To Me card controls are present on iOS');
  assert.ok(iosPositions.every((position,index)=>index===0||position>iosPositions[index-1]),
    'Study experience controls retain the To Me order');

  const questionDefaultsMatch = voice.match(/var defaults=\{shareQuestion:true,copyQuestion:true,readAloud:true,readingSpeed:'normal'\}/);
  assert.ok(questionDefaultsMatch,'iOS question tool defaults are declared');
  const questionDefaults = vm.runInNewContext('({' + questionDefaultsMatch[0].replace(/^var defaults=/,'') + '})');
  assert.equal(questionDefaults.shareQuestion, toMeDefaults.shareQuestion);
  assert.equal(questionDefaults.copyQuestion, toMeDefaults.copyQuestion);
  assert.equal(questionDefaults.readAloud, toMeDefaults.readAloud);
  assert.equal(questionDefaults.readingSpeed, toMeDefaults.readingSpeed);
  assert.ok(voice.includes('followSystemTheme:shared&&typeof shared.autoTheme===\'boolean\'?shared.autoTheme:true'));
  assert.ok(voice.includes('keepScreenAwake:shared&&typeof shared.keepScreenOn===\'boolean\'?shared.keepScreenOn:true'));
  function questionVoiceDescription(source) {
    const cardStart=source.indexOf("card.innerHTML='<h3>Question voice</h3>'");
    assert.notEqual(cardStart,-1,'Question voice card exists in source');
    const paragraphStart=source.indexOf('<p class="meta">',cardStart);
    assert.notEqual(paragraphStart,-1,'Question voice helper paragraph exists');
    const textStart=paragraphStart+'<p class="meta">'.length;
    const textEnd=source.indexOf('</p>',textStart);
    assert.ok(textEnd>textStart,'Question voice helper paragraph closes');
    return source.slice(textStart,textEnd);
  }
  assert.equal(questionVoiceDescription(voice),questionVoiceDescription(toMeVoice));
  assert.ok(voice.includes('saved&&typeof saved===\'object\'&&!Array.isArray(saved)?saved:{}'),
    'existing iOS preference backups override new-install defaults');

  assert.ok(androidEnhancements.includes("var PREF_KEY = 'shbace_android_features_v1'"));
  assert.ok(voice.includes("var ANDROID_SHARED_PREF_KEY='shbace_android_features_v1'"));
  assert.ok(voice.includes("var QUESTION_TOOLS_KEY='shbace_question_tools_v1'"));
  assert.ok(voice.includes("var IOS_EXPERIENCE_KEY='shbace_ios_study_experience_v1'"));
  assert.ok(voice.includes("localStorage.setItem(ANDROID_SHARED_PREF_KEY,JSON.stringify(shared))"));
  assert.ok(voice.includes("['shareQuestion','copyQuestion','readAloud','readingSpeed'].forEach(function(key){shared[key]=computerQuestionTools[key]})"));
  assert.ok(voice.includes('shared.autoTheme=!!iosStudyPrefs.followSystemTheme'));
  assert.ok(voice.includes('shared.keepScreenOn=!!iosStudyPrefs.keepScreenAwake'));
});

test('iOS retains only the non-native shared controls and marks Android-native controls as platform-only', () => {
  const featureBlock = androidEnhancements.slice(
    androidEnhancements.indexOf('function featureSettingsHTML()'),
    androidEnhancements.indexOf('function mountSettings()', androidEnhancements.indexOf('function featureSettingsHTML()'))
  );
  assert.ok(featureBlock.includes("toggleMarkup('haptics', 'Haptic feedback'"));
  assert.ok(featureBlock.includes("toggleMarkup('examCountdown', 'Exam countdown reminders'"));
  assert.ok(voice.includes('Android-only haptics and scheduled native reminders are intentionally not exposed here.'));
  assert.ok(!voice.includes('data-shb-ios-experience="haptics"'));
  assert.ok(!voice.includes('data-shb-ios-experience="examCountdown"'));
  for (const marker of ['App updates','Notification preferences','Student data backup','Onboarding']) {
    assert.ok(features.includes(marker), 'iOS-only Settings item remains: ' + marker);
  }
});

function studyExperienceMountHarness() {
  const roots=[];
  let activeRoot=null;
  function makeRoot() {
    const root={
      children:[],
      querySelector(selector) {
        if(selector==='h1')return {textContent:'Settings'};
        if(selector==='#shbUnifiedVoiceSettings')return this.children.find(node=>node.id==='shbUnifiedVoiceSettings')||null;
        if(selector==='#shbQuestionToolsSettings')return this.children.find(node=>node.id==='shbQuestionToolsSettings')||null;
        return null;
      },
      appendChild(child) {
        if(child.parentElement){const old=child.parentElement.children.indexOf(child);if(old>=0)child.parentElement.children.splice(old,1)}
        child.parentElement=this;this.children.push(child);return child;
      }
    };
    roots.push(root);activeRoot=root;return root;
  }
  const document={createElement(){return {id:'',className:'',innerHTML:'',parentElement:null}}};
  const api=vm.runInNewContext(
    extractFunction(voice,'computerVoiceMountSettings')+String.fromCharCode(10)+'({computerVoiceMountSettings})',
    {
      settingsRoot(){return activeRoot},
      document,
      computerVoiceUpdateUi(){},
      computerVoiceUpdateQuestionToolsUI(){}
    }
  );
  return {roots,makeRoot,api};
}

test('behavior: one Study experience card is mounted after repeated Settings opens and re-mounts', () => {
  const {roots,makeRoot,api}=studyExperienceMountHarness();
  for(let open=0;open<12;open++){
    const root=makeRoot();
    for(let render=0;render<5;render++)api.computerVoiceMountSettings();
    assert.equal(root.children.filter(node=>node.id==='shbQuestionToolsSettings').length,1,
      'each Settings render has exactly one Study experience card');
    assert.equal(root.children.filter(node=>node.id==='shbUnifiedVoiceSettings').length,1,
      'each Settings render has exactly one Question voice card');
  }
  assert.equal(roots.length,12);
});

function settingsOrganizerHarness() {
  const state = { writes: 0, zones: [], cards: [], order: null };
  const node = name => ({
    name, parentElement: null, children: [],
    get lastElementChild(){return this.children[this.children.length-1]||null},
    appendChild(child) {
      const oldParent=child.parentElement;
      if(oldParent){const at=oldParent.children.indexOf(child);if(at>=0)oldParent.children.splice(at,1)}
      if(oldParent!==this || !this.children.includes(child))state.writes++;
      child.parentElement=this;
      if(!this.children.includes(child))this.children.push(child);
      return child;
    },
    querySelector(){return null}
  });
  ['Appearance','Onboarding','Study progress','Student data backup','Question Bank Version','Study experience','Question voice'].forEach(title=>{
    const c=node(title);c.className='card setcard';
    if(title==='Study experience')c.id='shbQuestionToolsSettings';
    if(title==='Question voice')c.id='shbUnifiedVoiceSettings';
    c.querySelector=selector=>selector==='h3'?{textContent:title}:null;
    state.cards.push(c);
  });
  const notification=node('notifications'),updates=node('updates'),file=node('bkFile');
  notification.className='u10-settings-card';
  const root=node('settingsRoot');
  state.root=root;
  const appendRoot=root.appendChild.bind(root);
  root.appendChild=child=>{const result=appendRoot(child);if(child.className==='shb-settings-order')state.order=child;return result};
  root.querySelector=selector=>{
    if(selector==='h1')return {textContent:'Settings'};
    if(selector==='.shb-settings-order')return state.order;
    if(selector==='#shbQuestionToolsSettings')return state.cards[5];
    if(selector==='#shbUnifiedVoiceSettings')return state.cards[6];
    if(selector==='.u10-settings-card')return notification;
    if(selector==='#shbAppUpdates')return updates;
    if(selector==='#bkFile')return file;
    return null;
  };
  root.querySelectorAll=selector=>selector==='.card.setcard'?state.cards:[];
  const document={
    querySelector(selector){return selector==='#phoneContent .rs'?root:null},
    createElement(tag){
      const el=node(tag);
      el.setAttribute=()=>{};
      el.querySelector=selector=>{
        if(selector==='.shb-settings-items')return el.items||null;
        const match=selector.match(/data-shb-settings-items="([^"]+)"/);
        if(match){const zone=el.children.find(child=>child.items&&child.items.name==='items:'+match[1]);return zone?zone.items:null}
        return null;
      };
      Object.defineProperty(el,'innerHTML',{set(html){
        const match=html.match(/data-shb-settings-items="([^"]+)"/);
        if(match){el.items=node('items:'+match[1]);state.zones.push(match[1])}
      }});
      return el;
    }
  };
  const frames=[];
  const api=vm.runInNewContext(
    'var settingsBusy=false,settingsQueued=false;' + String.fromCharCode(10) +
      extractFunction(settings,'getSettingsRoot') + String.fromCharCode(10) +
      extractFunction(settings,'makeSettingZone') + String.fromCharCode(10) +
      extractFunction(settings,'findSettingCard') + String.fromCharCode(10) +
      extractFunction(settings,'organizeSettings') + String.fromCharCode(10) +
      extractFunction(settings,'queueSettingsOrganization') + String.fromCharCode(10) +
      '({organizeSettings,queueSettingsOrganization})',
    {document,requestAnimationFrame(fn){frames.push(fn)},setTimeout}
  );
  return {state,api,frames};
}

test('behavior: Settings organizer is idempotent and never re-appends unchanged cards',()=>{
  const {state,api}=settingsOrganizerHarness();
  api.organizeSettings();
  const firstWrites=state.writes;
  assert.ok(firstWrites>0,'first organization creates zones and positions cards');
  assert.deepEqual(state.zones,['appearance','banks','notifications','updates','experience','data','progress']);
  const toMeZones=[...toMeSettings.matchAll(/makeSettingZone\(order,'([^']+)'/g)].map(match=>match[1]);
  const iosCoreZones=state.zones.filter(zone=>toMeZones.includes(zone));
  assert.deepEqual(iosCoreZones,toMeZones,'the shared Settings zones preserve To Me order');
  assert.equal(state.cards[6].parentElement.name,'items:appearance','Question voice is grouped with Appearance');
  assert.equal(state.cards[5].parentElement,state.root,'Study experience remains a sibling after the Settings zones');
  assert.equal(state.root.lastElementChild,state.cards[5],'Study experience is mounted once after the zones');
  assert.ok(state.cards.filter(card=>card!==state.cards[5]).every(card=>card.parentElement&&card.parentElement.name.startsWith('items:')));
  api.organizeSettings();api.organizeSettings();api.organizeSettings();
  assert.equal(state.writes,firstWrites,'repeated passes make zero DOM writes');
  assert.equal(state.root.children.filter(card=>card===state.cards[5]).length,1,'Study experience is never duplicated');
});

test('behavior: repeated Settings host observer callbacks are coalesced and stable',()=>{
  const {state,api,frames}=settingsOrganizerHarness();
  const host={};
  const relevant=[{target:host}],irrelevant=[{target:{}}];
  const handler=vm.runInNewContext(
    extractFunction(settings,'settingsHostMutationRelevant')+String.fromCharCode(10)+
      extractFunction(settings,'handleSettingsHostMutations')+String.fromCharCode(10)+
      '({settingsHostMutationRelevant,handleSettingsHostMutations})',
    {queueSettingsOrganization:api.queueSettingsOrganization}
  );
  for(let i=0;i<20;i++)handler.handleSettingsHostMutations(relevant,host);
  handler.handleSettingsHostMutations(irrelevant,host);
  assert.equal(frames.length,1,'repeated route mutations schedule one rAF');
  frames.shift()();
  const writes=state.writes;
  for(let i=0;i<20;i++)handler.handleSettingsHostMutations(relevant,host);
  assert.equal(frames.length,1);
  frames.shift()();
  assert.equal(state.writes,writes,'unchanged Settings DOM is untouched');
});
