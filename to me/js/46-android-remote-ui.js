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
  var pages = Array.isArray(ui.pages) ? ui.pages.slice(0, 40) : [];
  var templates = Array.isArray(ui.templates) ? ui.templates.slice(0, 20) : [];
  var pageById = Object.create(null);
  var declaredPageIds = Object.create(null);
  var templateById = Object.create(null);
  var BUILTIN_CONDITIONS = {
    always: true, hasBanks: true, hasResources: true,
    hasFlashcardDecks: true, hasLearningContent: true
  };
  pages.forEach(function (page) {
    if (page && validId(page.id) && typeof page.title === 'string' &&
        page.title.trim() && !declaredPageIds[page.id]) declaredPageIds[page.id] = true;
  });
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

  function validateBlocks(blocks, allowSlots, depth, budget) {
    depth = Number.isInteger(depth) ? depth : 0;
    budget = budget || { count:0 };
    if (!Array.isArray(blocks) || blocks.length > 60 || depth > 4) return false;
    return blocks.every(function (block) {
      return validateBlock(block, allowSlots, depth, budget);
    });
  }

  function validateBlock(block, allowSlots, depth, budget) {
    if (!block || typeof block !== 'object' || Array.isArray(block) ||
        depth > 4 || ++budget.count > 120) return false;
    var type = String(block.type || '');
    var nested = function (items) { return validateBlocks(items, allowSlots, depth + 1, budget); };
    if (type === 'stack' || type === 'grid') {
      var stackChildren = Array.isArray(block.children) ? block.children : block.blocks;
      if (!Array.isArray(stackChildren) || stackChildren.length > 30) return false;
      if (type === 'grid' && (!Number.isInteger(block.columns) || block.columns < 1 || block.columns > 3)) return false;
      if (block.gap != null && (!Number.isInteger(block.gap) || block.gap < 0 || block.gap > 32)) return false;
      return nested(stackChildren);
    }
    if (type === 'section') {
      var layout = String(block.layout || 'stack');
      if (['stack', 'row', 'grid'].indexOf(layout) < 0 ||
          (block.gap != null && (!Number.isInteger(block.gap) || block.gap < 0 || block.gap > 32)) ||
          (layout === 'grid' && block.columns != null &&
            (!Number.isInteger(block.columns) || block.columns < 1 || block.columns > 3))) return false;
      return nested(block.blocks);
    }
    if (type === 'tabs') {
      var tabs = Array.isArray(block.tabs) ? block.tabs : block.items;
      if (!Array.isArray(tabs) || tabs.length < 2 || tabs.length > 6) return false;
      var ids = Object.create(null);
      var validTabs = tabs.every(function (tab) {
        var tabLabel = tab && (typeof tab.label === 'string' ? tab.label : tab.title);
        if (!tab || !validId(tab.id) || ids[tab.id] || typeof tabLabel !== 'string' ||
            !tabLabel.trim() || tabLabel.length > 48 || !Array.isArray(tab.blocks) || tab.blocks.length > 30) return false;
        ids[tab.id] = true;
        return nested(tab.blocks);
      });
      return validTabs && (block.defaultTab == null || !!ids[String(block.defaultTab)]);
    }
    if (type === 'accordion') {
      if (!Array.isArray(block.items) || block.items.length < 1 || block.items.length > 12) return false;
      var itemIds = Object.create(null);
      return block.items.every(function (item) {
        var title = item && (typeof item.title === 'string' ? item.title : item.label);
        if (!item || typeof title !== 'string' || !title.trim() || title.length > 80 ||
            !Array.isArray(item.blocks) || item.blocks.length > 30) return false;
        if (item.id != null) {
          if (!validId(item.id) || itemIds[item.id]) return false;
          itemIds[item.id] = true;
        }
        if (item.open != null && typeof item.open !== 'boolean') return false;
        return nested(item.blocks);
      });
    }
    if (type === 'when') {
      return !!BUILTIN_CONDITIONS[String(block.condition || '')] &&
        (block.not == null || typeof block.not === 'boolean') && nested(block.blocks);
    }
    if (type === 'slot') {
      return allowSlots === true && /^[a-z][a-z0-9_-]{0,31}$/.test(String(block.name || ''));
    }
    if (['heading', 'text', 'notice', 'divider', 'image', 'resourceList',
         'bankList', 'flashcardDeckList', 'link', 'button', 'card', 'list', 'metric', 'spacer'].indexOf(type) < 0) return false;
    if (type === 'heading' || type === 'text') return typeof block.text === 'string' && block.text.length <= 3000;
    if (type === 'notice') return typeof block.text === 'string' && block.text.length <= 3000 &&
      ['info', 'success', 'warning', 'neutral'].indexOf(String(block.tone || 'info')) >= 0 &&
      (block.title == null || (typeof block.title === 'string' && block.title.length <= 160));
    if (type === 'image') return typeof block.file === 'string' && block.file.length <= 240;
    if (type === 'card') return (block.title == null || (typeof block.title === 'string' && block.title.length <= 160)) &&
      (block.text == null || (typeof block.text === 'string' && block.text.length <= 3000)) &&
      (block.blocks == null || nested(block.blocks));
    if (type === 'list') return Array.isArray(block.items) && block.items.length <= 30 &&
      block.items.every(function (item) { return typeof item === 'string' && item.length <= 300; });
    if (type === 'metric') return (typeof block.label === 'string' || typeof block.label === 'number') &&
      (typeof block.value === 'string' || typeof block.value === 'number');
    if (type === 'spacer') return Number.isInteger(block.size) && block.size >= 4 && block.size <= 64;
    if (type === 'link') return typeof block.label === 'string' && block.label.trim() &&
      block.label.length <= 120 && !!safeUrl(block.url);
    if (type === 'button') {
      var action = String(block.action || ''), target = String(block.target || '');
      if (typeof block.label !== 'string' || !block.label.trim() || block.label.length > 120 || !validId(target)) return false;
      if (action === 'page') return !!declaredPageIds[target];
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
    return type === 'divider';
  }

  function collectTemplateSlots(blocks, found, depth) {
    if (!Array.isArray(blocks) || depth > 4) return;
    blocks.forEach(function (block) {
      if (!block || typeof block !== 'object') return;
      if (block.type === 'slot') found[String(block.name)] = true;
      if (Array.isArray(block.blocks)) collectTemplateSlots(block.blocks, found, depth + 1);
      if (Array.isArray(block.children)) collectTemplateSlots(block.children, found, depth + 1);
      var tabs = Array.isArray(block.tabs) ? block.tabs :
        (block.type === 'tabs' && Array.isArray(block.items) ? block.items : []);
      tabs.forEach(function (item) {
        if (item && Array.isArray(item.blocks)) collectTemplateSlots(item.blocks, found, depth + 1);
      });
      if (block.type === 'accordion' && Array.isArray(block.items)) block.items.forEach(function (item) {
        if (item && Array.isArray(item.blocks)) collectTemplateSlots(item.blocks, found, depth + 1);
      });
    });
  }

  templates.forEach(function (template) {
    if (!template || !validId(template.id) || templateById[template.id] ||
        !Array.isArray(template.blocks)) return;
    var budget = { count:0 };
    if (!validateBlocks(template.blocks, true, 0, budget)) return;
    var slots = Object.create(null);
    collectTemplateSlots(template.blocks, slots, 0);
    templateById[template.id] = { source:template, slots:slots };
  });

  function validateTemplatePage(page) {
    if (page.templateId == null) {
      return page.blocks != null && validateBlocks(page.blocks, false, 0, { count:0 });
    }
    var template = templateById[String(page.templateId)];
    if (!template || !page.slots || typeof page.slots !== 'object' || Array.isArray(page.slots)) return false;
    var names = Object.keys(page.slots);
    var budget = { count:0 };
    return names.every(function (name) {
      return !!template.slots[name] && validateBlocks(page.slots[name], false, 0, budget);
    });
  }

  pages.forEach(function (page) {
    if (!page || !validId(page.id) || typeof page.title !== 'string' ||
        !page.title.trim() || page.title.length > 120 || pageById[page.id] ||
        (page.subtitle != null && (typeof page.subtitle !== 'string' || page.subtitle.length > 160)) ||
        !validateTemplatePage(page)) return;
    pageById[page.id] = page;
  });

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

  function prepareBlocks(blocks, slots, depth, budget) {
    if (!Array.isArray(blocks) || depth > 4) return null;
    var output = [];
    for (var index = 0; index < blocks.length; index++) {
      var block = blocks[index];
      if (!block || typeof block !== 'object' || Array.isArray(block) || ++budget.count > 120) return null;
      var type = String(block.type || '');
      if (type === 'when') {
        var visible = conditionMatches(String(block.condition || ''));
        if (block.not === true) visible = !visible;
        if (visible) {
          var conditionalBlocks = prepareBlocks(block.blocks, slots, depth + 1, budget);
          if (!conditionalBlocks) return null;
          output = output.concat(conditionalBlocks);
        }
        continue;
      }
      if (type === 'slot') {
        var slotBlocks = slots && Array.isArray(slots[block.name]) ? slots[block.name] : [];
        var expandedSlot = prepareBlocks(slotBlocks, null, depth + 1, budget);
        if (!expandedSlot) return null;
        output = output.concat(expandedSlot);
        continue;
      }
      var copy = Object.assign({}, block);
      if (Array.isArray(block.blocks)) {
        copy.blocks = prepareBlocks(block.blocks, slots, depth + 1, budget);
        if (!copy.blocks) return null;
      }
      if (Array.isArray(block.children)) {
        copy.children = prepareBlocks(block.children, slots, depth + 1, budget);
        if (!copy.children) return null;
      }
      if (Array.isArray(block.tabs)) {
        copy.tabs = block.tabs.map(function (item) {
          var next = Object.assign({}, item);
          next.blocks = prepareBlocks(item.blocks, slots, depth + 1, budget);
          return next.blocks ? next : null;
        });
        if (copy.tabs.some(function (item) { return !item; })) return null;
      } else if (type === 'tabs' && Array.isArray(block.items)) {
        copy.items = block.items.map(function (item) {
          var next = Object.assign({}, item);
          next.blocks = prepareBlocks(item.blocks, slots, depth + 1, budget);
          return next.blocks ? next : null;
        });
        if (copy.items.some(function (item) { return !item; })) return null;
      }
      if (type === 'accordion' && Array.isArray(block.items)) {
        copy.items = block.items.map(function (item) {
          var next = Object.assign({}, item);
          next.blocks = prepareBlocks(item.blocks, slots, depth + 1, budget);
          return next.blocks ? next : null;
        });
        if (copy.items.some(function (item) { return !item; })) return null;
      }
      output.push(copy);
    }
    return output;
  }

  function openTarget(action, target) {
    var key = String(target || '');
    if (action === 'page' && pageById[key]) {
      window.shbRemoteOpenPage(key);
      return true;
    }
    if (action === 'builtin' && BUILTIN_PAGES[key]) {
      var navigation = window.SHBACENavigation;
      if (navigation && typeof navigation.navigate === 'function') {
        var result = navigation.navigate(key);
        return !!(result && result.ok);
      }
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
    if (type === 'card') {
      var nestedCard = block.blocks && window.SHBACEPageBuilder ?
        window.SHBACEPageBuilder.render(block.blocks, function (child) { return renderBlock(child, page); },
          (page && page.id ? page.id : 'page') + '-card') : '';
      return '<section class="card shb-remote-ui-card-block">' +
        (block.icon ? '<div aria-hidden="true">' + esc(block.icon) + '</div>' : '') +
        (block.title ? '<h3>' + esc(block.title) + '</h3>' : '') +
        (block.text ? '<p>' + esc(block.text) + '</p>' : '') + nestedCard + '</section>';
    }
    if (type === 'list') return '<ul class="shb-remote-ui-list-block">' +
      toArray(block.items).slice(0,30).map(function (item) { return '<li>' + esc(item) + '</li>'; }).join('') + '</ul>';
    if (type === 'metric') return '<div class="shb-remote-ui-metric"><b>' + esc(block.value) +
      '</b><small>' + esc(block.label) + '</small></div>';
    if (type === 'spacer') return '<span class="shb-remote-ui-spacer" aria-hidden="true" style="height:' +
      Math.max(4,Math.min(64,Number(block.size)||12)) + 'px"></span>';
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
    return '';
  }

  function renderPage(page) {
    var pageBuilder = window.SHBACEPageBuilder;
    var template = page.templateId != null ? templateById[String(page.templateId)] : null;
    var sourceBlocks = template ? template.source.blocks : page.blocks;
    var prepared = prepareBlocks(sourceBlocks, template ? page.slots : null, 0, { count:0 });
    var blocks = '';
    if (prepared && pageBuilder) {
      blocks = pageBuilder.render(prepared, function (block) { return renderBlock(block, page); }, page.id);
    } else if (prepared) {
      blocks = prepared.map(function (block) { return renderBlock(block, page); }).join('');
    } else {
      var core = window.SHBACECore;
      if (core && core.diagnostics) core.diagnostics.record('warn', 'REMOTE_PAGE_RENDER_LIMIT',
        'A remote page exceeded the safe expanded component budget.', { pageId:page.id });
      blocks = '<div class="card shb-remote-ui-notice shb-tone-warning">This page is too complex to display safely.</div>';
    }
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

  // Appearance tokens are owned by the V3 Theme Engine in the remote-control runtime.

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
    if (!blocks.length || !validateBlocks(blocks)) return;
    var wrapper = document.createElement('section');
    wrapper.className = 'shb-remote-home-blocks';
    wrapper.innerHTML = window.SHBACEPageBuilder ?
      window.SHBACEPageBuilder.render(blocks, renderBlock, 'home') : blocks.map(renderBlock).join('');
    root.appendChild(wrapper);
  }

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