/* SHBACE Medical · Universal Android Remote Control Engine v3
 * Declarative, validated UI and feature configuration for the native Android APK.
 * Remote data is never evaluated as JavaScript, HTML, CSS or an expression.
 */
(function () {
  'use strict';
  function nativeAndroid() {
    try {
      var c = window.Capacitor;
      return !!(c && typeof c.getPlatform === 'function' && c.getPlatform() === 'android' &&
        typeof c.isNativePlatform === 'function' && c.isNativePlatform());
    } catch (e) { return false; }
  }
  if (!nativeAndroid() || window.__SHBACE_REMOTE_CONTROL_V3__) return;
  var API = window.__SHBACE_REMOTE_CONTENT_API__;
  if (!API || typeof API.getCatalog !== 'function') return;

  var catalog = API.getCatalog() || {};
  var ui = catalog.ui && typeof catalog.ui === 'object' ? catalog.ui : {};
  var sidebar = ui.sidebar && typeof ui.sidebar === 'object' ? ui.sidebar : {};
  var features = ui.features && typeof ui.features === 'object' ? ui.features : {};
  var screens = ui.screens && typeof ui.screens === 'object' ? ui.screens : {};
  var BUILTIN = {
    subjects:1, grade:1, specialties:1, topics:1, questions:1, quiz:1, quizrun:1,
    quizresult:1, quizhistory:1, review:1, stats:1, search:1, settings:1,
    about:1, dedication:1, changelog:1, feedback:1, rate:1, pinned:1,
    saved:1, wrong:1, reported:1, notifs:1, timer:1, weak:1, menu:1
  };
  function safeList(name) {
    try { return typeof API[name] === 'function' ? API[name]() || [] : []; }
    catch (e) { return []; }
  }
  function indexById(items) {
    var out = Object.create(null);
    (Array.isArray(items) ? items : []).forEach(function (v) {
      if (v && typeof v.id === 'string') out[v.id] = v;
    });
    return out;
  }
  var resources = indexById(safeList('getResources'));
  var banks = indexById(safeList('getBanks'));
  var decks = indexById(safeList('getFlashcardDecks'));
  var remotePages = Object.create(null);
  (Array.isArray(ui.pages) ? ui.pages : []).forEach(function (p) {
    if (p && validId(p.id)) remotePages[p.id] = p;
  });

  function validId(v) { return /^[A-Za-z0-9_-]{1,48}$/.test(String(v || '')); }
  function hex(v) { return /^#[0-9a-fA-F]{3}(?:[0-9a-fA-F]{3})?$/.test(String(v || '')); }
  function esc(v) {
    return String(v == null ? '' : v).replace(/[&<>"']/g, function (c) {
      return { '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[c];
    });
  }
  function safeUrl(v) {
    try { var u = new URL(String(v || '')); return u.protocol === 'https:' ? u.href : ''; }
    catch (e) { return ''; }
  }
  function pageKey(id) { return 'shbRemotePage_' + String(id); }
  function routeId(route) {
    route = String(route || '');
    return route.indexOf('shbRemotePage_') === 0 ? route.slice(15) : route;
  }
  function currentPage() {
    try { return String(appPage || 'subjects'); } catch (e) { return 'subjects'; }
  }
  function featureFor(route) {
    route = routeId(route);
    if (['quiz','quizrun','quizresult','quizhistory'].indexOf(route) >= 0) return 'quiz';
    if (['review','weak'].indexOf(route) >= 0) return 'smartReview';
    if (route === 'stats') return 'statistics';
    if (route === 'questions') return 'questionBank';
    return '';
  }
  function visible(route) {
    var id = routeId(route), feature = featureFor(id), screen = screens[id];
    if (feature && features[feature] && features[feature].visible === false) return false;
    return !(screen && screen.visible === false);
  }
  function routeAction(item) {
    if (!item || typeof item !== 'object') return null;
    if (typeof item.targetPage === 'string' && BUILTIN[item.targetPage]) {
      return { action:'builtin', target:item.targetPage };
    }
    if (typeof item.pageId === 'string' && remotePages[item.pageId]) {
      return { action:'page', target:item.pageId };
    }
    var action = String(item.action || ''), target = String(item.target || '');
    if ((action === 'resource' && resources[target]) ||
        (action === 'bank' && banks[target]) || (action === 'deck' && decks[target])) {
      return { action:action, target:target };
    }
    return null;
  }
  function validAction(action, target) {
    if (action === 'builtin') return !!BUILTIN[target] && visible(target);
    if (action === 'page') return !!remotePages[target] && visible(pageKey(target));
    if (action === 'resource') return !!resources[target];
    if (action === 'bank') return !!banks[target];
    if (action === 'deck') return !!decks[target];
    return false;
  }

  /* ---------- appearance: named tokens and bounded values only ---------- */
  function installStyles() {
    if (document.getElementById('shb-remote-control-v3-styles')) return;
    var s = document.createElement('style');
    s.id = 'shb-remote-control-v3-styles';
    s.textContent =
      '.phone .shb-rc3-card{box-sizing:border-box;padding:calc(14px * var(--shb-remote-spacing-scale,1));margin:calc(12px * var(--shb-remote-spacing-scale,1)) 0;border:1px solid var(--shb-remote-border,rgba(130,170,210,.18));border-radius:var(--shb-remote-card-radius,16px);background:var(--shb-remote-card,rgba(20,38,62,.55));color:var(--shb-remote-text,inherit)}' +
      '.phone .shb-rc3-card h3{margin:0 0 7px;font-size:1rem}.phone .shb-rc3-card p{margin:0;line-height:var(--shb-remote-line-height,1.65);white-space:pre-wrap}' +
      '.phone .shb-rc3-list{padding-inline-start:22px;line-height:var(--shb-remote-line-height,1.75)}.phone .shb-rc3-metric{display:flex;flex-direction:column;gap:4px;padding:calc(14px * var(--shb-remote-spacing-scale,1));border-radius:var(--shb-remote-card-radius,14px);background:var(--shb-remote-surface,rgba(20,38,62,.5));border:1px solid var(--shb-remote-border,rgba(130,170,210,.18));color:var(--shb-remote-text,inherit)}' +
      '.phone .shb-rc3-metric b{font-size:1.35rem}.phone .shb-rc3-metric small{color:var(--shb-remote-muted,inherit)}.phone .shb-rc3-spacer{display:block;width:100%;pointer-events:none}' +
      '.phone .shb-remote-top-nav{margin:8px 0 14px!important}' +
      '.phone .shb-remote-ui-card,.phone .shb-remote-announcement{border-color:var(--shb-remote-border,inherit);border-radius:var(--shb-remote-card-radius,14px);background:var(--shb-remote-card,inherit);color:var(--shb-remote-text,inherit)}' +
      '.phone .shb-remote-ui-notice{border-color:var(--shb-remote-border,inherit);border-radius:var(--shb-remote-card-radius,14px);background:var(--shb-remote-surface,inherit);color:var(--shb-remote-text,inherit)}' +
      '.phone .shb-remote-announcement p,.phone .shb-remote-ui-text{line-height:var(--shb-remote-line-height,1.75)}' +
      '.phone .shb-remote-ui-heading{color:var(--shb-remote-text,inherit)}.phone .shb-remote-ui-card small,.phone .shb-remote-announcement small{color:var(--shb-remote-muted,inherit)}' +
      '.phone .shb-rc3-card .success,.phone .shb-remote-ui-success{color:var(--shb-remote-success,inherit)}.phone .shb-rc3-card .danger,.phone .shb-remote-ui-danger{color:var(--shb-remote-danger,inherit)}';
    document.head.appendChild(s);
  }
  function applyAppearance() {
    var a = ui.appearance && typeof ui.appearance === 'object' ? ui.appearance : {};
    var root = document.documentElement;
    var colorMap = {
      accentColor:['--mint','--accent'],
      accentSoft:['--mint-soft'],
      backgroundColor:['--shb-remote-background'],
      surfaceColor:['--shb-remote-surface'],
      surfaceAltColor:['--shb-remote-surface-alt'],
      cardColor:['--shb-remote-card'],
      textColor:['--shb-remote-text'],
      mutedColor:['--shb-remote-muted'],
      borderColor:['--shb-remote-border'],
      successColor:['--shb-remote-success'],
      dangerColor:['--shb-remote-danger'],
      warningColor:['--shb-remote-warning']
    };
    Object.keys(colorMap).forEach(function (key) {
      colorMap[key].forEach(function (token) { root.style.removeProperty(token); });
      if (hex(a[key])) colorMap[key].forEach(function (token) { root.style.setProperty(token, a[key]); });
    });
    ['--shb-remote-font-scale','--shb-remote-card-radius','--shb-remote-line-height','--shb-remote-spacing-scale']
      .forEach(function (token) { root.style.removeProperty(token); });
    var fontScale = Number(a.fontScale);
    if (Number.isFinite(fontScale) && fontScale >= .85 && fontScale <= 1.2) {
      root.style.setProperty('--shb-remote-font-scale', String(fontScale));
    }
    if (Number.isInteger(a.cardRadius) && a.cardRadius >= 6 && a.cardRadius <= 32) {
      root.style.setProperty('--shb-remote-card-radius', a.cardRadius + 'px');
    }
    var lineHeight = Number(a.lineHeight);
    if (Number.isFinite(lineHeight) && lineHeight >= 1.2 && lineHeight <= 1.9) {
      root.style.setProperty('--shb-remote-line-height', String(lineHeight));
    }
    var spacingScale = Number(a.spacingScale);
    if (Number.isFinite(spacingScale) && spacingScale >= .8 && spacingScale <= 1.2) {
      root.style.setProperty('--shb-remote-spacing-scale', String(spacingScale));
    }
    if (a.density === 'compact' || a.density === 'comfortable') {
      root.setAttribute('data-shb-remote-density', a.density);
    } else {
      root.removeAttribute('data-shb-remote-density');
    }
  }

  /* ---------- safe reusable blocks ---------- */
  function actionButton(label, icon, action, target) {
    if (!validAction(action, target)) return '';
    return '<button type="button" class="btn block shb-rc3-block" data-shb-action="' +
      esc(action) + '" data-shb-target="' + esc(target) + '">' +
      (icon ? '<span aria-hidden="true">' + esc(icon) + '</span> ' : '') + esc(label) + '</button>';
  }
  function renderBlock(b) {
    if (!b || typeof b !== 'object') return '';
    var t = String(b.type || '');
    if (t === 'heading') {
      var lv = Number(b.level) === 3 ? 3 : 2;
      return '<h' + lv + ' class="shb-rc3-block">' + esc(b.text) + '</h' + lv + '>';
    }
    if (t === 'text') return '<p class="shb-rc3-block" style="white-space:pre-wrap;line-height:1.7">' + esc(b.text) + '</p>';
    if (t === 'notice') {
      var tone = ['info','success','warning','neutral'].indexOf(String(b.tone || 'info')) >= 0 ? String(b.tone || 'info') : 'info';
      return '<section class="card shb-rc3-card shb-tone-' + tone + '">' +
        (b.title ? '<b>' + esc(b.title) + '</b>' : '') + '<p>' + esc(b.text) + '</p></section>';
    }
    if (t === 'divider') return '<hr class="shb-rc3-block shb-remote-ui-divider">';
    if (t === 'spacer') {
      var size = Math.max(4, Math.min(64, Math.round(Number(b.size) || 12)));
      return '<span class="shb-rc3-spacer" aria-hidden="true" style="height:' + size + 'px"></span>';
    }
    if (t === 'image') {
      var src = '';
      try { src = API.assetData(String(b.file || '')) || ''; } catch (e) {}
      return src ? '<img class="shb-rc3-block shb-remote-ui-image" src="' + src + '" alt="' + esc(b.alt || '') + '" loading="lazy">' : '';
    }
    if (t === 'link') {
      var href = safeUrl(b.url);
      return href ? '<a class="btn block shb-rc3-block" href="' + esc(href) + '" target="_blank" rel="noopener noreferrer">' + esc(b.label) + '</a>' : '';
    }
    if (t === 'button') return actionButton(b.label, b.icon, b.action, b.target);
    if (t === 'card') return '<section class="card shb-rc3-card">' +
      (b.icon ? '<div aria-hidden="true">' + esc(b.icon) + '</div>' : '') +
      (b.title ? '<h3>' + esc(b.title) + '</h3>' : '') +
      (b.text ? '<p>' + esc(b.text) + '</p>' : '') + '</section>';
    if (t === 'list') {
      var items = Array.isArray(b.items) ? b.items.slice(0,30) : [];
      return items.length ? '<ul class="shb-rc3-list">' + items.map(function (x) { return '<li>' + esc(x) + '</li>'; }).join('') + '</ul>' : '';
    }
    if (t === 'metric') return '<div class="shb-rc3-metric"><b>' + esc(b.value) + '</b><small>' + esc(b.label) + '</small></div>';
    if (t === 'resourceList') return '<div class="shb-remote-ui-list">' + (Array.isArray(b.ids) ? b.ids : []).filter(function (id) {
      return !!resources[id];
    }).map(function (id) { return actionButton(resources[id].title, resources[id].type || 'File', 'resource', id); }).join('') + '</div>';
    if (t === 'bankList') return '<div class="shb-remote-ui-list">' + (Array.isArray(b.ids) ? b.ids : []).filter(function (id) {
      return !!banks[id];
    }).map(function (id) {
      var item = banks[id];
      return actionButton(item.bank && item.bank.label || item.label || 'Question bank',
        item.bank && item.bank.icon || '✚', 'bank', id);
    }).join('') + '</div>';
    if (t === 'flashcardDeckList') return '<div class="shb-remote-ui-list">' + (Array.isArray(b.ids) ? b.ids : []).filter(function (id) {
      return !!decks[id];
    }).map(function (id) { return actionButton(decks[id].title || 'Flashcards', '▤', 'deck', id); }).join('') + '</div>';
    return '';
  }
  function renderBlocks(blocks) {
    return (Array.isArray(blocks) ? blocks : []).map(renderBlock).join('');
  }

  /* ---------- header ---------- */
  var header = ui.header && typeof ui.header === 'object' ? ui.header : null;
  var oldHeader = window.appHeader;
  if (header && typeof oldHeader === 'function') {
    window.appHeader = function (label) {
      if (header.enabled === false) return '';
      var brand = typeof header.brand === 'string' && header.brand.trim() ? header.brand.trim() : 'Shbace Medical';
      var subtitle = typeof header.subtitle === 'string' ? header.subtitle : String(label || '');
      var logo = '';
      if (header.logoFile) { try { logo = API.assetData(String(header.logoFile)) || ''; } catch (e) {} }
      var logoHtml = logo ? '<img class="hdr-ic" src="' + logo + '" alt="' + esc(brand) + '">' :
        '<span class="hdr-ic" aria-hidden="true">' + esc(header.icon || '🩺') + '</span>';
      var actions = Array.isArray(header.actions) ? header.actions.slice(0,5) : null;
      if (!actions) {
        actions = [];
        if (header.showThemeToggle !== false) actions.push({action:'theme',label:'Theme',icon:'◐'});
        if (header.showNotifications !== false) actions.push({action:'builtin',target:'notifs',label:'Notifications',icon:'♧'});
        if (header.showSettings !== false) actions.push({action:'builtin',target:'settings',label:'Settings',icon:'⚙'});
      }
      var actionHtml = actions.map(function (item) {
        if (!item || typeof item !== 'object') return '';
        var action = String(item.action || ''), target = String(item.target || '');
        if (action === 'theme') return '<button class="hdr-btn" type="button" aria-label="' + esc(item.label || 'Theme') + '" data-shb-remote-theme="1">' + esc(item.icon || '◐') + '</button>';
        if (action === 'drawer') return '<button class="hdr-btn" type="button" aria-label="' + esc(item.label || 'Menu') + '" data-shb-remote-drawer="1">' + esc(item.icon || '☰') + '</button>';
        if (!validAction(action, target)) return '';
        return '<button class="hdr-btn" type="button" aria-label="' + esc(item.label || target) +
          '" data-shb-action="' + esc(action) + '" data-shb-target="' + esc(target) + '">' + esc(item.icon || '›') + '</button>';
      }).join('');
      var menu = header.showMenu === false ? '' :
        '<button class="menu-btn" type="button" aria-label="Open menu" data-shb-remote-drawer="1">☰</button>';
      return '<div class="phone-appbar hdr2 shb-remote-header">' + menu +
        '<div class="hdr-brand2">' + logoHtml + '<div class="hdr-tx"><b>' + esc(brand) +
        '</b><span><small>' + esc(subtitle) + '</small></span></div></div>' +
        '<div class="hdr-actions">' + actionHtml + '</div></div>';
    };
  }

  /* ---------- bottom navigation ---------- */
  var bottom = ui.bottomNavigation && typeof ui.bottomNavigation === 'object' ? ui.bottomNavigation : null;
  var oldNav = window.appNav;
  function navItems() {
    return bottom && Array.isArray(bottom.items) ? bottom.items.filter(function (item) {
      if (!item || item.enabled === false || typeof item.label !== 'string' || !item.label.trim()) return false;
      var target = routeAction(item);
      if (!target) return false;
      if (target.action === 'builtin' && !visible(target.target)) return false;
      if (target.action === 'page' && !visible(pageKey(target.target))) return false;
      return true;
    }).slice().sort(function (a,b) { return Number(a.order || 0) - Number(b.order || 0); }).slice(0,6) : [];
  }
  if (bottom && typeof oldNav === 'function') {
    window.appNav = function () {
      if (bottom.enabled === false || bottom.position === 'hidden') return '';
      var items = navItems();
      if (!items.length) return '';
      return '<div class="app-nav shb-remote-bottom-nav" aria-label="Main navigation" style="grid-template-columns:repeat(' +
        items.length + ',minmax(0,1fr))">' + items.map(function (item) {
          var target = routeAction(item), current = currentPage();
          var active = target.action === 'builtin' ? current === target.target :
            (target.action === 'page' ? current === pageKey(target.target) : false);
          return '<button type="button" class="' + (active ? 'active' : '') +
            '" aria-label="' + esc(item.label) + '" title="' + esc(item.label) +
            '" data-shb-action="' + esc(target.action) + '" data-shb-target="' + esc(target.target) +
            '"><span aria-hidden="true">' + esc(item.icon || '•') + '</span><span>' + esc(item.label) + '</span></button>';
        }).join('') + '</div>';
    };
  }

  /* ---------- extend existing sidebar config ---------- */
  if (window.__SHBACE_REMOTE_DRAWER_CONFIG__) {
    var drawerConfig = window.__SHBACE_REMOTE_DRAWER_CONFIG__;
    drawerConfig.itemOrder = Array.isArray(sidebar.itemOrder) ? sidebar.itemOrder.slice() : [];
    drawerConfig.itemGroups = sidebar.itemGroups && typeof sidebar.itemGroups === 'object' ? sidebar.itemGroups : {};
    var hidden = Array.isArray(drawerConfig.hiddenItems) ? drawerConfig.hiddenItems.slice() : [];
    Object.keys(features).forEach(function (name) {
      if (features[name] && features[name].visible === false) {
        var routes = name === 'quiz' ? ['quiz','quizrun','quizresult','quizhistory'] :
          name === 'smartReview' ? ['review','weak'] : name === 'statistics' ? ['stats'] :
          name === 'questionBank' ? ['questions'] : [];
        routes.forEach(function (route) { hidden.push(route); });
      }
    });
    Object.keys(screens).forEach(function (route) {
      if (screens[route] && screens[route].visible === false) hidden.push(route);
    });
    drawerConfig.hiddenItems = Array.from(new Set(hidden.map(String)));
  }
  if (typeof window.shbRemoteMenuAction === 'function') {
    var oldAction = window.shbRemoteMenuAction;
    window.shbRemoteMenuAction = function (action, target) {
      if (action === 'builtin' && !visible(target)) return false;
      if (action === 'page' && !visible(pageKey(target))) return false;
      return oldAction.apply(this, arguments);
    };
  }

  /* ---------- screen-level layout slots ---------- */
  function configForScreen(route) {
    var id = routeId(route);
    return screens[route] || screens[id] || null;
  }
  function addBlocks(parent, blocks, before, marker) {
    if (!parent || !Array.isArray(blocks) || !blocks.length) return;
    var html = window.SHBACEPageBuilder ?
      window.SHBACEPageBuilder.render(blocks, renderBlock, marker) : renderBlocks(blocks);
    if (!html) return;
    var section = document.createElement('section');
    section.className = 'shb-rc3-page-slot ' + marker;
    section.innerHTML = html;
    if (before && parent.firstChild) parent.insertBefore(section, parent.firstChild);
    else parent.appendChild(section);
  }
  function applyScreenLayout() {
    var route = currentPage();
    var screen = document.querySelector('#phoneContent .screen.app-shell') ||
      document.querySelector('#phoneContent .screen');
    if (!screen) return;
    var root = screen.querySelector('.rs') || screen;
    var globalBlocks = ui.globalBlocks && typeof ui.globalBlocks === 'object' ? ui.globalBlocks : {};
    var cfg = configForScreen(route) || {};
    addBlocks(root, globalBlocks.before, true, 'shb-rc3-global');
    if (typeof cfg.title === 'string' && cfg.title.trim()) {
      var heading = root.querySelector('h1');
      var head = screen.querySelector('.app-head-title');
      if (heading) heading.textContent = cfg.title;
      if (head) head.textContent = cfg.title;
    }
    if (typeof cfg.subtitle === 'string') {
      var sub = root.querySelector('.sub');
      if (sub) sub.textContent = cfg.subtitle;
    }
    if (hex(cfg.backgroundColor)) screen.style.backgroundColor = cfg.backgroundColor;
    addBlocks(root, cfg.prepend, true, 'shb-rc3-screen-before');
    addBlocks(root, cfg.append, false, 'shb-rc3-screen-after');
    addBlocks(root, globalBlocks.after, false, 'shb-rc3-global');
  }
  function positionNavigation() {
    if (!bottom || bottom.enabled === false || bottom.position !== 'top') return;
    var nav = document.querySelector('#phoneContent .shb-remote-bottom-nav');
    if (!nav) return;
    nav.classList.add('shb-remote-top-nav');
    var screen = nav.closest('.screen');
    if (!screen || nav.parentNode !== screen) return;
    var headerNode = screen.querySelector('.phone-appbar');
    if (headerNode && headerNode.parentNode === screen) headerNode.insertAdjacentElement('afterend', nav);
    else screen.insertBefore(nav, screen.firstChild);
  }

  installStyles();
  applyAppearance();
  if (features.quiz && typeof window.__shbApplyRemoteQuizOptions === 'function') {
    try { window.__shbApplyRemoteQuizOptions(features.quiz); } catch (e) { console.warn('Remote Quiz settings skipped:', e); }
  }
  if (features.smartReview && typeof window.__shbApplyRemoteSmartReviewOptions === 'function') {
    try { window.__shbApplyRemoteSmartReviewOptions(features.smartReview); } catch (e) { console.warn('Remote Smart Review settings skipped:', e); }
  }

  document.addEventListener('click', function (event) {
    var theme = event.target && event.target.closest ? event.target.closest('[data-shb-remote-theme]') : null;
    var menu = event.target && event.target.closest ? event.target.closest('[data-shb-remote-drawer]') : null;
    if (theme) {
      if (typeof window.toggleTheme === 'function') window.toggleTheme();
      event.preventDefault();
    } else if (menu) {
      if (typeof window.toggleDrawer === 'function') window.toggleDrawer();
      event.preventDefault();
    }
  }, true);

  var previousRender = window.renderAppDemo;
  if (typeof previousRender === 'function') {
    window.renderAppDemo = function () {
      var result = previousRender.apply(this, arguments);
      try { applyScreenLayout(); positionNavigation(); }
      catch (e) { console.warn('Remote screen layout skipped:', e); }
      return result;
    };
  }
  window.__SHBACE_REMOTE_CONTROL_V3__ = {
    version:3,
    nativeAndroidOnly:true,
    refresh:function () {
      applyAppearance();
      if (typeof window.renderAppDemo === 'function') window.renderAppDemo();
      return true;
    }
  };
})();