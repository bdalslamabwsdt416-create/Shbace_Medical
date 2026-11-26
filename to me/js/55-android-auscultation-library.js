/* Shbace Medical · Android-only Heart Auscultation route and package controls. */
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

  var HEART_ROUTE = 'auscultationheart';
  var lastPackState = null;
  function esc(value) {
    return String(value == null ? '' : value).replace(/[&<>"']/g, function (c) {
      return { '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[c];
    });
  }
  function packState(system) {
    try {
      var value = window.ShbaceNative.getAuscultationPackState(system || 'heart');
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
  function renderHeartPage() {
    var state = packState('heart');
    lastPackState = state;
    var head = typeof window.appHeader === 'function' ? window.appHeader('Heart Auscultation') : '';
    var body;
    if (state.installed) {
      body = '<div class="shb-ausc-heart-frame"><iframe title="Heart Auscultation Library" ' +
        'src="js/auscultation/heart/index.html?system=heart" loading="eager" allow="autoplay"></iframe></div>';
    } else {
      var progress = Number(state.downloadedBytes || 0);
      var total = Number(state.totalBytes || state.packageBytes || 0);
      var pct = total > 0 ? Math.max(0, Math.min(100, Math.round(progress / total * 100))) : 0;
      var status = state.downloading
        ? 'Downloading the independent Heart package…'
        : state.error
          ? 'The last download did not complete. ' + esc(state.error)
          : 'Download the Heart package once. Its recordings and 3D models will then remain available offline.';
      body = '<section class="shb-ausc-heart-gate">' +
        '<div class="shb-ausc-gate-icon">♡</div>' +
        '<span class="shb-ausc-kicker">CARDIAC AUSCULTATION</span>' +
        '<h1>Heart Auscultation</h1>' +
        '<p>77 primary heart sounds · five standard listening areas · interactive 3D cardiac anatomy</p>' +
        '<div class="shb-ausc-pack-facts"><div><b>77</b><small>recordings</small></div><div><b>3D</b><small>thorax + heart</small></div><div><b>Offline</b><small>after download</small></div></div>' +
        '<p class="shb-ausc-pack-status" role="status">' + status + '</p>' +
        (state.downloading ? '<progress max="100" value="' + pct + '"></progress><small>' + pct + '%</small>' : '') +
        '<button type="button" class="shb-ausc-primary" data-shb-heart-download ' +
          (state.downloading ? 'disabled' : '') + '>' +
          (state.downloading ? 'Downloading…' : 'Download Heart Library') + '</button>' +
        '<small class="shb-ausc-pack-note">Heart downloads separately. Lung recordings are not part of this package.</small>' +
      '</section>';
    }
    return head + '<div class="shb-ausc-heart-page">' + body + '</div>';
  }
  function currentPage() {
    try { return typeof appPage === 'string' ? appPage : ''; }
    catch (_) { return typeof window.appPage === 'string' ? window.appPage : ''; }
  }
  function setCurrentPage(route) {
    try { appPage = route; }
    catch (_) { window.appPage = route; }
  }
  function refreshHeartPage() {
    if (currentPage() === HEART_ROUTE && typeof window.renderAppDemo === 'function') {
      window.renderAppDemo();
    }
    refreshDrawerButton();
  }
  function refreshDrawerButton() {
    var button = document.querySelector('[data-shb-ausc-download="heart"]');
    if (!button) return;
    var state = packState('heart');
    button.disabled = !!state.downloading || !!state.installed;
    button.setAttribute('aria-label', state.installed ? 'Heart Library downloaded' :
      state.downloading ? 'Downloading Heart Library' : 'Download Heart Library');
    button.title = state.installed ? 'Downloaded' : state.downloading ? 'Downloading…' : 'Download Heart Library';
    button.innerHTML = state.installed
      ? '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m5 12 4 4L19 6"/></svg>'
      : state.downloading
        ? '<span class="shb-ausc-download-spinner" aria-hidden="true"></span>'
        : '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3v12m-5-5 5 5 5-5M4 18v3h16v-3"/></svg>';
    button.classList.toggle('is-installed', !!state.installed);
    button.classList.toggle('is-downloading', !!state.downloading);
  }
  function downloadHeart() {
    var state = packState('heart');
    if (state.installed) {
      notify('Heart Auscultation is already downloaded.');
      refreshDrawerButton();
      return true;
    }
    if (state.downloading) {
      notify('Heart Library is already downloading.');
      return true;
    }
    var started = false;
    try { started = !!window.ShbaceNative.startAuscultationPackDownload('heart'); }
    catch (error) { notify('Could not start the Heart download.'); }
    if (started) {
      notify('Heart Library download started.');
      refreshHeartPage();
      refreshDrawerButton();
    } else {
      notify('Heart Library download could not start. Check the connection and try again.');
    }
    return started;
  }
  function openAuscultation(system) {
    if (system !== 'heart') {
      notify('Lung Auscultation will be added in its separate stage.');
      return false;
    }
    setCurrentPage(HEART_ROUTE);
    if (typeof window.renderAppDemo === 'function') window.renderAppDemo();
    if (typeof window.toggleDrawer === 'function') window.toggleDrawer(false);
    return true;
  }

  var style = document.createElement('style');
  style.id = 'shb-android-auscultation-page-styles';
  style.textContent =
    '.phone .shb-ausc-heart-page{min-height:calc(100dvh - 58px);background:#06142a;color:#e7f2ff;padding:14px;box-sizing:border-box}' +
    '.phone .shb-ausc-heart-gate{max-width:620px;margin:26px auto;padding:22px;border:1px solid rgba(68,153,229,.25);border-radius:22px;background:linear-gradient(155deg,rgba(20,54,88,.92),rgba(6,20,42,.98));box-shadow:0 18px 42px rgba(0,0,0,.22);text-align:center}' +
    '.phone .shb-ausc-gate-icon{font-size:42px;color:#f18b9a;line-height:1.3}.phone .shb-ausc-kicker{font-size:10px;letter-spacing:.17em;color:#76bff4;font-weight:800}' +
    '.phone .shb-ausc-heart-gate h1{font-size:24px;margin:8px 0}.phone .shb-ausc-heart-gate p{color:#afc5dc;font-size:13px;line-height:1.6}' +
    '.phone .shb-ausc-pack-facts{display:grid;grid-template-columns:repeat(3,1fr);gap:8px;margin:20px 0}' +
    '.phone .shb-ausc-pack-facts div{padding:12px 6px;border-radius:13px;background:rgba(77,152,220,.09);border:1px solid rgba(77,152,220,.15)}' +
    '.phone .shb-ausc-pack-facts b{display:block;font-size:20px;color:#eaf6ff}.phone .shb-ausc-pack-facts small{display:block;color:#8eabc8;font-size:10px;margin-top:3px}' +
    '.phone .shb-ausc-pack-status{min-height:36px}.phone .shb-ausc-primary{width:100%;min-height:48px;border:0;border-radius:14px;background:linear-gradient(105deg,#1678d7,#25a9d1);color:#fff;font-size:14px;font-weight:800}' +
    '.phone .shb-ausc-primary:disabled{opacity:.65}.phone .shb-ausc-pack-note{display:block;color:#88a6c4;font-size:10px;line-height:1.5;margin-top:12px}' +
    '.phone .shb-ausc-heart-frame{height:calc(100dvh - 104px);min-height:520px;margin:-14px}.phone .shb-ausc-heart-frame iframe{display:block;width:100%;height:100%;border:0;background:#071427}' +
    '.phone .shb-ausc-heart-page progress{width:100%;accent-color:#28b7e8}.phone .shb-ausc-download-spinner{width:16px;height:16px;border:2px solid rgba(255,255,255,.35);border-top-color:#fff;border-radius:50%;display:inline-block;animation:shbAuscSpin .8s linear infinite}' +
    '@keyframes shbAuscSpin{to{transform:rotate(360deg)}}';
  document.head.appendChild(style);

  if (typeof window.__shbRegisterPage === 'function') {
    window.__shbRegisterPage(HEART_ROUTE, renderHeartPage, 'subjects');
  }
  window.shbOpenAuscultationPage = openAuscultation;
  window.shbDownloadAuscultationPack = downloadHeart;
  window.__SHBACE_AUSCULTATION_LIBRARY__ = {
    version:1,
    state:function(){ return packState('heart'); },
    refresh:function(){ refreshHeartPage(); },
    refreshDrawer:refreshDrawerButton
  };

  document.addEventListener('click', function (event) {
    var pageDownload = event.target && event.target.closest ? event.target.closest('[data-shb-heart-download]') : null;
    if (pageDownload) {
      event.preventDefault();
      downloadHeart();
      return;
    }
    var open = event.target && event.target.closest ? event.target.closest('[data-shb-ausc-open]') : null;
    if (open) {
      event.preventDefault();
      openAuscultation(open.getAttribute('data-shb-ausc-open'));
      return;
    }
    var download = event.target && event.target.closest ? event.target.closest('[data-shb-ausc-download]') : null;
    if (download && download.getAttribute('data-shb-ausc-download') === 'heart') {
      event.preventDefault();
      downloadHeart();
    }
  }, true);

  function onPackEvent(event) {
    if (!event || !event.detail || event.detail.system !== 'heart') return;
    if (event.detail.status === 'error') notify('Heart Library download failed: ' + String(event.detail.error || 'Unknown error'));
    if (event.detail.status === 'installed') notify('Heart Library is ready for offline use.');
    refreshHeartPage();
  }
  window.addEventListener('shbace-auscultation-pack-progress', onPackEvent);
  window.addEventListener('shbace-auscultation-pack-result', onPackEvent);
  setTimeout(refreshDrawerButton, 0);
})();