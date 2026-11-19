import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import vm from "node:vm";
import test from "node:test";

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, "..");
const collections = readFileSync(resolve(root, "js/35-pediatrics-collections.js"), "utf8");
const homeActions = readFileSync(resolve(root, "js/13-home-functional-actions-v1.js"), "utf8");
const feature = readFileSync(resolve(root, "js/09-app-features-v6.js"), "utf8");

function extractFunction(source, name) {
  const match = name === "routeThroughNavigation"
    ? source.match(/function routeThroughNavigation\(route\)\{[\s\S]*?\n\}/)
    : source.match(/function navigateHomeRoute\(route\)\{[\s\S]*?\n\}/);
  assert.ok(match, "missing route helper " + name);
  return match[0];
}

function exerciseRouteHelper(helper, functionName, route, adapterMode = "ok") {
  const calls = { routes:[], renders:0 };
  const window = {};
  const context = vm.createContext({
    window,
    appPage:"subjects",
    renderAppDemo(){calls.renders += 1;}
  });
  if (adapterMode !== "missing") {
    window.__shbNavTap = (id) => {
      calls.routes.push(id);
      if (adapterMode === "throw") throw new Error("adapter unavailable");
      context.appPage = id;
      context.renderAppDemo();
    };
  }
  vm.runInContext(helper + "\n" + functionName + "(" + JSON.stringify(route) + ");", context);
  return { context, calls };
}

function createHomeRuntime(savedProgress = null) {
  const calls = { routes:[], openedTopics:[], collections:[], renders:0 };
  const storage = new Map();
  if (savedProgress) storage.set("shbace_home_pediatrics_resume_v1", JSON.stringify(savedProgress));
  const state = { spec:"all", topic:0, idx:0, filter:"all", tag:"all", view:"all" };
  let context;
  const window = {
    __qs:state,
    openTopic(spec, topic) {
      calls.openedTopics.push({spec,topic});
      state.spec = spec;
      state.topic = topic;
      context.appPage = "questions";
      context.renderAppDemo();
    },
    __shbNavTap(route) {
      calls.routes.push(route);
      context.appPage = route;
      context.renderAppDemo();
    }
  };
  context = vm.createContext({
    window,
    REAL:{spec:{respiratory:{topics:[[101,"Respiratory topic",6]]}}},
    appPage:"subjects",
    renderAppDemo(){calls.renders += 1;},
    localStorage:{
      getItem(key){return storage.has(key)?storage.get(key):null;},
      setItem(key,value){storage.set(key,String(value));},
      removeItem(key){storage.delete(key);}
    },
    Date, JSON, Math, Number, String, Array, Object
  });
  vm.runInContext(homeActions, context, {filename:"13-home-functional-actions-v1.js"});
  return { context, calls, state, storage, window };
}

test("Pediatrics collection and home route helpers use the shared adapter with a legacy fallback", () => {
  const collectionHelper = extractFunction(collections, "routeThroughNavigation");
  const homeHelper = extractFunction(homeActions, "navigateHomeRoute");

  for (const [helper, name] of [[collectionHelper,"routeThroughNavigation"],[homeHelper,"navigateHomeRoute"]]) {
    const routed = exerciseRouteHelper(helper, name, "specialties");
    assert.deepEqual(routed.calls.routes, ["specialties"]);
    assert.equal(routed.context.appPage, "specialties");
    assert.equal(routed.calls.renders, 1);

    const noAdapter = exerciseRouteHelper(helper, name, "questions", "missing");
    assert.deepEqual(noAdapter.calls.routes, []);
    assert.equal(noAdapter.context.appPage, "questions");
    assert.equal(noAdapter.calls.renders, 1);

    const adapterFailure = exerciseRouteHelper(helper, name, "topics", "throw");
    assert.deepEqual(adapterFailure.calls.routes, ["topics"]);
    assert.equal(adapterFailure.context.appPage, "topics");
    assert.equal(adapterFailure.calls.renders, 1);
  }
});

