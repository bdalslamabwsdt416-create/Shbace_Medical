import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import vm from "node:vm";
import test from "node:test";

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, "..");
const source = readFileSync(resolve(root, "js/53-workflow-engine-v1.js"), "utf8");
const validator = readFileSync(resolve(root, "../for ApK/android-content/validate.mjs"), "utf8");

function createRuntime(workflows = []) {
  const listeners = new Map();
  const services = new Map();
  const root = {
    children: [],
    appendChild(node) { this.children.push(node); }
  };
  const document = {
    querySelector() { return root; },
    createElement() {
      return {
        setAttribute(name, value) { this[name] = value; },
        className: "",
        textContent: ""
      };
    },
    body: root
  };
  const events = {
    on(name, handler) {
      const set = listeners.get(name) || new Set();
      set.add(handler);
      listeners.set(name, set);
      return () => set.delete(handler);
    },
    emit(name, payload) {
      const set = listeners.get(name);
      if (!set) return;
      for (const handler of Array.from(set)) handler(payload);
    }
  };
  const navigated = [];
  const opened = [];
  const navigation = {
    isRemoteTarget(target, engine) {
      return engine === "v3" && ["subjects", "topics", "quizresult"].includes(target);
    },
    validate(target) { return { ok: this.isRemoteTarget(target, "v3") }; },
    navigate(target) {
      navigated.push(target);
      events.emit("navigation:route-changed", { from: "topics", to: target, mode: "app" });
      return { ok: true, route: target };
    }
  };
  const window = {
    Capacitor: { getPlatform: () => "android", isNativePlatform: () => true },
    SHBACECore: {
      platform: "android",
      events,
      services: { register(name, value) { services.set(name, value); return { ok: true }; } },
      diagnostics: { record() {} }
    },
    __SHBACE_REMOTE_CONTENT_API__: {
      getCatalog: () => ({ ui: { pages: [{ id: "osce-practice" }], workflows } })
    },
    SHBACENavigation: navigation,
    shbRemoteOpenPage(id) { opened.push(id); return true; }
  };
  const context = vm.createContext({
    window, document, console, Date, Set, Map, Object, Array, String, Number, Math, JSON, Promise
  });
  vm.runInContext(source, context, { filename: "53-workflow-engine-v1.js" });
  return { api: window.SHBACEWorkflowEngine, services, events, navigated, opened, root };
}

test("Workflow Engine is Android-only and registers a Core service", () => {
  const runtime = createRuntime();
  assert.equal(runtime.api.platform, "android");
  assert.equal(runtime.services.get("workflow.engine"), runtime.api);
});

test("route-change conditions execute only allow-listed actions", () => {
  const runtime = createRuntime([
    {
      id: "after-quiz",
      enabled: true,
      trigger: "navigation:route-changed",
      conditions: [{ field: "to", op: "equals", value: "quizresult" }],
      actions: [
        { type: "showMessage", message: "Quiz complete" },
        { type: "navigate", target: "topics" }
      ],
      cooldownMs: 0
    },
    {
      id: "other-route",
      trigger: "navigation:route-changed",
      conditions: [{ field: "to", op: "equals", value: "subjects" }],
      actions: [{ type: "openPage", target: "osce-practice" }],
      cooldownMs: 0
    }
  ]);
  runtime.events.emit("navigation:route-changed", { from: "quizrun", to: "quizresult", mode: "app" });
  assert.deepEqual(runtime.navigated, ["topics"]);
  assert.equal(runtime.root.children.length, 1);
  assert.equal(runtime.root.children[0].textContent, "Quiz complete");
  runtime.events.emit("navigation:route-changed", { from: "topics", to: "subjects", mode: "app" });
  assert.deepEqual(runtime.opened, ["osce-practice"]);
});

test("invalid rules, triggers, fields and actions are rejected at runtime", () => {
  const runtime = createRuntime([
    { id: "bad-trigger", trigger: "exec", actions: [{ type: "navigate", target: "topics" }] },
    { id: "bad-action", trigger: "navigation:route-changed", actions: [{ type: "runScript", code: "alert(1)" }] },
    { id: "bad-field", trigger: "navigation:route-changed",
      conditions: [{ field: "studentPassword", op: "equals", value: "x" }],
      actions: [{ type: "showMessage", message: "x" }] },
    { id: "bad-route", trigger: "navigation:route-changed",
      actions: [{ type: "navigate", target: "unknown" }] }
  ]);
  assert.equal(runtime.api.list().length, 0);
  runtime.events.emit("navigation:route-changed", { to: "topics" });
  assert.deepEqual(runtime.navigated, []);
  assert.equal(runtime.root.children.length, 0);
});

test("workflow dispatch prevents recursive event loops and enforces its event action budget", () => {
  const manyActions = Array.from({ length: 3 }, (_, i) => ({ type: "showMessage", message: "Message " + i }));
  const workflows = Array.from({ length: 5 }, (_, i) => ({
    id: "rule-" + i,
    trigger: "navigation:rendered",
    actions: manyActions,
    cooldownMs: 0
  }));
  const runtime = createRuntime(workflows);
  const result = runtime.api.dispatch("navigation:rendered", { route: "topics", mode: "app" });
  assert.equal(result.attempted, 10);
  assert.equal(runtime.root.children.length, 10);
});

test("Workflow Engine and remote rules never evaluate or access student stores", () => {
  assert.doesNotMatch(source, /\beval\s*\(|new Function\s*\(|localStorage\.|indexedDB\./);
  assert.match(validator, /catalog\.ui\.workflows/);
  assert.match(validator, /Unsupported workflow trigger/);
  assert.match(validator, /Unsupported workflow action/);
  assert.match(validator, /Workflow openPage action has an unknown remote page/);
});
