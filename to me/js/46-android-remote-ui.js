/* SHBACE Medical · Android Remote UI Experience v1
 * Declarative remote navigation/pages. This module is Android APK only.
 * It accepts JSON data; it never evaluates or imports remote JavaScript.
 */
(function () {
  'use strict';

  function isNativeAndroid() {
    try {
      return !!(window.Capacitor &&
        typeof window.Capacitor.getPlatform === 'function' &&
        window.Capacitor.getPlatform() === 'android' &&
        typeof window.Capacitor.isNativePlatform === 'function' &&
        window.Capacitor.isNativePlatform());
    } catch (e) { return false; }
  }
  if (!isNativeAndroid() || window.__SHBACE_ANDROID_REMOTE_UI_V1__) return;
  var API = window.__SHBACE_REMOTE_CONTENT_API__;
  if (!API || typeof window.__shbRegisterPage !== 'function') return;
  window.__SHBACE_ANDROID_REMOTE_UI_V1__ = true;

  var catalog = API.getCatalog();
  var ui = catalog && catalog.ui && typeof catalog.ui === 'object' ? catalog.ui : {};
  var sidebar = ui.sidebar && typeof ui.sidebar === 'object' ? ui.sidebar : {};
  var pages = Array.isArray(ui.pages) ? ui.pages : [];
  var pageById = Object.create(null);
  var resourceById = Object.create(null);
  var bankById = Object.create(null);
  var deckById = Object.create(null);
  var BUILTIN_PAGES = {
    subjects:1, specialties:1, topics:1, questions:1, quiz:1, quizrun:1,
    quizresult:1, quizhistory:1, review:1, stats:1, search:1, settings:1,
    about:1, changelog:1, feedback:1, rate:1, pinned:1, saved:1, wrong:1,
    reported:1, notifs:1, timer:1
  };

  function esc(value) {
    return String(value == null ? '' : value).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  function validId(value) { return /^[A-Za-z0-9_-]{1,48}$/.test(String(value || '')); }
  function pageKey(id) { return 'shbRemotePage_' + String(id); }
  function safeUrl(value) {
    try {
      var url = new URL(String(value || ''));
      return url.protocol === 'https:' ? url.href : '';
    } catch (e) { return ''; }
  }
  function toArray(value) { return Array.isArray(value) ? value : []; }

  API.getResources().forEach(function (item) { resourceById[item.id] = item; });
  API.getBanks().forEach(function (item) { bankById[item.id] = item; });
  API.getFlashcardDecks().forEach(function (item) { deckById[item.id] = item; });

  var templates = Array.isArray(ui.templates) ? ui.templates : [];
  var templateById = Object.create(null);
  var BUILTIN_CONDITIONS = {
    always: true, hasBanks: true, hasResources: true,
    hasFlashcardDecks: true, hasLearningContent: true
  };

  function validateBlocks(blocks, allowSlots, depth, budget) {
    if (!Array.isArray(blocks) || blocks.length > 60 || depth > 4) return false;
    for (var i = 0; i < blocks.length; i++) {
      budget.count++;
      if (budget.count > 300 || !validateBlock(blocks[i], allowSlots, depth, budget)) return false;
    }
    return true;
  }

  function validateBlock(block, allowSlots, depth, budget) {
    if (!block || typeof block !== 'object' || Array.isArray(block)) return false;
    var type = String(block.type || '');
    var allowed = ['heading', 'text', 'notice', 'divider', 'image', 'resourceList',
      'bankList', 'flashcardDeckList', 'link', 'button', 'card', 'list', 'metric',
      'spacer', 'section', 'grid', 'tabs', 'accordion', 'when', 'slot'];
    if (allowed.indexOf(type) < 0) return false;
    if (type === 'heading' || type === 'text') {
      return typeof block.text === 'string' && block.text.length <= 3000;
    }
    if (type === 'notice') {
      return typeof block.text === 'string' && block.text.length <= 3000 &&
        ['info', 'success', 'warning', 'neutral'].indexOf(String(block.tone || 'info')) >= 0;
    }
    if (type === 'image') return typeof block.file === 'string' && block.file.length <= 240;
    if (type === 'link') return typeof block.label === 'string' && !!safeUrl(block.url);
    if (type === 'button') {
      var action = String(block.action || ''), target = String(block.target || '');
      if (typeof block.label !== 'string' || !validId(target)) return false;
      if (action === 'page') return !!pageById[target];
      if (action === 'builtin') return !!BUILTIN_PAGES[target];
      if (action === 'resource') return !!resourceById[target];
      if (action === 'bank') return !!bankById[target];
      if (action === 'deck') return !!deckById[target];
      return false;
    }
    if (type === 'resourceList' || type === 'bankList' || type === 'flashcardDeckList') {
      if (!Array.isArray(block.ids) || block.ids.length > 120) return false;
      var source = type === 'resourceList' ? resourceById :
        (type === 'bankList' ? bankById : deckById);
      return block.ids.every(function (id) { return !!source[String(id)]; });
    }
    if (type === 'card') {
      if (block.title != null && typeof block.title !== 'string') return false;
      if (block.text != null && typeof block.text !== 'string') return false;
      return block.blocks == null || validateBlocks(block.blocks, allowSlots, depth + 1, budget);
    }
    if (type === 'list') {
      return Array.isArray(block.items) && block.items.length <= 30 &&
        block.items.every(function (item) { return typeof item === 'string' && item.length <= 300; });
    }
    if (type === 'metric') {
      return (typeof block.label === 'string' || typeof block.label === 'number') &&
        (typeof block.value === 'string' || typeof block.value === 'number');
    }
    if (type === 'spacer') return Number.isInteger(block.size) && block.size >= 4 && block.size <= 64;
    if (type === 'section') {
      return ['stack', 'row', 'grid'].indexOf(String(block.layout || 'stack')) >= 0 &&
        validateBlocks(block.blocks, allowSlots, depth + 1, budget);
    }
    if (type === 'grid') {
      return Number.isInteger(block.columns) && block.columns >= 1 && block.columns <= 3 &&
        validateBlocks(block.blocks, allowSlots, depth + 1, budget);
    }
    if (type === 'tabs' || type === 'accordion') {
      if (!Array.isArray(block.items) || block.items.length < (type === 'tabs' ? 2 : 1) ||
          block.items.length > (type === 'tabs' ? 6 : 12)) return false;
      return block.items.every(function (item) {
        return item && typeof item.label === 'string' && item.label.trim() &&
          (type !== 'tabs' || validId(item.id)) &&
          validateBlocks(item.blocks, allowSlots, depth + 1, budget);
      });
    }
    if (type === 'when') {
      return !!BUILTIN_CONDITIONS[String(block.condition || '')] &&
        validateBlocks(block.blocks, allowSlots, depth + 1, budget);
    }
    if (type === 'slot') {
      return allowSlots === true && /^[a-z][a-z0-9_-]{0,31}$/.test(String(block.name || ''));
    }
    return type === 'divider';
  }

  function collectTemplateSlots(blocks, found) {
    (blocks || []).forEach(function (block) {
      if (!block || typeof block !== 'object') return;
      if (block.type === 'slot') found[String(block.name)] = true;
      if (Array.isArray(block.blocks)) collectTemplateSlots(block.blocks, found);
      (block.items || []).forEach(function (item) {
        if (item && Array.isArray(item.blocks)) collectTemplateSlots(item.blocks, found);
      });
    });
  }

  templates.forEach(function (template) {
    if (!template || !validId(template.id) || templateById[template.id] ||
        !Array.isArray(template.blocks)) return;
    var budget = { count: 0 };
    if (!validateBlocks(template.blocks, true, 0, budget)) return;
    var slots = Object.create(null);
    collectTemplateSlots(template.blocks, slots);
    templateById[template.id] = { source: template, slots: slots };
  });

  pages.forEach(function (page) {
    if (!page || !validId(page.id) || typeof page.title !== 'string' ||
        !page.title.trim() || pageById[page.id]) return;
    var budget = { count: 0 };
    if (page.templateId != null) {
      var template = templateById[String(page.templateId)];
      if (!template || !page.slots || typeof page.slots !== 'object' || Array.isArray(page.slots)) return;
      var slotNames = Object.keys(page.slots);
      if (!slotNames.every(function (name) {
        return !!template.slots[name] &&
          validateBlocks(page.slots[name], false, 0, budget);
      })) return;
      if (!slotNames.length && Object.keys(template.slots).length) return;
    } else if (!validateBlocks(page.blocks, false, 0, budget)) return;
    pageById[page.id] = page;
  });

  function openTarget(action, target) {
    var key = String(target || '');
    if (action === 'page' && pageById[key]) {
      window.shbRemoteOpenPage(key);
      return true;
    }
    if (action === 'builtin' && BUILTIN_PAGES[key]) {
      appPage = key;
      window.renderAppDemo();
      return true;
    }
    if (action === 'resource' && resourceById[key]) return API.openResource(key);
    if (action === 'bank' && bankById[key]) { API.openBank(key); return true; }
    if (action === 'deck' && deckById[key]) { API.openDeck(key); return true; }
    return false;
  }
  window.shbRemoteMenuAction = openTarget;

  function cardButton(title, description, icon, action, target, count) {
    return '<button type="button" class="card sc shb-remote-ui-card" data-shb-action="' +
      esc(action) + '" data-shb-target="' + esc(target) + '">' +
      '<span class="shb-remote-ui-icon">' + esc(icon || '✚') + '</span>' +
      '<span class="spc-tx"><h3>' + esc(title) + '</h3><span class="meta">' +
      esc(description || '') + (count ? ' · ' + esc(count) : '') +
      '</span></span><span class="chev">›</span></button>';
  }

  var tabSequence = 0;

  function conditionMatches(condition) {
    if (condition === 'always') return true;
    if (condition === 'hasBanks') return Object.keys(bankById).length > 0;
    if (condition === 'hasResources') return Object.keys(resourceById).length > 0;
    if (condition === 'hasFlashcardDecks') return Object.keys(deckById).length > 0;
    if (condition === 'hasLearningContent') {
      return Object.keys(bankById).length + Object.keys(resourceById).length +
        Object.keys(deckById).length > 0;
    }
    return false;
  }

  function renderBlocks(blocks, page) {
    return toArray(blocks).map(function (block) { return renderBlock(block, page); }).join('');
  }

  function renderTabs(block, page) {
    var id = 'shb-remote-tabset-' + (++tabSequence);
    var nav = block.items.map(function (item, index) {
      return '<button type="button" role="tab" class="shb-remote-ui-tab" data-shb-remote-tab-index="' +
        index + '" aria-selected="' + (index === 0 ? 'true' : 'false') + '">' +
        esc(item.label) + '</button>';
    }).join('');
    var panes = block.items.map(function (item, index) {
      return '<section role="tabpanel" class="shb-remote-ui-tab-panel" data-shb-remote-tab-panel="' +
        index + '"' + (index === 0 ? '' : ' hidden') + '>' +
        renderBlocks(item.blocks, page) + '</section>';
    }).join('');
    return '<div class="shb-remote-ui-tabs" data-shb-remote-tabset="' + id + '">' +
      '<div class="shb-remote-ui-tabs-nav" role="tablist">' + nav + '</div>' +
      '<div class="shb-remote-ui-tabs-panels">' + panes + '</div></div>';
  }

  function renderBlock(block, page) {
    var type = String(block.type || '');
    if (type === 'heading') {
      var level = Number(block.level) === 3 ? 3 : 2;
      return '<h' + level + ' class="shb-remote-ui-heading">' + esc(block.text) + '</h' + level + '>';
    }
    if (type === 'text') return '<p class="shb-remote-ui-text">' + esc(block.text) + '</p>';
    if (type === 'notice') {
      var tone = ['info', 'success', 'warning', 'neutral'].indexOf(String(block.tone || 'info')) >= 0
        ? String(block.tone || 'info') : 'info';
      return '<div class="card shb-remote-ui-notice shb-tone-' + tone + '">' +
        (block.title ? '<b>' + esc(block.title) + '</b>' : '') +
        '<div>' + esc(block.text) + '</div></div>';
    }
    if (type === 'divider') return '<hr class="shb-remote-ui-divider">';
    if (type === 'image') {
      var src = API.assetData(String(block.file || ''));
      return src ? '<img class="shb-remote-ui-image" src="' + src + '" alt="' +
        esc(block.alt || '') + '" loading="lazy">' : '';
    }
    if (type === 'link') {
      var href = safeUrl(block.url);
      return href ? '<a class="btn block shb-remote-ui-link" href="' + esc(href) +
        '" target="_blank" rel="noopener noreferrer">' + esc(block.label) + '</a>' : '';
    }
    if (type === 'button') {
      return '<button type="button" class="btn primary block shb-remote-ui-button" data-shb-action="' +
        esc(block.action) + '" data-shb-target="' + esc(block.target) + '">' +
        esc(block.label) + '</button>';
    }
    if (type === 'resourceList') {
      var resourceHtml = toArray(block.ids).filter(function (id) { return !!resourceById[id]; }).map(function (id) {
        var item = resourceById[id];
        return cardButton(item.title, item.description || item.source || item.type.toUpperCase(),
          item.type.toUpperCase(), 'resource', item.id);
      }).join('');
      return resourceHtml ? '<div class="shb-remote-ui-list">' + resourceHtml + '</div>' :
        '<p class="meta">No resources are available in this section yet.</p>';
    }
    if (type === 'bankList') {
      var bankHtml = toArray(block.ids).filter(function (id) { return !!bankById[id]; }).map(function (id) {
        var item = bankById[id];
        return cardButton(item.bank.label, item.bank.description || 'Open question bank', item.bank.icon || '✚',
          'bank', item.id, item.count + ' questions');
      }).join('');
      return bankHtml ? '<div class="shb-remote-ui-list">' + bankHtml + '</div>' :
        '<p class="meta">No question banks are available in this section yet.</p>';
    }
    if (type === 'flashcardDeckList') {
      var deckHtml = toArray(block.ids).filter(function (id) { return !!deckById[id]; }).map(function (id) {
        var item = deckById[id];
        return cardButton(item.title, item.description || 'Flashcards', '▤', 'deck', item.id,
          item.count + ' cards');
      }).join('');
      return deckHtml ? '<div class="shb-remote-ui-list">' + deckHtml + '</div>' :
        '<p class="meta">No flashcard decks are available in this section yet.</p>';
    }
    if (type === 'card') {
      return '<section class="card shb-remote-ui-card-container">' +
        (block.title ? '<h3>' + esc(block.title) + '</h3>' : '') +
        (block.text ? '<p>' + esc(block.text) + '</p>' : '') +
        (block.blocks ? renderBlocks(block.blocks, page) : '') + '</section>';
    }
    if (type === 'list') {
      return '<ul class="shb-remote-ui-bullet-list">' + block.items.map(function (item) {
        return '<li>' + esc(item) + '</li>';
      }).join('') + '</ul>';
    }
    if (type === 'metric') {
      return '<div class="shb-remote-ui-metric"><span>' + esc(block.label) +
        '</span><strong>' + esc(block.value) + '</strong></div>';
    }
    if (type === 'spacer') return '<div class="shb-remote-ui-spacer" aria-hidden="true" style="height:' +
      Number(block.size) + 'px"></div>';
    if (type === 'section') {
      var layout = ['stack', 'row', 'grid'].indexOf(String(block.layout || 'stack')) >= 0 ?
        String(block.layout || 'stack') : 'stack';
      return '<section class="shb-remote-ui-section shb-layout-' + layout + '">' +
        renderBlocks(block.blocks, page) + '</section>';
    }
    if (type === 'grid') {
      var columns = Math.max(1, Math.min(3, Number(block.columns) || 2));
      return '<section class="shb-remote-ui-grid" style="--shb-remote-grid-columns:' + columns + '">' +
        renderBlocks(block.blocks, page) + '</section>';
    }
    if (type === 'tabs') return renderTabs(block, page);
    if (type === 'accordion') {
      return '<div class="shb-remote-ui-accordion">' + block.items.map(function (item, index) {
        return '<details class="shb-remote-ui-accordion-item"' + (index === 0 && block.firstOpen === true ? ' open' : '') +
          '><summary>' + esc(item.label) + '</summary><div class="shb-remote-ui-accordion-content">' +
          renderBlocks(item.blocks, page) + '</div></details>';
      }).join('') + '</div>';
    }
    if (type === 'when') {
      var visible = conditionMatches(String(block.condition || ''));
      if (block.not === true) visible = !visible;
      return visible ? '<div class="shb-remote-ui-conditional">' +
        renderBlocks(block.blocks, page) + '</div>' : '';
    }
    if (type === 'slot') {
      return page && page.slots && Array.isArray(page.slots[block.name]) ?
        renderBlocks(page.slots[block.name], null) : '';
    }
    return '';
  }

  function renderPage(page) {
    var template = page.templateId != null ? templateById[String(page.templateId)] : null;
    tabSequence = 0;
    var blocks = template ? renderBlocks(template.source.blocks, page) : renderBlocks(page.blocks, page);
    return '<div class="app-head"><div class="app-head-title">' + esc(page.title) +
      '</div></div><div class="rs shb-remote-ui-page">' +
      '<div class="ped-collection-kicker">SHBACE MEDICAL · REMOTE SECTION</div>' +
      '<h1>' + esc(page.title) + '</h1>' +
      (page.subtitle ? '<p class="sub">' + esc(page.subtitle) + '</p>' : '') +
      blocks + '</div>';
  }

  pages.forEach(function (page) {
    if (!pageById[page.id]) return;
    window.__shbRegisterPage(pageKey(page.id), function () { return renderPage(page); }, 'subjects');
  });

  window.shbRemoteOpenPage = function (id) {
    if (!pageById[id]) return false;
    appPage = pageKey(id);
    window.renderAppDemo();
    return true;
  };

  function makeSidebarGroups() {
    var groups = [];
    toArray(sidebar.groups).forEach(function (group) {
      if (!group || typeof group.title !== 'string' || !group.title.trim() ||
          !Array.isArray(group.items)) return;
      var items = group.items.filter(function (item) {
        var hasRemotePage = item && validId(item.pageId) && !!pageById[item.pageId];
        var hasBuiltinPage = item && validId(item.targetPage) && !!BUILTIN_PAGES[item.targetPage];
        return item && item.enabled !== false && validId(item.id) &&
          (hasRemotePage || hasBuiltinPage) &&
          typeof item.label === 'string' && item.label.trim();
      }).sort(function (a, b) { return Number(a.order || 0) - Number(b.order || 0); })
        .map(function (item) {
          var targetPage = pageById[item.pageId] ? pageKey(item.pageId) : String(item.targetPage);
          return [String(item.label), targetPage, String(item.icon || '')];
        });
      if (items.length) groups.push([String(group.title), items]);
    });
    return groups;
  }

  window.__SHBACE_REMOTE_DRAWER_CONFIG__ = {
    hiddenItems: toArray(sidebar.hiddenItems).map(String),
    renames: sidebar.renames && typeof sidebar.renames === 'object' ? sidebar.renames : {},
    groupRenames: sidebar.groupRenames && typeof sidebar.groupRenames === 'object' ? sidebar.groupRenames : {},
    groupOrder: toArray(sidebar.groupOrder).map(String),
    groups: makeSidebarGroups()
  };

  function applyAppearance() {
    var appearance = ui.appearance && typeof ui.appearance === 'object' ? ui.appearance : {};
    var root = document.documentElement;
    var colorPattern = /^#[0-9a-fA-F]{3}(?:[0-9a-fA-F]{3})?$/;
    if (colorPattern.test(String(appearance.accentColor || ''))) {
      root.style.setProperty('--mint', String(appearance.accentColor));
      root.style.setProperty('--accent', String(appearance.accentColor));
    }
    if (colorPattern.test(String(appearance.accentSoft || ''))) {
      root.style.setProperty('--mint-soft', String(appearance.accentSoft));
    }
  }
  applyAppearance();

  function injectAnnouncements() {
    var root = document.querySelector('.rs');
    if (!root || root.querySelector('.shb-remote-announcement')) return;
    var announcements = toArray(ui.announcements).slice(0, 10);
    announcements.forEach(function (item) {
      if (!item || !validId(item.id) || !String(item.title || '').trim() ||
          !String(item.text || '').trim()) return;
      if (item.expiresAt && Date.parse(item.expiresAt) < Date.now()) return;
      var key = 'shb_remote_announcement_dismissed_' + item.id;
      try { if (localStorage.getItem(key) === '1') return; } catch (e) {}
      var node = document.createElement('section');
      node.className = 'card shb-remote-announcement';
      var title = document.createElement('b');
      title.textContent = String(item.title);
      var body = document.createElement('p');
      body.textContent = String(item.text);
      node.appendChild(title);
      node.appendChild(body);
      if (item.dismissible !== false) {
        var close = document.createElement('button');
        close.type = 'button';
        close.className = 'btn sm';
        close.textContent = 'Dismiss';
        close.addEventListener('click', function () {
          try { localStorage.setItem(key, '1'); } catch (e) {}
          node.remove();
        });
        node.appendChild(close);
      }
      root.insertBefore(node, root.firstChild);
    });
  }

  function injectHomeBlocks() {
    if (appPage !== 'subjects') return;
    var root = document.querySelector('.rs');
    if (!root || root.querySelector('.shb-remote-home-blocks')) return;
    var blocks = toArray(ui.homeBlocks);
    if (!blocks.length || !blocks.every(validateBlock)) return;
    var wrapper = document.createElement('section');
    wrapper.className = 'shb-remote-home-blocks';
    wrapper.innerHTML = blocks.map(renderBlock).join('');
    root.appendChild(wrapper);
  }

  document.addEventListener('click', function (event) {
    var tab = event.target && event.target.closest ?
      event.target.closest('[data-shb-remote-tab-index]') : null;
    if (!tab) return;
    var root = tab.closest('.shb-remote-ui-tabs');
    var nav = tab.parentNode;
    var panels = null;
    if (!root || !nav) return;
    for (var i = 0; i < root.children.length; i++) {
      if (root.children[i].classList.contains('shb-remote-ui-tabs-panels')) {
        panels = root.children[i];
        break;
      }
    }
    if (!panels) return;
    var selected = String(tab.getAttribute('data-shb-remote-tab-index'));
    var tabs = nav.querySelectorAll('[data-shb-remote-tab-index]');
    Array.prototype.forEach.call(tabs, function (item) {
      var active = String(item.getAttribute('data-shb-remote-tab-index')) === selected;
      item.setAttribute('aria-selected', active ? 'true' : 'false');
      item.classList.toggle('is-active', active);
    });
    Array.prototype.forEach.call(panels.children, function (pane) {
      pane.hidden = String(pane.getAttribute('data-shb-remote-tab-panel')) !== selected;
    });
  }, true);

  document.addEventListener('click', function (event) {
    var button = event.target && event.target.closest ?
      event.target.closest('[data-shb-action][data-shb-target]') : null;
    if (!button) return;
    var action = button.getAttribute('data-shb-action');
    var target = button.getAttribute('data-shb-target');
    if (openTarget(action, target)) {
      event.preventDefault();
      event.stopPropagation();
    }
  }, true);

  function installStyles() {
    if (document.getElementById('shb-remote-ui-styles')) return;
    var style = document.createElement('style');
    style.id = 'shb-remote-ui-styles';
    style.textContent =
      '.di-icon{display:inline-flex;min-width:24px;justify-content:center;margin-inline-end:8px}' +
      '.shb-remote-ui-page{padding-bottom:28px}' +
      '.shb-remote-ui-heading{margin:20px 0 10px;font-size:1.12rem}' +
      '.shb-remote-ui-text{white-space:pre-wrap;line-height:1.75;margin:10px 0 16px}' +
      '.shb-remote-ui-notice{padding:14px;margin:12px 0;line-height:1.65}' +
      '.shb-remote-ui-divider{border:0;border-top:1px solid var(--line,rgba(255,255,255,.14));margin:18px 0}' +
      '.shb-remote-ui-image{display:block;width:100%;max-width:640px;max-height:420px;object-fit:contain;margin:12px auto;border-radius:14px}' +
      '.shb-remote-ui-list{display:grid;gap:10px;margin:12px 0}' +
      '.shb-remote-ui-card{width:100%;display:flex;align-items:center;gap:12px;text-align:start;padding:14px;cursor:pointer}' +
      '.shb-remote-ui-card-container{padding:14px;margin:12px 0}' +
      '.shb-remote-ui-section{display:flex;gap:12px;margin:12px 0}' +
      '.shb-layout-stack{flex-direction:column}' +
      '.shb-layout-row{flex-direction:row;flex-wrap:wrap;align-items:stretch}' +
      '.shb-layout-grid,.shb-remote-ui-grid{display:grid;grid-template-columns:repeat(var(--shb-remote-grid-columns,2),minmax(0,1fr));gap:12px;margin:12px 0}' +
      '.shb-remote-ui-grid>*{min-width:0}' +
      '.shb-remote-ui-tabs{margin:14px 0}' +
      '.shb-remote-ui-tabs-nav{display:flex;gap:6px;overflow-x:auto;padding:3px 0 9px}' +
      '.shb-remote-ui-tab{border:1px solid var(--line,rgba(255,255,255,.14));border-radius:12px;padding:9px 13px;background:transparent;color:inherit;white-space:nowrap}' +
      '.shb-remote-ui-tab.is-active,.shb-remote-ui-tab[aria-selected=true]{background:var(--mint-soft,rgba(90,210,170,.15));border-color:var(--mint,#70d7b4)}' +
      '.shb-remote-ui-tab-panel{padding:4px 0}' +
      '.shb-remote-ui-accordion-item{border:1px solid var(--line,rgba(255,255,255,.14));border-radius:12px;padding:12px;margin:8px 0}' +
      '.shb-remote-ui-accordion-item summary{cursor:pointer;font-weight:650}' +
      '.shb-remote-ui-accordion-content{padding-top:10px}' +
      '.shb-remote-ui-bullet-list{padding-inline-start:24px;line-height:1.8}' +
      '.shb-remote-ui-metric{display:flex;flex-direction:column;gap:5px;padding:12px;border:1px solid var(--line,rgba(255,255,255,.14));border-radius:12px}' +
      '.shb-remote-ui-metric strong{font-size:1.35rem}' +
      '.shb-remote-ui-spacer{width:100%}' +
      '@media(max-width:520px){.shb-layout-grid,.shb-remote-ui-grid{grid-template-columns:1fr}.shb-layout-row{flex-direction:column}}' +
      '.shb-remote-ui-icon{display:grid;place-items:center;min-width:42px;height:42px;border-radius:12px;background:rgba(120,220,190,.12);font-size:1.2rem}' +
      '.shb-remote-announcement{padding:13px;margin:10px 0;border-inline-start:3px solid var(--mint,#70d7b4)}' +
      '.shb-remote-announcement p{margin:6px 0;white-space:pre-wrap;line-height:1.6}';
    document.head.appendChild(style);
  }
  installStyles();

  var previousRender = window.renderAppDemo;
  window.renderAppDemo = function () {
    var result = previousRender.apply(this, arguments);
    try { injectAnnouncements(); injectHomeBlocks(); } catch (e) {
      console.warn('SHBACE remote UI enhancement skipped:', e);
    }
    return result;
  };
})();