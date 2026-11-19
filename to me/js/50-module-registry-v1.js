/* SHBACE Medical · Module Registry v1
 * Registers local, allow-listed modules. Registration never downloads or evaluates code.
 */
(function () {
  'use strict';
  var core = window.SHBACECore;
  if (!core || core.platform !== 'android' || window.SHBACEModuleRegistry) return;

  var modules = new Map();
  var readyOrder = [];
  var operationQueue = Promise.resolve();

  function validId(value) { return /^[a-z][a-z0-9]*(?:[.-][a-z0-9]+)*$/.test(String(value || '')); }
  function validVersion(value) { return /^\d+\.\d+\.\d+$/.test(String(value || '')); }
  function uniqueStrings(values) {
    if (!Array.isArray(values)) return [];
    var seen = new Set(), out = [];
    values.forEach(function (value) {
      var text = String(value || '').trim();
      if (text && !seen.has(text)) { seen.add(text); out.push(text); }
    });
    return out;
  }
  function snapshot(entry) {
    return {
      id: entry.id, version: entry.version,
      dependencies: entry.dependencies.slice(), platforms: entry.platforms.slice(),
      capabilities: entry.capabilities.slice(), state: entry.state,
      registeredAt: entry.registeredAt, initializedAt: entry.initializedAt,
      error: entry.error || null
    };
  }
  function register(definition) {
    if (!definition || typeof definition !== 'object') return { ok: false, reason: 'invalid-definition' };
    var id = String(definition.id || '').trim();
    var version = String(definition.version || '').trim();
    if (!validId(id) || !validVersion(version) || typeof definition.initialize !== 'function') {
      return { ok: false, reason: 'invalid-contract' };
    }
    if (modules.has(id)) return { ok: false, reason: 'duplicate-module' };
    var dependencies = uniqueStrings(definition.dependencies);
    var platforms = uniqueStrings(definition.platforms);
    if (!platforms.length) platforms = ['android'];
    if (dependencies.indexOf(id) >= 0) return { ok: false, reason: 'self-dependency' };
    var entry = {
      id: id, version: version, dependencies: dependencies, platforms: platforms,
      capabilities: uniqueStrings(definition.capabilities),
      initialize: definition.initialize,
      dispose: typeof definition.dispose === 'function' ? definition.dispose : null,
      state: 'registered', registeredAt: new Date().toISOString(),
      initializedAt: null, cleanup: null, error: null
    };
    modules.set(id, entry);
    core.events.emit('module:registered', snapshot(entry));
    return { ok: true, module: snapshot(entry) };
  }
  function topologicalPlan(ids) {
    var requested = Array.isArray(ids) && ids.length ? uniqueStrings(ids) : Array.from(modules.keys());
    var visited = new Set(), visiting = [], plan = [];
    function visit(id) {
      var entry = modules.get(id);
      if (!entry) throw new Error('Missing module dependency: ' + id);
      if (visited.has(id)) return;
      if (visiting.indexOf(id) >= 0) throw new Error('Module dependency cycle: ' + visiting.concat([id]).join(' -> '));
      visiting.push(id);
      entry.dependencies.forEach(visit);
      visiting.pop();
      visited.add(id);
      plan.push(id);
    }
    requested.forEach(visit);
    return plan;
  }
  function validate(ids) {
    try { return { ok: true, order: topologicalPlan(ids) }; }
    catch (error) { return { ok: false, order: [], error: String(error && error.message || error) }; }
  }
  function contextFor(entry) {
    return Object.freeze({
      core: core,
      module: Object.freeze({ id: entry.id, version: entry.version, capabilities: entry.capabilities.slice() }),
      events: core.events, services: core.services, diagnostics: core.diagnostics
    });
  }
  async function initializeEntry(entry) {
    if (entry.state === 'ready') return snapshot(entry);
    if (!entry.platforms.includes(core.platform)) {
      entry.state = 'skipped';
      entry.error = 'Unsupported platform: ' + core.platform;
      core.events.emit('module:skipped', snapshot(entry));
      return snapshot(entry);
    }
    entry.dependencies.forEach(function (dependencyId) {
      var dependency = modules.get(dependencyId);
      if (!dependency || dependency.state !== 'ready') throw new Error('Dependency is not ready: ' + dependencyId);
    });
    entry.state = 'starting';
    entry.error = null;
    core.events.emit('module:starting', snapshot(entry));
    try {
      var result = await entry.initialize(contextFor(entry));
      if (typeof result === 'function') entry.cleanup = result;
      else if (result && typeof result.dispose === 'function') entry.cleanup = function () { return result.dispose.call(result); };
      else if (entry.dispose) entry.cleanup = function () { return entry.dispose(contextFor(entry)); };
      entry.state = 'ready';
      entry.initializedAt = new Date().toISOString();
      if (readyOrder.indexOf(entry.id) < 0) readyOrder.push(entry.id);
      core.diagnostics.record('info', 'MODULE_READY', 'Module initialized.', { module: entry.id, version: entry.version });
      core.events.emit('module:ready', snapshot(entry));
      return snapshot(entry);
    } catch (error) {
      entry.state = 'failed';
      entry.error = String(error && error.message || error);
      core.diagnostics.record('error', 'MODULE_INIT_FAILED', 'Module initialization failed.', { module: entry.id, error: entry.error });
      core.events.emit('module:failed', snapshot(entry));
      throw error;
    }
  }
  function serialize(operation) {
    var next = operationQueue.then(operation, operation);
    operationQueue = next.catch(function () {});
    return next;
  }
  function initialize(id) {
    return serialize(async function () {
      var validation = validate([id]);
      if (!validation.ok) throw new Error(validation.error);
      var results = [];
      for (var i = 0; i < validation.order.length; i++) results.push(await initializeEntry(modules.get(validation.order[i])));
      return results[results.length - 1] || null;
    });
  }
  function initializeAll(ids) {
    return serialize(async function () {
      var validation = validate(ids);
      if (!validation.ok) return { ok: false, initialized: [], failures: [{ error: validation.error }] };
      var initialized = [], failures = [];
      for (var i = 0; i < validation.order.length; i++) {
        var entry = modules.get(validation.order[i]);
        try {
          await initializeEntry(entry);
          if (entry.state === 'ready') initialized.push(entry.id);
        } catch (error) {
          failures.push({ module: entry.id, error: String(error && error.message || error) });
        }
      }
      return { ok: failures.length === 0, initialized: initialized, failures: failures };
    });
  }
  async function disposeEntry(entry) {
    if (!entry || entry.state !== 'ready') return false;
    try {
      if (typeof entry.cleanup === 'function') await entry.cleanup();
      entry.cleanup = null;
      entry.state = 'disposed';
      entry.initializedAt = null;
      core.events.emit('module:disposed', snapshot(entry));
      return true;
    } catch (error) {
      entry.error = String(error && error.message || error);
      entry.state = 'failed';
      core.diagnostics.record('error', 'MODULE_DISPOSE_FAILED', 'Module cleanup failed.', { module: entry.id, error: entry.error });
      throw error;
    }
  }
  function disposeAll() {
    return serialize(async function () {
      var disposed = [], failures = [];
      for (var i = readyOrder.length - 1; i >= 0; i--) {
        var id = readyOrder[i];
        try { if (await disposeEntry(modules.get(id))) disposed.push(id); }
        catch (error) { failures.push({ module: id, error: String(error && error.message || error) }); }
      }
      readyOrder.length = 0;
      return { ok: failures.length === 0, disposed: disposed, failures: failures };
    });
  }
  function unregister(id) {
    var key = String(id || ''), entry = modules.get(key);
    if (!entry) return { ok: false, reason: 'not-found' };
    if (entry.state === 'ready' || entry.state === 'starting') return { ok: false, reason: 'module-active' };
    var dependents = [];
    modules.forEach(function (candidate) {
      if (candidate.id !== key && candidate.dependencies.indexOf(key) >= 0) dependents.push(candidate.id);
    });
    if (dependents.length) return { ok: false, reason: 'has-dependents', dependents: dependents };
    modules.delete(key);
    core.events.emit('module:unregistered', { id: key });
    return { ok: true, id: key };
  }

  var api = Object.freeze({
    version: '1.0.0',
    register: register,
    validate: validate,
    initialize: initialize,
    initializeAll: initializeAll,
    disposeAll: disposeAll,
    unregister: unregister,
    get: function (id) { var entry = modules.get(String(id || '')); return entry ? snapshot(entry) : null; },
    list: function () { return Array.from(modules.values()).map(snapshot); }
  });
  Object.defineProperty(window, 'SHBACEModuleRegistry', {
    value: api, configurable: false, enumerable: true, writable: false
  });
  core.events.emit('module-registry:ready', { version: api.version });
})();