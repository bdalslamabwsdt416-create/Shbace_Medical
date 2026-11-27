/* Android-only Auscultation Library: independent Heart and Lung packs. */
/* Release correction authorization: [republish-android-v1.3.12] */
(function () {
  'use strict';
  function isNativeAndroid() {
    try {
      var bridge = window.ShbaceNative;
      if (!bridge || typeof bridge.getAuscultationPackState !== 'function' ||
          typeof bridge.startAuscultationPackDownload !== 'function') return false;
      var c = window.Capacitor;
      if (c && typeof c.getPlatform === 'function') {
        var platform = c.getPlatform();
        if (platform && platform !== 'android' && platform !== 'web') return false;
      }
      /* The injected Shbace bridge is the native-host signal when Capacitor's
         JavaScript platform registry is not ready yet. */
      return true;
    } catch (_) { return false; }
  }
  if (!isNativeAndroid() || window.__SHBACE_AUSCULTATION_LIBRARY__) return;

  var ROUTES = { heart:'auscultationheart', lung:'auscultationlung' };
  var TITLES = { heart:'Heart Auscultation', lung:'Lung Auscultation' };
  var lastPackState = { heart:null, lung:null };

  function esc(value) {
    return String(value == null ? '' : value).replace(/[&<>"']/g, function (c) {
      return { '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[c];
    });
  }
  function packState(system) {
    try {
      var value = window.ShbaceNative.getAuscultationPackState(system);
      return value ? JSON.parse(value) : { installed:false, downloading:false };
    } catch (error) {
      return { installed:false, downloading:false, error:String(error && error.message || error) };
    }
  }
  function notify(message) {
    try {
      if (typeof window.toast === 'function') window.toast(message);
      else if (typeof window.showToast === 'function') window.showToast(message);
    } catch (_) {}
  }
  function pageFacts(system) {
    return system === 'heart'
      ? {
          eyebrow:'CARDIAC AUSCULTATION',
          heading:'Heart Auscultation',
          description:'77 primary heart sounds · five standard listening areas · interactive 3D cardiac anatomy',
          facts:[['77','distinct sounds'],['5','listening areas'],['3D','thorax + heart']],
          button:'Download Heart Library',
          note:'Heart downloads separately. Lung recordings are not part of this package.'
        }
      : {
          eyebrow:'RESPIRATORY AUSCULTATION',
          heading:'Lung Auscultation',
          description:'31 distinct lung sounds · patient and teaching variants · interactive anterior and posterior 3D thorax',
          facts:[['31','distinct sounds'],['2','chest views'],['3D','thorax + lungs']],
          button:'Download Lung Library',
          note:'Lung downloads separately. Heart recordings are not part of this package.'
        };
  }
  function renderPackPage(system) {
    var state = packState(system);
    lastPackState[system] = state;
    var facts = pageFacts(system);
    var head = typeof window.appHeader === 'function' ? window.appHeader(TITLES[system]) : '';
    var body;
    if (state.installed) {
      body = '<div class="shb-ausc-integrated" data-shb-ausc-host data-system="' + system +
        '" aria-label="' + esc(TITLES[system]) + '"></div>';
    } else {
      var progress = Number(state.downloadedBytes || 0);
      var total = Number(state.totalBytes || state.packageBytes || 0);
      var pct = total > 0 ? Math.max(0, Math.min(100, Math.round(progress / total * 100))) : 0;
      var status = state.downloading
        ? 'Downloading the independent ' + (system === 'heart' ? 'Heart' : 'Lung') + ' package…'
        : state.error
          ? 'The last download did not complete. ' + esc(state.error)
          : 'Download this library once. Its recordings and 3D models will then remain available offline.';
      body = '<section class="shb-ausc-pack-gate">' +
        '<div class="shb-ausc-gate-icon ' + system + '">' + (system === 'heart' ? '♡' : '♧') + '</div>' +
        '<span class="shb-ausc-kicker">' + facts.eyebrow + '</span>' +
        '<h1>' + facts.heading + '</h1><p>' + facts.description + '</p>' +
        '<div class="shb-ausc-pack-facts">' + facts.facts.map(function (item) {
          return '<div><b>' + item[0] + '</b><small>' + item[1] + '</small></div>';
        }).join('') + '</div>' +
        '<p class="shb-ausc-pack-status" role="status">' + status + '</p>' +
        (state.downloading ? '<progress max="100" value="' + pct + '"></progress><small>' + pct + '%</small>' : '') +
        '<button type="button" class="shb-ausc-primary" data-shb-pack-download="' + system + '" ' +
          (state.downloading ? 'disabled' : '') + '>' +
          (state.downloading ? 'Downloading…' : facts.button) + '</button>' +
        '<small class="shb-ausc-pack-note">' + facts.note + '</small></section>';
    }
    return head + '<div class="shb-ausc-pack-page">' + body + '</div>';
  }
  function currentPage() {
    try { return typeof appPage === 'string' ? appPage : ''; }
    catch (_) { return typeof window.appPage === 'string' ? window.appPage : ''; }
  }
  function setCurrentPage(route) {
    try { appPage = route; }
    catch (_) { window.appPage = route; }
  }
  function refreshPackPage(system) {
    if (currentPage() === ROUTES[system] && typeof window.renderAppDemo === 'function') {
      window.renderAppDemo();
    }
    refreshDrawerButtons();
  }
  function refreshDrawerButton(system) {
    var button = document.querySelector('[data-shb-ausc-download="' + system + '"]');
    if (!button) return;
    var state = packState(system);
    lastPackState[system] = state;
    button.disabled = !!state.downloading || !!state.installed;
    button.setAttribute('aria-label', state.installed ? TITLES[system] + ' downloaded' :
      state.downloading ? 'Downloading ' + TITLES[system] : 'Download ' + TITLES[system]);
    button.title = state.installed ? 'Downloaded' :
      state.downloading ? 'Downloading…' : 'Download ' + TITLES[system];
    button.innerHTML = state.installed
      ? '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m5 12 4 4L19 6"/></svg>'
      : state.downloading
        ? '<span class="shb-ausc-download-spinner" aria-hidden="true"></span>'
        : '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3v12m-5-5 5 5 5-5M4 18v3h16v-3"/></svg>';
    button.classList.toggle('is-installed', !!state.installed);
    button.classList.toggle('is-downloading', !!state.downloading);
  }
  function refreshDrawerButtons() {
    refreshDrawerButton('heart');
    refreshDrawerButton('lung');
  }
  function drawerAuscultationMarkup() {
    return '<section class="shb-ausc-menu" data-shb-auscultation-menu="1">' +
      '<button type="button" class="shb-ausc-parent" data-shb-ausc-toggle aria-expanded="false" aria-controls="shbAuscultationSubmenu">' +
        '<span class="shb-ausc-parent-main"><svg class="shb-ausc-parent-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 21V9"/><path d="M12 12c-1.8-4.8-6.8-6.1-8.4-2.3-1.6 3.8 1.3 8.1 5.3 8.1 1.8 0 3.1-1.1 3.1-2.9"/><path d="M12 12c1.8-4.8 6.8-6.1 8.4-2.3 1.6 3.8-1.3 8.1-5.3 8.1-1.8 0-3.1-1.1-3.1-2.9"/></svg><span>Auscultation Library</span></span>' +
        '<span class="shb-ausc-total">108 sounds</span><svg class="shb-ausc-chevron" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m6 9 6 6 6-6"/></svg>' +
      '</button>' +
      '<div class="shb-ausc-children" id="shbAuscultationSubmenu" role="list" hidden>' +
        '<div class="shb-ausc-child" data-system="heart" role="listitem"><button type="button" class="shb-ausc-child-open" data-shb-ausc-open="heart"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M20.8 8.8c0 5.1-8.8 11-8.8 11s-8.8-5.9-8.8-11A4.8 4.8 0 0 1 12 6.1a4.8 4.8 0 0 1 8.8 2.7Z"/><path d="M3.5 12h4l2-4 3.1 8 2.1-4h5.8"/></svg><span>Heart Auscultation</span><small class="shb-ausc-child-count">77</small></button><button type="button" class="shb-ausc-download" data-shb-ausc-download="heart" aria-label="Download Heart Auscultation" title="Download Heart Auscultation"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3v12m-5-5 5 5 5-5M4 18v3h16v-3"/></svg></button></div>' +
        '<div class="shb-ausc-child" data-system="lung" role="listitem"><button type="button" class="shb-ausc-child-open" data-shb-ausc-open="lung"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 3v8"/><path d="M10 8c-1.8 0-3.1 1.4-4.2 4.2C4.5 15.6 3.5 18 3.5 20c0 1.2 1 1.7 2.2 1.7 3.7 0 6.3-2.7 6.3-6.4V9.8C12 8.6 11.2 8 10 8Z"/><path d="M14 8c1.8 0 3.1 1.4 4.2 4.2 1.3 3.4 2.3 5.8 2.3 7.8 0 1.2-1 1.7-2.2 1.7-3.7 0-6.3-2.7-6.3-6.4V9.8C12 8.6 12.8 8 14 8Z"/><path d="M12 11c-1.2 1.4-2.4 2.1-3.7 2.1M12 11c1.2 1.4 2.4 2.1 3.7 2.1"/></svg><span>Lung Auscultation</span><small class="shb-ausc-child-count">31</small></button><button type="button" class="shb-ausc-download" data-shb-ausc-download="lung" aria-label="Download Lung Auscultation" title="Download Lung Auscultation"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3v12m-5-5 5 5 5-5M4 18v3h16v-3"/></svg></button></div>' +
      '</div></section>';
  }
  function installDrawerAuscultationStyles() {
    if (document.getElementById('shb-auscultation-drawer-styles')) return;
    var style = document.createElement('style');
    style.id = 'shb-auscultation-drawer-styles';
    style.textContent = [
      '.phone .shb-ausc-menu{margin:9px 0 4px;padding:0 2px}',
      '.phone .shb-ausc-parent{box-sizing:border-box;width:100%;min-height:48px;display:flex;align-items:center;justify-content:space-between;gap:12px;padding:11px 12px;border:1px solid rgba(56,189,248,.28);border-radius:14px;background:linear-gradient(110deg,rgba(47,139,255,.16),rgba(56,189,248,.07));color:#e7f4ff;text-align:left;font-family:inherit;font-size:14px;font-weight:700;line-height:1.3;cursor:pointer}',
      '.phone .shb-ausc-parent-main{display:flex;align-items:center;gap:11px;min-width:0}',
      '.phone .shb-ausc-parent-icon{width:21px;height:21px;flex:none;color:#62c6ff}',
      '.phone .shb-ausc-total{margin-left:auto;padding:4px 8px;border:1px solid rgba(56,189,248,.24);border-radius:999px;background:rgba(56,189,248,.10);color:#8fd8ff;font-size:10px;font-weight:800;white-space:nowrap}',
      '.phone .shb-ausc-chevron{width:17px;height:17px;flex:none;color:#8fc6ff;transition:transform .18s ease}',
      '.phone .shb-ausc-parent[aria-expanded=true] .shb-ausc-chevron{transform:rotate(180deg)}',
      '.phone .shb-ausc-children{display:grid;gap:5px;padding:7px 0 2px 9px}',
      '.phone .shb-ausc-children[hidden]{display:none!important}',
      '.phone .shb-ausc-child{box-sizing:border-box;min-height:45px;display:flex;align-items:center;gap:7px;padding:5px 7px 5px 10px;border-inline-start:2px solid rgba(56,189,248,.28);border-radius:0 11px 11px 0;color:#b9cde4;background:rgba(18,43,70,.34);font-size:13.5px;font-weight:650}',
      '.phone .shb-ausc-child-open{flex:1;min-width:0;min-height:35px;display:flex;align-items:center;gap:10px;padding:4px 2px;border:0;background:transparent;color:inherit;text-align:left;font:inherit}',
      '.phone .shb-ausc-child-open svg{width:19px;height:19px;flex:none}',
      '.phone .shb-ausc-download{width:34px;height:34px;flex:none;display:grid;place-items:center;border:1px solid rgba(56,189,248,.2);border-radius:10px;background:rgba(44,139,210,.1);color:#8fd8ff}',
      '.phone .shb-ausc-download svg{width:17px;height:17px;stroke:currentColor;fill:none;stroke-width:1.9;stroke-linecap:round;stroke-linejoin:round}',
      '.phone .shb-ausc-download:disabled{opacity:.65;cursor:default}',
      '.phone .shb-ausc-download.is-installed{color:#6ee7b7;border-color:rgba(110,231,183,.25)}',
      '.phone .shb-ausc-download.is-downloading{color:#8fd8ff}',
      '.phone .shb-ausc-download-spinner{width:15px;height:15px;border:2px solid rgba(143,216,255,.25);border-top-color:#8fd8ff;border-radius:50%;animation:shbAuscSpin .8s linear infinite}',
      '.phone .shb-ausc-child svg{width:19px;height:19px;flex:none}',
      '.phone .shb-ausc-child[data-system=heart] svg{color:#f28b9a}',
      '.phone .shb-ausc-child[data-system=lung] svg{color:#64c6ff}',
      '.phone.light .shb-ausc-parent{color:#173451;background:linear-gradient(110deg,rgba(47,139,255,.10),rgba(56,189,248,.05));border-color:rgba(47,139,255,.25)}',
      '.phone.light .shb-ausc-child{color:#395571;background:rgba(47,139,255,.045)}',
      '.phone.light .shb-ausc-total,.phone.light .shb-ausc-child-count{color:#17669b;background:rgba(47,139,255,.08);border-color:rgba(47,139,255,.18)}',
      '@keyframes shbAuscSpin{to{transform:rotate(360deg)}}'
    ].join('');
    document.head.appendChild(style);
  }
  function ensureAuscultationDrawerEntry(drawer) {
    if (!drawer || !drawer.querySelector) return false;
    var body = drawer.querySelector('.dr-body');
    if (!body) return false;
    if (body.querySelector('[data-shb-auscultation-menu]')) return true;
    installDrawerAuscultationStyles();
    body.insertAdjacentHTML('afterbegin', drawerAuscultationMarkup());
    return !!body.querySelector('[data-shb-auscultation-menu]');
  }
  function installDrawerToggleRecovery() {
    var previousToggleDrawer = window.toggleDrawer;
    if (typeof previousToggleDrawer !== 'function' ||
        previousToggleDrawer.__shbAuscultationDrawerRecovery) return false;
    function recoveredToggleDrawer() {
      var result = previousToggleDrawer.apply(this, arguments);
      var drawer = document.getElementById('drawer');
      if (drawer && drawer.classList && drawer.classList.contains('open')) {
        ensureAuscultationDrawerEntry(drawer);
        refreshDrawerButtons();
      }
      return result;
    }
    recoveredToggleDrawer.__shbAuscultationDrawerRecovery = true;
    recoveredToggleDrawer.__shbPreviousToggleDrawer = previousToggleDrawer;
    window.toggleDrawer = recoveredToggleDrawer;
    var drawer = document.getElementById('drawer');
    if (drawer && drawer.classList && drawer.classList.contains('open')) {
      ensureAuscultationDrawerEntry(drawer);
      refreshDrawerButtons();
    }
    return true;
  }
  function downloadPack(system) {
    if (!ROUTES[system]) return false;
    var state = packState(system);
    if (state.installed) {
      notify(TITLES[system] + ' is already downloaded.');
      refreshDrawerButton(system);
      return true;
    }
    if (state.downloading) {
      notify(TITLES[system] + ' is already downloading.');
      return true;
    }
    var started = false;
    try { started = !!window.ShbaceNative.startAuscultationPackDownload(system); }
    catch (_) { notify('Could not start the ' + TITLES[system] + ' download.'); }
    if (started) {
      notify(TITLES[system] + ' download started.');
      refreshPackPage(system);
    } else {
      notify(TITLES[system] + ' download could not start. Check the connection and try again.');
    }
    refreshDrawerButton(system);
    return started;
  }
  function openAuscultation(system) {
    if (!ROUTES[system]) return false;
    setCurrentPage(ROUTES[system]);
    if (typeof window.renderAppDemo === 'function') window.renderAppDemo();
    if (typeof window.toggleDrawer === 'function') window.toggleDrawer(false);
    return true;
  }

  var mountedHosts = new Map();
  var adapterPromise = null;
  var adapterPromiseSystem = '';
  function ensureAuscultationAdapter(system) {
    if (window.__shbAuscultationAssets && window.__shbAuscultationAssets.system === system) return Promise.resolve();
    if (adapterPromise && adapterPromiseSystem === system) return adapterPromise;
    adapterPromiseSystem = system;
    adapterPromise = new Promise(function (resolve, reject) {
      var old = document.getElementById('shb-auscultation-adapter-script');
      if (old) old.remove();
      var script = document.createElement('script');
      script.id = 'shb-auscultation-adapter-script';
      script.async = true;
      script.src = new URL('js/auscultation/' + system + '/native-assets.js?v=shbace-integrated-3', document.baseURI).href;
      script.onload = function () {
        if (window.__shbAuscultationAssets && window.__shbAuscultationAssets.system === system) resolve();
        else reject(new Error('The offline ' + system + ' adapter did not initialize.'));
      };
      script.onerror = function () { reject(new Error('Could not load the offline ' + system + ' adapter.')); };
      document.head.appendChild(script);
    }).finally(function () { adapterPromise = null; adapterPromiseSystem = ''; });
    return adapterPromise;
  }
  function mountIntegratedHost(host) {
    if (!host || host.dataset.shbMounted === 'true' || host.dataset.shbMounting === 'true') return;
    var system = host.getAttribute('data-system') === 'lung' ? 'lung' : 'heart';
    host.dataset.shbMounting = 'true';
    var shadow = host.shadowRoot || host.attachShadow({ mode: 'open' });
    var base = new URL('js/auscultation/' + system + '/', document.baseURI);
    var cssFiles = ['styles.css', 'lung.css?v=3', 'teaching.css?v=4', 'library-pro.css?v=9',
      system === 'heart' ? 'heart-only.css' : 'lung-only.css'];
    var links = cssFiles.map(function (file) {
      return '<link rel="stylesheet" href="' + new URL(file, base).href + '">';
    }).join('');
    shadow.innerHTML = links + '<link rel="stylesheet" href="' +
      new URL('../shbace-integrated.css?v=2', base).href + '"><div class="shb-ausc-runtime shb-ausc-layout medara-library"><div class="shb-ausc-template-loading">Opening auscultation library…</div></div>';
    var root = shadow.querySelector('.shb-ausc-runtime');
    fetch(new URL('index.html', base), { cache: 'no-store' }).then(function (response) {
      if (!response.ok) throw new Error('Auscultation interface template is unavailable.');
      return response.text();
    }).then(function (html) {
      var parsed = new DOMParser().parseFromString(html, 'text/html');
      var shell = parsed.querySelector('.library-shell');
      if (!shell) throw new Error('Auscultation interface template is incomplete.');
      root.innerHTML = '';
      root.appendChild(document.importNode(shell, true));
      if (!root.querySelector('#toast')) {
        var toastEl = document.createElement('div');
        toastEl.id = 'toast'; toastEl.className = 'toast'; toastEl.setAttribute('role', 'status');
        root.appendChild(toastEl);
      }
      var heading = root.querySelector('.library-heading');
      var systemBar = root.querySelector('.system-bar');
      if (heading) heading.remove();
      if (systemBar) systemBar.remove();
      var eyebrow = root.querySelector('.viewer-title .small-eyebrow');
      if (eyebrow) eyebrow.textContent = '3D ANATOMY';
      var hint = root.querySelector('.scene-hint');
      if (hint) hint.textContent = 'Drag to rotate · Select a point to listen';
      var boneOpacity = root.querySelector('#bone-opacity');
      if (boneOpacity) boneOpacity.value = system === 'heart' ? '17' : '22';
      var callout = root.querySelector('.selected-callout');
      var controls = root.querySelector('.view-controls');
      if (callout && controls) controls.insertAdjacentElement('afterend', callout);
      return ensureAuscultationAdapter(system);
    }).then(function () {
      return import(new URL('auscultation-pro.js?v=shbace-integrated-4', base).href);
    }).then(function (runtime) {
      if (!host.isConnected) return;
      var dispose = runtime.mountAuscultation(root, system);
      mountedHosts.set(host, { dispose: dispose });
      host.dataset.shbMounted = 'true';
      delete host.dataset.shbMounting;
    }).catch(function (error) {
      delete host.dataset.shbMounting;
      var message = root.querySelector('#model-loading') || root.querySelector('.shb-ausc-template-loading');
      if (message) message.textContent = 'Could not open the auscultation library: ' + String(error && error.message || error);
      console.error('Shbace auscultation mount failed:', error);
    });
  }
  function scanIntegratedHosts() {
    document.querySelectorAll('[data-shb-ausc-host]').forEach(mountIntegratedHost);
    mountedHosts.forEach(function (mounted, host) {
      if (host.isConnected) return;
      try { if (mounted.dispose) mounted.dispose(); } catch (_) {}
      mountedHosts.delete(host);
    });
  }

  var style = document.createElement('style');
  style.id = 'shb-android-auscultation-page-styles';
  style.textContent =
    '.phone .shb-ausc-pack-page{min-height:calc(100dvh - 58px);background:#06142a;color:#e7f2ff;padding:14px;box-sizing:border-box}' +
    '.phone .shb-ausc-pack-gate{max-width:620px;margin:26px auto;padding:22px;border:1px solid rgba(68,153,229,.25);border-radius:22px;background:linear-gradient(155deg,rgba(20,54,88,.92),rgba(6,20,42,.98));box-shadow:0 18px 42px rgba(0,0,0,.22);text-align:center}' +
    '.phone .shb-ausc-gate-icon{font-size:42px;color:#f18b9a;line-height:1.3}.phone .shb-ausc-gate-icon.lung{color:#76c7ec}' +
    '.phone .shb-ausc-kicker{font-size:10px;letter-spacing:.17em;color:#76bff4;font-weight:800}' +
    '.phone .shb-ausc-pack-gate h1{font-size:24px;margin:8px 0}.phone .shb-ausc-pack-gate p{color:#afc5dc;font-size:13px;line-height:1.6}' +
    '.phone .shb-ausc-pack-facts{display:grid;grid-template-columns:repeat(3,1fr);gap:8px;margin:20px 0}' +
    '.phone .shb-ausc-pack-facts div{padding:12px 6px;border-radius:13px;background:rgba(77,152,220,.09);border:1px solid rgba(77,152,220,.15)}' +
    '.phone .shb-ausc-pack-facts b{display:block;font-size:20px;color:#eaf6ff}.phone .shb-ausc-pack-facts small{display:block;color:#8eabc8;font-size:10px;margin-top:3px}' +
    '.phone .shb-ausc-pack-status{min-height:36px}.phone .shb-ausc-primary{width:100%;min-height:48px;border:0;border-radius:14px;background:linear-gradient(105deg,#1678d7,#25a9d1);color:#fff;font-size:14px;font-weight:800}' +
    '.phone .shb-ausc-primary:disabled{opacity:.65}.phone .shb-ausc-pack-note{display:block;color:#88a6c4;font-size:10px;line-height:1.5;margin-top:12px}' +
    '.phone .shb-ausc-integrated{display:block;width:100%;min-width:0;margin:0;padding:0;background:transparent}' +
    '.phone .shb-ausc-pack-page progress{width:100%;accent-color:#28b7e8}.phone .shb-ausc-download-spinner{width:16px;height:16px;border:2px solid rgba(255,255,255,.35);border-top-color:#fff;border-radius:50%;display:inline-block;animation:shbAuscPackSpin .8s linear infinite}' +
    '@keyframes shbAuscPackSpin{to{transform:rotate(360deg)}}';
  document.head.appendChild(style);

  if (typeof window.__shbRegisterPage === 'function') {
    window.__shbRegisterPage(ROUTES.heart, function () { return renderPackPage('heart'); }, 'subjects');
    window.__shbRegisterPage(ROUTES.lung, function () { return renderPackPage('lung'); }, 'subjects');
  }
  window.shbOpenAuscultationPage = openAuscultation;
  window.shbDownloadAuscultationPack = function (system) { return downloadPack(system || 'heart'); };
  window.__SHBACE_AUSCULTATION_LIBRARY__ = {
    version:3,
    state:function (system) { return packState(system || 'heart'); },
    refresh:function (system) { refreshPackPage(system || 'heart'); },
    refreshDrawer:refreshDrawerButtons
  };

  document.addEventListener('click', function (event) {
    var pageDownload = event.target && event.target.closest
      ? event.target.closest('[data-shb-pack-download]') : null;
    if (pageDownload) {
      event.preventDefault();
      downloadPack(pageDownload.getAttribute('data-shb-pack-download'));
      return;
    }
    var open = event.target && event.target.closest
      ? event.target.closest('[data-shb-ausc-open]') : null;
    if (open) {
      event.preventDefault();
      openAuscultation(open.getAttribute('data-shb-ausc-open'));
      return;
    }
    var download = event.target && event.target.closest
      ? event.target.closest('[data-shb-ausc-download]') : null;
    if (download) {
      var system = download.getAttribute('data-shb-ausc-download');
      if (ROUTES[system]) {
        event.preventDefault();
        downloadPack(system);
      }
    }
  }, true);

  function onPackEvent(event) {
    var detail = event && event.detail;
    if (!detail || !ROUTES[detail.system]) return;
    var system = detail.system;
    if (detail.status === 'error') {
      notify(TITLES[system] + ' download failed: ' + String(detail.error || 'Unknown error'));
    }
    if (detail.status === 'installed') {
      notify(TITLES[system] + ' is ready for offline use.');
    }
    refreshPackPage(system);
  }
  installDrawerToggleRecovery();

  var auscultationPageObserver = new MutationObserver(scanIntegratedHosts);
  if (document.body) auscultationPageObserver.observe(document.body, { childList:true, subtree:true });
  scanIntegratedHosts();
  window.addEventListener('shbace-auscultation-pack-progress', onPackEvent);
  window.addEventListener('shbace-auscultation-pack-result', onPackEvent);
  setTimeout(refreshDrawerButtons, 0);
})();
