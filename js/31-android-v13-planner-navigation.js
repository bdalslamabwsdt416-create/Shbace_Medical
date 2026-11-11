/* Shbace Medical Android 1.3 — Exam Goal Planner + Android navigation polish.
   Local-only data. The Question Bank remains the single source of truth for unanswered questions. */
(function () {
  'use strict';
  function isAndroidNative() {
    try {
      var c = window.Capacitor;
      return !!(c && c.isNativePlatform && c.isNativePlatform() &&
        (!c.getPlatform || c.getPlatform() === 'android') && window.ShbaceNative);
    } catch (_) { return false; }
  }
  if (!isAndroidNative()) return;

  var STORE_KEY = 'shbace_exam_goal_planner_v1';
  var LEGACY_GOAL_KEY = 'shbace_exam_goal_v1';
  var DAY_MS = 86400000;
  var state = readState();
  var lastDayKey = localDayKey(new Date());
  var midnightHandle = null;

  function esc(value) {
    return String(value == null ? '' : value).replace(/[&<>"']/g, function (c) {
      return ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' })[c];
    });
  }
  function localDayKey(d) {
    d = d || new Date();
    return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
  }
  function localMidnight(key) {
    var p = String(key || '').split('-').map(Number);
    if (p.length !== 3 || !p[0] || !p[1] || !p[2]) return null;
    var d = new Date(p[0], p[1] - 1, p[2], 0, 0, 0, 0);
    if (isNaN(d.getTime()) || d.getFullYear() !== p[0] || d.getMonth() !== p[1] - 1 || d.getDate() !== p[2]) return null;
    return d;
  }
  function dayDiff(fromKey, toKey) {
    var a = localMidnight(fromKey), b = localMidnight(toKey);
    if (!a || !b) return NaN;
    // Both values are constructed at local midnight. Rounding absorbs 23/25-hour DST days.
    return Math.round((b.getTime() - a.getTime()) / DAY_MS);
  }
  function shiftDay(key, amount) {
    var d = localMidnight(key);
    if (!d) return key;
    d.setDate(d.getDate() + amount);
    return localDayKey(d);
  }
  function makeId() { return 'exam-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 7); }
  function makeExam(name, date) {
    return {
      id: makeId(),
      name: name || 'Written paper',
      date: date || '',
      bufferDays: 3,
      restDays: 1,
      reminderEnabled: false,
      reminderTime: '19:30'
    };
  }
  function readState() {
    var saved = null;
    try { saved = JSON.parse(localStorage.getItem(STORE_KEY) || 'null'); } catch (_) {}
    if (saved && Array.isArray(saved.exams) && saved.exams.length) {
      saved.exams = saved.exams.filter(function (x) { return x && typeof x.id === 'string'; });
      if (!saved.exams.length) saved.exams = [makeExam('Written paper', '')];
      if (!saved.exams.some(function (x) { return x.id === saved.activeId; })) saved.activeId = saved.exams[0].id;
      saved.exams.forEach(function (x) {
        x.name = String(x.name || 'Exam');
        x.date = /^\d{4}-\d{2}-\d{2}$/.test(x.date || '') ? x.date : '';
        x.bufferDays = clampInt(x.bufferDays, 0, 90, 3);
        x.restDays = clampInt(x.restDays, 0, 7, 1);
        x.reminderEnabled = !!x.reminderEnabled;
        x.reminderTime = /^\d{2}:\d{2}$/.test(x.reminderTime || '') ? x.reminderTime : '19:30';
      });
      return saved;
    }
    var legacy = '';
    try { legacy = localStorage.getItem(LEGACY_GOAL_KEY) || ''; } catch (_) {}
    var first = makeExam('Written paper', /^\d{4}-\d{2}-\d{2}$/.test(legacy) ? legacy : '');
    var fresh = { version: 1, activeId: first.id, exams: [first] };
    try {
      localStorage.setItem(STORE_KEY, JSON.stringify(fresh));
      if (legacy) localStorage.removeItem(LEGACY_GOAL_KEY);
    } catch (_) {}
    return fresh;
  }
  function clampInt(value, min, max, fallback) {
    var n = Number(value);
    if (!Number.isFinite(n)) return fallback;
    return Math.max(min, Math.min(max, Math.round(n)));
  }
  function saveState() {
    try { localStorage.setItem(STORE_KEY, JSON.stringify(state)); } catch (_) {}
  }
  function activeExam() {
    return state.exams.find(function (x) { return x.id === state.activeId; }) || state.exams[0];
  }
  function snapshot() {
    try {
      return typeof window.__shbExamPlannerSnapshot === 'function'
        ? window.__shbExamPlannerSnapshot()
        : { bankTotal: 0, answered: 0, remaining: 0, rows: [], dueSmartReview: 0, averageAnswerMs: null };
    } catch (_) {
      return { bankTotal: 0, answered: 0, remaining: 0, rows: [], dueSmartReview: 0, averageAnswerMs: null };
    }
  }
  function getExamMetrics(exam, data) {
    var today = localDayKey(new Date());
    var daysLeft = exam.date ? dayDiff(today, exam.date) : null;
    var remaining = Math.max(0, Number(data.remaining) || 0);
    var buffer = clampInt(exam.bufferDays, 0, 90, 3);
    var restPerWeek = clampInt(exam.restDays, 0, 7, 1);
    var restDays = daysLeft > 0 ? Math.floor(daysLeft / 7) * restPerWeek : 0;
    var finalReview = daysLeft !== null && daysLeft >= 0 && daysLeft <= buffer;
    var studyDays = daysLeft !== null && daysLeft >= 0 ? Math.max(1, daysLeft - buffer - restDays) : 0;
    var target = daysLeft > buffer && remaining > 0 ? Math.ceil(remaining / studyDays) : 0;
    return { today: today, daysLeft: daysLeft, remaining: remaining, bufferDays: buffer,
      restDays: restDays, studyDays: studyDays, target: target, finalReview: finalReview,
      examToday: daysLeft === 0, past: daysLeft !== null && daysLeft < 0,
      unrealistic: target > 150, complete: remaining === 0 };
  }
  function answeredToday(rows, dayKey) {
    return rows.filter(function (x) { return x.answered && x.at > 0 && localDayKey(new Date(x.at)) === dayKey; }).length;
  }
  function studyStreak(rows, today) {
    var days = {};
    rows.forEach(function (x) { if (x.answered && x.at > 0) days[localDayKey(new Date(x.at))] = true; });
    var cursor = days[today] ? today : shiftDay(today, -1);
    var count = 0;
    while (days[cursor]) { count++; cursor = shiftDay(cursor, -1); }
    return count;
  }
  function dayCount(rows, key) {
    var start = localMidnight(key), end = localMidnight(shiftDay(key, 1));
    if (!start || !end) return 0;
    return rows.filter(function (x) { return x.answered && x.at >= start.getTime() && x.at < end.getTime(); }).length;
  }
  function statusFor(todayCount, target, now) {
    if (target <= 0) return 'On track';
    if (todayCount >= target) return todayCount > target ? 'Ahead' : 'On track';
    var mins = now.getHours() * 60 + now.getMinutes();
    var expected = target * (mins / 1440);
    return todayCount + Math.max(2, target * 0.12) >= expected ? 'On track' : 'Behind';
  }
  function coachMarkup(status, done, target) {
    if (target <= 0) return '';
    if (done >= target) {
      try { return '<div class="eg-coach eg-coach-done">' + mascot('celebrate', 'mascot eg-mascot') + '</div>'; } catch (_) { return ''; }
    }
    if (status === 'Behind') {
      try { return '<div class="eg-coach eg-coach-behind">' + mascot('encourage', 'mascot eg-mascot') + '</div>'; } catch (_) { return ''; }
    }
    return '';
  }
  function formatMinutes(ms) {
    var minutes = Math.max(0, Math.round(ms / 60000));
    if (minutes < 60) return 'about ' + minutes + ' min';
    var hours = Math.floor(minutes / 60), rest = minutes % 60;
    return 'about ' + (rest ? hours + ' h ' + rest + ' min' : hours + ' h');
  }
  function specialtyStats(rows) {
    var map = {};
    rows.forEach(function (q) {
      var key = q.spec || 'other';
      if (!map[key]) map[key] = { id: key, name: q.specName || 'Other', total: 0, answered: 0, correct: 0 };
      var s = map[key]; s.total++;
      if (q.answered) { s.answered++; if (q.correct) s.correct++; }
    });
    return Object.keys(map).map(function (k) {
      var s = map[k]; s.remaining = Math.max(0, s.total - s.answered);
      s.accuracy = s.answered ? Math.round(s.correct * 100 / s.answered) : null;
      return s;
    }).filter(function (s) { return s.remaining > 0; }).sort(function (a, b) { return b.remaining - a.remaining; });
  }
  function weakTopicStats(rows) {
    var map = {};
    rows.forEach(function (q) {
      var key = (q.spec || 'other') + '::' + (q.topic || 'other');
      if (!map[key]) map[key] = { id: q.topic, spec: q.spec, name: q.topicName || 'Other', total: 0, answered: 0, correct: 0 };
      var t = map[key]; t.total++;
      if (q.answered) { t.answered++; if (q.correct) t.correct++; }
    });
    return Object.keys(map).map(function (k) {
      var t = map[k]; t.remaining = Math.max(0, t.total - t.answered);
      t.accuracy = t.answered ? Math.round(t.correct * 100 / t.answered) : null;
      return t;
    }).filter(function (t) { return t.remaining > 0; }).sort(function (a, b) {
      if (a.accuracy === null && b.accuracy !== null) return 1;
      if (b.accuracy === null && a.accuracy !== null) return -1;
      if (a.accuracy !== b.accuracy) return (a.accuracy || 0) - (b.accuracy || 0);
      return b.remaining - a.remaining;
    }).slice(0, 6);
  }
  function svgLineChart(rows, remaining, target, today) {
    var actual = [], ideal = [], max = Math.max(1, remaining);
    for (var i = 6; i >= 0; i--) {
      var day = shiftDay(today, -i);
      var after = rows.filter(function (x) {
        if (!x.answered || !x.at) return false;
        var cutoff = localMidnight(shiftDay(day, 1));
        return cutoff && x.at >= cutoff.getTime();
      }).length;
      var a = remaining + after;
      var v = remaining + target * i;
      actual.push(a); ideal.push(v);
      max = Math.max(max, a, v);
    }
    var points = function (values) {
      return values.map(function (v, idx) {
        var x = 18 + idx * 47;
        var y = 112 - (v / max) * 92;
        return x.toFixed(1) + ',' + y.toFixed(1);
      }).join(' ');
    };
    return '<svg class="eg-burndown" viewBox="0 0 320 138" role="img" aria-label="Remaining questions compared with the ideal burn-down line">' +
      '<path d="M16 112H304" stroke="currentColor" opacity=".18" fill="none"/>' +
      '<polyline points="' + points(ideal) + '" fill="none" stroke="#4FC3F7" stroke-width="2.5" stroke-dasharray="5 4" stroke-linecap="round" stroke-linejoin="round"/>' +
      '<polyline points="' + points(actual) + '" fill="none" stroke="#55D9B7" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/>' +
      '<text x="18" y="131" font-size="9" fill="currentColor" opacity=".62">6 days ago</text><text x="304" y="131" text-anchor="end" font-size="9" fill="currentColor" opacity=".62">Today</text></svg>' +
      '<div class="eg-chart-legend"><span><i class="eg-legend-actual"></i>Remaining</span><span><i class="eg-legend-ideal"></i>Ideal</span></div>';
  }
  function weeklyBars(rows, today) {
    var values = [], max = 1, names = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];
    for (var i = 6; i >= 0; i--) {
      var key = shiftDay(today, -i), count = dayCount(rows, key), d = localMidnight(key);
      values.push({ count: count, label: names[d ? d.getDay() : 0] });
      max = Math.max(max, count);
    }
    return '<div class="eg-week-bars">' + values.map(function (v) {
      return '<div class="eg-week-col"><b>' + (v.count || '') + '</b><i style="height:' + Math.max(4, Math.round(v.count * 42 / max)) + 'px"></i><small>' + v.label + '</small></div>';
    }).join('') + '</div>';
  }
  function examTabs() {
    return '<div class="eg-exam-tabs" role="tablist" aria-label="Exams">' +
      state.exams.map(function (x) {
        return '<button type="button" role="tab" aria-selected="' + (x.id === state.activeId) +
          '" class="eg-exam-tab ' + (x.id === state.activeId ? 'active' : '') + '" data-eg-select="' + esc(x.id) + '">' +
          esc(x.name || 'Exam') + '</button>';
      }).join('') +
      '<button type="button" class="eg-add-exam" data-eg-add aria-label="Add exam">+</button></div>';
  }
  function examPanelMarkup(exam, data) {
    var now = new Date(), metrics = getExamMetrics(exam, data), rows = Array.isArray(data.rows) ? data.rows : [];
    var doneToday = answeredToday(rows, metrics.today);
    var streak = studyStreak(rows, metrics.today);
    var status = statusFor(doneToday, metrics.target, now);
    var pct = metrics.target ? Math.max(0, Math.min(100, doneToday * 100 / metrics.target)) : (metrics.complete ? 100 : 0);
    var circ = 2 * Math.PI * 47, offset = circ * (1 - pct / 100);
    var average = Number(data.averageAnswerMs);
    var time = Number.isFinite(average) && average > 0 && metrics.target > 0 ? formatMinutes(average * metrics.target) : '';
    var smart = Math.max(0, Number(data.dueSmartReview) || 0);
    var stats = specialtyStats(rows), weak = weakTopicStats(rows);
    var dateText = exam.date ? '<bdi dir="ltr" class="eg-date-isolate">' + esc(exam.date) + '</bdi>' : '—';
    var passed = metrics.past;
    var noDate = !exam.date;
    var sentence = metrics.complete ? 'Your question bank is complete.' :
      metrics.finalReview ? 'Final review only · no new questions.' :
      'Answer about ' + metrics.target.toLocaleString('en-US') + ' questions each day to finish the currently unanswered bank before your exam.';
    var warning = metrics.unrealistic ? '<div class="eg-warning">High daily target · ' + metrics.target + '/day</div>' : '';
    var stateLabel = passed ? 'Date passed' : metrics.examToday ? 'Exam day' : metrics.complete ? 'Completed' : metrics.finalReview ? 'Final review' : status;
    var coach = !passed && !metrics.examToday ? coachMarkup(status, doneToday, metrics.target) : '';
    var reminders = '<div class="eg-reminder-row"><label class="eg-reminder-toggle"><input type="checkbox" data-eg-reminder ' +
      (exam.reminderEnabled ? 'checked' : '') + '><span>Daily reminder</span></label><input type="time" dir="ltr" class="eg-time" data-eg-time value="' +
      esc(exam.reminderTime || '19:30') + '" aria-label="Reminder time"></div>';
    var settings = '<details class="eg-settings"><summary>Planning settings</summary><div class="eg-settings-grid">' +
      '<label>Final review days<input type="number" min="0" max="90" step="1" data-eg-buffer value="' + metrics.bufferDays + '"></label>' +
      '<label>Rest days per week<input type="number" min="0" max="7" step="1" data-eg-rest value="' + clampInt(exam.restDays,0,7,1) + '"></label>' +
      reminders + '</div></details>';
    var metricsMarkup = '<div class="eg-metrics">' +
      '<div class="eg-metric"><b>' + (noDate ? '—' : (passed ? '—' : metrics.daysLeft.toLocaleString('en-US'))) + '</b><small>Days left</small></div>' +
      '<div class="eg-metric"><b>' + metrics.remaining.toLocaleString('en-US') + '</b><small>Questions remaining</small></div>' +
      '<div class="eg-metric eg-target"><b>' + (noDate || passed || metrics.finalReview || metrics.complete ? '—' : metrics.target.toLocaleString('en-US')) + '</b><small>' + (metrics.finalReview ? 'Final review' : 'Questions per day') + '</small>' +
      '<em>Smart Review · ' + smart + ' due</em></div></div>';
    var progress = '<div class="eg-today-card"><div class="eg-ring-wrap"><svg viewBox="0 0 112 112" aria-label="Answered today: ' + doneToday + ' of ' + metrics.target + '">' +
      '<circle cx="56" cy="56" r="47" fill="none" stroke="currentColor" stroke-opacity=".14" stroke-width="8"/>' +
      '<circle cx="56" cy="56" r="47" fill="none" stroke="#53D5B5" stroke-width="8" stroke-linecap="round" stroke-dasharray="' +
      circ.toFixed(1) + '" stroke-dashoffset="' + offset.toFixed(1) + '" transform="rotate(-90 56 56)"/></svg>' +
      '<div><b>' + doneToday + '<small> / ' + metrics.target + '</small></b><span>Today</span></div></div>' +
      '<div class="eg-today-info"><b class="eg-status eg-status-' + status.toLowerCase().replace(/\s/g,'-') + '">' + stateLabel + '</b>' +
      '<span>Streak · ' + streak + ' days</span>' + (time ? '<span>Estimated · ' + time + '</span>' : '') + '</div>' +
      coach + '<button type="button" class="eg-timer-link" data-eg-timer>Study Timer ↗</button></div>';
    var specialtyMarkup = stats.length ? stats.map(function (s) {
      return '<div class="eg-specialty-row"><span>' + esc(s.name) + '</span><b>' + s.remaining.toLocaleString('en-US') + '</b></div>';
    }).join('') : '<div class="eg-muted">—</div>';
    var weakMarkup = weak.length ? weak.map(function (t) {
      var acc = t.accuracy === null ? 'Not rated' : t.accuracy + '%';
      return '<div class="eg-weak-row"><div><b>' + esc(t.name) + '</b><small>' + acc + '</small></div><span>' + t.remaining + ' left</span></div>';
    }).join('') : '<div class="eg-muted">—</div>';
    var charts = '<section class="eg-panel"><h3>Burn-down</h3>' + svgLineChart(rows, metrics.remaining, metrics.target, metrics.today) + '</section>' +
      '<section class="eg-panel"><h3>This week</h3>' + weeklyBars(rows, metrics.today) + '</section>';
    return '<div class="eg-exam-panel" data-eg-panel="' + esc(exam.id) + '">' +
      '<div class="eg-exam-name-row"><label><span>Exam name</span><input type="text" maxlength="40" data-eg-name value="' + esc(exam.name) + '"></label>' +
      (state.exams.length > 1 ? '<button type="button" class="eg-remove" data-eg-remove>Remove</button>' : '') + '</div>' +
      '<label class="eg-date-label">Your exam date<input type="date" class="eg-date" dir="ltr" data-eg-date min="' + metrics.today +
      '" value="' + esc(exam.date) + '"><span class="eg-date-preview" dir="ltr">' + dateText + '</span></label>' +
      metricsMarkup + (noDate ? '' : passed ? '<div class="eg-warning">Exam date is in the past</div>' : metrics.examToday ? '<div class="eg-warning">Final review only</div>' : '') +
      warning + '<p class="eg-sentence">' + (noDate || passed ? '—' : sentence) + '</p>' +
      progress + settings + '<div class="eg-lower-grid"><section class="eg-panel"><h3>Remaining by specialty</h3>' + specialtyMarkup +
      '</section><section class="eg-panel"><h3>Lowest-accuracy topics</h3>' + weakMarkup + '</section></div>' + charts +
      '</div>';
  }
  function plannerView() {
    var data = snapshot(), exam = activeExam();
    if (!exam) return '<div class="rs shb-eg-page"><h1>Exam goal planner</h1></div>';
    return '<div class="rs shb-eg-page" id="shbExamGoalPage">' +
      '<button type="button" class="backb eg-back" onclick="navBack()" aria-label="Go back">‹ Back</button>' +
      '<div class="eg-heading"><h1>Exam goal planner</h1><p>Set your exam date and get a realistic daily question target.</p></div>' +
      examTabs() + examPanelMarkup(exam, data) + '</div>';
  }
  function pageRender() {
    try { if (appPage === 'examgoal') renderAppDemo(); } catch (_) {}
  }
  function addExam() {
    var n = state.exams.length + 1;
    var name = state.exams.some(function (x) { return /written/i.test(x.name); }) ? 'OSCE' : 'Exam ' + n;
    var exam = makeExam(name, '');
    state.exams.push(exam); state.activeId = exam.id; saveState(); pageRender();
  }
  function selectExam(id) {
    if (!state.exams.some(function (x) { return x.id === id; })) return;
    state.activeId = id; saveState(); pageRender(); updateAllReminders();
  }
  function removeActiveExam() {
    if (state.exams.length <= 1) return;
    var exam = activeExam();
    if (window.__shbAndroidFeatures && window.__shbAndroidFeatures.schedulePlannerReminder) {
      window.__shbAndroidFeatures.schedulePlannerReminder(false, exam.reminderTime, 0, exam.name, exam.id, 0);
    }
    state.exams = state.exams.filter(function (x) { return x.id !== exam.id; });
    state.activeId = state.exams[0].id; saveState(); pageRender(); updateAllReminders();
  }
  function updateAllReminders() {
    var feature = window.__shbAndroidFeatures;
    if (!feature || typeof feature.schedulePlannerReminder !== 'function') return;
    var data = snapshot(), today = localDayKey(new Date());
    state.exams.forEach(function (exam) {
      var metrics = getExamMetrics(exam, data);
      var enabled = !!exam.reminderEnabled && !metrics.past && metrics.daysLeft > 0 && metrics.remaining > 0;
      feature.schedulePlannerReminder(enabled, exam.reminderTime, metrics.target, exam.name, exam.id, metrics.daysLeft);
    });
  }
  function setExamField(field, value) {
    var exam = activeExam();
    if (!exam) return;
    if (field === 'date') exam.date = /^\d{4}-\d{2}-\d{2}$/.test(value) ? value : '';
    if (field === 'name') exam.name = String(value || 'Exam').slice(0, 40);
    if (field === 'bufferDays') exam.bufferDays = clampInt(value, 0, 90, 3);
    if (field === 'restDays') exam.restDays = clampInt(value, 0, 7, 1);
    if (field === 'reminderEnabled') exam.reminderEnabled = !!value;
    if (field === 'reminderTime') exam.reminderTime = /^\d{2}:\d{2}$/.test(value) ? value : '19:30';
    saveState(); pageRender(); updateAllReminders();
  }
  function scheduleMidnight() {
    if (midnightHandle) clearTimeout(midnightHandle);
    var now = new Date(), next = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1, 0, 0, 1, 0);
    midnightHandle = setTimeout(function () {
      lastDayKey = localDayKey(new Date());
      if (appPage === 'examgoal') pageRender();
      updateAllReminders();
      scheduleMidnight();
    }, Math.max(1000, next.getTime() - Date.now()));
  }
  function refreshIfNewLocalDay() {
    var today = localDayKey(new Date());
    if (today !== lastDayKey) {
      lastDayKey = today;
      if (appPage === 'examgoal') pageRender();
      updateAllReminders();
    }
  }

  // Keep the original hologram welcome screen; remove the other legacy onboarding panels on Android only.
  try {
    if (typeof screenTitles !== 'undefined' && Array.isArray(screenTitles) && screenTitles.length > 1) screenTitles.splice(1);
    if (typeof screenHints !== 'undefined' && Array.isArray(screenHints) && screenHints.length > 1) screenHints.splice(1);
    if (typeof obVisible === 'function') obVisible = function () { return [0]; };
    if (typeof footer === 'function') footer = function () {
      return '<div class="screen-foot sw-foot ob-foot"><span class="ob-dots"><button type="button" class="ob-dot on" aria-current="step" aria-label="Welcome"><i></i></button></span>' +
        '<button type="button" class="ob-arrow" onclick="enterAppDemo()" aria-label="Enter Shbace Medical">›</button></div>';
    };
  } catch (_) {}

  // Semantic back navigation: close transient UI first, then return only through valid parent routes.
  var backStack = [], lastPage = (typeof appPage === 'string' ? appPage : 'subjects'), suppressStack = false;
  var parents = {
    specialties: ['subjects'], topics: ['specialties'], questions: ['topics', 'subjects'],
    quizrun: ['quiz'], quizresult: ['quizrun', 'quiz'], quizhistory: ['quiz'],
    timer: ['examgoal', 'subjects'], weak: ['stats','subjects'], dedication: ['about']
  };
  var rootPages = ['subjects','quiz','review','stats','timer','examgoal','settings','about','changelog','feedback','rate','pinned','saved','wrong','notes','notifs','search'];
  function closeTransient() {
    try {
      var drawer = document.getElementById('drawer');
      if (drawer && drawer.classList.contains('open') && typeof window.toggleDrawer === 'function') {
        window.toggleDrawer(false); return true;
      }
    } catch (_) {}
    try {
      var phone = document.querySelector('.phone');
      if (phone && phone.classList.contains('qfull') && window.__qs) {
        window.__qs.full = false; phone.classList.remove('qfull');
        try { document.fullscreenElement && document.exitFullscreen(); } catch (_) {}
        return true;
      }
    } catch (_) {}
    try {
      var dialog = document.querySelector('dialog[open]');
      if (dialog && typeof dialog.close === 'function') { dialog.close(); return true; }
      var layer = Array.prototype.slice.call(document.querySelectorAll('.modal.open,.overlay.open,.shb-sheet.open,[role="dialog"].open')).pop();
      if (layer) {
        var close = layer.querySelector('[data-close],.close,.btn-close,[aria-label="Close"]');
        if (close) close.click(); else layer.classList.remove('open');
        return true;
      }
    } catch (_) {}
    return false;
  }
  function smartBack() {
    if (closeTransient()) return true;
    if (appPage === 'subjects') return false;
    var dest = null;
    var stackPage = backStack.length ? backStack[backStack.length - 1] : null;
    var allowed = parents[appPage] || [];
    if (stackPage && allowed.indexOf(stackPage) >= 0) dest = backStack.pop();
    if (!dest && appPage === 'quizresult' && window.qzBack) dest = window.qzBack === 'history' ? 'quizhistory' : window.qzBack;
    if (!dest && allowed.length) dest = allowed[0];
    if (!dest) dest = 'subjects';
    suppressStack = true;
    appPage = dest;
    try { renderAppDemo(); } finally { suppressStack = false; lastPage = dest; }
    return true;
  }
  if (typeof window.navBack === 'function') window.navBack = smartBack;
  var baseRender = window.renderAppDemo;
  if (typeof baseRender === 'function') {
    window.renderAppDemo = function () {
      var next = String(appPage || 'subjects');
      if (!suppressStack && next !== lastPage) {
        if (parents[next] && parents[next].indexOf(lastPage) >= 0) backStack.push(lastPage);
        else if (rootPages.indexOf(next) >= 0) backStack = [];
        lastPage = next;
      }
      return baseRender.apply(this, arguments);
    };
  }
  try {
    var appPlugin = window.Capacitor && window.Capacitor.Plugins && window.Capacitor.Plugins.App;
    if (appPlugin && appPlugin.addListener && !window.__shbSmartBackInstalled) {
      window.__shbSmartBackInstalled = true;
      appPlugin.addListener('backButton', function () {
        if (!smartBack()) {
          try { if (appPlugin.exitApp) appPlugin.exitApp(); } catch (_) {}
        }
      });
    }
  } catch (_) {}

  // Register the page in the existing app route table.
  if (window.__shbAndroidPageRegistry) window.__shbAndroidPageRegistry.examgoal = plannerView;

  // User actions are delegated so the planner stays lightweight across re-renders.
  document.addEventListener('click', function (event) {
    var t = event.target && event.target.closest ? event.target.closest('[data-eg-select],[data-eg-add],[data-eg-remove],[data-eg-timer]') : null;
    if (!t) return;
    if (t.hasAttribute('data-eg-select')) selectExam(t.getAttribute('data-eg-select'));
    else if (t.hasAttribute('data-eg-add')) addExam();
    else if (t.hasAttribute('data-eg-remove')) removeActiveExam();
    else if (t.hasAttribute('data-eg-timer')) { appPage = 'timer'; renderAppDemo(); }
  });
  document.addEventListener('change', function (event) {
    var t = event.target;
    if (!t || !t.closest || !t.closest('#shbExamGoalPage')) return;
    if (t.hasAttribute('data-eg-date')) setExamField('date', t.value);
    else if (t.hasAttribute('data-eg-name')) setExamField('name', t.value);
    else if (t.hasAttribute('data-eg-buffer')) setExamField('bufferDays', t.value);
    else if (t.hasAttribute('data-eg-rest')) setExamField('restDays', t.value);
    else if (t.hasAttribute('data-eg-reminder')) setExamField('reminderEnabled', t.checked);
    else if (t.hasAttribute('data-eg-time')) setExamField('reminderTime', t.value);
  });

  // Hide all numeric badges in the side drawer only; in-page statistics remain intact.
  if (typeof window.toggleDrawer === 'function' && !window.__shbDrawerBadgesCleaned) {
    var oldToggleDrawer = window.toggleDrawer;
    window.toggleDrawer = function () {
      var result = oldToggleDrawer.apply(this, arguments);
      try {
        var drawer = document.getElementById('drawer');
        if (drawer) drawer.querySelectorAll('.nb,.nbadge,.badge,.count-badge').forEach(function (node) { node.remove(); });
      } catch (_) {}
      return result;
    };
    window.__shbDrawerBadgesCleaned = true;
  }

  // Keep the app's theme styles, with compact, RTL-safe, phone-sized planner cards.
  var style = document.createElement('style');
  style.id = 'shbace-android-v13-planner';
  style.textContent = [
    '.phone .shb-eg-page{min-width:0;max-width:100%;overflow-x:hidden;padding-bottom:20px}',
    '.phone .shb-eg-page .eg-heading h1{margin:6px 0 3px;font-size:22px;letter-spacing:-.02em}',
    '.phone .shb-eg-page .eg-heading p{font-size:11px;line-height:1.4;color:var(--muted,#8da7c5);margin:0 0 13px}',
    '.phone .eg-exam-tabs{display:flex;gap:7px;align-items:center;overflow-x:auto;scrollbar-width:none;padding:2px 1px 9px;margin-bottom:8px}',
    '.phone .eg-exam-tabs::-webkit-scrollbar{display:none}',
    '.phone .eg-exam-tab,.phone .eg-add-exam{flex:none;border:1px solid rgba(83,157,241,.32);border-radius:14px;background:rgba(45,111,190,.12);color:inherit;padding:9px 12px;font-size:11px;font-weight:800;white-space:nowrap}',
    '.phone .eg-exam-tab.active{background:linear-gradient(135deg,rgba(38,116,214,.35),rgba(22,186,204,.18));border-color:rgba(83,187,255,.68);box-shadow:0 0 14px rgba(52,146,255,.14)}',
    '.phone .eg-add-exam{width:36px;height:36px;padding:0;font-size:21px;line-height:1;color:#8ddaff}',
    '.phone .eg-exam-panel{display:grid;gap:11px;min-width:0}',
    '.phone .eg-exam-name-row{display:flex;align-items:end;gap:8px}',
    '.phone .eg-exam-name-row label{flex:1;min-width:0;display:grid;gap:5px;font-size:10px;font-weight:800}',
    '.phone .eg-exam-name-row input,.phone .eg-date{width:100%;min-width:0;min-height:42px;border:1px solid rgba(93,161,231,.34);border-radius:12px;padding:9px 11px;background:rgba(30,85,145,.16);color:inherit;font-size:13px}',
    '.phone .eg-remove{border:1px solid rgba(240,126,126,.35);background:rgba(240,100,100,.1);color:inherit;border-radius:10px;padding:9px 10px;font-size:10px}',
    '.phone .eg-date-label{display:grid;gap:5px;font-size:10px;font-weight:800}',
    '.phone .eg-date{direction:ltr;unicode-bidi:isolate;text-align:left;font-variant-numeric:tabular-nums}',
    '.phone .eg-date-preview{font-size:10px;color:var(--muted,#91a9c5);text-align:start}',
    '.phone .eg-date-isolate{direction:ltr;unicode-bidi:isolate;display:inline-block}',
    '.phone .eg-metrics{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:7px;min-width:0}',
    '.phone .eg-metric{min-width:0;padding:11px 5px;border:1px solid rgba(78,151,226,.22);border-radius:14px;background:linear-gradient(150deg,rgba(21,66,119,.34),rgba(7,27,62,.42));text-align:center}',
    '.phone .eg-metric b{display:block;font-size:20px;line-height:1.1;font-weight:900;font-variant-numeric:tabular-nums;overflow-wrap:anywhere}',
    '.phone .eg-metric small{display:block;margin-top:5px;font-size:9px;color:#a9c4e2;line-height:1.2}',
    '.phone .eg-target{border-color:rgba(47,200,174,.35);background:linear-gradient(145deg,rgba(17,125,137,.18),rgba(8,45,81,.45))}',
    '.phone .eg-target em{display:block;margin-top:5px;font-size:8px;line-height:1.25;color:#8bded5;font-style:normal}',
    '.phone .eg-sentence{font-size:11px;line-height:1.5;margin:0;color:var(--text,#e7f1ff)}',
    '.phone .eg-warning{padding:8px 10px;border:1px solid rgba(255,177,77,.42);border-radius:11px;background:rgba(255,177,77,.1);color:#ffce89;font-size:10px;font-weight:800}',
    '.phone .eg-today-card{display:grid;grid-template-columns:96px minmax(0,1fr) auto;align-items:center;gap:10px;padding:12px;border:1px solid rgba(82,163,236,.26);border-radius:17px;background:linear-gradient(145deg,rgba(21,63,113,.35),rgba(8,27,60,.5))}',
    '.phone .eg-ring-wrap{width:96px;height:96px;position:relative}',
    '.phone .eg-ring-wrap svg{width:100%;height:100%;display:block}',
    '.phone .eg-ring-wrap>div{position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center}',
    '.phone .eg-ring-wrap>div b{font-size:21px;font-variant-numeric:tabular-nums}',
    '.phone .eg-ring-wrap>div b small{font-size:10px;color:var(--muted,#9eb5ce)}',
    '.phone .eg-ring-wrap>div span{font-size:9px;color:var(--muted,#9eb5ce)}',
    '.phone .eg-today-info{display:grid;gap:5px;min-width:0;font-size:10px;color:var(--muted,#9eb5ce)}',
    '.phone .eg-status{font-size:11px;font-weight:900;color:#76dfc1}',
    '.phone .eg-status-behind{color:#ffb77d}',
    '.phone .eg-coach{width:48px;height:48px;overflow:hidden;display:grid;place-items:center}',
    '.phone .eg-coach .mascot-holder{width:44px;height:44px;min-height:0}',
    '.phone .eg-coach .mascot{width:100%;height:100%;object-fit:contain}',
    '.phone .eg-timer-link{grid-column:1/-1;justify-self:start;border:0;background:none;color:#83caff;font-size:10px;font-weight:800;padding:2px 0}',
    '.phone .eg-settings{border:1px solid rgba(86,154,222,.22);border-radius:13px;padding:10px 12px;background:rgba(27,72,124,.1)}',
    '.phone .eg-settings summary{font-size:10px;font-weight:800;cursor:pointer}',
    '.phone .eg-settings-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px;margin-top:11px}',
    '.phone .eg-settings-grid>label{display:grid;gap:5px;font-size:9px;color:var(--muted,#9eb5ce)}',
    '.phone .eg-settings-grid input[type=number],.phone .eg-time{width:100%;min-width:0;min-height:36px;border:1px solid rgba(93,161,231,.3);border-radius:10px;padding:7px 8px;background:rgba(30,85,145,.15);color:inherit;font-size:12px}',
    '.phone .eg-time{direction:ltr;unicode-bidi:isolate}',
    '.phone .eg-reminder-row{grid-column:1/-1;display:flex;align-items:center;gap:10px;font-size:10px}',
    '.phone .eg-reminder-toggle{display:flex!important;grid-template-columns:none!important;align-items:center;gap:7px;flex:1}',
    '.phone .eg-reminder-row input[type=checkbox]{width:17px;height:17px;accent-color:#43b9d5}',
    '.phone .eg-reminder-row .eg-time{max-width:116px}',
    '.phone .eg-lower-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px}',
    '.phone .eg-panel{min-width:0;padding:11px;border:1px solid rgba(77,148,219,.22);border-radius:15px;background:rgba(20,61,108,.18)}',
    '.phone .eg-panel h3{margin:0 0 9px;font-size:11px}',
    '.phone .eg-specialty-row,.phone .eg-weak-row{display:flex;justify-content:space-between;gap:8px;align-items:center;padding:7px 0;border-bottom:1px solid rgba(121,169,215,.12);font-size:9px}',
    '.phone .eg-specialty-row:last-child,.phone .eg-weak-row:last-child{border-bottom:0}',
    '.phone .eg-specialty-row span,.phone .eg-weak-row>div{min-width:0;overflow-wrap:anywhere}',
    '.phone .eg-specialty-row b,.phone .eg-weak-row>span{font-size:9px;font-variant-numeric:tabular-nums;white-space:nowrap}',
    '.phone .eg-weak-row>div{display:grid;gap:2px}',
    '.phone .eg-weak-row small,.phone .eg-muted{font-size:8px;color:var(--muted,#9eb5ce)}',
    '.phone .eg-burndown{width:100%;height:auto;display:block;overflow:visible;color:var(--muted,#9eb5ce)}',
    '.phone .eg-chart-legend{display:flex;gap:14px;font-size:8px;color:var(--muted,#9eb5ce);margin-top:4px}',
    '.phone .eg-chart-legend span{display:flex;align-items:center;gap:5px}',
    '.phone .eg-chart-legend i{width:12px;height:3px;border-radius:4px;display:inline-block}',
    '.phone .eg-legend-actual{background:#55D9B7}.phone .eg-legend-ideal{background:#4FC3F7}',
    '.phone .eg-week-bars{display:flex;align-items:end;justify-content:space-between;gap:6px;min-height:66px}',
    '.phone .eg-week-col{display:flex;flex:1;min-width:0;align-items:center;flex-direction:column;justify-content:end;gap:4px}',
    '.phone .eg-week-col b{font-size:8px;min-height:9px;font-variant-numeric:tabular-nums}',
    '.phone .eg-week-col i{width:72%;max-width:18px;min-height:3px;border-radius:6px 6px 2px 2px;background:linear-gradient(180deg,#42c3ef,#3484da)}',
    '.phone .eg-week-col small{font-size:8px;color:var(--muted,#9eb5ce)}',
    '.phone.light .eg-exam-tab,.phone.light .eg-add-exam{background:#f1f7ff;border-color:#c9def3;color:#234b72}',
    '.phone.light .eg-exam-tab.active{background:linear-gradient(135deg,#e4f1ff,#e2f8f5);border-color:#83bce9}',
    '.phone.light .eg-exam-name-row input,.phone.light .eg-date,.phone.light .eg-settings-grid input,.phone.light .eg-time{background:#fff;border-color:#d0e0f0;color:#173b5f}',
    '.phone.light .eg-metric{background:linear-gradient(145deg,#f3f8ff,#e9f3ff);border-color:#d4e5f5}',
    '.phone.light .eg-metric small{color:#5c7591}.phone.light .eg-target em{color:#117f83}',
    '.phone.light .eg-sentence{color:#254768}',
    '.phone.light .eg-today-card,.phone.light .eg-panel,.phone.light .eg-settings{background:linear-gradient(145deg,#f4f9ff,#eaf3fc);border-color:#d1e2f2}',
    '.phone.light .eg-status{color:#168369}.phone.light .eg-status-behind{color:#a75d21}',
    '.phone.light .eg-warning{background:#fff6e9;border-color:#f0d3aa;color:#8d5514}',
    '.phone.light .eg-specialty-row,.phone.light .eg-weak-row{border-color:#dce8f4}',
    '@media(max-width:360px){.phone .eg-today-card{grid-template-columns:84px minmax(0,1fr);}.phone .eg-ring-wrap{width:84px;height:84px}.phone .eg-coach{display:none}.phone .eg-lower-grid{grid-template-columns:1fr}.phone .eg-metric b{font-size:18px}}'
  ].join('');
  document.head.appendChild(style);

  try {
    if (window.__shbAndroidFeatures && window.__shbAndroidFeatures.clearLegacyExamReminders) {
      window.__shbAndroidFeatures.clearLegacyExamReminders();
    }
  } catch (_) {}
  updateAllReminders();
  scheduleMidnight();
  setTimeout(refreshIfNewLocalDay, 500);
  setInterval(refreshIfNewLocalDay, 60000);
  document.addEventListener('visibilitychange', refreshIfNewLocalDay);
  document.addEventListener('visibilitychange', function () {
    refreshIfNewLocalDay();
    if (!document.hidden) updateAllReminders();
  });
  window.addEventListener('focus', function () {
    refreshIfNewLocalDay();
    updateAllReminders();
  });

  // Recalculate the rolling reminder target whenever a new Question Bank answer is recorded.
  var reminderRefreshTimer = null;
  var originalQuestionAnswer = window.qAnswer;
  if (typeof originalQuestionAnswer === 'function') {
    window.qAnswer = function () {
      var result = originalQuestionAnswer.apply(this, arguments);
      if (appPage === 'examgoal') pageRender();
      if (reminderRefreshTimer) clearTimeout(reminderRefreshTimer);
      reminderRefreshTimer = setTimeout(function () {
        reminderRefreshTimer = null;
        updateAllReminders();
      }, 450);
      return result;
    };
  }
})();
