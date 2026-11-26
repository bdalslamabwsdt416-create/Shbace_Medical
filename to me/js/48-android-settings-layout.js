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
    { id: 'privacy', title: 'Privacy & data', description: 'Review the limited technical data used for basic app operation.' },
    { id: 'progress', title: 'Study progress', description: 'Manage answers and progress without removing your saved notes or bookmarks.' },
    { id: 'other', title: 'More settings', description: 'Other settings and controls remain available here.' },
    { id: 'updates', title: 'Updates', description: 'Check for a new APK version and refresh learning content.' }
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
      '.shb-apk-update-card .shb-apk-status{min-height:1.4em;font-size:11px;line-height:1.5}',
      '.shb-apk-update-card .shb-apk-download{width:100%;min-height:44px;margin-top:8px}',
      '.shb-apk-update-card .shb-apk-note{font-size:10px;line-height:1.5;color:var(--muted,#91a9c2)}',
      '.shb-apk-update-card .shb-apk-download[hidden]{display:none!important}',
      '.phone.light .shb-apk-update-card .shb-apk-note{color:#607891}',
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
    if (node.classList.contains('shb-privacy-card')) return 'privacy';
    if (node.classList.contains('shb-remote-settings') || node.classList.contains('shb-apk-update-card')) return 'updates';
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

  function installedApkVersion() {
    try {
      var info = String(window.ShbaceNative.getDeviceInfo() || '');
      var match = info.match(/(?:^|\n)Version:\s*([0-9]+\.[0-9]+\.[0-9]+)\s*\((\d+)\)/);
      return match ? { name: match[1], code: Number(match[2]) } : null;
    } catch (e) { return null; }
  }

  function versionParts(value) {
    var match = String(value || '').match(/^(\d+)\.(\d+)\.(\d+)$/);
    return match ? [Number(match[1]), Number(match[2]), Number(match[3])] : null;
  }

  function compareVersions(a, b) {
    var aa = versionParts(a), bb = versionParts(b);
    if (!aa || !bb) return null;
    for (var i = 0; i < 3; i++) {
      if (aa[i] > bb[i]) return 1;
      if (aa[i] < bb[i]) return -1;
    }
    return 0;
  }

  function safeReleaseAssetUrl(value, tag) {
    var url = String(value || '').trim();
    var expected = 'https://github.com/bdalslamabwsdt416-create/Shbace_Medical/releases/download/' +
      String(tag || '') + '/app-release.apk';
    /* Avoid URL() so older Android System WebViews can validate the link too. */
    return url === expected ? url : '';
  }

  function findReleaseApkAsset(assets) {
    if (!Array.isArray(assets)) return null;
    for (var i = 0; i < assets.length; i++) {
      var asset = assets[i];
      if (asset && asset.name === 'app-release.apk' &&
          (!asset.state || asset.state === 'uploaded') &&
          (typeof asset.size !== 'number' || asset.size > 0)) return asset;
    }
    return null;
  }

  async function resolveReleaseApkUrl(release, tag) {
    var asset = findReleaseApkAsset(release && release.assets);
    if (!asset && release && typeof release.assets_url === 'string' &&
        release.assets_url === 'https://api.github.com/repos/bdalslamabwsdt416-create/Shbace_Medical/releases/' +
          String(release.id || '') + '/assets') {
      var assetsResponse = await fetch(release.assets_url, {
        method: 'GET',
        mode: 'cors',
        cache: 'no-store',
        headers: { 'Accept': 'application/vnd.github+json' }
      });
      if (assetsResponse.ok) {
        var listedAssets = await assetsResponse.json();
        asset = findReleaseApkAsset(listedAssets);
      }
    }
    if (!asset) return '';
    /* Use GitHub's returned URL when exact; otherwise derive the canonical URL
       only after the API has confirmed that app-release.apk exists on this release. */
    return safeReleaseAssetUrl(asset.browser_download_url, tag) ||
      'https://github.com/bdalslamabwsdt416-create/Shbace_Medical/releases/download/' +
        tag + '/app-release.apk';
  }

  function setApkStatus(card, message) {
    var status = card && card.querySelector('.shb-apk-status');
    if (status) status.textContent = String(message || '');
  }

  async function checkForApkUpdate(card) {
    var check = card.querySelector('[data-shb-apk-check]');
    var download = card.querySelector('[data-shb-apk-download]');
    var current = installedApkVersion();
    if (!current) {
      setApkStatus(card, 'Could not read the installed APK version from Android.');
      return;
    }
    if (!navigator.onLine) {
      setApkStatus(card, 'Connect to the internet to check for a published APK update.');
      return;
    }

    check.disabled = true;
    check.textContent = 'Checking…';
    download.hidden = true;
    card.removeAttribute('data-shb-apk-download-url');
    setApkStatus(card, 'Installed version: ' + current.name + '. Checking GitHub Releases…');

    var controller = typeof AbortController === 'function' ? new AbortController() : null;
    var timeout = window.setTimeout(function () {
      if (controller) controller.abort();
    }, 15000);

    try {
      var response = await fetch('https://api.github.com/repos/bdalslamabwsdt416-create/Shbace_Medical/releases/latest', {
        method: 'GET',
        mode: 'cors',
        cache: 'no-store',
        headers: { 'Accept': 'application/vnd.github+json' },
        signal: controller ? controller.signal : undefined
      });
      if (!response.ok) {
        throw new Error(response.status === 404 ? 'No published Android APK release was found yet.' :
          'GitHub release check failed (HTTP ' + response.status + ').');
      }
      var release = await response.json();
      if (!release || release.draft || release.prerelease) throw new Error('The latest GitHub release is not a public stable release.');
      var tag = String(release.tag_name || '');
      var match = tag.match(/^android-v(\d+\.\d+\.\d+)$/);
      if (!match) throw new Error('The latest release does not contain a valid SHBACE Android version tag.');
      var latest = match[1];
      var comparison = compareVersions(latest, current.name);
      if (comparison === null) throw new Error('Could not compare the installed and published app versions.');

      card.setAttribute('data-shb-apk-checked', '1');
      if (comparison <= 0) {
        setApkStatus(card, 'You are up to date. Installed version: ' + current.name +
          ' · Latest published version: ' + latest + '.');
        return;
      }

      var assetUrl = await resolveReleaseApkUrl(release, tag);
      if (!assetUrl) throw new Error('Version ' + latest + ' is published, but GitHub did not return the app-release.apk asset.');
      card.setAttribute('data-shb-apk-download-url', assetUrl);
      setApkStatus(card, 'New version available: ' + latest + '. Your installed version is ' + current.name + '.');
      download.hidden = false;
    } catch (error) {
      var message = error && error.name === 'AbortError' ? 'The update check timed out. Please try again.' :
        String(error && error.message || 'The APK update check failed.');
      setApkStatus(card, message);
    } finally {
      window.clearTimeout(timeout);
      check.disabled = false;
      check.textContent = 'Check for update';
    }
  }

  function ensureAppUpdateCard(updateZone) {
    var items = updateZone.querySelector('.shb-settings-items');
    if (!items) return;
    var card = items.querySelector('.shb-apk-update-card');
    if (!card) {
      card = document.createElement('section');
      card.className = 'card setcard shb-apk-update-card';
      var title = document.createElement('h3');
      title.textContent = 'SHBACE Medical app';
      var description = document.createElement('p');
      description.className = 'meta';
      description.textContent = 'Check the latest published Android APK version.';
      var status = document.createElement('p');
      status.className = 'meta shb-apk-status';
      status.setAttribute('role', 'status');
      status.setAttribute('aria-live', 'polite');
      var check = document.createElement('button');
      check.type = 'button';
      check.className = 'btn primary block';
      check.textContent = 'Check for update';
      check.setAttribute('data-shb-apk-check', '1');
      var download = document.createElement('button');
      download.type = 'button';
      download.className = 'btn shb-apk-download';
      download.textContent = 'Download APK update';
      download.setAttribute('data-shb-apk-download', '1');
      download.hidden = true;
      var note = document.createElement('p');
      note.className = 'meta shb-apk-note';
      note.textContent = 'A new APK is downloaded through your browser. Android will ask you to confirm installation; the app does not install updates silently. Keep the same app installed so your local study data remains in place.';
      card.appendChild(title);
      card.appendChild(description);
      card.appendChild(status);
      card.appendChild(check);
      card.appendChild(download);
      card.appendChild(note);
      check.addEventListener('click', function () { checkForApkUpdate(card); });
      download.addEventListener('click', function () {
        var url = card.getAttribute('data-shb-apk-download-url') || '';
        var opened = false;
        try { opened = window.ShbaceNative.openExternalUrl(url) === true; } catch (e) {}
        if (!opened) {
          setApkStatus(card, 'Could not open the official GitHub download link. Check your internet connection and try again.');
        } else {
          setApkStatus(card, 'Opened the official APK download page. Follow Android’s installation prompt when the download finishes.');
        }
      });
    }
    if (items.lastElementChild !== card) items.appendChild(card);
    var current = installedApkVersion();
    var statusNode = card.querySelector('.shb-apk-status');
    if (current && !card.getAttribute('data-shb-apk-checked')) {
      statusNode.textContent = 'Installed version: ' + current.name + ' (build ' + current.code + ').';
    }
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

    /* The APK release checker is the last card in Settings; content updates remain alongside it. */
    ensureAppUpdateCard(state.zones.updates);
    var contentCard = state.zones.updates.querySelector('.shb-remote-settings');
    var contentButton = contentCard && contentCard.querySelector('[data-shb-remote-check]');
    if (contentButton && !contentButton.disabled) contentButton.textContent = 'Check learning content';
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