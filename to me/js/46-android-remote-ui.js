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

  function validateBlock(block) {
    if (!block || typeof block !== 'object') return false;
    var type = String(block.type || '');
    if (['heading', 'text', 'notice', 'divider', 'image', 'resourceList',
         'bankList', 'flashcardDeckList', 'link', 'button'].indexOf(type) < 0) return false;
    if (type === 'heading' || type === 'text') return typeof block.text === 'string';
    if (type === 'notice') return typeof block.text === 'string';
    if (type === 'image') return typeof block.file === 'string';
    if (type === 'link') return typeof block.label === 'string' && !!safeUrl(block.url);
    if (type === 'button') {
      return typeof block.label === 'string' &&
        ['page', 'resource', 'bank', 'deck'].indexOf(String(block.action || '')) >= 0 &&
        validId(block.target);
    }
    if (type === 'resourceList' || type === 'bankList' || type === 'flashcardDeckList') {
      return Array.isArray(block.ids) && block.ids.length <= 120;
    }
    return true;
  }

  pages.forEach(function (page) {
    if (!page || !validId(page.id) || typeof page.title !== 'string' ||
        !page.title.trim() || pageById[page.id] || !Array.isArray(page.blocks) ||
        page.blocks.length > 60 || !page.blocks.every(validateBlock)) return;
    pageById[page.id] = page;
  });

  function openTarget(action, target) {
    var key = String(target || '');
    if (action === 'page' && pageById[key]) {
      window.shbRemoteOpenPage(key);
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

  function renderBlock(block) {
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
    return '';
  }

  function renderPage(page) {
    var blocks = toArray(page.blocks).map(renderBlock).join('');
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
        return item && item.enabled !== false && validId(item.id) && validId(item.pageId) &&
          pageById[item.pageId] && typeof item.label === 'string' && item.label.trim();
      }).sort(function (a, b) { return Number(a.order || 0) - Number(b.order || 0); })
        .map(function (item) {
          return [String(item.label), pageKey(item.pageId), String(item.icon || '')];
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