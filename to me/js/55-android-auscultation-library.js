/* Android-only Auscultation Library: independent Heart and Lung packs. */
(function () {
  'use strict';
  function isNativeAndroid() {
    try {
      var c = window.Capacitor;
      return !!(c && c.isNativePlatform && c.isNativePlatform() &&
        (!c.getPlatform || c.getPlatform() === 'android') && window.ShbaceNative);
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
          facts:[['77','distinct sounds'],['77','recordings'],['3D','thorax + heart']],
          button:'Download Heart Library',
          note:'Heart downloads separately. Lung recordings are not part of this package.'
        }
      : {
          eyebrow:'RESPIRATORY AUSCULTATION',
          heading:'Lung Auscultation',
          description:'31 distinct lung sounds · patient and teaching variants · interactive anterior and posterior 3D thorax',
          facts:[['31','distinct sounds'],['73','recordings'],['3D','thorax + lungs']],
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
      body = '<div class="shb-ausc-pack-frame"><iframe title="' + esc(TITLES[system]) +
        ' Library" src="js/auscultation/' + system + '/index.html?system=' + system +
        '" loading="eager" allow="autoplay"></iframe></div>';
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
        '<h1>' + facts.heading + '</h1>' +
        '<p>' + facts.description + '</p>' +
        '<div class="shb-ausc-pack-facts">' + facts.facts.map(function (item) {
          return '<div><b>' + item[0] + '</b><small>' + item[1] + '</small></div>';
        }).join('') + '</div>' +
        '<p class="shb-ausc-pack-status" role="status">' + status + '</p>' +
        (state.downloading ? '<progress max="100" value="' + pct + '"></progress><small>' + pct + '%</small>' : '') +
        '<button type="button" class="shb-ausc-primary" data-shb-pack-download="' + system + '" ' +
          (state.downloading ? 'disabled' : '') + '>' +
          (state.downloading ? 'Downloading…' : facts.button) + '</button>' +
        '<small class="shb-ausc-pack-note">' + facts.note + '</small>' +
      '</section>';
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
    '.phone .shb-ausc-pack-frame{height:calc(100dvh - 104px);min-height:520px;margin:-14px}.phone .shb-ausc-pack-frame iframe{display:block;width:100%;height:100%;border:0;background:#071427}' +
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
    version:2,
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
  window.addEventListener('shbace-auscultation-pack-progress', onPackEvent);
  window.addEventListener('shbace-auscultation-pack-result', onPackEvent);
  setTimeout(refreshDrawerButtons, 0);
})();