test("Pediatrics collection chooser and collection selection navigate to the existing specialties route", () => {
  const openStart = collections.indexOf("window.openPediatricCollections=function");
  const selectStart = collections.indexOf("window.selectPediatricCollection=function");
  const nelsonStart = collections.indexOf("window.openNelsonSystem=function");
  const previousStart = collections.indexOf("window.openPreviousSystem=function");
  assert.ok(openStart >= 0 && selectStart > openStart && nelsonStart > selectStart && previousStart > nelsonStart);

  const openBody = collections.slice(openStart, selectStart);
  const selectBody = collections.slice(selectStart, nelsonStart);
  const nelsonBody = collections.slice(nelsonStart, previousStart);
  const previousBody = collections.slice(previousStart, collections.indexOf("window.openPreviousSystemFromCard", previousStart));

  assert.match(openBody, /activeCollection='';activePreviousSystem='';routeThroughNavigation\('specialties'\)/);
  assert.match(selectBody, /qs\.view='all';routeThroughNavigation\('specialties'\)/);
  assert.match(nelsonBody, /qs\.view='all';routeThroughNavigation\('questions'\)/);
  assert.match(previousBody, /qs\.view='all';routeThroughNavigation\('topics'\)/);
  for (const body of [openBody,selectBody,nelsonBody,previousBody]) {
    assert.doesNotMatch(body, /appPage\s*=/, "collection state is routed without direct appPage assignment");
  }
});

test("Home Continue Studying uses the saved topic and dispatches the final Question Bank route centrally", () => {
  const runtime = createHomeRuntime({
    spec:"respiratory", topic:101, idx:3, filter:"incorrect", tag:"all", view:"list", questionId:"q-101"
  });
  runtime.window.h7ResumePediatrics();

  assert.deepEqual(runtime.calls.openedTopics, [{spec:"respiratory",topic:101}]);
  assert.deepEqual(runtime.calls.routes, ["questions"]);
  assert.equal(runtime.context.appPage, "questions");
  assert.equal(runtime.state.spec, "respiratory");
  assert.equal(runtime.state.topic, 101);
  assert.equal(runtime.state.idx, 3);
  assert.equal(runtime.state.filter, "incorrect");
  assert.equal(runtime.state.view, "list");
  const saved = JSON.parse(runtime.storage.get("shbace_home_pediatrics_resume_v1"));
  assert.equal(saved.spec, "respiratory");
  assert.equal(saved.topic, 101);
  assert.equal(saved.idx, 3);
  assert.equal(saved.questionId, "q-101");
});

test("Home falls back to the specialties route when no saved Pediatrics topic is available", () => {
  const runtime = createHomeRuntime(null);
  runtime.window.h7ResumePediatrics();
  assert.deepEqual(runtime.calls.routes, ["specialties"]);
  assert.equal(runtime.context.appPage, "specialties");
  assert.equal(runtime.calls.openedTopics.length, 0);
});

test("Home Start Studying preserves the collection chooser; its fallback uses the shared route adapter", () => {
  const runtime = createHomeRuntime(null);
  runtime.window.h7StartPediatrics();
  assert.deepEqual(runtime.calls.routes, ["specialties"]);
  assert.equal(runtime.context.appPage, "specialties");

  const withChooser = createHomeRuntime(null);
  withChooser.window.openPediatricCollections = () => withChooser.calls.collections.push("chooser");
  withChooser.window.h7StartPediatrics();
  assert.deepEqual(withChooser.calls.collections, ["chooser"]);
  assert.deepEqual(withChooser.calls.routes, []);
});

test("Grade page Pediatrics card uses the shared route adapter for click and keyboard activation", () => {
  assert.match(feature, /onclick="window\.__shbNavTap\('specialties'\)"/);
  assert.match(feature, /onkeydown="if\(event\.key==='Enter'\)\{window\.__shbNavTap\('specialties'\)\}"/);
});
