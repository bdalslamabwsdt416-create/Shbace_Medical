/* Shbace Medical · Chrome phone and desktop browser enhancements
 * Isolated behind a native Android Capacitor check. Does not alter iOS/PWA behaviour.
 * Adds haptics, question actions, TTS, strike-through, system theme, exam planner,
 * controlled local reminders, share card, native timer notification and keep-screen-on.
 */
(function () {
  'use strict';
  function androidNative() {
    try {
      var c = window.Capacitor;
      var nativeApp = !!(c && c.isNativePlatform && c.isNativePlatform() &&
        (!c.getPlatform || c.getPlatform() === 'android') && window.ShbaceNative);
      var chromePwa = !!(window.__SHBACE_CHROME_PWA__ && /Android/i.test(navigator.userAgent || '') && !window.ShbaceNative);
      return nativeApp || chromePwa;
    } catch (_) { return false; }
  }
  if (!androidNative()) return;

  var PREF_KEY = 'shbace_android_features_v1';
  var GOAL_KEY = 'shbace_exam_goal_v1';
  var ACTIVITY_KEY = 'shbace_study_activity_days_v1';
  var DAY = 86400000;
  var DEFAULTS = {
    haptics: true, shareQuestion: true, copyQuestion: true, readAloud: true,
    keepScreenOn: true, autoTheme: true, examCountdown: true, doctorExpressions: true,
    readingSpeed: 'normal'
  };
  function readPrefs() {
    try {
      var p = JSON.parse(localStorage.getItem(PREF_KEY) || '{}');
      return Object.assign({}, DEFAULTS, p && typeof p === 'object' ? p : {});
    } catch (_) { return Object.assign({}, DEFAULTS); }
  }
  var prefs = readPrefs();
  // Migration safety: if either of the former doctor controls was OFF, preserve that
  // restrictive choice when moving to the single English Android control.
  try { if (window.__SET && window.__SET.doctor === 'off') prefs.doctorExpressions = false; } catch (_) {}
  function savePrefs() {
    try { localStorage.setItem(PREF_KEY, JSON.stringify(prefs)); } catch (_) {}
  }
  function toast(s) { try { if (typeof window.toast === 'function') window.toast(s); } catch (_) {} }
  var notificationPermissionNoticeShown = false;
  function notifyReminderPermissionRequired() {
    if (notificationPermissionNoticeShown) return;
    notificationPermissionNoticeShown = true;
    toast('إذن الإشعارات غير مفعّل. فعّله من إعدادات التطبيق حتى تصلك التذكيرات. لا تحتاج إلى صلاحية المنبّهات الدقيقة.');
  }
  window.__shbNotifyReminderPermissionRequired = notifyReminderPermissionRequired;
  function syncLegacyDoctorPreference() {
    var legacy = prefs.doctorExpressions === false ? 'off' : 'on';
    try {
      if (window.__SET) window.__SET.doctor = legacy;
      var saved = JSON.parse(localStorage.getItem('shbace_settings_v1') || '{}');
      if (!saved || typeof saved !== 'object' || Array.isArray(saved)) saved = {};
      if (saved.doctor !== legacy) {
        saved.doctor = legacy;
        localStorage.setItem('shbace_settings_v1', JSON.stringify(saved));
      }
    } catch (_) {}
    savePrefs();
    applyDoctorVisibility();
  }
  function applyDoctorVisibility() {
    var hide = prefs.doctorExpressions === false;
    var phone = document.querySelector('.phone');
    if (phone) phone.classList.toggle('nodoc', hide);
    document.body.classList.toggle('nodoc', hide);
  }
  function hideLegacyDoctorSetting() {
    var legacy = document.querySelectorAll('#phoneContent .setcard .setrow button[aria-label="شخصية الطبيب والتعابير"]');
    Array.prototype.forEach.call(legacy, function (button) {
      var row = button.closest('.setrow');
      if (row) { row.hidden = true; row.setAttribute('aria-hidden', 'true'); }
    });
  }
  syncLegacyDoctorPreference();
  function todayKey(d) {
    d = d || new Date();
    return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
  }
  function getStats() {
    try { return typeof window.__shbStats === 'function' ? window.__shbStats() : null; } catch (_) { return null; }
  }
  function getTimerState() {
    try { return window.__shbStudy && window.__shbStudy.state ? window.__shbStudy.state() : null; } catch (_) { return null; }
  }
  function getTimerTotals() {
    try { return window.__shbStudy && window.__shbStudy.totals ? window.__shbStudy.totals() : null; } catch (_) { return null; }
  }
  function reminderCategoryEnabled() {
    try { var p = JSON.parse(localStorage.getItem('shbace_notif_prefs_v1') || '{}'); return p.reminders !== false; }
    catch (_) { return true; }
  }
  function getActivityDays() {
    var a = [];
    try {
      var stored = JSON.parse(localStorage.getItem(ACTIVITY_KEY) || '[]');
      if (Array.isArray(stored)) a = stored.filter(function (x) { return /^\d{4}-\d{2}-\d{2}$/.test(x); });
    } catch (_) {}
    // Count activity already stored by earlier app versions, so a student who studied today
    // before installing this update does not receive a false "you have not studied" reminder.
    try {
      var qb = JSON.parse(localStorage.getItem('shbace_qb_v6') || '{}'), ans = qb && qb.ans || {};
      Object.keys(ans).forEach(function (id) {
        var t = Number(ans[id] && ans[id].t);
        if (t > 0) { var k = todayKey(new Date(t)); if (a.indexOf(k) < 0) a.push(k); }
      });
    } catch (_) {}
    return a;
  }
  function markActivity() {
    var k = todayKey(), a = getActivityDays(), firstToday = a.indexOf(k) < 0;
    if (firstToday) a.push(k);
    try { localStorage.setItem(ACTIVITY_KEY, JSON.stringify(a.slice(-45))); } catch (_) {}
    if (firstToday) cancelTodayReminder();
  }
  function haptic(kind) {
    if (!prefs.haptics) return;
    try { window.ShbaceNative.haptic(String(kind || 'light')); } catch (_) {
      try { if (navigator.vibrate) navigator.vibrate(kind === 'wrong' ? [45, 55, 45] : kind === 'correct' ? [22, 35, 22] : 12); } catch (__) {}
    }
  }
  function nativeTimerSync() {
    try {
      var s = getTimerState(), c = s && s.cur;
      if (c) {
        var elapsed = Number(c.ms) || 0;
        if (c.running && Number(c.rs)) elapsed += Math.max(0, Date.now() - c.rs);
        window.ShbaceNative.updateStudyTimer(Math.max(0, Math.floor(elapsed)), !!c.running);
      } else {
        window.ShbaceNative.stopStudyTimer();
      }
    } catch (_) {}
  }
  function screenAwake() {
    try {
      var on = !!(prefs.keepScreenOn && document.querySelector('#phoneContent .rs.qb'));
      window.ShbaceNative.keepScreenOn(on);
    } catch (_) {}
  }
  function applyTheme() {
    try {
      var m = window.matchMedia('(prefers-color-scheme: light)');
      var light = prefs.autoTheme ? m.matches : !!(window.__SET && window.__SET.theme === 'light');
      var phone = document.querySelector('.phone');
      if (phone) phone.classList.toggle('light', light);
      applyDoctorVisibility();
    } catch (_) {}
  }
  var themeQuery = null;
  try {
    themeQuery = window.matchMedia('(prefers-color-scheme: light)');
    if (themeQuery.addEventListener) themeQuery.addEventListener('change', applyTheme);
    else if (themeQuery.addListener) themeQuery.addListener(applyTheme);
  } catch (_) {}

  function toggleMarkup(key, title, desc) {
    return '<div class="shb-af-row"><div class="shb-af-copy"><b>' + title + '</b><small>' + desc +
      '</small></div><button type="button" class="drsw shb-af-switch ' + (prefs[key] ? 'on' : '') +
      '" role="switch" aria-checked="' + (!!prefs[key]) + '" data-shb-pref="' + key +
      '"><i></i><span>' + (prefs[key] ? 'ON' : 'OFF') + '</span></button></div>';
  }
  function featureSettingsHTML() {
    return '<section class="card setcard shb-af-settings" id="shbAndroidSettings">' +
      '<h3>Study experience</h3><p class="meta">Controls for study sessions and question tools on this Chrome app.</p>' +
      toggleMarkup('haptics', 'Haptic feedback', 'Light touch, correct-answer and incorrect-answer patterns.') +
      toggleMarkup('shareQuestion', 'Share a question', 'Show the question-sharing action.') +
      toggleMarkup('copyQuestion', 'Copy question text', 'Show the copy action for notes or AI tools.') +
      toggleMarkup('readAloud', 'Read questions aloud', 'Show voice playback controls on questions.') +
      '<div class="shb-af-row"><div class="shb-af-copy"><b>Reading speed</b><small>Applies to spoken question text.</small></div>' +
      '<div class="seg shb-af-speed" role="group" aria-label="Reading speed">' +
      ['slow', 'normal', 'fast'].map(function (v) {
        return '<button type="button" data-shb-speed="' + v + '" class="' + (prefs.readingSpeed === v ? 'on' : '') + '">' +
          (v === 'slow' ? 'Slow' : v === 'fast' ? 'Fast' : 'Normal') + '</button>';
      }).join('') + '</div></div>' +
      toggleMarkup('keepScreenOn', 'Keep screen awake', 'Prevent the display from sleeping while the Question Bank is open.') +
      toggleMarkup('autoTheme', 'Follow device theme', 'Automatically match device light or dark appearance.') +
      '</section>' +
      '<section class="card setcard shb-af-settings"><h3>Study reminders</h3>' +
      '<p class="meta">A small number of useful reminders. These use the app’s existing Android notification permission.</p>' +
      '<div class="shb-af-reminder-note"><b>Daily study reminder</b><small>Uses the existing Settings → Notification preferences → Study reminders switch. Normally 7:30 PM; moves to 7:45 PM on days when an Exam Goal reminder is also set for 7:30 PM, avoiding two alerts together. Exact-alarm access is not required; delivery may be a little later.</small></div>' +
      toggleMarkup('examCountdown', 'Exam countdown reminders', 'Three reminders at 7, 3 and 1 day before your saved exam date.') +
      '<button type="button" class="btn block shb-af-copyinfo" id="shbCopyAppInfo">Copy app information</button>' +
      '<p class="meta">Send the copied details when reporting an app issue. No account or personal data is included.</p></section>';
  }
  function mountSettings() {
    var root = document.querySelector('#phoneContent .rs');
    if (!root) return;
    var h = root.querySelector('h1');
    if (!h || !/^settings$/i.test((h.textContent || '').trim())) return;
    if (!root.querySelector('#shbAndroidSettings')) {
      var box = document.createElement('div');
      box.innerHTML = featureSettingsHTML();
      while (box.firstElementChild) root.appendChild(box.firstElementChild);
    }
  }
  function safeText(el) { return (el && (el.innerText || el.textContent) || '').replace(/\s+/g, ' ').trim(); }
  function cardQuestion(card) {
    if (!card) return '';
    var stem = safeText(card.querySelector('.qstem')).replace(/^Q\s*\d+\.\s*/i, '');
    var opts = Array.prototype.slice.call(card.querySelectorAll('.qopt')).map(function (el) {
      var letter = safeText(el.querySelector('i'));
      var value = safeText(el.querySelector('span'));
      return letter + '. ' + value;
    }).filter(Boolean);
    return [stem, opts.length ? opts.join('\n') : ''].filter(Boolean).join('\n\n');
  }
  function decorateQuestionCards() {
    var cards = document.querySelectorAll('#phoneContent .qcard');
    Array.prototype.forEach.call(cards, function (card) {
      if (card.querySelector('.shb-af-qtools')) return;
      var stem = card.querySelector('.qstem');
      if (!stem) return;
      var actions = [];
      if (prefs.shareQuestion) actions.push('<button type="button" class="shb-af-qtool" data-shb-question-action="share" aria-label="Share question"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 16V4"></path><path d="m7 9 5-5 5 5"></path><path d="M5 13v6a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-6"></path></svg><span>Share</span></button>');
      if (prefs.copyQuestion) actions.push('<button type="button" class="shb-af-qtool" data-shb-question-action="copy" aria-label="Copy question"><svg viewBox="0 0 24 24" aria-hidden="true"><rect x="8" y="8" width="12" height="12" rx="2"></rect><path d="M16 8V5a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h3"></path></svg><span>Copy</span></button>');
      if (prefs.readAloud) actions.push('<button type="button" class="shb-af-qtool" data-shb-question-action="speak" aria-label="Read question aloud"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M11 5 6 9H3v6h3l5 4z"></path><path d="M15.5 8.5a5 5 0 0 1 0 7"></path><path d="M18.5 5.5a9 9 0 0 1 0 13"></path></svg><span>Read aloud</span></button>');
      if (!actions.length) return;
      var html = '<div class="shb-af-qtools" role="group" aria-label="Question tools">' + actions.join('') + '</div>';
      stem.insertAdjacentHTML('afterend', html);
    });
  }
  function copyText(text, successMessage) {
    if (!text) return;
    if (window.ShbaceNative && window.ShbaceNative.copyText) {
      try { window.ShbaceNative.copyText(text); toast('Question copied'); return; } catch (_) {}
    }
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(function () { toast(successMessage || 'Question copied'); }).catch(function () { fallbackCopy(text, successMessage); });
    } else fallbackCopy(text, successMessage);
  }
  function fallbackCopy(text, successMessage) {
    var ta = document.createElement('textarea');
    ta.value = text; ta.style.position = 'fixed'; ta.style.opacity = '0';
    document.body.appendChild(ta); ta.select();
    try { document.execCommand('copy'); toast(successMessage || 'Question copied'); } catch (_) { toast('Could not copy text'); }
    ta.remove();
  }
  function shareText(text) {
    if (!text) return;
    try {
      if (window.ShbaceNative && window.ShbaceNative.shareText) { window.ShbaceNative.shareText(text); return; }
    } catch (_) {}
    if (navigator.share) navigator.share({ title: 'Shbace Medical question', text: text }).catch(function () {});
    else copyText(text);
  }
  function speak(text) {
    if (!prefs.readAloud || !text) return;
    var rates = { slow: 0.82, normal: 1, fast: 1.18 };
    try {
      if (window.ShbaceNative && window.ShbaceNative.speakText) {
        window.ShbaceNative.speakText(text, 'en-US', rates[prefs.readingSpeed] || 1);
        return;
      }
    } catch (_) {}
    try {
      if (!window.speechSynthesis || !window.SpeechSynthesisUtterance) { toast('Speech is not available on this device'); return; }
      window.speechSynthesis.cancel();
      var u = new SpeechSynthesisUtterance(text);
      u.rate = rates[prefs.readingSpeed] || 1;
      var voices = window.speechSynthesis.getVoices() || [];
      var voice = voices.find(function (v) { return /male/i.test(v.name) && /^en/i.test(v.lang); }) ||
        voices.find(function (v) { return /^en/i.test(v.lang); });
      if (voice) u.voice = voice;
      window.speechSynthesis.speak(u);
    } catch (_) { toast('Speech is not available on this device'); }
  }
  function mountPlanner() {
    var root = document.querySelector('#phoneContent .rs');
    var grid = root && root.querySelector('.ov-grid');
    if (!root || !grid || root.querySelector('#shbExamGoal')) return;
    var s = getStats();
    if (!s || !Number.isFinite(s.bankTotal)) return;
    var savedDate = '';
    try { savedDate = localStorage.getItem(GOAL_KEY) || ''; } catch (_) {}
    var card = document.createElement('section');
    card.id = 'shbExamGoal';
    card.className = 'card shb-eg-card';
    card.innerHTML = '<div class="shb-eg-head"><div><span class="shb-eg-kicker">EXAM PREPARATION</span><h2>Exam goal planner</h2>' +
      '<p>Set your exam date and get a realistic daily question target.</p></div><span class="shb-eg-icon">◷</span></div>' +
      '<label class="shb-eg-date-label" for="shbEgDate">Your exam date</label>' +
      '<input class="field shb-eg-date" type="date" id="shbEgDate" min="' + todayKey() + '" value="' + savedDate + '">' +
      '<div class="shb-eg-result" id="shbEgResult"></div>';
    grid.insertAdjacentElement('afterend', card);
    renderPlannerResult();
  }
  function renderPlannerResult() {
    var card = document.getElementById('shbExamGoal');
    if (!card) return;
    var s = getStats(), input = document.getElementById('shbEgDate');
    if (!s || !input) return;
    var date = input.value, remaining = Math.max(0, Number(s.bankTotal) - Number(s.answered || 0));
    var days = 0, target = 0, examToday = false;
    var label = 'Choose your exam date to calculate your daily target.';
    if (date) {
      var p = date.split('-').map(Number), exam = new Date(p[0], p[1] - 1, p[2]); exam.setHours(0,0,0,0);
      var today = new Date(); today.setHours(0,0,0,0);
      var diff = Math.ceil((exam.getTime() - today.getTime()) / DAY);
      if (diff < 0) label = 'This exam date has passed. Choose a future date.';
      else if (diff === 0) { examToday = true; days = 0; }
      else { days = diff; target = remaining ? Math.ceil(remaining / days) : 0; }
    }
    var result = document.getElementById('shbEgResult');
    if (!result) return;
    if (!date || (date && label.indexOf('passed') >= 0)) {
      result.innerHTML = '<p class="shb-eg-empty">' + label + '</p>';
      return;
    }
    var pct = Math.max(0, Math.min(100, s.bankTotal ? (s.answered / s.bankTotal) * 100 : 0));
    result.innerHTML = '<div class="shb-eg-metrics"><div><b>' + (examToday ? 'Today' : days) + '</b><small>' + (examToday ? 'Exam day' : 'Days left') + '</small></div>' +
      '<div><b>' + remaining.toLocaleString() + '</b><small>Questions remaining</small></div>' +
      '<div class="shb-eg-target"><b>' + (examToday ? '—' : target.toLocaleString()) + '</b><small>' + (examToday ? 'Final review' : 'Questions per day') + '</small></div></div>' +
      '<div class="shb-eg-bar"><i style="width:' + pct.toFixed(1) + '%"></i></div>' +
      '<p class="shb-eg-caption">' + (remaining ? (examToday ? 'It is exam day. Use the remaining ' + remaining + ' unanswered questions for final review as time allows.' : 'Answer about ' + target + ' questions each day to finish the currently unanswered bank before your exam.') : 'Your question bank is complete. Keep revising and reviewing.') + '</p>';
  }
  function plannerDateChanged(input) {
    var v = input && input.value || '';
    try { if (v) localStorage.setItem(GOAL_KEY, v); else localStorage.removeItem(GOAL_KEY); } catch (_) {}
    renderPlannerResult();
    planExamReminders();
  }
  async function localPlugin() {
    try {
      var c = window.Capacitor;
      return c && c.Plugins && c.Plugins.LocalNotifications ? c.Plugins.LocalNotifications : null;
    } catch (_) { return null; }
  }
  var APP_PHONE_NOTIFY_BASE = 100000000;
  var APP_PHONE_NOTIFY_KEY = 'shbace_android_phone_notifs_v1';
  var phoneNotifPlugin = null, phoneNotifListenerReady = false, phoneNotifChannelsReady = false;
  function phoneNotifHistory() {
    try {
      var x = JSON.parse(localStorage.getItem(APP_PHONE_NOTIFY_KEY) || '[]');
      return Array.isArray(x) ? x.filter(function (v) { return typeof v === 'string'; }).slice(-250) : [];
    } catch (_) { return []; }
  }
  function rememberPhoneNotif(id) {
    var list = phoneNotifHistory();
    if (list.indexOf(id) < 0) list.push(id);
    try { localStorage.setItem(APP_PHONE_NOTIFY_KEY, JSON.stringify(list.slice(-250))); } catch (_) {}
  }
  function phoneNotifId(raw) {
    var h = 2166136261, v = String(raw || '');
    for (var i = 0; i < v.length; i++) { h ^= v.charCodeAt(i); h = Math.imul(h, 16777619); }
    return APP_PHONE_NOTIFY_BASE + ((h >>> 0) % 90000000);
  }
  function phoneNotifChannel(kind) {
    return kind === 'review' ? 'shbace-review' :
      kind === 'quiz' ? 'shbace-quiz' :
      kind === 'reminders' ? 'shbace-reminders' : 'shbace-updates';
  }
  async function preparePhoneNotificationPlugin() {
    if (!androidNative()) return null;
    if (phoneNotifPlugin) return phoneNotifPlugin;
    var p = await localPlugin();
    if (!p) return null;
    try {
      var permission = await p.checkPermissions();
      if (!permission || permission.display !== 'granted') return null;
    } catch (_) { return null; }
    phoneNotifPlugin = p;
    if (!phoneNotifListenerReady && typeof p.addListener === 'function') {
      phoneNotifListenerReady = true;
      try {
        await p.addListener('localNotificationActionPerformed', function (action) {
          var n = action && action.notification, extra = n && n.extra || {};
          var id = String(extra.shbaceNotifId || '');
          if (id && typeof window.nOpen === 'function') window.nOpen(id);
        });
      } catch (e) { phoneNotifListenerReady = false; console.warn('Phone notification tap listener unavailable', e); }
    }
    if (!phoneNotifChannelsReady && typeof p.createChannel === 'function') {
      var defs = [
        ['shbace-review', 'Study review', 'Questions ready for Smart Review', 3],
        ['shbace-quiz', 'Quiz results', 'Quiz completion and study results', 3],
        ['shbace-reminders', 'Study reminders', 'Gentle study and exam reminders', 3],
        ['shbace-updates', 'Shbace Medical updates', 'Important app and account events', 3]
      ];
      try {
        for (var j = 0; j < defs.length; j++) {
          await p.createChannel({ id: defs[j][0], name: defs[j][1], description: defs[j][2], importance: defs[j][3], vibration: true, lights: true, lightColor: '#35B9F2' });
        }
        phoneNotifChannelsReady = true;
      } catch (e) { console.warn('Phone notification channels could not be prepared', e); }
    }
    return p;
  }
  async function mirrorInAppNotification(event) {
    if (!androidNative() || !event || !event.id) return;
    var rawId = String(event.id), kind = String(event.kind || 'updates');
    if (rawId.indexOf('push-') === 0) return; // FCM already arrives through Android's system notification tray.
    if (['review', 'quiz', 'reminders', 'updates'].indexOf(kind) < 0) kind = 'updates';
    // The daily study reminder is scheduled for 7:30 PM. Do not duplicate it on app launch earlier that day.
    if (kind === 'reminders' && rawId.indexOf('reminder-') === 0) {
      var now = new Date();
      if (now.getHours() * 60 + now.getMinutes() < 19 * 60 + 30) return;
    }
    var sent = phoneNotifHistory();
    if (sent.indexOf(rawId) >= 0) return;
    var p = await preparePhoneNotificationPlugin();
    if (!p) return; // Permission is requested by the existing notification bell, never by surprise.
    var nid = phoneNotifId(rawId), title = String(event.title || 'Shbace Medical');
    var body = String(event.body || 'Open Shbace Medical to view this update.');
    var channel = phoneNotifChannel(kind);
    try {
      await p.schedule({ notifications: [{
        id: nid,
        title: title,
        body: body,
        largeBody: body,
        summaryText: 'Shbace Medical · ' + (kind === 'review' ? 'Study review' : kind === 'quiz' ? 'Quiz update' : kind === 'reminders' ? 'Study reminder' : 'App update'),
        smallIcon: 'ic_stat_shbace',
        iconColor: '#35B9F2',
        channelId: channel,
        isExactNotification: false,
        schedule: { at: new Date(Date.now() + 700), allowWhileIdle: true },
        extra: { shbaceNotifId: rawId, page: String(event.page || ''), ref: String(event.ref || '') }
      }] });
      rememberPhoneNotif(rawId);
    } catch (e) { console.warn('Could not mirror app notification to Android', e); }
  }
  window.__shbAndroidNotify = mirrorInAppNotification;
  var REMINDER_BASE = 310000000, DAILY_BASE = 310100000;
  async function cancelReminderIds(plugin, ids) {
    try {
      var p = await plugin.getPending();
      var list = (p && p.notifications || []).filter(function (n) { return ids.indexOf(n.id) >= 0; });
      if (list.length) await plugin.cancel({ notifications: list.map(function (n) { return { id: n.id }; }) });
    } catch (_) {}
  }
  async function cancelTodayReminder() {
    var p = await localPlugin();
    if (p) await cancelReminderIds(p, [DAILY_BASE + Number(todayKey().replace(/-/g, '').slice(2))]);
  }
  var reminderPermissionTask = null;
  async function requestDailyReminderAccess() {
    if (reminderPermissionTask) return reminderPermissionTask;
    reminderPermissionTask = (async function () {
      try {
        var p = await localPlugin();
        if (!p) { toast('تعذّر الوصول إلى خدمة الإشعارات في التطبيق.'); return false; }
        var perm = await p.checkPermissions();
        if (!perm || perm.display !== 'granted') {
          var allowNotifications = window.confirm('حتى يقدر SHBACE Medical يرسل تذكير الدراسة، يحتاج إذن الإشعارات. هل تبي تفعّله الآن؟');
          if (!allowNotifications) return false;
          perm = await p.requestPermissions();
          if (!perm || perm.display !== 'granted') {
            toast('إذن الإشعارات غير مفعّل. فعّله من إعدادات التطبيق.');
            return false;
          }
        }
        // These are convenience reminders, not alarm-clock features. We deliberately
        // schedule them inexactly so Android's optional "Alarms & reminders" access
        // is never a prerequisite and the OS can batch delivery when needed.
        return true;
      } catch (e) {
        console.warn('Daily reminder permission flow failed', e);
        toast('تعذّر التحقق من أذونات التذكير. راجع إعدادات التطبيق.');
        return false;
      }
    })();
    try { return await reminderPermissionTask; }
    finally { reminderPermissionTask = null; }
  }
  window.__shbRequestReminderAccess = requestDailyReminderAccess;

  function dailyReminderAt(day) {
    var minutes = 19 * 60 + 30; // 7:30 PM is the normal daily reminder time.
    try {
      // The planner schedules only the next 14 days. Do not shift this reminder
      // outside that window when the planner has no notification on that date.
      var today = new Date(); today.setHours(0, 0, 0, 0);
      var targetDay = new Date(day.getFullYear(), day.getMonth(), day.getDate());
      var offset = Math.round((targetDay.getTime() - today.getTime()) / DAY);
      if (offset < 0 || offset >= 14) {
        return new Date(day.getFullYear(), day.getMonth(), day.getDate(), 19, 30, 0, 0);
      }
      var goals = JSON.parse(localStorage.getItem('shbace_exam_goals_v2') || 'null');
      if (Array.isArray(goals)) {
        // Match the same earliest future exam selected by the planner scheduler.
        var eligible = goals.filter(function (goal) {
          return goal && goal.reminderEnabled && /^\d{4}-\d{2}-\d{2}$/.test(goal.date || '') &&
            goal.date >= todayKey() && /^\d{2}:\d{2}$/.test(goal.reminderTime || '');
        }).sort(function (a, b) { return a.date.localeCompare(b.date); });
        if (eligible.length && eligible[0].date >= todayKey(day)) {
          var parts = eligible[0].reminderTime.split(':').map(Number);
          var plannerMinutes = parts[0] * 60 + parts[1];
          if (Number.isFinite(plannerMinutes) && Math.abs(plannerMinutes - minutes) < 15) {
            // Android can rate-limit allowWhileIdle alarms to one every 9 minutes.
            // Keep a 15-minute gap so both distinct reminders can still be delivered.
            minutes = plannerMinutes + 15;
            if (minutes > 23 * 60 + 44) minutes = plannerMinutes - 15;
          }
        }
      }
    } catch (_) {}
    return new Date(day.getFullYear(), day.getMonth(), day.getDate(),
      Math.floor(minutes / 60), minutes % 60, 0, 0);
  }
  async function planDailyReminders() {
    var p = await localPlugin();
    if (!p) return;
    try {
      var perm = await p.checkPermissions();
      if (!perm || perm.display !== 'granted') { notifyReminderPermissionRequired(); return; }
      notificationPermissionNoticeShown = false;
      try { await p.createChannel({ id: 'study-reminders', name: 'Study reminders', description: 'A single daily study reminder', importance: 2 }); } catch (_) {}
      var pend = await p.getPending(), mine = (pend.notifications || []).filter(function (n) { return n.id >= DAILY_BASE && n.id < DAILY_BASE + 100000; });
      if (mine.length) await p.cancel({ notifications: mine.map(function (n) { return { id: n.id }; }) });
      if (!reminderCategoryEnabled()) return;
      var days = getActivityDays(), notifications = [], now = new Date();
      for (var i = 0; i < 30; i++) {
        var day = new Date(now.getFullYear(), now.getMonth(), now.getDate() + i), k = todayKey(day);
        var at = dailyReminderAt(day);
        if (at.getTime() <= Date.now() + 30000 || days.indexOf(k) >= 0) continue;
        var totals = getTimerTotals();
        if (i === 0 && totals && totals.today >= 5 * 60000) continue;
        var id = DAILY_BASE + Number(k.replace(/-/g, '').slice(2));
        notifications.push({ id: id, title: 'A little study today?', body: 'You have not recorded a study session today. Take a few minutes for your question bank.', isExactNotification: false, schedule: { at: at, allowWhileIdle: true }, channelId: 'study-reminders' });
      }
      if (notifications.length) await p.schedule({ notifications: notifications });
    } catch (e) { console.warn('Study reminders could not be scheduled', e); }
  }
  window.__shbPlanDailyReminders = planDailyReminders;
  async function planExamReminders() {
    var p = await localPlugin();
    if (!p) return;
    try {
      var perm = await p.checkPermissions();
      if (!perm || perm.display !== 'granted') { notifyReminderPermissionRequired(); return; }
      notificationPermissionNoticeShown = false;
      try { await p.createChannel({ id: 'exam-countdown', name: 'Exam countdown', description: 'A few reminders before your exam', importance: 3 }); } catch (_) {}
      var ids = [REMINDER_BASE + 7, REMINDER_BASE + 3, REMINDER_BASE + 1];
      await cancelReminderIds(p, ids);
      if (!prefs.examCountdown || !reminderCategoryEnabled()) return;
      var raw = '';
      try { raw = localStorage.getItem(GOAL_KEY) || ''; } catch (_) {}
      if (!raw) return;
      var a = raw.split('-').map(Number), exam = new Date(a[0], a[1]-1, a[2]); exam.setHours(0,0,0,0);
      var today = new Date(); today.setHours(0,0,0,0);
      var remainingDays = Math.ceil((exam.getTime() - today.getTime()) / DAY);
      var s = getStats(), remaining = s ? Math.max(0, Number(s.bankTotal) - Number(s.answered || 0)) : 0;
      var perDay = remaining && remainingDays > 0 ? Math.ceil(remaining / remainingDays) : 0;
      [7,3,1].forEach(function (n) {
        var d = new Date(exam.getFullYear(), exam.getMonth(), exam.getDate() - n, 9, 0, 0, 0);
        if (d.getTime() <= Date.now() + 30000 || remainingDays <= 0) return;
        var body = perDay ? 'Your exam is in ' + n + ' day' + (n === 1 ? '' : 's') + '. Aim for about ' + perDay + ' questions each day.' : 'Your exam is in ' + n + ' day' + (n === 1 ? '' : 's') + '. Review your progress in Study Progress.';
        try { window.__shbAndroidPlannerNotif = body; } catch (_) {}
        ids.forEach(function (id) { /* no-op: IDs are fixed per reminder day below */ });
        var nid = REMINDER_BASE + n;
        planOneExam(p, nid, d, n, body);
      });
    } catch (e) { console.warn('Exam reminders could not be scheduled', e); }
  }
  async function planOneExam(p, id, date, days, body) {
    try {
      var perm = await p.checkPermissions();
      if (!perm || perm.display !== 'granted') return;
      await p.schedule({ notifications: [{ id: id, title: 'Exam countdown · ' + days + ' day' + (days === 1 ? '' : 's') + ' left', body: body, isExactNotification: false, schedule: { at: date, allowWhileIdle: true }, channelId: 'exam-countdown' }] });
    } catch (_) {}
  }
  function shareProgressCard() {
    var s = getStats();
    if (!s) { toast('Study statistics are not available'); return; }
    var canvas = document.createElement('canvas');
    canvas.width = 1080; canvas.height = 1350;
    var ctx = canvas.getContext('2d');
    var bg = ctx.createLinearGradient(0,0,1080,1350);
    bg.addColorStop(0,'#07172f'); bg.addColorStop(.55,'#0a2a55'); bg.addColorStop(1,'#071326');
    ctx.fillStyle = bg; ctx.fillRect(0,0,1080,1350);
    ctx.strokeStyle = 'rgba(95,205,255,.45)'; ctx.lineWidth = 4; ctx.strokeRect(38,38,1004,1274);
    ctx.fillStyle = '#77dcff'; ctx.font = '700 36px sans-serif'; ctx.fillText('SHBACE MEDICAL',82,120);
    ctx.fillStyle = '#f4f8ff'; ctx.font = '700 70px sans-serif'; ctx.fillText('My Study Progress',82,250);
    ctx.fillStyle = '#b8d4f3'; ctx.font = '32px sans-serif'; ctx.fillText(new Date().toLocaleDateString(),82,310);
    ctx.fillStyle = '#8be7ff'; ctx.font = '700 150px sans-serif'; ctx.fillText(String(s.completion || 0) + '%',82,560);
    ctx.fillStyle = '#eaf4ff'; ctx.font = '38px sans-serif'; ctx.fillText('Question bank completed',82,630);
    ctx.fillStyle = '#fff'; ctx.font = '700 58px sans-serif'; ctx.fillText(String(s.answered || 0) + ' / ' + String(s.bankTotal || 0),82,820);
    ctx.fillStyle = '#b8d4f3'; ctx.font = '32px sans-serif'; ctx.fillText('Questions answered',82,875);
    var t = getTimerTotals(), time = t && t.tot ? Math.round(t.tot/3600000*10)/10 + ' hours' : 'Keep building your study time';
    ctx.fillStyle = '#fff'; ctx.font = '700 56px sans-serif'; ctx.fillText(time,82,1055);
    ctx.fillStyle = '#b8d4f3'; ctx.font = '32px sans-serif'; ctx.fillText('Total study time',82,1110);
    ctx.fillStyle = '#82d7ff'; ctx.font = '28px sans-serif'; ctx.fillText('Learn · Practice · Excel',82,1230);
    canvas.toBlob(function (blob) {
      if (!blob) { toast('Could not create the progress card'); return; }
      var reader = new FileReader();
      reader.onloadend = function () {
        var b64 = String(reader.result || '').split(',')[1] || '';
        try {
          if (window.ShbaceNative && window.ShbaceNative.shareImage) { window.ShbaceNative.shareImage(b64); return; }
        } catch (_) {}
        try {
          var a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = 'shbace-study-progress.png'; a.click();
          setTimeout(function () { URL.revokeObjectURL(a.href); }, 5000);
          toast('Progress card saved');
        } catch (_) { toast('Could not save the progress card'); }
      };
      reader.readAsDataURL(blob);
    }, 'image/png');
  }
  function mountShareProgress() {
    var root = document.querySelector('#phoneContent .rs');
    if (!root || !root.querySelector('.ov-grid') || root.querySelector('#shbShareProgress')) return;
    var b = document.createElement('button');
    b.type = 'button'; b.className = 'btn block'; b.id = 'shbShareProgress';
    b.textContent = 'Share my progress card';
    var goal = root.querySelector('#shbExamGoal');
    (goal || root.querySelector('.ov-grid')).insertAdjacentElement('afterend', b);
  }
  function mountAndroidHowToUse() {
    var root = document.querySelector('#phoneContent .rs');
    var list = root && root.querySelector('.ab2-how .how-list');
    if (!list || list.querySelector('[data-shb-android-help]')) return;
    Array.prototype.forEach.call(list.querySelectorAll('.how-sec'), function (section) {
      var title = safeText(section.querySelector('.how-t'));
      var pad = section.querySelector('.how-pad');
      if (!pad) return;
      if (title.indexOf('مؤقّت الدراسة') >= 0) {
        var timerTip = document.createElement('p');
        timerTip.className = 'how-tip';
        timerTip.textContent = 'Android: أثناء تشغيل جلسة Study Timer يظهر الوقت في إشعار مستمر، ويستمر العدّ عند تصغير التطبيق أو قفل الشاشة. أوقف الجلسة أو أوقفها مؤقتاً من داخل التطبيق عند الانتهاء.';
        pad.appendChild(timerTip);
      }
      if (title.indexOf('الإشعارات') >= 0) {
        pad.innerHTML = pad.innerHTML.replace(
          'أما إشعارات المراجعة الذكية والتذكير بالدراسة فتُحدّث داخل التطبيق عند فتحه.',
          'في Android تظهر إشعارات المراجعة والاختبارات والتذكيرات وتحديثات التطبيق أيضاً في شريط إشعارات الهاتف، إضافة إلى مركز الإشعارات داخل التطبيق، بعد منح إذن الإشعارات. ويمكن تشغيل تذكير مذاكرة يومي واحد وتنبيهات الامتحان قبل 7 و3 و1 أيام.'
        );
      }
    });
    var section = document.createElement('details');
    section.className = 'how-sec';
    section.setAttribute('data-shb-android-help', '1');
    section.innerHTML =
      '<summary><span class="how-n">A</span><span class="how-t">Android study tools</span><i class="how-chev" aria-hidden="true"></i></summary>' +
      '<div class="how-in"><div class="how-pad">' +
      '<ol>' +
      '<li>داخل السؤال استخدم <b>Share</b> لإرسال نص السؤال، أو <b>Copy</b> لنسخه، أو <b>Read aloud</b> لسماعه. يمكن تشغيل أو إيقاف كل أداة من Settings؛ وهي مفعّلة افتراضياً.</li>' +
      '<li>تفضيل القراءة <b>Slow / Normal / Fast</b>. يفضّل Android صوتاً رجاليّاً إن كان متاحاً في محرك القراءة المثبّت على الجهاز، وإلا يستخدم صوتاً مناسباً متاحاً.</li>' +
      '<li>اضغط مطوّلاً على خيار إجابة لاستبعاده بصرياً. هذا لا يختار الإجابة ولا يغيّر نتيجتك.</li>' +
      '<li>يمنع <b>Keep screen awake</b> انطفاء الشاشة أثناء وجودك في Question Bank فقط، ويعود سلوك الشاشة الطبيعي عند مغادرته.</li>' +
      '<li>من <b>Stats → Overview</b> حدّد تاريخ الامتحان في <b>Exam Goal Planner</b> ليحسب التطبيق الأيام المتبقية وعدد الأسئلة اليومية المطلوب لإنهاء الأسئلة غير المجابة.</li>' +
      '<li>تجد تذكير المذاكرة والعدّ التنازلي للامتحان في Settings. أوقف أي تذكير لا تحتاجه؛ التذكيرات محدودة وليست إشعارات متكررة كل ساعة.</li>' +
      '<li>زر <b>Copy app information</b> ينسخ معلومات تشخيصية مثل إصدار التطبيق وAndroid والجهاز، من دون بياناتك الدراسية، لتُرسلها عند الإبلاغ عن مشكلة.</li>' +
      '<li>بطاقة <b>Share my progress card</b> في Study Progress تنشئ صورة لإحصائياتك لمشاركتها.</li>' +
      '<li>يعمل <b>Haptic feedback</b> باهتزاز خفيف عند حفظ السؤال والانتقال للتالي، وبنمطين مختلفين للإجابة الصحيحة والخاطئة، سواء في Question Bank أو Quiz. تحكم فيه من Settings.</li>' +
      '</ol></div></div>';
    list.appendChild(section);
  }

  function mountQuestionHelpersAndTop() {
    if (prefs.autoTheme) applyTheme();
    mountSettings();
    hideLegacyDoctorSetting();
    applyDoctorVisibility();
    mountAndroidHowToUse();
    mountPlanner();
    renderPlannerResult();
    mountShareProgress();
    decorateQuestionCards();
    screenAwake();
    var root = document.querySelector('#phoneContent .rs');
    if (root) {
      var h = root.querySelector(':scope > h1');
      if (h && !h.dataset.shbTopBound) {
        h.dataset.shbTopBound = '1';
        h.title = 'Tap to return to top';
        h.addEventListener('click', function () {
          var sc = document.querySelector('#phoneContent');
          if (sc) sc.scrollTo({ top: 0, behavior: 'smooth' });
        });
      }
      root.querySelectorAll('input,textarea').forEach(function (el) {
        if (el.type === 'search') { el.setAttribute('enterkeyhint', 'search'); el.setAttribute('autocapitalize', 'none'); el.setAttribute('autocorrect', 'off'); el.spellcheck = false; }
        else if (el.tagName === 'TEXTAREA') { el.setAttribute('autocapitalize', 'sentences'); el.setAttribute('enterkeyhint', 'done'); }
      });
    }
  }
  function onRender() {
    requestAnimationFrame(function () {
      mountQuestionHelpersAndTop();
      nativeTimerSync();
    });
  }
  var oldRender = window.renderAppDemo;
  if (typeof oldRender === 'function') {
    window.renderAppDemo = function () {
      var r = oldRender.apply(this, arguments);
      onRender();
      return r;
    };
  }
  var phoneContent = document.getElementById('phoneContent');
  if (phoneContent && window.MutationObserver) {
    var renderQueued = false;
    new MutationObserver(function () {
      if (renderQueued) return;
      renderQueued = true;
      requestAnimationFrame(function () { renderQueued = false; onRender(); });
    }).observe(phoneContent, { childList: true });

    // Question-bank actions can replace only one <article class="qcard"> in place.
    // Observe those nested mutations separately so the helper buttons survive answers,
    // save/report/note actions and switching the question view without rerendering
    // every Android feature on each small DOM change.
    var questionToolsQueued = false;
    new MutationObserver(function (records) {
      var relevant = records.some(function (record) {
        var target = record.target;
        if (target && target.nodeType === 1) {
          if (target.closest && target.closest('.shb-af-qtools')) return false;
          if ((target.matches && target.matches('#qbBody, .qcard')) ||
              (target.closest && (target.closest('#qbBody') || target.closest('.qcard')))) return true;
        }
        return Array.prototype.some.call(record.addedNodes || [], function (node) {
          if (!node || node.nodeType !== 1) return false;
          return (node.matches && node.matches('#qbBody, .qcard')) ||
            (node.querySelector && !!node.querySelector('#qbBody, .qcard'));
        });
      });
      if (!relevant || questionToolsQueued) return;
      questionToolsQueued = true;
      requestAnimationFrame(function () {
        questionToolsQueued = false;
        decorateQuestionCards();
      });
    }).observe(phoneContent, { childList: true, subtree: true });
  }
  if (typeof window.setSet === 'function') {
    var oldSet = window.setSet;
    window.setSet = function (k, v) {
      var r = oldSet.apply(this, arguments);
      if (k === 'theme') { prefs.autoTheme = false; savePrefs(); }
      if (k === 'doctor') {
        prefs.doctorExpressions = v === 'on';
        savePrefs();
        syncLegacyDoctorPreference();
        hideLegacyDoctorSetting();
      }
      return r;
    };
  }
  var oldNSetPref = window.nSetPref;
  if (typeof oldNSetPref === 'function') window.nSetPref = function (kind, value) {
    var r = oldNSetPref.apply(this, arguments);
    if (kind === 'reminders') {
      if (value) {
        requestDailyReminderAccess().then(function (ok) {
          if (ok) {
            planDailyReminders(); planExamReminders();
            try { if (window.__shbV13 && window.__shbV13.refresh) window.__shbV13.refresh(); } catch (_) {}
          }
        });
      } else { planDailyReminders(); planExamReminders(); }
    }
    return r;
  };
  var oldAnswer = window.qAnswer;
  if (typeof oldAnswer === 'function') window.qAnswer = function (id, index) {
    var r = oldAnswer.apply(this, arguments);
    markActivity();
    var card = document.getElementById('qc-' + id);
    haptic(card && card.querySelector('.qreact.ok') ? 'correct' : 'wrong');
    requestAnimationFrame(decorateQuestionCards);
    renderPlannerResult();
    return r;
  };
  var oldQzPick = window.qzPick;
  if (typeof oldQzPick === 'function') window.qzPick = function (index) {
    var before = window.__shbQuizCurrent ? window.__shbQuizCurrent() : null;
    var r = oldQzPick.apply(this, arguments);
    var after = window.__shbQuizCurrent ? window.__shbQuizCurrent() : null;
    if (Number(index) >= 0 && before && after && after.selected === Number(index) && before.selected !== Number(index)) {
      markActivity();
      haptic(Number(index) === Number(before.correct) ? 'correct' : 'wrong');
    }
    return r;
  };
  var oldQzGo = window.qzGo;
  if (typeof oldQzGo === 'function') window.qzGo = function (direction) {
    var before = window.__shbQuizCurrent ? window.__shbQuizCurrent() : null;
    var r = oldQzGo.apply(this, arguments);
    var after = window.__shbQuizCurrent ? window.__shbQuizCurrent() : null;
    if (before && after && after.idx > before.idx) haptic('light');
    return r;
  };
  var oldQzJump = window.qzJump;
  if (typeof oldQzJump === 'function') window.qzJump = function (index) {
    var before = window.__shbQuizCurrent ? window.__shbQuizCurrent() : null;
    var r = oldQzJump.apply(this, arguments);
    var after = window.__shbQuizCurrent ? window.__shbQuizCurrent() : null;
    if (before && after && after.idx > before.idx) haptic('light');
    return r;
  };
  var oldSave = window.qSave;
  if (typeof oldSave === 'function') window.qSave = function () {
    var r = oldSave.apply(this, arguments);
    haptic('light');
    requestAnimationFrame(decorateQuestionCards);
    return r;
  };
  var oldStep = window.qStep;
  if (typeof oldStep === 'function') window.qStep = function (d) {
    var r = oldStep.apply(this, arguments); if (Number(d) > 0) haptic('light'); return r;
  };
  var oldStart = window.stTimerStart;
  if (typeof oldStart === 'function') window.stTimerStart = function () {
    var r = oldStart.apply(this, arguments); markActivity(); haptic('light'); nativeTimerSync(); return r;
  };
  var oldPause = window.stTimerPause;
  if (typeof oldPause === 'function') window.stTimerPause = function () {
    var r = oldPause.apply(this, arguments); nativeTimerSync(); return r;
  };
  var oldFinish = window.stTimerFinish;
  if (typeof oldFinish === 'function') window.stTimerFinish = function () {
    var r = oldFinish.apply(this, arguments); nativeTimerSync(); return r;
  };
  var oldToggle = window.tmToggle;
  if (typeof oldToggle === 'function') window.tmToggle = function () {
    var wasRunning = !!(getTimerState() && getTimerState().cur && getTimerState().cur.running);
    var r = oldToggle.apply(this, arguments);
    if (!wasRunning) markActivity();
    nativeTimerSync();
    return r;
  };
  var oldReset = window.resetAllAsk;
  if (typeof oldReset === 'function') window.resetAllAsk = function () {
    var r = oldReset.apply(this, arguments);
    var set = window.__SET || {}, last = Number(set.lastBackup || 0), fresh = last > 0 && Date.now() - last <= 7 * DAY;
    if (!fresh) {
      var sheet = document.querySelector('#cfwrap .xsheet');
      if (sheet && !sheet.querySelector('.shb-backup-warning')) {
        var p = document.createElement('p'); p.className = 'xnote shb-backup-warning';
        p.textContent = 'Backup warning: no recent backup (within the last 7 days) was recorded. Export a full backup before resetting if you need to keep this progress.';
        sheet.appendChild(p);
      }
    }
    return r;
  };
  document.addEventListener('click', function (ev) {
    var t = ev.target;
    var prefBtn = t.closest && t.closest('[data-shb-pref]');
    if (prefBtn) {
      var k = prefBtn.getAttribute('data-shb-pref');
      prefs[k] = !prefs[k]; savePrefs();
      if (k === 'autoTheme') applyTheme();
      if (k === 'keepScreenOn') screenAwake();
      if (k === 'examCountdown') {
        if (prefs.examCountdown) {
          requestDailyReminderAccess().then(function (ok) {
            if (ok) {
              planDailyReminders(); planExamReminders();
              try { if (window.__shbV13 && window.__shbV13.refresh) window.__shbV13.refresh(); } catch (_) {}
            }
          });
        } else planExamReminders();
      }
      if (k === 'doctorExpressions') syncLegacyDoctorPreference();
      if (k === 'shareQuestion' || k === 'copyQuestion' || k === 'readAloud') {
        document.querySelectorAll('#phoneContent .qcard .shb-af-qtools').forEach(function (x) { x.remove(); });
        decorateQuestionCards();
      }
      var state = prefs[k];
      prefBtn.classList.toggle('on', state); prefBtn.setAttribute('aria-checked', String(state));
      prefBtn.querySelector('span').textContent = state ? 'ON' : 'OFF';
      return;
    }
    var speed = t.closest && t.closest('[data-shb-speed]');
    if (speed) {
      prefs.readingSpeed = speed.getAttribute('data-shb-speed'); savePrefs();
      document.querySelectorAll('[data-shb-speed]').forEach(function (b) { b.classList.toggle('on', b === speed); });
      return;
    }
    var date = t.closest && t.closest('#shbEgDate');
    if (date) return;
    var action = t.closest && t.closest('[data-shb-question-action]');
    if (action) {
      var card = action.closest('.qcard'), text = cardQuestion(card), type = action.getAttribute('data-shb-question-action');
      if (type === 'copy') copyText(text);
      if (type === 'share') shareText(text);
      if (type === 'speak') speak(text);
    }
    if (t.closest && t.closest('#shbCopyAppInfo')) {
      try {
        var info = window.ShbaceNative.getDeviceInfo ? window.ShbaceNative.getDeviceInfo() : navigator.userAgent;
        copyText('Shbace Medical app diagnostics\n' + info, 'App information copied');
      } catch (_) { copyText(navigator.userAgent); }
    }
    if (t.closest && t.closest('#shbShareProgress')) shareProgressCard();
  }, true);
  document.addEventListener('change', function (ev) {
    if (ev.target && ev.target.id === 'shbEgDate') plannerDateChanged(ev.target);
  });
  var longPressTimer = null, longPressTarget = null;
  document.addEventListener('pointerdown', function (ev) {
    var el = ev.target.closest && ev.target.closest('.qopt');
    if (!el || el.disabled) return;
    longPressTarget = el; el.dataset.shbLongPress = '0';
    clearTimeout(longPressTimer);
    longPressTimer = setTimeout(function () {
      if (!longPressTarget || !longPressTarget.isConnected) return;
      longPressTarget.classList.toggle('shb-struck');
      longPressTarget.dataset.shbLongPress = '1';
      haptic('light');
    }, 560);
  }, true);
  ['pointerup','pointercancel','pointerleave'].forEach(function (name) {
    document.addEventListener(name, function () { clearTimeout(longPressTimer); longPressTimer = null; }, true);
  });
  document.addEventListener('click', function (ev) {
    var el = ev.target.closest && ev.target.closest('.qopt');
    if (el && el.dataset.shbLongPress === '1') {
      ev.preventDefault(); ev.stopImmediatePropagation(); el.dataset.shbLongPress = '0';
    }
  }, true);
  document.addEventListener('visibilitychange', function () {
    if (document.hidden) {
      try { if (prefs.readAloud) window.ShbaceNative.stopSpeaking(); } catch (_) {}
      try { if (window.ShbaceNative.keepScreenOn) window.ShbaceNative.keepScreenOn(false); } catch (_) {}
    } else {
      applyTheme(); screenAwake(); nativeTimerSync();
      planDailyReminders(); planExamReminders();
    }
  });
  // Restore the native foreground timer notification after a process/activity recreation.
  setTimeout(function () { nativeTimerSync(); applyTheme(); screenAwake(); planDailyReminders(); planExamReminders(); }, 900);
  var oldCopy = window.restoreBackup;
  if (typeof oldCopy === 'function') {
    window.restoreBackup = function () {
      var r = oldCopy.apply(this, arguments);
      setTimeout(function () { prefs = readPrefs(); onRender(); }, 600);
      return r;
    };
  }
  var style = document.createElement('style');
  style.textContent = [
    '.shb-af-settings{margin:12px 0}.shb-af-row{display:flex;align-items:center;justify-content:space-between;gap:12px;padding:12px 0;border-top:1px solid rgba(100,150,210,.16)}',
    '.shb-af-copy{min-width:0;flex:1}.shb-af-copy b,.shb-af-copy small{display:block}.shb-af-copy b{font-size:13px}.shb-af-copy small{font-size:11px;line-height:1.4;color:var(--muted,#8da7c5);margin-top:3px}',
    '.shb-af-speed{flex:none;max-width:210px}.shb-af-speed button{font-size:10px;padding:7px 8px}',
    '.shb-af-qtools{display:flex;align-items:center;flex-wrap:wrap;gap:8px;margin:10px 0 12px}',
    '.shb-af-qtools button.shb-af-qtool{appearance:none;-webkit-appearance:none;display:inline-flex;align-items:center;justify-content:center;gap:8px;min-height:40px;min-width:0;padding:8px 12px;border:1px solid rgba(91,169,255,.34);border-radius:12px;background:linear-gradient(145deg,rgba(25,81,145,.46),rgba(8,30,67,.72));color:#e7f3ff;font:700 12px/1.2 system-ui,-apple-system,BlinkMacSystemFont,sans-serif;letter-spacing:.01em;cursor:pointer;box-shadow:inset 0 1px 0 rgba(220,242,255,.12),0 3px 10px rgba(0,0,0,.15);transition:transform .16s ease,border-color .16s ease,background .16s ease,box-shadow .16s ease;-webkit-tap-highlight-color:transparent;touch-action:manipulation}',
    '.shb-af-qtools button.shb-af-qtool svg{display:block;width:17px;height:17px;flex:none;fill:none;stroke:currentColor;stroke-width:1.8;stroke-linecap:round;stroke-linejoin:round;opacity:.96}',
    '.shb-af-qtools button.shb-af-qtool:active{transform:translateY(1px) scale(.97);border-color:rgba(83,211,255,.82);background:linear-gradient(145deg,rgba(29,112,186,.64),rgba(9,44,89,.82));box-shadow:0 0 13px rgba(44,164,255,.2)}',
    '.shb-af-qtools button.shb-af-qtool:focus-visible{outline:2px solid #69d8ff;outline-offset:2px}',
    '.phone.light .shb-af-qtools button.shb-af-qtool{background:linear-gradient(145deg,#f7fbff,#e8f3ff);color:#174b7a;border-color:#c7def5;box-shadow:inset 0 1px 0 #fff,0 2px 7px rgba(40,100,160,.08)}',
    '@media(max-width:360px){.shb-af-qtools{gap:6px}.shb-af-qtools button.shb-af-qtool{flex:1 1 auto;padding:8px 9px;gap:6px;font-size:11px}.shb-af-qtools button.shb-af-qtool svg{width:16px;height:16px}}',
    '.qopt.shb-struck{opacity:.32!important;text-decoration:line-through!important;filter:grayscale(1)}',
    '.shb-eg-card{margin:14px 0;padding:16px;border:1px solid rgba(79,164,255,.35);background:linear-gradient(145deg,rgba(15,54,105,.48),rgba(8,26,58,.76))}',
    '.shb-eg-head{display:flex;justify-content:space-between;gap:12px;align-items:flex-start}.shb-eg-kicker{font-size:9px;letter-spacing:.15em;font-weight:900;color:#71d8ff}.shb-eg-head h2{font-size:18px;margin:5px 0}.shb-eg-head p{font-size:11px;line-height:1.45;color:var(--muted,#8da7c5);margin:0}.shb-eg-icon{width:38px;height:38px;border-radius:13px;display:grid;place-items:center;background:rgba(50,151,255,.17);font-size:25px;color:#8fe2ff}',
    '.shb-eg-date-label{display:block;font-size:11px;font-weight:800;margin:15px 0 6px}.shb-eg-date{width:100%;min-height:44px}',
    '.shb-eg-metrics{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:7px;margin-top:13px}.shb-eg-metrics>div{min-width:0;padding:10px 7px;border-radius:12px;background:rgba(70,137,210,.12);border:1px solid rgba(85,160,230,.15);text-align:center}.shb-eg-metrics b,.shb-eg-metrics small{display:block}.shb-eg-metrics b{font-size:21px;font-variant-numeric:tabular-nums;color:#f0f8ff}.shb-eg-metrics small{font-size:9px;line-height:1.3;color:#a6c4e7;margin-top:3px}.shb-eg-metrics .shb-eg-target{background:rgba(29,185,151,.12);border-color:rgba(65,211,177,.25)}.shb-eg-metrics .shb-eg-target b{color:#80f0cc}',
    '.shb-eg-bar{height:6px;border-radius:20px;background:rgba(115,155,205,.2);overflow:hidden;margin-top:12px}.shb-eg-bar i{display:block;height:100%;border-radius:20px;background:linear-gradient(90deg,#287cff,#46dbef)}.shb-eg-caption,.shb-eg-empty{font-size:10px;line-height:1.5;color:var(--muted,#8da7c5);margin:9px 0 0}',
    '.phone.light .shb-eg-card{background:linear-gradient(145deg,#f4f9ff,#e9f3ff);border-color:#c5ddf5}.phone.light .shb-eg-metrics>div{background:#f7fbff;border-color:#d6e7f7}.phone.light .shb-eg-metrics b{color:#17375c}.phone.light .shb-eg-metrics small{color:#58728f}.phone.light .shb-eg-metrics .shb-eg-target{background:#e4f7f0;border-color:#bcebd9}.phone.light .shb-eg-metrics .shb-eg-target b{color:#107c5e}',
    '.phone.light .shb-af-qtools button{background:#edf6ff;color:#164d83;border-color:#c4def5}.phone.light .shb-af-copy small{color:#56718e}',
    '.shb-backup-warning{border:1px solid rgba(255,174,70,.38);background:rgba(255,164,46,.1);color:#ffd18d!important;border-radius:10px;padding:10px}.phone.light .shb-backup-warning{color:#8a4a08!important;background:#fff5e8;border-color:#efd2a7}'
  ].join('');
  document.head.appendChild(style);

  setTimeout(onRender, 350);
  // Mirror only events created during this app launch (never replay the student's old notification history).
  setTimeout(function () {
    try {
      var recent = window.__shbRecentInAppNotifications ? window.__shbRecentInAppNotifications(120000) : [];
      recent.forEach(function (n) { mirrorInAppNotification(n); });
    } catch (e) { console.warn('Recent Android notices could not be mirrored', e); }
  }, 1300);
  window.__shbAndroidFeatures = {
    state: function () { return { prefs: Object.assign({}, prefs), examDate: localStorage.getItem(GOAL_KEY) || '' }; },
    refresh: onRender
  };
})();