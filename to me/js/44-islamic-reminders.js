/* Shbace Islamic Reminders (تذكير إيماني): a small translucent in-app notice every 15 minutes of ACTIVE use.
   - Time counts only while the app is visible and the student is interacting (idle > 60 s is not counted).
     It is stored, so moving between pages, closing and reopening never resets it.
   - Never shown while the app is in the background; never blocks taps (only the notice itself takes pointer events).
   - Swipe left or right to dismiss; it also fades away by itself (longer text stays a little longer).
   - Touches only its own storage key; no student data is read or changed.

   CONTENT: edit the CONTENT object below, or add items at runtime without rebuilding anything:
     shbIslamicReminders.add('hadith', { t: 'text', s: 'optional second line', src: 'source (kept in data, not shown)' })
   A new category name is picked up automatically.
   Test in the console: shbIslamicReminders.show()  /  shbIslamicReminders.hide() */
(function () {
  'use strict';
  if (window.__shbIslamicReminders) return;
  window.__shbIslamicReminders = true;

  var INTERVAL_MS = 15 * 60 * 1000;
  var IDLE_MS = 60 * 1000;
  var KEY = 'shbace_islamic_reminders_v1';

  /* t = main text, s = optional short second line, src = source (stored with the data, not displayed).
     Quran text is kept exactly as approved. Sources of duas/adhkar are left empty until verified. */
  var CONTENT = {
    ayah: [
      { t: '﴿ وَمَا تَوْفِيقِي إِلَّا بِاللَّهِ ﴾', s: 'سرّ النجاح الحقيقي يبدأ من التوكل على الله.', src: 'هود: 88' },
      { t: '﴿ أَلَا بِذِكْرِ اللَّهِ تَطْمَئِنُّ الْقُلُوبُ ﴾', s: 'لا شيء يبعث الطمأنينة كذكر الله.', src: 'الرعد: 28' },
      { t: '﴿ إِنَّ مَعَ الْعُسْرِ يُسْرًا ﴾', s: 'وعد رباني بأن بعد كل ضيق هناك فرج.', src: 'الشرح: 6' },
      { t: '﴿ وَمَن يَتَوَكَّلْ عَلَى اللَّهِ فَهُوَ حَسْبُهُ ﴾', s: 'توكّل عليه، فهو خير وكيل.', src: 'الطلاق: 3' },
      { t: '﴿ لَا تَحْزَنْ إِنَّ اللَّهَ مَعَنَا ﴾', s: 'مهما اشتدت الظروف، لا تفقد الأمل.', src: 'التوبة: 40' },
      { t: '﴿ إِنَّ اللَّهَ مَعَ الصَّابِرِينَ ﴾', s: 'اصبر، فالله لا يضيع أجر الصابرين.', src: 'البقرة: 153' },
      { t: '﴿ وَهُوَ مَعَكُمْ أَيْنَ مَا كُنْتُمْ ﴾', src: 'الحديد: 4' },
      { t: '﴿ وَقُل رَّبِّ زِدْنِي عِلْمًا ﴾', s: 'اللهم اجعل علمنا نافعاً.', src: 'طه: 114' },
      { t: '﴿ وَعَسَىٰ أَن تَكْرَهُوا شَيْئًا وَهُوَ خَيْرٌ لَّكُمْ ﴾', s: 'ثق بأن اختيار الله لك خير.', src: 'البقرة: 216' },
      { t: '﴿ فَاذْكُرُونِي أَذْكُرْكُمْ ﴾', src: 'البقرة: 152' },
      { t: '﴿ وَبَشِّرِ الصَّابِرِينَ ﴾', src: 'البقرة: 155' },
      { t: '﴿ إِنَّ رَبِّي قَرِيبٌ مُّجِيبٌ ﴾', src: 'هود: 61' }
    ],
    dua: [
      { t: 'اللهم قُرَّ أعيننا بخير الأمور وخير الناس وخير الأيام والأقدار والأرزاق، إنك على كل شيء قدير.' },
      { t: 'اللهم اهدني وأصلح حالي، وهب لي بركةً في وقتي وعمري.' },
      { t: 'اللهم لا تجعل الدنيا أكبر همي ولا مبلغ علمي.' },
      { t: 'اللهم وفقني وأكرمني بخير ما أحب وأرضى.' },
      { t: 'اللهم لا تشمت بي أحداً من خلقك، وأبعدني عن الحرام والمنكرات والمعاصي، ويسر لي كل حلال يا الله.' },
      { t: 'اللهم إني أسألك باسمك العظيم أن تحفظني من فواجع الأقدار، ومن كل عين حاسدة، ومن كل شر مستتر.' },
      { t: 'اللهم إني ظلمت نفسي ظلماً كثيراً، ولا يغفر الذنوب إلا أنت، فاغفر لي مغفرة من عندك وارحمني، إنك أنت الغفور الرحيم.' },
      { t: 'اللهم بارك لنا في أوقاتنا، ووفقنا لما تحب وترضى.' },
      { t: 'اللهم ارزقنا راحة البال، وطمأنينة القلب، وجميل الأقدار.' },
      { t: 'اللهم لا سهل إلا ما جعلته سهلاً، وأنت تجعل الحَزْن إذا شئت سهلاً.' },
      { t: 'اللهم اجعل لنا من كل هم فرجاً، ومن كل ضيق مخرجاً.' },
      { t: 'اللهم ارزقنا علماً نافعاً، ورزقاً طيباً، وعملاً متقبلاً.' },
      { t: 'اللهم إني أسألك الهدى والتقى والعفاف والغنى.' },
      { t: 'يا مقلب القلوب، ثبت قلبي على دينك.' },
      { t: 'اللهم أعني على ذكرك وشكرك وحسن عبادتك.' },
      { t: 'اللهم إني أسألك العفو والعافية في الدنيا والآخرة.' },
      { t: 'رب اشرح لي صدري ويسر لي أمري.' },
      { t: 'اللهم اجعل القرآن ربيع قلبي ونور صدري.' }
    ],
    dhikr: [
      { t: 'اللهم صلِّ وسلم وبارك على نبينا محمد.' },
      { t: 'أكثروا من الصلاة والسلام على النبي محمد ﷺ.' },
      { t: 'اللهم صلِّ على محمد، صلاةً تملأ بها قلوبنا نوراً وطمأنينة.' },
      { t: 'سبحان الله وبحمده، سبحان الله العظيم.' },
      { t: 'أستغفر الله العظيم وأتوب إليه.' },
      { t: 'لا إله إلا أنت سبحانك إني كنت من الظالمين.' },
      { t: 'الحمد لله دائماً وأبداً.' },
      { t: 'سبحان الله، والحمد لله، ولا إله إلا الله، والله أكبر.' }
    ],
    khawater: [
      { t: 'حين تضيق بك الأرض… يكفي أن ترفع يديك إلى السماء. ♥️' },
      { t: 'ثمة سعادة في نهاية كل حزن، وثمة راحة بعد كل تعب، وثمة نور بعد كل ظلام، وثمة فرج بعد كل ألم.', s: '﴿ فَإِنَّ مَعَ الْعُسْرِ يُسْرًا ﴾', src: 'الشرح: 6' },
      { t: 'لا تنسَ أن تدعو، فربك يسمعك وإن لم يسمعك أحد.' },
      { t: 'اجعل بينك وبين الله دعوة لا يعلمها سواه.' },
      { t: 'اسعَ واجتهد، واترك النتائج على الله.' },
      { t: 'قد يتأخر ما تتمناه، لكن تدبير الله أجمل مما تتخيل.' },
      { t: 'لا تجعل انشغالك بالدنيا ينسيك نصيبك من ذكر الله.' },
      { t: 'كل دقيقة في طلب العلم، احتسب فيها الأجر وأخلص النية.' },
      { t: 'اجعل نيتك في طلب العلم نفع الناس وخدمة الخلق.' },
      { t: 'أخلص نيتك، واستعن بالله، وخذ بالأسباب.' },
      { t: 'لا تستصغر دعوة صادقة، فقد تغيّر بها أقدارك.' },
      { t: 'اطمئن، فرب الخير لا يأتي إلا بالخير.' },
      { t: 'لا تيأس من رحمة الله مهما تعثرت خطواتك.' },
      { t: 'ما دام الله يعلم ما في قلبك، فلا يشغلك سوء فهم الآخرين.' },
      { t: 'ابدأ يومك بذكر الله، واختمه بالحمد لله.' },
      { t: 'خذ بالأسباب وكأنها كل شيء، وتوكل على الله وكأنها لا شيء.' },
      { t: 'لا تقارن بدايتك بنهاية أحد، واصل سعيك.' },
      { t: 'اجعل قلبك مع الله، وخطواتك في طريق أحلامك.' }
    ]
  };

  /* ---------- saved state: usage time + "bags" so nothing repeats until everything has been shown ---------- */
  var state = { ms: 0, catBag: [], bags: {}, lastCat: '', lastItem: {} };
  try {
    var saved = JSON.parse(localStorage.getItem(KEY) || 'null');
    if (saved && isFinite(saved.ms)) {
      state.ms = Math.max(0, saved.ms);
      if (Array.isArray(saved.catBag)) state.catBag = saved.catBag.filter(function (c) { return typeof c === 'string'; });
      if (saved.bags && typeof saved.bags === 'object') state.bags = saved.bags;
      if (typeof saved.lastCat === 'string') state.lastCat = saved.lastCat;
      if (saved.lastItem && typeof saved.lastItem === 'object') state.lastItem = saved.lastItem;
    }
  } catch (_) {}
  function save() { try { localStorage.setItem(KEY, JSON.stringify(state)); } catch (_) {} }

  function shuffle(a) {
    for (var j = a.length - 1; j > 0; j--) {
      var k = Math.floor(Math.random() * (j + 1));
      var t = a[j]; a[j] = a[k]; a[k] = t;
    }
    return a;
  }
  /* The next value is taken with pop(); if it equals the previous one, swap it with another so it never repeats back to back. */
  function avoidRepeat(bag, last) {
    if (bag.length > 1 && bag[bag.length - 1] === last) {
      var t = bag[0]; bag[0] = bag[bag.length - 1]; bag[bag.length - 1] = t;
    }
  }

  function categories() {
    return Object.keys(CONTENT).filter(function (c) { return Array.isArray(CONTENT[c]) && CONTENT[c].length; });
  }

  function nextItem() {
    var cats = categories();
    if (!cats.length) return null;
    state.catBag = state.catBag.filter(function (c) { return cats.indexOf(c) >= 0; });
    if (!state.catBag.length) {
      state.catBag = shuffle(cats.slice());
      avoidRepeat(state.catBag, state.lastCat);
    }
    var cat = state.catBag.pop();
    var list = CONTENT[cat];
    var bag = (Array.isArray(state.bags[cat]) ? state.bags[cat] : []).filter(function (n) { return n >= 0 && n < list.length; });
    if (!bag.length) {
      bag = [];
      for (var i = 0; i < list.length; i++) bag.push(i);
      shuffle(bag);
      avoidRepeat(bag, state.lastItem[cat]);
    }
    var n = bag.pop();
    state.bags[cat] = bag;
    state.lastItem[cat] = n;
    state.lastCat = cat;
    return { cat: cat, item: list[n] };
  }

  /* ---------- activity tracking ---------- */
  var lastActive = Date.now();
  var lastTick = Date.now();
  var toast = null;
  var hideTimer = 0;

  function touch() { lastActive = Date.now(); }
  ['pointerdown', 'keydown', 'touchstart', 'scroll', 'wheel'].forEach(function (name) {
    window.addEventListener(name, touch, { passive: true, capture: true });
  });

  /* ---------- look: small translucent glass card, Arabic-friendly ---------- */
  var style = document.createElement('style');
  style.textContent =
    '.shb-ir-wrap{position:fixed;left:0;right:0;top:calc(env(safe-area-inset-top,0px) + 10px);z-index:2147482000;' +
    'display:flex;justify-content:center;pointer-events:none}' +
    '.shb-ir{pointer-events:auto;touch-action:pan-y;user-select:none;-webkit-user-select:none;box-sizing:border-box;' +
    'width:min(92vw,380px);display:flex;align-items:center;gap:10px;padding:10px 14px;border-radius:16px;' +
    'background:rgba(7,19,31,.72);-webkit-backdrop-filter:blur(14px) saturate(1.3);backdrop-filter:blur(14px) saturate(1.3);' +
    'border:1px solid rgba(120,214,255,.34);box-shadow:0 8px 24px rgba(0,0,0,.30),0 0 18px rgba(40,160,255,.14);color:#eaf4ff;' +
    'font-family:"Noto Naskh Arabic","Amiri","Geeza Pro","Segoe UI",Tahoma,system-ui,-apple-system,sans-serif;' +
    'opacity:0;transform:translateY(-14px);transition:transform .28s ease,opacity .28s ease}' +
    '.shb-ir.in{opacity:1;transform:translateY(0)}' +
    '.shb-ir-dot{flex:none;width:8px;height:8px;border-radius:50%;background:#78d6ff;box-shadow:0 0 10px rgba(56,170,255,.85)}' +
    '.shb-ir-body{flex:1;min-width:0;text-align:center}' +
    '.shb-ir-t{font-size:16px;line-height:1.75;font-weight:600}' +
    '.shb-ir-s{margin-top:2px;font-size:13px;line-height:1.7;color:#9fd8f5}' +
    '@media (prefers-reduced-motion:reduce){.shb-ir{transition:none}}';
  document.head.appendChild(style);

  function remove(el) {
    var wrap = el && el.parentNode;
    if (wrap && wrap.parentNode) wrap.parentNode.removeChild(wrap);
    if (toast === el) toast = null;
  }

  function dismiss(el, dir) {
    clearTimeout(hideTimer);
    if (!el) return;
    el.style.transition = 'transform .22s ease, opacity .22s ease';
    el.style.transform = dir ? 'translateX(' + (dir * Math.max(window.innerWidth, 360)) + 'px)' : 'translateY(-14px)';
    el.style.opacity = '0';
    setTimeout(function () { remove(el); }, 240);
  }

  function schedule(ms) {
    clearTimeout(hideTimer);
    hideTimer = setTimeout(function () { dismiss(toast, 0); }, ms);
  }

  function show() {
    if (toast) return;
    var pick = nextItem();
    if (!pick) return;
    var item = pick.item;

    var wrap = document.createElement('div');
    wrap.className = 'shb-ir-wrap';
    var el = document.createElement('div');
    el.className = 'shb-ir';
    el.setAttribute('role', 'status');
    el.setAttribute('aria-live', 'polite');
    el.setAttribute('lang', 'ar');
    el.setAttribute('data-kind', pick.cat);
    var dot = document.createElement('div');
    dot.className = 'shb-ir-dot';
    var body = document.createElement('div');
    body.className = 'shb-ir-body';
    var txt = document.createElement('div');
    txt.className = 'shb-ir-t';
    txt.setAttribute('dir', 'auto');
    txt.textContent = item.t;
    body.appendChild(txt);
    if (item.s) {
      var sub = document.createElement('div');
      sub.className = 'shb-ir-s';
      sub.setAttribute('dir', 'auto');
      sub.textContent = item.s;
      body.appendChild(sub);
    }
    el.appendChild(dot);
    el.appendChild(body);
    wrap.appendChild(el);
    document.body.appendChild(wrap);
    toast = el;
    state.ms = 0;
    save();

    var startX = 0, dx = 0, startT = 0, dragging = false;
    el.addEventListener('pointerdown', function (e) {
      dragging = true; startX = e.clientX; dx = 0; startT = Date.now();
      clearTimeout(hideTimer);
      el.style.transition = 'none';
      try { el.setPointerCapture(e.pointerId); } catch (_) {}
    });
    el.addEventListener('pointermove', function (e) {
      if (!dragging) return;
      dx = e.clientX - startX;
      el.style.transform = 'translateX(' + dx + 'px)';
      el.style.opacity = String(Math.max(0.25, 1 - Math.abs(dx) / 260));
    });
    function end() {
      if (!dragging) return;
      dragging = false;
      var speed = Math.abs(dx) / Math.max(1, Date.now() - startT);
      if (Math.abs(dx) > 70 || speed > 0.5) {
        dismiss(el, dx < 0 ? -1 : 1);
      } else {
        el.style.transition = 'transform .2s ease, opacity .2s ease';
        el.style.transform = 'translateY(0)';
        el.style.opacity = '1';
        schedule(4000);
      }
    }
    el.addEventListener('pointerup', end);
    el.addEventListener('pointercancel', end);

    requestAnimationFrame(function () { requestAnimationFrame(function () { el.classList.add('in'); }); });
    /* short phrases ~7 s; longer duas stay a little longer so they can be read, never more than 18 s */
    var len = String(item.t || '').length + String(item.s || '').length;
    schedule(Math.min(18000, 7000 + len * 55));
  }

  /* ---------- usage clock ---------- */
  var ticks = 0;
  setInterval(function () {
    var now = Date.now();
    var dt = now - lastTick;
    lastTick = now;
    if (dt > 5000) dt = 1000; /* device slept or tab was frozen: do not count the gap */
    var booted = window.__shbBooted === true;
    if (booted && document.visibilityState === 'visible' && now - lastActive < IDLE_MS) {
      state.ms += dt;
      if (state.ms >= INTERVAL_MS && !toast) show();
    }
    if (++ticks % 10 === 0) save();
  }, 1000);

  document.addEventListener('visibilitychange', function () {
    if (document.visibilityState === 'hidden') {
      clearTimeout(hideTimer);
      remove(toast); /* never leave a notice behind when the app goes to the background */
      save();
    }
  });
  window.addEventListener('pagehide', save);

  window.shbIslamicReminders = {
    show: show,
    hide: function () { clearTimeout(hideTimer); remove(toast); },
    reset: function () { state.ms = 0; save(); },
    add: function (category, item) {
      if (!category || !item || !item.t) return false;
      (CONTENT[category] = CONTENT[category] || []).push(item);
      return true;
    }
  };
})();
