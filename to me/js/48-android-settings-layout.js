/* SHBACE Medical · Android Settings Layout v1
 * Android APK only. Keeps every existing setting control and store intact;
 * this module only groups the existing DOM nodes into a predictable order.
 */
(function () {
  'use strict';

  function isAndroidNative() {
    try {
      return !!(window.Capacitor &&
        typeof window.Capacitor.getPlatform === 'function' &&
        window.Capacitor.getPlatform() === 'android' &&
        typeof window.Capacitor.isNativePlatform === 'function' &&
        window.Capacitor.isNativePlatform() &&
        window.ShbaceNative);
    } catch (e) { return false; }
  }
  if (!isAndroidNative()) return;
  if (window.__SHBACE_ANDROID_SETTINGS_LAYOUT_V1__) return;
  window.__SHBACE_ANDROID_SETTINGS_LAYOUT_V1__ = true;

  var ZONES = [
    { id: 'appearance', title: 'Appearance & voice', description: 'Theme, text size and question-reading voice.' },
    { id: 'notifications', title: 'Notifications', description: 'Choose which study events can notify you.' },
    { id: 'study', title: 'Study experience', description: 'Question tools and study-session behaviour.' },
    { id: 'reminders', title: 'Study reminders', description: 'Reminder settings connected to your study and exam plans.' },
    { id: 'experience', title: 'Onboarding', description: 'Control the welcome screens shown when the app starts.' },
    { id: 'data', title: 'Backup & restore', description: 'Export or restore student information saved on this device.' },
    { id: 'progress', title: 'Study progress', description: 'Manage answers and progress without removing your saved notes or bookmarks.' },
    { id: 'other', title: 'More settings', description: 'Other settings and controls remain available here.' },
    { id: 'updates', title: 'Updates', description: 'Check for new learning content. This does not replace the installed APK.' }
  ];

  var queued = false;
  var observer = null;

  function injectStyles() {
    if (document.getElementById('shbAndroidSettingsLayoutStyles')) return;
    var style = document.createElement('style');
    style.id = 'shbAndroidSettingsLayoutStyles';
    style.textContent = [
      '.shb-settings-order.shb-android-settings-order{display:grid;gap:12px;margin-top:16px}',
      '.shb-android-settings-order>.shb-settings-section{min-width:0;padding:11px;border:1px solid rgba(100,165,220,.2);border-radius:16px;background:rgba(13,35,60,.18)}',
      '.shb-android-settings-order>.shb-settings-section>header{padding:0 2px}',
      '.shb-android-settings-order>.shb-settings-section>header h2{font-size:14px;line-height:1.35;margin:0 0 3px;font-weight:850}',
      '.shb-android-settings-order>.shb-settings-section>header p{font-size:10.5px;line-height:1.45;margin:0;color:var(--muted,#91a9c2)}',
      '.shb-android-settings-order .shb-settings-items{display:grid;gap:9px;margin-top:9px;min-width:0}',
      '.shb-android-settings-order .shb-settings-items>.card,.shb-android-settings-order .shb-settings-items>.u10-settings-card{margin:0!important;min-width:0}',
      '.shb-android-settings-order [data-shb-remote-check]{min-height:44px;font-weight:800}',
      '.shb-android-settings-order [data-shb-remote-check]:disabled{opacity:.65}',
      '.shb-android-settings-order .shb-remote-feedback{min-height:1.2em}',
      '.phone.light .shb-android-settings-order>.shb-settings-section{background:rgba(235,246,255,.65);border-color:#d0e0ef}',
      '.phone.light .shb-android-settings-order>.shb-settings-section>header p{color:#607891}',
      '@media(max-width:360px){.shb-android-settings-order>.shb-settings-section{padding:9px;border-radius:14px}}'
    ].join('');
    document.head.appendChild(style);
  }

  function settingsRoot() {
    var root = document.querySelector('#phoneContent .rs');
    var heading = root && root.querySelector('h1');
    return root && heading && /^settings$/i.test((heading.textContent || '').trim()) ? root : null;
  }

  function isSettingItem(node) {
    return !!(node && node.nodeType === 1 &&
      (node.id === 'bkFile' ||
       node.classList.contains('setcard') ||
       node.classList.contains('u10-settings-card')));
  }

  function itemHeading(node) {
    var heading = node.querySelector('h3');
    return String(heading ? heading.textContent : '').replace(/\s+/g, ' ').trim().toLowerCase();
  }

  function categoryFor(node) {
    if (node.id === 'bkFile') return 'data';
    if (node.classList.contains('shb-remote-settings')) return 'updates';
    if (node.classList.contains('u10-settings-card')) return 'notifications';
    if (node.id === 'shbUnifiedVoiceSettings') return 'appearance';
    if (node.id === 'shbAndroidSettings') return 'study';

    var heading = itemHeading(node);
    if (heading === 'appearance' || heading === 'question voice' || heading.indexOf('appearance') >= 0) return 'appearance';
    if (heading === 'onboarding' || heading.indexOf('onboarding') >= 0) return 'experience';
    if (heading.indexOf('notification') >= 0) return 'notifications';
    if (heading === 'study experience') return 'study';
    if (heading === 'study reminders') return 'reminders';
    if (heading.indexOf('student data backup') >= 0 || heading.indexOf('backup') >= 0 || heading.indexOf('restore') >= 0) return 'data';
    if (heading.indexOf('study progress') >= 0 || heading.indexOf('progress management') >= 0) return 'progress';
    if (heading.indexOf('learning content') >= 0 || heading.indexOf('update') >= 0) return 'updates';
    return 'other';
  }

  function makeZone(order, spec) {
    var zone = document.createElement('section');
    zone.className = 'shb-settings-section';
    zone.setAttribute('data-shb-settings-zone', spec.id);
    var header = document.createElement('header');
    var title = document.createElement('h2');
    title.textContent = spec.title;
    var description = document.createElement('p');
    description.textContent = spec.description;
    var items = document.createElement('div');
    items.className = 'shb-settings-items';
    items.setAttribute('data-shb-settings-items', spec.id);
    header.appendChild(title);
    header.appendChild(description);
    zone.appendChild(header);
    zone.appendChild(items);
    order.appendChild(zone);
    return zone;
  }

  function ensureZones(root) {
    var order = null;
    Array.prototype.forEach.call(root.children, function (child) {
      if (child.classList && child.classList.contains('shb-settings-order')) order = child;
    });
    if (!order) {
      order = document.createElement('div');
      order.className = 'shb-settings-order';
      root.appendChild(order);
    }
    order.classList.add('shb-android-settings-order');

    var zones = Object.create(null);
    ZONES.forEach(function (spec) {
      var found = null;
      Array.prototype.forEach.call(order.children, function (child) {
        if (child.getAttribute && child.getAttribute('data-shb-settings-zone') === spec.id) found = child;
      });
      zones[spec.id] = found || makeZone(order, spec);
    });

    /* Keep the section order deterministic even if another extension created some zones first. */
    ZONES.forEach(function (spec, index) {
      var zone = zones[spec.id];
      var current = order.children[index] || null;
      if (current !== zone) order.insertBefore(zone, current);
    });
    return { order: order, zones: zones };
  }

  function collectItems(root, order) {
    var items = [];
    var seen = new Set();
    function addFrom(container) {
      Array.prototype.forEach.call(container.children, function (child) {
        if (isSettingItem(child) && !seen.has(child)) {
          seen.add(child);
          items.push(child);
        }
      });
    }
    addFrom(root);
    Array.prototype.forEach.call(order.querySelectorAll('.shb-settings-items'), addFrom);
    return items;
  }

  function organizeSettings() {
    var root = settingsRoot();
    if (!root) return;
    injectStyles();

    var state = ensureZones(root);
    var items = collectItems(root, state.order);
    items.forEach(function (item) {
      var category = categoryFor(item);
      var zone = state.zones[category] || state.zones.other;
      var target = zone.querySelector('.shb-settings-items');
      if (target && item.parentNode !== target) target.appendChild(item);
    });

    /* The remote-content checker is a real Android native operation, not the PWA cache updater. */
    var updateCard = state.zones.updates.querySelector('.shb-remote-settings');
    var updateButton = updateCard && updateCard.querySelector('[data-shb-remote-check]');
    if (updateButton && !updateButton.disabled) updateButton.textContent = 'Check for update';
  }

  function queueOrganization() {
    if (queued) return;
    queued = true;
    window.requestAnimationFrame(function () {
      queued = false;
      try { organizeSettings(); }
      catch (error) { console.warn('Android Settings layout skipped:', error); }
    });
  }

  function installObserver() {
    var host = document.getElementById('phoneContent');
    if (!host || observer || typeof MutationObserver !== 'function') return;
    observer = new MutationObserver(queueOrganization);
    observer.observe(host, { childList: true, subtree: true });
  }

  var originalRender = window.renderAppDemo;
  if (typeof originalRender === 'function' && !window.__SHBACE_ANDROID_SETTINGS_RENDER_HOOK__) {
    window.__SHBACE_ANDROID_SETTINGS_RENDER_HOOK__ = true;
    window.renderAppDemo = function () {
      var result = originalRender.apply(this, arguments);
      queueOrganization();
      return result;
    };
  }

  installObserver();
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function () {
      installObserver();
      queueOrganization();
    }, { once: true });
  } else {
    queueOrganization();
  }
})();