import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import vm from "node:vm";
import test from "node:test";

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, "..");
const feature = readFileSync(resolve(root, "js/09-app-features-v6.js"), "utf8");

const openStart = feature.indexOf("window.openQ=function(id){");
const openEnd = feature.indexOf("\nsearchView=", openStart);
assert.ok(openStart >= 0 && openEnd > openStart, "Question Bank openQ handler must exist");
const openQuestion = feature.slice(openStart, openEnd);
const routeHelper = (feature.match(/function nNavigateRoute\(route\)\{[\s\S]*?\n\}/) || [])[0];
assert.ok(routeHelper, "shared notification route helper must remain available to question navigation");

function exerciseOpenQuestion(id, mode = "ok") {
  const calls = { routes:[], renders:0, recent:[], timers:[] };
  const target = { id:"q-target", spec:"renal", topic:204 };
  const other = { id:"q-other", spec:"respiratory", topic:101 };
  const window = {};
  const context = vm.createContext({
    window,
    QB:[target,other],
    qs:{spec:"all",topic:0,filter:"incorrect",tag:"important",idx:7,view:"all"},
    appPage:"subjects",
    recordRecent(...args){calls.recent.push(args);},
    filtered(){return [other,target];},
    renderAppDemo(){calls.renders++;},
    Math,
    setTimeout(callback,delay){calls.timers.push({callback,delay});return calls.timers.length;}
  });
  if (mode !== "missing") {
    window.__shbNavTap = (route) => {
      calls.routes.push(route);
      if (mode === "throw") throw new Error("shared adapter unavailable");
      context.appPage = route;
      context.renderAppDemo();
    };
  }
  vm.runInContext(routeHelper + "\n" + openQuestion + "\nopenQ(" + JSON.stringify(id) + ");", context,
    { filename:"question-open-navigation-adapter.js" });
  return {context,calls};
}

test("opening a known question preserves its specialty, topic and filtered index before one shared route render", () => {
  const result = exerciseOpenQuestion("q-target");
  assert.deepEqual(result.calls.recent, [["topic","renal",204]]);
  assert.equal(result.context.qs.spec,"renal");
  assert.equal(result.context.qs.topic,204);
  assert.equal(result.context.qs.filter,"all");
  assert.equal(result.context.qs.tag,"all");
  assert.equal(result.context.qs.idx,1);
  assert.deepEqual(result.calls.routes,["questions"]);
  assert.deepEqual(result.calls.renders,[1].map(()=>undefined).filter(()=>false));
  assert.equal(result.context.appPage,"questions");
  assert.equal(result.calls.timers.length,1);
  assert.equal(result.calls.timers[0].delay,80);
  assert.match(openQuestion,/nNavigateRoute\('questions'\)/);
  assert.doesNotMatch(openQuestion,/appPage\s*=/);
});

test("question opening keeps a local render fallback when the shared adapter is missing or throws", () => {
  const missing = exerciseOpenQuestion("q-target","missing");
  assert.deepEqual(missing.calls.routes,[]);
  assert.equal(missing.context.appPage,"questions");
  assert.equal(missing.calls.renders,1);

  const failed = exerciseOpenQuestion("q-target","throw");
  assert.deepEqual(failed.calls.routes,["questions"]);
  assert.equal(failed.context.appPage,"questions");
  assert.equal(failed.calls.renders,1);
});

test("an unknown question id never changes the route or renders a blank Question Bank", () => {
  const result = exerciseOpenQuestion("missing-question");
  assert.deepEqual(result.calls.routes,[]);
  assert.equal(result.context.appPage,"subjects");
  assert.equal(result.calls.renders,0);
  assert.deepEqual(result.calls.recent,[]);
  assert.equal(result.calls.timers.length,0);
});
