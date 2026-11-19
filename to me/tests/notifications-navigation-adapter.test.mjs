import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import vm from "node:vm";
import test from "node:test";

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, "..");
const feature = readFileSync(resolve(root, "js/09-app-features-v6.js"), "utf8");

function extract(source, start, end, fromEnd = false) {
  const from = fromEnd ? source.lastIndexOf(start) : source.indexOf(start);
  const to = source.indexOf(end, from);
  assert.ok(from >= 0 && to > from, "missing source block: " + start);
  return source.slice(from, to + 2);
}

const routeHelper = (feature.match(/function nNavigateRoute\(route\)\{[\s\S]*?\n\}/) || [])[0];
const sharedNavigation = extract(feature, "window.__shbNavTap=function(id){", "\nappNav=function");
const notificationOpen = extract(feature, "window.nOpen=function(id){", "\nconst NI=", true);

assert.ok(routeHelper, "notification route helper must exist");

function runNotification(page, options = {}) {
  const calls = {
    validated: [],
    adapterNavigations: [],
    adapterThrows: [],
    renders: [],
    savedNotifications: [],
    openedQuestions: [],
    quizRoutes: [],
    pauses: [],
    reviewSaves: 0
  };
  const notification = { id: "notice-1", page, ref: options.ref || "", read: false };
  const window = {};
  let context;
  context = vm.createContext({
    window,
    NOTIF: [notification],
    NKEY: "notifications",
    LS: { set(key, value) { calls.savedNotifications.push({ key, count: value.length }); } },
    QZ: { attempts: options.validQuizResult ? [{ id: options.ref }] : [] },
    qzViewId: null,
    qzNavigate(route) {
      calls.quizRoutes.push(route);
      context.appPage = route;
      context.renderAppDemo();
    },
    u7Q(id) { return id === "question-1"; },
    openQ(id) { calls.openedQuestions.push(id); },
    PAGES2: { examplanner: 1, shbRemoteFlashcards: 1 },
    appPage: "subjects",
    renderAppDemo() { calls.renders.push(context.appPage); },
    srRun: !!options.activeReview,
    SR3: { sess: !!options.activeReview },
    srTPause(value) { calls.pauses.push(value); },
    SU: { qid: "active-question" },
    srSave() { calls.reviewSaves += 1; },
    srTab: "cards",
    SRSUM: { old: true },
    SRX: { open: "old-session" }
  });
  window.renderAppDemo = () => context.renderAppDemo();
  window.SHBACENavigation = {
    validate(route) {
      calls.validated.push(route);
      return { ok: ["review", "settings", "notifs", "saved", "wrong", "notes", "pinned", "stats"].includes(route) };
    },
    navigate(route) {
      calls.adapterNavigations.push(route);
      context.appPage = route;
      window.renderAppDemo();
      return { ok: true, route };
    }
  };

  let routeCode = sharedNavigation;
  if (options.adapterMode === "missing") routeCode = "";
  if (options.adapterMode === "throw") {
    routeCode = "window.__shbNavTap=function(route){calls.adapterThrows.push(route);throw new Error('adapter unavailable')};";
    context.calls = calls;
  }
  vm.runInContext(routeHelper + "\n" + routeCode + "\n" + notificationOpen, context,
    { filename: "notifications-navigation-adapter.js" });
  context.window.nOpen("notice-1");
  return { context, calls, notification };
}

test("supported notification destinations dispatch through shared navigation exactly once", () => {
  for (const route of ["review", "settings", "notifs", "saved", "wrong", "notes", "pinned", "stats"]) {
    const result = runNotification(route);
    assert.deepEqual(result.calls.validated, [route], route + " must be validated");
    assert.deepEqual(result.calls.adapterNavigations, [route], route + " must use the shared adapter");
    assert.deepEqual(result.calls.renders, [route], route + " must render once");
    assert.equal(result.context.appPage, route);
    assert.equal(result.notification.read, true);
    assert.equal(result.calls.savedNotifications.length, 1);
  }
});

test("Smart Review notifications retain the shared adapter's active-session pause behaviour", () => {
  const result = runNotification("review", { activeReview: true });
  assert.deepEqual(result.calls.pauses, [true]);
  assert.equal(result.calls.reviewSaves, 1);
  assert.equal(result.context.srRun, false);
  assert.equal(result.context.srTab, "topics");
  assert.equal(result.context.SRSUM, null);
  assert.equal(result.context.SRX.open, null);
  assert.deepEqual(result.calls.renders, ["review"]);
});

test("registered local pages rejected by the static route catalogue keep the legacy fallback", () => {
  const result = runNotification("examplanner");
  assert.deepEqual(result.calls.validated, ["examplanner"]);
  assert.deepEqual(result.calls.adapterNavigations, []);
  assert.deepEqual(result.calls.renders, ["examplanner"]);
  assert.equal(result.context.appPage, "examplanner");
});

test("missing or throwing shared navigation keeps the legacy notification route fallback", () => {
  const missing = runNotification("settings", { adapterMode: "missing" });
  assert.deepEqual(missing.calls.renders, ["settings"]);
  assert.equal(missing.context.appPage, "settings");

  const throwing = runNotification("settings", { adapterMode: "throw" });
  assert.deepEqual(throwing.calls.adapterThrows, ["settings"]);
  assert.deepEqual(throwing.calls.renders, ["settings"]);
  assert.equal(throwing.context.appPage, "settings");
});

test("question and completed-quiz notification targets keep their specialized open flows", () => {
  const question = runNotification("questions", { ref: "question-1" });
  assert.deepEqual(question.calls.openedQuestions, ["question-1"]);
  assert.deepEqual(question.calls.validated, []);
  assert.deepEqual(question.calls.adapterNavigations, []);
  assert.deepEqual(question.calls.renders, ["subjects"]);

  const quiz = runNotification("quizresult", { ref: "attempt-1", validQuizResult: true });
  assert.deepEqual(quiz.calls.quizRoutes, ["quizresult"]);
  assert.equal(quiz.context.qzViewId, "attempt-1");
  assert.deepEqual(quiz.calls.validated, []);
});
