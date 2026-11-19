/* SHBACE Medical · Android Page Builder v1
 * Local renderer for bounded declarative layout trees. It never evaluates remote code.
 */
(function () {
  'use strict';
  function isNativeAndroid() {
    try {
      var c = window.Capacitor;
      return !!(c && typeof c.getPlatform === 'function' && c.getPlatform() === 'android' &&
        typeof c.isNativePlatform === 'function' && c.isNativePlatform());
    } catch (e) { return false; }
  }
  if (!isNativeAndroid() || window.SHBACEPageBuilder) return;

  var MAX_DEPTH = 4;
  var MAX_BLOCKS = 120;
  var groupSequence = 0;

  function esc(value) {
    return String(value == null ? '' : value).replace(/[&<>"']/g, function (c) {
      return { '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[c];
    });
  }
  function bounded(value, min, max, fallback) {
    var n = Number(value);
    return Number.isFinite(n) ? Math.max(min, Math.min(max, Math.round(n))) : fallback;
  }
  function render(blocks, renderLeaf, context) {
    if (!Array.isArray(blocks) || typeof renderLeaf !== 'function') return '';
    var budget = { count:0 };
    var prefix = String(context || 'page').replace(/[^A-Za-z0-9_-]/g, '_').slice(0,48) || 'page';
    function children(items, depth) {
      if (!Array.isArray(items) || depth > MAX_DEPTH) return '';
      return items.map(function (block) { return node(block, depth); }).join('');
    }
    function node(block, depth) {
      if (!block || typeof block !== 'object' || Array.isArray(block) ||
          depth > MAX_DEPTH || ++budget.count > MAX_BLOCKS) return '';
      var type = String(block.type || '');
      if (type === 'stack') {
        var stackGap = bounded(block.gap, 0, 32, 12);
        return '<div class="shb-pb-stack" style="--shb-pb-gap:' + stackGap + 'px">' +
          children(block.children, depth + 1) + '</div>';
      }
      if (type === 'grid') {
        var columns = bounded(block.columns, 1, 3, 2);
        var gridGap = bounded(block.gap, 0, 32, 12);
        return '<div class="shb-pb-grid" style="--shb-pb-columns:' + columns +
          ';--shb-pb-gap:' + gridGap + 'px">' + children(block.children, depth + 1) + '</div>';
      }
      if (type === 'tabs') {
        var tabs = Array.isArray(block.tabs) ? block.tabs.filter(function (tab) { return tab && tab.id; }).slice(0, 6) : [];
        if (tabs.length < 2) return '';
        var group = prefix + '-tabs-' + (++groupSequence);
        var first = String(block.defaultTab || (tabs[0] && tabs[0].id) || '');
        if (!tabs.some(function (tab) { return String(tab.id) === first; })) first = String((tabs[0] && tabs[0].id) || '');
        var buttons = tabs.map(function (tab) {
          if (!tab || !tab.id) return '';
          var id = String(tab.id);
          var active = id === first;
          return '<button type="button" class="shb-pb-tab' + (active ? ' is-active' : '') +
            '" role="tab" aria-selected="' + (active ? 'true' : 'false') +
            '" data-shb-pb-tab="' + esc(id) + '" data-shb-pb-group="' + esc(group) + '">' +
            esc(tab.label || id) + '</button>';
        }).join('');
        var panels = tabs.map(function (tab) {
          if (!tab || !tab.id) return '';
          var id = String(tab.id), active = id === first;
          return '<section class="shb-pb-panel" role="tabpanel" data-shb-pb-panel="' +
            esc(id) + '" data-shb-pb-group="' + esc(group) + '"' +
            (active ? '' : ' hidden') + '>' + children(tab.blocks, depth + 1) + '</section>';
        }).join('');
        return '<div class="shb-pb-tabs"><div class="shb-pb-tablist" role="tablist">' +
          buttons + '</div>' + panels + '</div>';
      }
      if (type === 'accordion') {
        var items = Array.isArray(block.items) ? block.items.slice(0, 10) : [];
        return '<div class="shb-pb-accordion">' + items.map(function (item, index) {
          if (!item || typeof item.title !== 'string') return '';
          return '<details class="shb-pb-accordion-item"' + (item.open === true && index === 0 ? ' open' : '') +
            '><summary>' + esc(item.title) + '</summary><div class="shb-pb-accordion-content">' +
            children(item.blocks, depth + 1) + '</div></details>';
        }).join('') + '</div>';
      }
      try { return String(renderLeaf(block) || ''); }
      catch (error) {
        var core = window.SHBACECore;
        if (core && core.diagnostics) core.diagnostics.record('warn', 'PAGE_BUILDER_LEAF_FAILED',
          'A page builder leaf block could not be rendered.', { type:type, error:String(error && error.message || error) });
        return '';
      }
    }
    return children(blocks, 0);
  }

  function installStyles() {
    if (document.getElementById('shb-page-builder-v1-styles')) return;
    var style = document.createElement('style');
    style.id = 'shb-page-builder-v1-styles';
    style.textContent =
      '.shb-pb-stack{display:flex;flex-direction:column;gap:var(--shb-pb-gap,12px);min-width:0}' +
      '.shb-pb-grid{display:grid;grid-template-columns:repeat(var(--shb-pb-columns,2),minmax(0,1fr));gap:var(--shb-pb-gap,12px);min-width:0}' +
      '.shb-pb-grid>*{min-width:0}.shb-pb-tabs{margin:14px 0}.shb-pb-tablist{display:flex;gap:7px;overflow-x:auto;padding:2px 1px 8px;scrollbar-width:thin}' +
      '.shb-pb-tab{flex:0 0 auto;border:1px solid var(--line,rgba(130,170,210,.2));border-radius:999px;padding:8px 13px;background:transparent;color:inherit;font:inherit;cursor:pointer}' +
      '.shb-pb-tab.is-active{background:var(--mint-soft,rgba(80,210,170,.16));border-color:var(--mint,#70d7b4);color:var(--mint,#70d7b4)}' +
      '.shb-pb-panel[hidden]{display:none!important}.shb-pb-panel{min-width:0;padding-block:5px}' +
      '.shb-pb-accordion{display:grid;gap:8px;margin:12px 0}.shb-pb-accordion-item{border:1px solid var(--line,rgba(130,170,210,.2));border-radius:13px;background:var(--card,rgba(20,38,62,.3));overflow:hidden}' +
      '.shb-pb-accordion-item summary{padding:13px 15px;cursor:pointer;font-weight:700}.shb-pb-accordion-content{padding:0 13px 13px}';
    document.head.appendChild(style);
  }

  document.addEventListener('click', function (event) {
    var button = event.target && event.target.closest ? event.target.closest('[data-shb-pb-tab][data-shb-pb-group]') : null;
    if (!button) return;
    var group = button.getAttribute('data-shb-pb-group');
    var selected = button.getAttribute('data-shb-pb-tab');
    var root = button.closest('.shb-pb-tabs');
    if (!root) return;
    root.querySelectorAll('[data-shb-pb-tab][data-shb-pb-group="' + group + '"]').forEach(function (item) {
      var active = item === button;
      item.classList.toggle('is-active', active);
      item.setAttribute('aria-selected', active ? 'true' : 'false');
    });
    root.querySelectorAll('[data-shb-pb-panel][data-shb-pb-group="' + group + '"]').forEach(function (panel) {
      panel.hidden = panel.getAttribute('data-shb-pb-panel') !== selected;
    });
    event.preventDefault();
  });

  var api = Object.freeze({
    version:'1.0.0',
    platform:'android',
    maxDepth:MAX_DEPTH,
    maxBlocks:MAX_BLOCKS,
    render:render
  });
  Object.defineProperty(window, 'SHBACEPageBuilder', {
    value:api, configurable:false, enumerable:true, writable:false
  });
  if (window.SHBACECore && window.SHBACECore.services) {
    window.SHBACECore.services.register('page-builder.renderer', api);
  }
  installStyles();
  if (window.SHBACECore && window.SHBACECore.events) {
    window.SHBACECore.events.emit('page-builder:ready', { version:api.version, maxDepth:MAX_DEPTH, maxBlocks:MAX_BLOCKS });
  }
})();
