/* SHBACE Medical · Core Runtime v1
 * Local Android-only foundation. No remote code, no storage migration, no feature rewrites.
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
  if (!isNativeAndroid() || window.SHBACECore) return;

  var startedAt = Date.now();
  var eventListeners = new Map();
  var services = new Map();
  var diagnosticEntries = [];
  var diagnosticSequence = 0;
  var MAX_DIAGNOSTICS = 100;

  var diagnostics = Object.freeze({
    record: function (level, code, message, details) {
      var entry = Object.freeze({
        id: ++diagnosticSequence,
        at: new Date().toISOString(),
        level: String(level || 'info'),
        code: String(code || 'CORE_EVENT'),
        message: String(message || ''),
        details: details == null ? null : details
      });
      diagnosticEntries.push(entry);
      if (diagnosticEntries.length > MAX_DIAGNOSTICS) diagnosticEntries.shift();
      return entry;
    },
    snapshot: function () { return diagnosticEntries.slice(); },
    clear: function () { diagnosticEntries.length = 0; }
  });

  function on(eventName, handler) {
    var name = String(eventName || '').trim();
    if (!name || typeof handler !== 'function') throw new TypeError('A named event and function handler are required.');
    var listeners = eventListeners.get(name);
    if (!listeners) { listeners = new Set(); eventListeners.set(name, listeners); }
    listeners.add(handler);
    return function unsubscribe() { return off(name, handler); };
  }
  function once(eventName, handler) {
    var unsubscribe = null;
    function onceHandler(payload) {
      if (unsubscribe) unsubscribe();
      handler(payload);
    }
    unsubscribe = on(eventName, onceHandler);
    return unsubscribe;
  }
  function off(eventName, handler) {
    var name = String(eventName || '');
    var listeners = eventListeners.get(name);
    if (!listeners) return false;
    var removed = listeners.delete(handler);
    if (!listeners.size) eventListeners.delete(name);
    return removed;
  }
  function emit(eventName, payload) {
    var name = String(eventName || '').trim();
    if (!name) return { delivered: 0, errors: 0 };
    var listeners = eventListeners.get(name);
    if (!listeners || !listeners.size) return { delivered: 0, errors: 0 };
    var delivered = 0, errors = 0;
    Array.from(listeners).forEach(function (handler) {
      try { handler(payload); delivered++; }
      catch (error) {
        errors++;
        diagnostics.record('error', 'EVENT_HANDLER_FAILED', 'An event listener failed.', {
          event: name, error: String(error && error.message || error)
        });
      }
    });
    return { delivered: delivered, errors: errors };
  }

  var events = Object.freeze({
    on: on, once: once, off: off, emit: emit,
    listenerCount: function (eventName) {
      var listeners = eventListeners.get(String(eventName || ''));
      return listeners ? listeners.size : 0;
    }
  });

  var serviceApi = Object.freeze({
    register: function (name, value, options) {
      var key = String(name || '').trim();
      var opts = options && typeof options === 'object' ? options : {};
      if (!key || value == null) return { ok: false, reason: 'invalid-service' };
      if (services.has(key) && opts.replace !== true) return { ok: false, reason: 'already-registered' };
      services.set(key, value);
      emit('core:service-registered', { name: key, replaced: !!opts.replace });
      return { ok: true, name: key };
    },
    get: function (name) { return services.get(String(name || '')) || null; },
    has: function (name) { return services.has(String(name || '')); },
    remove: function (name, expectedValue) {
      var key = String(name || '');
      if (!services.has(key)) return false;
      if (arguments.length > 1 && services.get(key) !== expectedValue) return false;
      services.delete(key);
      emit('core:service-removed', { name: key });
      return true;
    },
    list: function () { return Array.from(services.keys()).sort(); }
  });

  if (window.ShbaceNative) serviceApi.register('android.native', window.ShbaceNative);

  var core = Object.freeze({
    id: 'shbace.android.core',
    version: '1.0.0',
    apiVersion: 1,
    platform: 'android',
    startedAt: startedAt,
    events: events,
    services: serviceApi,
    diagnostics: diagnostics,
    isReady: function () { return true; }
  });

  Object.defineProperty(window, 'SHBACECore', {
    value: core, configurable: false, enumerable: true, writable: false
  });
  emit('core:ready', {
    id: core.id, version: core.version, apiVersion: core.apiVersion, platform: core.platform
  });
})();