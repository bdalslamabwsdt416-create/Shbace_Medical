import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, "..");
const jsDir = resolve(root, "js");
const jsFiles = readdirSync(jsDir)
  .filter((name) => name.endsWith(".js"))
  .sort()
  .map((name) => ({ name, content: readFileSync(resolve(jsDir, name), "utf8") }));
const sourceByName = new Map(jsFiles.map((file) => [file.name, file.content]));
const allSource = jsFiles.map((file) => file.content).join("\n");
const routes = JSON.parse(readFileSync(resolve(root, "modules/routes.v1.json"), "utf8"));
const feature = sourceByName.get("09-app-features-v6.js") || "";
const coreFiles = [
  "49-app-core-v1.js",
  "50-module-registry-v1.js",
  "51-navigation-contract-v1.js",
  "52-page-builder-v1.js",
  "53-workflow-engine-v1.js"
].map((name) => sourceByName.get(name) || "").join("\n");

function hasStore(key) {
  return jsFiles.some((file) => file.content.includes(key));
}

test("every route-declared student store has a source owner in the Android JS tree", () => {
  const declared = new Set();
  for (const route of routes.routes) {
    assert.ok(Array.isArray(route.stateStores), "route must declare stateStores: " + route.id);
    for (const key of route.stateStores) {
      assert.equal(typeof key, "string");
      assert.ok(key.length > 0, "empty store key on route " + route.id);
      declared.add(key);
    }
  }
  assert.ok(declared.size > 0, "route inventory must not silently lose its store map");
  for (const key of declared) {
    assert.ok(hasStore(key), "route store has no source reference: " + key);
  }
});

test("critical learning stores retain their established keys and distinct ownership", () => {
  const critical = [
    "shbace_qb_v6",
    "shbace_quiz_v1",
    "shbace_quizcfg_v1",
    "shbace_sr3_v1",
    "shbace_pins_v1",
    "shbace_recent_v1",
    "shbace_note_meta_v2",
    "shbace_exam_goal_planner_v1",
    "shbace_remote_flashcards_v1",
    "shbace_studytime_v1",
    "shbace_notif_v1",
    "shbace_settings_v1",
    "shbace_theme",
    "shbace_topicmap_v1",
    "shbace_topicmap_backup_v1"
  ];
  for (const key of critical) {
    assert.ok(hasStore(key), "critical student store key is missing from source: " + key);
  }
  assert.notEqual("shbace_sr3_v1", "shbace_remote_flashcards_v1",
    "Smart Review and remote flashcard progress must remain separate stores");
  assert.match(sourceByName.get("45-android-remote-content.js") || "",
    /shbace_remote_flashcards_v1/);
  assert.match(sourceByName.get("36-exam-planner-settings-smartreview.js") || "",
    /shbace_exam_goal_planner_v1/);
});

test("question answers, bookmarks, notes, repetition and review retain the legacy QBank record shape", () => {
  assert.match(feature, /const KEY='shbace_qb_v6'/);
  assert.match(feature,
    /const S=Object\.assign\(\{ans:\{\},saved:\{\},notes:\{\},rep:\{\},sr:\{\}\},LS\.get\(KEY,\{\}\)\)/);
  for (const field of ["ans", "saved", "notes", "rep", "sr"]) {
    assert.ok(feature.includes(field + ":{"), "missing QBank progress field: " + field);
  }
});

test("topic-ID remapping keeps its raw backup gate before dependent-store writes", () => {
  const backupGate = feature.indexOf("if(!LS.set('shbace_topicmap_backup_v1'");
  const dependentWrite = feature.indexOf("LS.set(k,a.filter", backupGate);
  const quizConfigWrite = feature.indexOf("LS.set('shbace_quizcfg_v1'", backupGate);
  assert.ok(backupGate >= 0, "topic remapping must retain the backup-before-migration guard");
  assert.ok(dependentWrite > backupGate, "pin/recent writes must occur after the backup succeeds");
  assert.ok(quizConfigWrite > backupGate, "quiz configuration writes must occur after the backup succeeds");
  assert.match(feature.slice(backupGate, backupGate + 180),
    /if\(!LS\.set\('shbace_topicmap_backup_v1'.*?\)return/);
});

test("Core, navigation, Page Builder and Workflow foundations remain outside student storage", () => {
  assert.doesNotMatch(coreFiles, /\blocalStorage\b|\bsessionStorage\b|\bindexedDB\b/);
  for (const key of [
    "shbace_qb_v6", "shbace_sr3_v1", "shbace_pins_v1",
    "shbace_note_meta_v2", "shbace_remote_flashcards_v1"
  ]) assert.equal(coreFiles.includes(key), false, "foundation layer must not own " + key);
});
