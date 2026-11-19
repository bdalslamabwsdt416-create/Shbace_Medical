/* SHBACE Medical · Navigation Contract v1
 * Android-only adapter around the existing appPage/renderAppDemo navigation model.
 * Observes current navigation and exposes a safe route catalogue; it does not replace
 * legacy renderers, local state, history, or remote page registration.
 */
(function () {
  'use strict';
  function isNativeAndroid() {
    try {
      var c = window.Capacitor;
      return !!(c && typeof c.getPlatform === 'function' && c.getPlatform() === 'android' &&
        typeof c.isNativePlatform === 'function' && c.isNativePlatform());
    } catch (e) { return false; }
  }
  if (!isNativeAndroid() || window.SHBACENavigation) return;
  var core = window.SHBACECore;
  if (!core || !core.events || !core.services) return;

  var DATA = {"schemaVersion":1,"title":"SHBACE Medical Android navigation route inventory","target":"android-apk","frozenAndroidRelease":{"applicationId":"com.shbace.medical","versionName":"1.3.9","versionCode":18},"sourceFiles":["to me/js/04-app-main.js","to me/js/09-app-features-v6.js","to me/js/36-exam-planner-settings-smartreview.js","to me/js/45-android-remote-content.js","to me/js/46-android-remote-ui.js","to me/js/47-android-remote-control.js","to me/js/10-history-sync.js"],"renderModel":{"currentRouteVariable":"appPage","renderFunction":"renderAppDemo","historyStateFields":["m","s","p","c"],"historyNote":"js/10-history-sync.js mirrors appPage in local browser history; this is not cross-device account synchronization.","defaultRender":"menuView"},"remoteAllowLists":{"androidRemoteUiV1":["subjects","specialties","topics","questions","quiz","quizrun","quizresult","quizhistory","review","stats","search","settings","about","changelog","feedback","rate","pinned","saved","wrong","reported","notifs","timer"],"androidRemoteControlV3":["subjects","grade","specialties","topics","questions","quiz","quizrun","quizresult","quizhistory","review","stats","search","settings","about","dedication","changelog","feedback","rate","pinned","saved","wrong","reported","notifs","timer","weak","menu"],"notes":"The V3 allow-list is broader than V2. A route can exist in the app without being an allowed target in both remote-navigation engines."},"dynamicRemotePage":{"routePrefix":"shbRemotePage_","registration":"window.__shbRegisterPage","rendererSource":"to me/js/46-android-remote-ui.js","allowRemoteMarkup":false,"note":"Each page id is generated from validated declarative JSON blocks; page code is not downloaded or evaluated."},"registeredLocalPages":[{"id":"examplanner","registrationFile":"to me/js/36-exam-planner-settings-smartreview.js","registerMethod":"__shbRegisterPage","backTarget":"subjects"},{"id":"shbRemoteFlashcards","registrationFile":"to me/js/45-android-remote-content.js","registerMethod":"__shbRegisterPage","backTarget":"subjects"}],"backResolution":{"staticMapSource":"const BACKP in to me/js/09-app-features-v6.js","wildcardRoute":"questions","wildcardRule":"__shbGetBackTarget resolves to topics when the question bank is specialty-scoped, otherwise subjects.","quizResultRule":"quizresult may return to quizhistory when opened from history; otherwise it returns to quiz.","noGlobalBackMeaning":"null means the current BACKP map does not define the shared injected Back button for that route; it does not imply that the page has no internal navigation."},"routes":[{"id":"subjects","title":"Home","group":"home","renderer":"core-switch","backTarget":null,"addressable":true,"remoteV2":true,"remoteV3":true,"stateStores":["shbace_qb_v6","shbace_studytime_v1","shbace_study_activity_days_v1"],"note":"Landing screen and home study overview."},{"id":"grade","title":"Grade","group":"home","renderer":"page-registry","backTarget":null,"addressable":true,"remoteV2":false,"remoteV3":true,"stateStores":["shbace_onboarding_v3_grade","shbace_qb_v6"],"note":"Registered in PAGES; remote V3 target only, not a V2 remote-UI target."},{"id":"specialties","title":"Specialties","group":"learning","renderer":"core-switch","backTarget":"subjects","addressable":true,"remoteV2":true,"remoteV3":true,"stateStores":["shbace_qb_v6","shbace_pins_v1","shbace_recent_v1"],"note":"Specialty selection within the question-bank hierarchy."},{"id":"topics","title":"Topics","group":"learning","renderer":"core-switch","backTarget":"specialties","addressable":true,"remoteV2":true,"remoteV3":true,"stateStores":["shbace_qb_v6","shbace_pins_v1","shbace_recent_v1"],"note":"Topic list; parent specialty is kept in the question-bank UI state."},{"id":"questions","title":"Question Bank","group":"learning","renderer":"core-switch","backTarget":"*","addressable":true,"remoteV2":true,"remoteV3":true,"stateStores":["shbace_qb_v6","shbace_pins_v1","shbace_recent_v1","shbace_note_meta_v2"],"note":"Wildcard back is resolved by __shbGetBackTarget: Topics for a scoped specialty, otherwise Home."},{"id":"quiz","title":"Quiz Mode","group":"quiz","renderer":"core-switch","backTarget":null,"addressable":true,"remoteV2":true,"remoteV3":true,"stateStores":["shbace_quiz_v1","shbace_quizcfg_v1","shbace_qb_v6"],"note":"Quiz setup; the page owns its internal transitions."},{"id":"quizrun","title":"Quiz Session","group":"quiz","renderer":"core-switch","backTarget":null,"addressable":true,"remoteV2":true,"remoteV3":true,"stateStores":["shbace_quiz_v1","shbace_quizcfg_v1","shbace_qb_v6"],"note":"Active session; Pause & Exit is managed inside the Quiz screen."},{"id":"quizresult","title":"Quiz Result","group":"quiz","renderer":"core-switch","backTarget":"quiz","addressable":true,"remoteV2":true,"remoteV3":true,"stateStores":["shbace_quiz_v1","shbace_quizcfg_v1","shbace_qb_v6"],"note":"Back target may resolve to Quiz History when the result was opened from history."},{"id":"quizhistory","title":"Quiz History","group":"quiz","renderer":"page-registry","backTarget":"quiz","addressable":true,"remoteV2":true,"remoteV3":true,"stateStores":["shbace_quiz_v1"],"note":"Page registry renderer."},{"id":"review","title":"Smart Review","group":"review","renderer":"core-switch","backTarget":null,"addressable":true,"remoteV2":true,"remoteV3":true,"stateStores":["shbace_sr3_v1","shbace_qb_v6"],"note":"Smart Review owns its tabs and session flow."},{"id":"weak","title":"Weak Areas","group":"review","renderer":"page-registry","backTarget":"stats","addressable":true,"remoteV2":false,"remoteV3":true,"stateStores":["shbace_qb_v6"],"note":"Derived from question-bank answers; registered in PAGES."},{"id":"stats","title":"Statistics","group":"analytics","renderer":"core-switch","backTarget":"subjects","addressable":true,"remoteV2":true,"remoteV3":true,"stateStores":["shbace_qb_v6","shbace_quiz_v1","shbace_sr3_v1","shbace_studytime_v1","shbace_study_activity_days_v1"],"note":"Aggregates local study and assessment data."},{"id":"search","title":"Search","group":"learning","renderer":"core-switch","backTarget":null,"addressable":true,"remoteV2":true,"remoteV3":true,"stateStores":[],"note":"Core render switch route; not listed in the current global BACKP map."},{"id":"settings","title":"Settings","group":"settings","renderer":"page-registry","backTarget":"subjects","addressable":true,"remoteV2":true,"remoteV3":true,"stateStores":["shbace_settings_v1","shbace_theme","shbace_notif_v1"],"note":"Settings renderer is provided by the feature layer; current settings cards retain their own stores."},{"id":"notifs","title":"Notifications","group":"settings","renderer":"page-registry","backTarget":"subjects","addressable":true,"remoteV2":true,"remoteV3":true,"stateStores":["shbace_notif_v1"],"note":"Notification centre; opens routes through PAGES2 validation."},{"id":"saved","title":"Saved Questions","group":"collections","renderer":"page-registry","backTarget":"subjects","addressable":true,"remoteV2":true,"remoteV3":true,"stateStores":["shbace_qb_v6","shbace_pins_v1"],"note":"Page registry alias for bookmarked questions."},{"id":"wrong","title":"Wrong Answers","group":"collections","renderer":"page-registry","backTarget":"subjects","addressable":true,"remoteV2":true,"remoteV3":true,"stateStores":["shbace_qb_v6"],"note":"Page registry alias for incorrect answers."},{"id":"notes","title":"My Notes","group":"collections","renderer":"page-registry","backTarget":"subjects","addressable":true,"remoteV2":false,"remoteV3":false,"stateStores":["shbace_qb_v6","shbace_note_meta_v2"],"note":"Notes renderer is registered in PAGES and PAGES2."},{"id":"pinned","title":"Pinned & Recent","group":"collections","renderer":"page-registry","backTarget":"subjects","addressable":true,"remoteV2":true,"remoteV3":true,"stateStores":["shbace_pins_v1","shbace_recent_v1"],"note":"Initial PAGES entry is later replaced by the combined Pinned & Recent renderer."},{"id":"reported","title":"Reported Questions","group":"collections","renderer":"page-registry","backTarget":"subjects","addressable":true,"remoteV2":true,"remoteV3":true,"stateStores":["shbace_qb_v6"],"note":"Registered PAGES renderer; reports remain within the question-bank state."},{"id":"timer","title":"Study Timer","group":"study-tools","renderer":"page-registry","backTarget":"subjects","addressable":true,"remoteV2":true,"remoteV3":true,"stateStores":["shbace_studytime_v1"],"note":"Also uses the native StudyTimerService / Android SharedPreferences bridge."},{"id":"examplanner","title":"Exam Goal Planner","group":"study-tools","renderer":"registered-local","backTarget":"subjects","addressable":true,"remoteV2":false,"remoteV3":false,"stateStores":["shbace_exam_goal_planner_v1"],"note":"Registered by js/36 through __shbRegisterPage; not a remote V2/V3 built-in target."},{"id":"shbRemoteFlashcards","title":"Remote Flashcards","group":"study-tools","renderer":"registered-local","backTarget":"subjects","addressable":true,"remoteV2":false,"remoteV3":false,"stateStores":["shbace_remote_flashcards_v1"],"note":"Registered by js/45 through __shbRegisterPage; progress is separate from Smart Review."},{"id":"about","title":"About","group":"help","renderer":"page-registry","backTarget":"subjects","addressable":true,"remoteV2":true,"remoteV3":true,"stateStores":[],"note":"Initial local PAGES renderer."},{"id":"dedication","title":"Dedication","group":"help","renderer":"legacy-fallback","backTarget":"about","addressable":true,"remoteV2":false,"remoteV3":true,"stateStores":[],"note":"Present in the V3 built-in target list and BACKP; no direct PAGES assignment was found in the inspected feature file."},{"id":"changelog","title":"Changelog","group":"help","renderer":"page-registry","backTarget":"subjects","addressable":true,"remoteV2":true,"remoteV3":true,"stateStores":[],"note":"Initial local PAGES renderer."},{"id":"feedback","title":"Contact & Feedback","group":"help","renderer":"page-registry","backTarget":"subjects","addressable":true,"remoteV2":true,"remoteV3":true,"stateStores":[],"note":"Initial local PAGES renderer."},{"id":"rate","title":"Rate","group":"help","renderer":"page-registry","backTarget":"subjects","addressable":true,"remoteV2":true,"remoteV3":true,"stateStores":["shbace_rating_v1"],"note":"Initial local PAGES renderer; rating is saved locally."},{"id":"menu","title":"Menu fallback","group":"system","renderer":"legacy-fallback","backTarget":"subjects","addressable":true,"remoteV2":false,"remoteV3":true,"stateStores":[],"note":"Fallback renderer used by renderAppDemo for routes not matched by the explicit core switch."}]};
  var byId = Object.create(null);
  DATA.routes.forEach(function (route) { byId[route.id] = route; });
  var previousRoute = readRoute();
  var sequence = 0;

  function readRoute() {
    try { return String(appPage || 'subjects'); }
    catch (e) { return 'subjects'; }
  }
  function readMode() {
    try { return String(mode || 'unknown'); }
    catch (e) { return 'unknown'; }
  }
  function copyRoute(route) {
    if (!route) return null;
    return {
      id: route.id,
      title: route.title,
      group: route.group,
      renderer: route.renderer,
      backTarget: route.backTarget,
      addressable: !!route.addressable,
      remoteV2: !!route.remoteV2,
      remoteV3: !!route.remoteV3,
      stateStores: route.stateStores.slice(),
      note: route.note
    };
  }
  function get(id) { return copyRoute(byId[String(id || '')] || null); }
  function list() { return DATA.routes.map(copyRoute); }
  function dynamicRemotePage(id) {
    var value = String(id || '');
    if (!/^shbRemotePage_[A-Za-z0-9_-]{1,48}$/.test(value)) return null;
    return {
      id:value,
      kind:'dynamic-remote-page',
      registration:'window.__shbRegisterPage',
      registeredStatus:'managed-by-remote-ui-engine'
    };
  }
  function classify(id) {
    var key = String(id || '');
    if (byId[key]) return {kind:'app-route', route:copyRoute(byId[key])};
    var remote = dynamicRemotePage(key);
    return remote ? {kind:remote.kind, route:remote} : null;
  }
  function resolveBackTarget(id) {
    var key = String(id || readRoute());
    var route = byId[key];
    if (!route || route.backTarget == null) return null;
    if ((route.backTarget === '*' || key === 'quizresult') && typeof window.__shbGetBackTarget === 'function') {
      try { return String(window.__shbGetBackTarget(key) || 'subjects'); }
      catch (e) { return null; }
    }
    if (route.renderer === 'registered-local' && typeof window.__shbGetBackTarget === 'function') {
      try { return String(window.__shbGetBackTarget(key) || route.backTarget); }
      catch (e) { return route.backTarget; }
    }
    return String(route.backTarget);
  }
  function validate(id) {
    var key = String(id || '');
    var route = byId[key];
    if (!route) {
      var dynamic = dynamicRemotePage(key);
      return {ok:false,reason:dynamic ? 'dynamic-page-registration-is-managed-by-remote-ui' : 'unknown-route'};
    }
    return {ok:true,route:copyRoute(route)};
  }
  function navigate(id) {
    var validation = validate(id);
    if (!validation.ok) return validation;
    if (readMode() !== 'app') return {ok:false,reason:'app-mode-required'};
    if (typeof window.renderAppDemo !== 'function') return {ok:false,reason:'renderer-unavailable'};
    try {
      appPage = String(id);
      window.renderAppDemo();
      return {ok:true,route:String(id)};
    } catch (error) {
      core.diagnostics.record('error','NAVIGATION_ADAPTER_FAILED','Navigation adapter could not render a known route.',{
        route:String(id),error:String(error && error.message || error)
      });
      return {ok:false,reason:'render-failed'};
    }
  }
  function back() {
    var target = resolveBackTarget(readRoute());
    if (target == null || typeof window.navBack !== 'function') return {ok:false,reason:'back-not-defined'};
    try { window.navBack(); return {ok:true,target:target}; }
    catch (error) {
      core.diagnostics.record('error','NAVIGATION_BACK_FAILED','Legacy back navigation failed.',{
        route:readRoute(),error:String(error && error.message || error)
      });
      return {ok:false,reason:'back-failed'};
    }
  }

  function afterRender() {
    var current = readRoute();
    sequence++;
    var detail = {route:current,mode:readMode(),sequence:sequence,at:new Date().toISOString()};
    core.events.emit('navigation:rendered',detail);
    if (current !== previousRoute) {
      var changed = {from:previousRoute,to:current,mode:detail.mode,sequence:sequence,at:detail.at};
      previousRoute = current;
      core.events.emit('navigation:route-changed',changed);
    }
  }

  var originalRender = window.renderAppDemo;
  if (typeof originalRender === 'function' && !window.__SHBACE_NAVIGATION_RENDER_HOOK_V1__) {
    window.__SHBACE_NAVIGATION_RENDER_HOOK_V1__ = true;
    window.renderAppDemo = function () {
      var result = originalRender.apply(this,arguments);
      try { afterRender(); }
      catch (error) {
        core.diagnostics.record('warn','NAVIGATION_OBSERVER_FAILED','Navigation observer skipped a render.',{
          error:String(error && error.message || error)
        });
      }
      return result;
    };
  }

  var api = Object.freeze({
    version:'1.0.0',
    apiVersion:1,
    platform:'android',
    list:list,
    get:get,
    classify:classify,
    current:function(){return {id:readRoute(),mode:readMode()};},
    validate:validate,
    navigate:navigate,
    back:back,
    resolveBackTarget:resolveBackTarget,
    isRemoteTarget:function(id,engine){
      var route=byId[String(id||'')];
      if(!route)return false;
      if(engine==='v2')return !!route.remoteV2;
      if(engine==='v3')return !!route.remoteV3;
      return false;
    },
    onChange:function(handler){return core.events.on('navigation:route-changed',handler);},
    onRendered:function(handler){return core.events.on('navigation:rendered',handler);},
    manifest:function(){return JSON.parse(JSON.stringify(DATA));}
  });

  Object.defineProperty(window,'SHBACENavigation',{
    value:api,configurable:false,enumerable:true,writable:false
  });
  core.services.register('navigation.catalog',api);
  core.events.emit('navigation:ready',{
    version:api.version,
    routeCount:DATA.routes.length,
    remotePagePrefix:DATA.dynamicRemotePage.routePrefix
  });
})();