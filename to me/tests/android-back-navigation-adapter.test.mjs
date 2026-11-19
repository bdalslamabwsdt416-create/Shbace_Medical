import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import vm from "node:vm";
import test from "node:test";

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, "..");
const nativeNavigation = readFileSync(resolve(root, "js/31-android-v13.js"), "utf8");

const start = nativeNavigation.indexOf("window.navBack=function(){");
const end = nativeNavigation.indexOf("\nwindow.addEventListener('popstate'", start);
assert.ok(start >= 0 && end > start, "Android native Back handler must be present");
const handler = nativeNavigation.slice(start, end);

function runtime({
  route = "quizrun",
  stack = ["subjects", "quiz", "quizrun"],
  resolvedTarget = "subjects",
  spec = "respiratory",
  adapterMode = "ok",
  overlay = false
} = {}) {
  const calls = { routes:[], renders:0, overlayChecks:0, resolved:[] };
  let context;
  const window = {
    __qs:{spec},
    __shbGetBackTarget(id) {
      calls.resolved.push(id);
      return resolvedTarget;
    }
  };
  if (adapterMode !== "missing") {
    window.__shbNavTap = (target) => {
      calls.routes.push({target,backing:context.backing});
      if (adapterMode === "throw") throw new Error("shared navigation unavailable");
      context.appPage = target;
      context.renderAppDemo();
    };
  }
  context = vm.createContext({
    window,
    appPage:route,
    stack:stack.slice(),
    backing:false,
    closeOverlay(){calls.overlayChecks++;return overlay;},
    renderAppDemo(){calls.renders++;}
  });
  vm.runInContext(handler, context, {filename:"31-android-v13-navBack.js"});
  return {context,calls};
}

test("hardware and in-app Back dispatch through the shared route adapter while the native history stack is backing", () => {
  const app = runtime();
  app.context.window.navBack();

  assert.deepEqual(app.calls.routes, [{target:"quiz",backing:true}]);
  assert.equal(app.context.appPage, "quiz");
  assert.equal(app.context.stack.length, 2);
  assert.equal(app.calls.renders, 1);
  assert.equal(app.context.backing, false, "backing guard must always be released");
});

test("Back retains wildcard Question Bank resolution and delegates the resolved topic route centrally", () => {
  const app = runtime({
    route:"questions",
    stack:[],
    resolvedTarget:"*",
    spec:"respiratory"
  });
  app.context.window.navBack();

  assert.deepEqual(app.calls.resolved, ["questions"]);
  assert.deepEqual(app.calls.routes, [{target:"topics",backing:true}]);
  assert.equal(app.context.appPage, "topics");
  assert.equal(app.calls.renders, 1);
});

test("Back preserves the legacy local-render fallback when the shared adapter is absent or throws", () => {
  const missing = runtime({route:"quizresult",stack:["quiz"],adapterMode:"missing"});
  missing.context.window.navBack();
  assert.deepEqual(missing.calls.routes, []);
  assert.equal(missing.context.appPage, "quiz");
  assert.equal(missing.calls.renders, 1);
  assert.equal(missing.context.backing, false);

  const failed = runtime({route:"quizresult",stack:["quiz"],adapterMode:"throw"});
  failed.context.window.navBack();
  assert.deepEqual(failed.calls.routes, [{target:"quiz",backing:true}]);
  assert.equal(failed.context.appPage, "quiz");
  assert.equal(failed.calls.renders, 1);
  assert.equal(failed.context.backing, false);
});

test("Back closes an open overlay first and never dispatches a route while an overlay is active", () => {
  const app = runtime({overlay:true});
  app.context.window.navBack();
  assert.equal(app.calls.overlayChecks, 1);
  assert.deepEqual(app.calls.routes, []);
  assert.equal(app.calls.renders, 0);
  assert.equal(app.context.appPage, "quizrun");
  assert.deepEqual(app.context.stack, ["subjects","quiz","quizrun"]);
});

test("Back does nothing when its resolved target is already the current route", () => {
  const app = runtime({route:"subjects",stack:[],resolvedTarget:"subjects"});
  app.context.window.navBack();
  assert.deepEqual(app.calls.routes, []);
  assert.equal(app.calls.renders, 0);
  assert.equal(app.context.appPage, "subjects");
});

test("native Back handler keeps a central adapter path and releases the history backing guard in finally", () => {
  assert.match(handler, /window\.__shbNavTap\(to\)/);
  assert.match(handler, /finally\{backing=false\}/);
  assert.match(handler, /if\(closeOverlay\(\)\)return/);
  assert.match(handler, /stack\.length\?stack\.pop\(\):null/);
});
