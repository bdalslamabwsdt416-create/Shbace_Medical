import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import vm from "node:vm";
import test from "node:test";

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, "..");
const feature = readFileSync(resolve(root, "js/09-app-features-v6.js"), "utf8");
const home = readFileSync(resolve(root, "js/13-home-functional-actions-v1.js"), "utf8");
const collections = readFileSync(resolve(root, "js/35-pediatrics-collections.js"), "utf8");

function getLine(source, marker) {
  const found = source.split("\n").find(line => line.includes(marker));
  assert.ok(found, "missing source line: " + marker);
  return found;
}
function getTwoLines(source, marker) {
  const lines = source.split("\n");
  const index = lines.findIndex(line => line.includes(marker));
  assert.ok(index >= 0, "missing source block: " + marker);
  return lines.slice(index, index + 2).join("\n");
}

const routeHelper = (feature.match(/function qbnNavigateRoute\(route\)\{[\s\S]*?\n\}/) || [])[0];
const baseOpenTopic = getLine(feature, "window.openTopic=function(spec,id,options){");
const recentWrapper = getLine(feature, "const __ot=window.openTopic;");
const homeWrapper = getTwoLines(home, "const originalOpenTopic=window.openTopic;");
const collectionWrapper = getTwoLines(collections, "const _oldOpenTopic=window.openTopic;");
assert.ok(routeHelper, "shared Question Bank route helper must exist");

function createTopicRuntime(adapterMode = "ok") {
  const calls = { routes:[], recent:[], saved:[], renders:[] };
  const window = { __SHB_PED_COLLECTION:"aj" };
  let context;
  context = vm.createContext({
    window,
    qs:{spec:"old-specialty",topic:88,filter:"incorrect",tag:"important",idx:7},
    appPage:"subjects",
    activeCollection:"aj",
    activePreviousSystem:"",
    recordRecent(...args){calls.recent.push(args);},
    saveProgress(...args){calls.saved.push(args);},
    renderAppDemo(){
      calls.renders.push({
        route:context.appPage,
        spec:context.qs.spec,
        topic:context.qs.topic,
        filter:context.qs.filter,
        tag:context.qs.tag,
        idx:context.qs.idx
      });
    },
    String
  });
  if (adapterMode !== "missing") {
    window.__shbNavTap = route => {
      calls.routes.push(route);
      if (adapterMode === "throw") throw new Error("shared adapter unavailable");
      context.appPage = route;
      context.renderAppDemo();
    };
  }
  vm.runInContext(routeHelper + "\n" + baseOpenTopic, context, {filename:"base-topic-open.js"});
  vm.runInContext(recentWrapper, context, {filename:"recent-topic-wrapper.js"});
  vm.runInContext(homeWrapper, context, {filename:"home-topic-wrapper.js"});
  vm.runInContext(collectionWrapper, context, {filename:"pediatrics-topic-wrapper.js"});
  return {context,calls};
}

test("ordinary topic opens preserve the collection/recent/home wrappers and dispatch one shared route", () => {
  const runtime = createTopicRuntime();
  runtime.window.openTopic("renal",204);
  assert.deepEqual(runtime.calls.recent,[["topic","renal",204]]);
  assert.deepEqual(runtime.calls.saved,[["renal",204,null]]);
  assert.deepEqual(runtime.calls.routes,["questions"]);
  assert.equal(runtime.calls.renders.length,1);
  assert.deepEqual(runtime.calls.renders[0],{
    route:"questions",spec:"renal",topic:204,filter:"all",tag:"all",idx:0
  });
  assert.equal(runtime.context.qs.spec,"renal");
  assert.equal(runtime.context.qs.topic,204);
  assert.equal(runtime.context.activeCollection,"aj");
});

test("deferred topic opens forward options through every wrapper without rendering early", () => {
  const runtime = createTopicRuntime();
  runtime.window.openTopic("renal",204,{deferNavigation:true});
  assert.deepEqual(runtime.calls.recent,[["topic","renal",204]]);
  assert.deepEqual(runtime.calls.saved,[["renal",204,null]]);
  assert.deepEqual(runtime.calls.routes,[]);
  assert.equal(runtime.calls.renders.length,0);
  assert.equal(runtime.context.qs.spec,"renal");
  assert.equal(runtime.context.qs.topic,204);
  assert.equal(runtime.context.qs.filter,"all");
  assert.equal(runtime.context.qs.tag,"all");
  assert.equal(runtime.context.qs.idx,0);
});

test("ordinary topic opens retain local rendering when the shared adapter is missing or throws", () => {
  for (const mode of ["missing","throw"]) {
    const runtime = createTopicRuntime(mode);
    runtime.window.openTopic("respiratory",101);
    assert.deepEqual(runtime.calls.routes, mode === "missing" ? [] : ["questions"]);
    assert.equal(runtime.context.appPage,"questions");
    assert.equal(runtime.calls.renders.length,1);
    assert.equal(runtime.calls.renders[0].spec,"respiratory");
    assert.equal(runtime.calls.renders[0].topic,101);
  }
});
