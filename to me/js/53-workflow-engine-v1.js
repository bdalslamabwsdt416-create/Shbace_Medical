/* SHBACE Medical · Workflow Engine v1
 * Android-only local rules. Remote input is declarative JSON and cannot execute code.
 */
(function () {
  'use strict';

  function isNativeAndroid() {
    try {
      var c = window.Capacitor;
      return !!(c && typeof c.getPlatform === 'function' && c.getPlatform() === 'android' &&
        typeof c.isNativePlatform === 'function' && c.isNativePlatform());
    } catch (error) { return false; }
  }

  var core = window.SHBACECore;
  var contentApi = window.__SHBACE_REMOTE_CONTENT_API__;
  var navigation = window.SHBACENavigation;
  if (!isNativeAndroid() || !core || !contentApi ||
      typeof contentApi.getCatalog !== 'function' || !navigation ||
      window.SHBACEWorkflowEngine) return;

  var TRIGGERS = Object.freeze({
    'navigation:route-changed': Object.freeze(['from', 'to', 'mode']),
    'navigation:rendered': Object.freeze(['route', 'mode'])
  });
  var subscriptions = [];
  var lastRunAt = new Map();
  var rejectedRuleIds = new Set();
  var dispatching = false;
  var MAX_RULES = 30;
  var MAX_ACTIONS_PER_EVENT = 10;

  function validId(value) {
    return /^[a-z][a-z0-9_-]{0,63}$/.test(String(value || ''));
  }

  function scalarString(value) {
    return typeof value === 'string' && value.length <= 120;
  }

  function currentCatalog() {
    try {
      var value = contentApi.getCatalog();
      return value && typeof value === 'object' ? value : {};
    } catch (error) {
      core.diagnostics.record('warn', 'WORKFLOW_CATALOG_UNAVAILABLE',
        'Remote workflow configuration could not be read.', {
          error: String(error && error.message || error)
        });
      return {};
    }
  }

  function normalizeCondition(condition, allowedFields) {
    if (!condition || typeof condition !== 'object' || Array.isArray(condition) ||
        !allowedFields.includes(String(condition.field || ''))) return null;
    var op = String(condition.op || '');
    if (op === 'equals' || op === 'notEquals') {
      if (!scalarString(condition.value)) return null;
      return { field: String(condition.field), op: op, value: condition.value };
    }
    if (op === 'oneOf' && Array.isArray(condition.value) &&
        condition.value.length >= 1 && condition.value.length <= 8 &&
        condition.value.every(scalarString)) {
      return { field: String(condition.field), op: op, value: condition.value.slice() };
    }
    return null;
  }

  function normalizeAction(action, pageIds) {
    if (!action || typeof action !== 'object' || Array.isArray(action)) return null;
    var type = String(action.type || '');
    var target = String(action.target || '');
    if (type === 'navigate') {
      if (!validId(target) || typeof navigation.isRemoteTarget !== 'function' ||
          !navigation.isRemoteTarget(target, 'v3')) return null;
      return { type: type, target: target };
    }
    if (type === 'openPage') {
      if (!validId(target) || !pageIds.has(target)) return null;
      return { type: type, target: target };
    }
    if (type === 'showMessage') {
      if (typeof action.message !== 'string') return null;
      var message = action.message;
      if (!message.trim() || message.length > 220) return null;
      return { type: type, message: message };
    }
    return null;
  }

  function normalizeRule(rule, pageIds) {
    if (!rule || typeof rule !== 'object' || Array.isArray(rule) ||
        !validId(rule.id) || !Object.prototype.hasOwnProperty.call(TRIGGERS, String(rule.trigger || ''))) return null;
    if (rule.enabled != null && typeof rule.enabled !== 'boolean') return null;
    var priority = rule.priority == null ? 0 : rule.priority;
    var cooldownMs = rule.cooldownMs == null ? 1000 : rule.cooldownMs;
    if (!Number.isInteger(priority) || priority < -100 || priority > 100 ||
        !Number.isInteger(cooldownMs) || cooldownMs < 0 || cooldownMs > 60000) return null;

    var sourceConditions = rule.conditions == null ? [] : rule.conditions;
    var sourceActions = rule.actions;
    if (!Array.isArray(sourceConditions) || sourceConditions.length > 5 ||
        !Array.isArray(sourceActions) || sourceActions.length < 1 || sourceActions.length > 3) return null;

    var allowedFields = TRIGGERS[String(rule.trigger)];
    var conditions = sourceConditions.map(function (item) {
      return normalizeCondition(item, allowedFields);
    });
    if (conditions.some(function (item) { return !item; })) return null;
    var actions = sourceActions.map(function (item) {
      return normalizeAction(item, pageIds);
    });
    if (actions.some(function (item) { return !item; })) return null;

    return {
      id: String(rule.id),
      enabled: rule.enabled !== false,
      trigger: String(rule.trigger),
      priority: priority,
      cooldownMs: cooldownMs,
      conditions: conditions,
      actions: actions
    };
  }

  function readRules() {
    var catalog = currentCatalog();
    var ui = catalog.ui && typeof catalog.ui === 'object' ? catalog.ui : {};
    var pages = Array.isArray(ui.pages) ? ui.pages : [];
    var pageIds = new Set(pages.filter(function (page) {
      return page && validId(page.id);
    }).map(function (page) { return String(page.id); }));
    var source = Array.isArray(ui.workflows) ? ui.workflows : [];
    var seen = new Set(), rules = [];
    source.slice(0, MAX_RULES).forEach(function (rule) {
      var ruleId = rule && rule.id ? String(rule.id) : '';
      if (ruleId && seen.has(ruleId)) return;
      var normalized = normalizeRule(rule, pageIds);
      if (!normalized) {
        if (!rejectedRuleIds.has(ruleId)) {
          rejectedRuleIds.add(ruleId);
          core.diagnostics.record('warn', 'WORKFLOW_RULE_REJECTED',
            'An invalid remote workflow rule was ignored.', {
              ruleId: ruleId ? ruleId.slice(0, 64) : null
            });
        }
        return;
      }
      seen.add(normalized.id);
      if (normalized.enabled) rules.push(normalized);
    });
    rules.sort(function (a, b) { return b.priority - a.priority || a.id.localeCompare(b.id); });
    return rules;
  }

  function conditionsMatch(rule, payload) {
    var values = payload && typeof payload === 'object' && !Array.isArray(payload) ? payload : {};
    return rule.conditions.every(function (condition) {
      if (!Object.prototype.hasOwnProperty.call(values, condition.field)) return false;
      var actual = values[condition.field];
      if (!scalarString(actual)) return false;
      if (condition.op === 'equals') return actual === condition.value;
      if (condition.op === 'notEquals') return actual !== condition.value;
      if (condition.op === 'oneOf') return condition.value.indexOf(actual) >= 0;
      return false;
    });
  }

  function showMessage(message) {
    try {
      var root = document.querySelector('.rs') || document.querySelector('#app') || document.body;
      if (!root || typeof document.createElement !== 'function') return false;
      var node = document.createElement('div');
      node.className = 'card shb-workflow-message';
      node.setAttribute('role', 'status');
      node.setAttribute('aria-live', 'polite');
      node.textContent = message;
      root.appendChild(node);
      return true;
    } catch (error) {
      core.diagnostics.record('warn', 'WORKFLOW_MESSAGE_FAILED',
        'A workflow message could not be displayed.', {
          error: String(error && error.message || error)
        });
      return false;
    }
  }

  function runAction(action) {
    if (action.type === 'navigate') {
      try {
        if (!navigation.isRemoteTarget(action.target, 'v3')) return false;
        var validated = navigation.validate(action.target);
        if (!validated || !validated.ok) return false;
        var result = navigation.navigate(action.target);
        return !!(result && result.ok);
      } catch (error) {
        core.diagnostics.record('warn', 'WORKFLOW_NAVIGATION_FAILED',
          'A workflow navigation action failed.', {
            target: action.target,
            error: String(error && error.message || error)
          });
        return false;
      }
    }
    if (action.type === 'openPage') {
      try {
        if (typeof window.shbRemoteOpenPage !== 'function') return false;
        return window.shbRemoteOpenPage(action.target) !== false;
      } catch (error) {
        core.diagnostics.record('warn', 'WORKFLOW_PAGE_OPEN_FAILED',
          'A workflow remote-page action failed.', {
            target: action.target,
            error: String(error && error.message || error)
          });
        return false;
      }
    }
    if (action.type === 'showMessage') return showMessage(action.message);
    return false;
  }

  function dispatch(eventName, payload) {
    var name = String(eventName || '');
    if (!Object.prototype.hasOwnProperty.call(TRIGGERS, name)) {
      return { ok: false, reason: 'unsupported-trigger', executed: 0 };
    }
    if (dispatching) return { ok: true, ignored: true, reason: 'reentrant', executed: 0 };

    var rules = readRules().filter(function (rule) { return rule.trigger === name; });
    var executed = 0, attempted = 0, matched = 0, skippedCooldown = 0, errors = 0;
    var now = Date.now();
    dispatching = true;
    try {
      for (var i = 0; i < rules.length && attempted < MAX_ACTIONS_PER_EVENT; i++) {
        var rule = rules[i];
        if (!conditionsMatch(rule, payload || {})) continue;
        matched++;
        var last = lastRunAt.get(rule.id) || 0;
        if (rule.cooldownMs > 0 && now - last < rule.cooldownMs) {
          skippedCooldown++;
          continue;
        }
        lastRunAt.set(rule.id, now);
        for (var j = 0; j < rule.actions.length && attempted < MAX_ACTIONS_PER_EVENT; j++) {
          attempted++;
          try {
            if (runAction(rule.actions[j])) executed++;
            else errors++;
          } catch (error) {
            errors++;
            core.diagnostics.record('warn', 'WORKFLOW_ACTION_FAILED',
              'A workflow action failed safely.', {
                ruleId: rule.id, action: rule.actions[j].type,
                error: String(error && error.message || error)
              });
          }
        }
      }
    } finally {
      dispatching = false;
    }
    return { ok: errors === 0, matched: matched, executed: executed,
      attempted: attempted, skippedCooldown: skippedCooldown, errors: errors };
  }

  function dispose() {
    subscriptions.forEach(function (unsubscribe) {
      try { unsubscribe(); } catch (error) {}
    });
    subscriptions.length = 0;
    lastRunAt.clear();
  }

  var api = Object.freeze({
    version: '1.0.0',
    platform: 'android',
    list: function () {
      return readRules().map(function (rule) {
        return { id: rule.id, trigger: rule.trigger, priority: rule.priority,
          conditionCount: rule.conditions.length, actionTypes: rule.actions.map(function (action) { return action.type; }) };
      });
    },
    dispatch: dispatch,
    dispose: dispose
  });

  Object.defineProperty(window, 'SHBACEWorkflowEngine', {
    value: api, configurable: false, enumerable: true, writable: false
  });
  core.services.register('workflow.engine', api);
  Object.keys(TRIGGERS).forEach(function (eventName) {
    subscriptions.push(core.events.on(eventName, function (payload) {
      dispatch(eventName, payload);
    }));
  });
  core.events.emit('workflow:ready', {
    version: api.version,
    triggers: Object.keys(TRIGGERS),
    ruleCount: api.list().length
  });
})();
