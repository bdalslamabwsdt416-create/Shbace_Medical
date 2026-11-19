import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import vm from "node:vm";
import test from "node:test";

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, "..");
const feature = readFileSync(resolve(root, "js/09-app-features-v6.js"), "utf8");
const routes = JSON.parse(readFileSync(resolve(root, "modules/routes.v1.json"), "utf8"));

function sliceBetween(source, start, end) {
  const from = source.indexOf(start);
  const to = source.indexOf(end, from);
  assert.ok(from >= 0, "missing source start: " + start);
  assert.ok(to > from, "missing source end: " + end);
  return source.slice(from, to);
}

function exerciseNavigate(route, adapterMode = "ok") {
  const calls = { routes:[], renders:[] };
  const window = {};
  const context = vm.createContext({
    window,
    appPage:"subjects",
    renderAppDemo() {
      calls.renders.push(context.appPage);
    }
  });
  if (adapterMode !== "missing") {
    window.__shbNavTap = (target) => {
      calls.routes.push(target);
      if (adapterMode === "throw") throw new Error("navigation adapter unavailable");
      context.appPage = target;
      context.renderAppDemo();
    };
  }
  const helper = feature.match(/function qzNavigate\(route\)\{[\s\S]*?\n\}/);
  assert.ok(helper, "Quiz navigation helper must exist");
  vm.runInContext(helper[0] + "\nqzNavigate(" + JSON.stringify(route) + ");", context,
    { filename:"quiz-navigation-adapter.js" });
  return { context, calls };
}

test("Quiz navigation dispatches through the shared adapter exactly once and keeps the legacy fallback", () => {
  const routed = exerciseNavigate("quizrun");
  assert.deepEqual(routed.calls.routes, ["quizrun"]);
  assert.deepEqual(routed.calls.renders, ["quizrun"]);
  assert.equal(routed.context.appPage, "quizrun");

  const missing = exerciseNavigate("quizhistory", "missing");
  assert.deepEqual(missing.calls.routes, []);
  assert.deepEqual(missing.calls.renders, ["quizhistory"]);
  assert.equal(missing.context.appPage, "quizhistory");

  const failed = exerciseNavigate("quizresult", "throw");
  assert.deepEqual(failed.calls.routes, ["quizresult"]);
  assert.deepEqual(failed.calls.renders, ["quizresult"]);
  assert.equal(failed.context.appPage, "quizresult");
});

test("all Quiz lifecycle targets are already declared in the Android route contract", () => {
  const ids = new Set(routes.routes.map(route => route.id));
  for (const id of ["quiz", "quizrun", "quizresult", "quizhistory"]) {
    assert.ok(ids.has(id), "missing route contract entry: " + id);
  }
});

test("starting and resuming a quiz persist its active session before entering Quiz Session", () => {
  const start = sliceBetween(feature, "window.qzStart=function(){", "window.qzResume=function");
  const resume = sliceBetween(feature, "window.qzResume=function", "window.qzDiscard=function");
  assert.ok(start.indexOf("qcSave();qzSave();qzPal=false;") >= 0);
  assert.ok(start.indexOf("qcSave();qzSave();qzPal=false;") < start.indexOf("qzNavigate('quizrun')"));
  assert.match(resume, /if\(QZ\.active\)qzNavigate\('quizrun'\)/);
  assert.doesNotMatch(start, /appPage\s*=\s*'quizrun'/);
  assert.doesNotMatch(resume, /appPage\s*=\s*'quizrun'/);
});

test("submitting a quiz stores the completed attempt and clears the active session before opening the result", () => {
  const finish = sliceBetween(feature, "function qzFinish(reason){", "/* M-07:");
  const stored = finish.indexOf("QZ.active=null;qzSave()");
  const navigated = finish.indexOf("qzNavigate('quizresult')");
  assert.ok(stored >= 0 && navigated > stored);
  assert.doesNotMatch(finish, /appPage\s*=\s*'quizresult'/);

  const invalidFinish = sliceBetween(feature, "/* M-07:", "let qzLast=");
  assert.match(invalidFinish, /QZ\.active=null;qzSave\(\)/);
  assert.match(invalidFinish, /qzNavigate\('quiz'\)/);
  assert.doesNotMatch(invalidFinish, /appPage\s*=\s*'quiz'/);
});

test("retakes, retries, topic quizzes and weak-topic quizzes preserve settings before route dispatch", () => {
  const begin = sliceBetween(feature, "function qzBegin(ids,base,kind){", "window.qzRetake=function");
  const topicQuiz = sliceBetween(feature, "window.qzTopicQuiz=function", "window.qzWeakQuiz=function");
  const weakQuiz = sliceBetween(feature, "window.qzWeakQuiz=function", "window.qzOpen=function");
  assert.ok(begin.indexOf("qzSave();qzPal=false;qzAnim=false;") < begin.indexOf("qzNavigate('quizrun')"));
  for (const [name, block] of [["topic",topicQuiz],["weak",weakQuiz]]) {
    assert.ok(block.includes("qcSave();qzNavigate('quiz')"), name + " quiz must save its configuration before navigating");
    assert.doesNotMatch(block, /appPage\s*=\s*'quiz'/);
  }
});

test("result, history and notification entry points dispatch the exact existing local routes", () => {
  const resultOpen = sliceBetween(feature, "window.qzOpen=function(id,from)", "const qzRowHTML");
  const notificationOpen = sliceBetween(feature, "window.nOpen=function(id)", "const NI=");
  const quizView = sliceBetween(feature, "quizView=function(){", "const shuffle=");
  const resultView = sliceBetween(feature, "quizResultView=function(){", "/* ---- Quiz history ---- */");
  const historyView = sliceBetween(feature, "function qzHistoryView(){", "/* ---- stats from completed attempts ---- */");
  const statsView = sliceBetween(feature, "function stQuizHTML(){", "function stBankHTML(){");

  assert.match(resultOpen, /qzNavigate\('quizresult'\)/);
  assert.match(notificationOpen, /qzViewId=ref;qzNavigate\('quizresult'\)/);
  assert.match(quizView, /qzNavigate\('quizhistory'\)/);
  assert.match(quizView, /onclick="qzNavigate\('quiz'\)">Pause &amp; exit/);
  assert.match(resultView, /qzNavigate\('quiz'\)/);
  assert.match(resultView, /qzNavigate\('quizhistory'\)/);
  assert.match(historyView, /qzNavigate\('quiz'\)/);
  assert.match(statsView, /qzNavigate\('quizhistory'\)/);
  for (const block of [resultOpen,notificationOpen,quizView,resultView,historyView,statsView]) {
    assert.doesNotMatch(block, /appPage\s*=\s*'(?:quiz|quizrun|quizresult|quizhistory)'/);
  }
});
