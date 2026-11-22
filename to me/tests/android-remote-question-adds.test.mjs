import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import vm from "node:vm";
import test from "node:test";

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, "..");
const core = readFileSync(resolve(root, "js/09-app-features-v6.js"), "utf8");
const adapter = readFileSync(resolve(root, "js/43-ai-bank-engine-adapter.js"), "utf8");
const remote = readFileSync(resolve(root, "js/45-android-remote-content.js"), "utf8");
const packageManifest = JSON.parse(readFileSync(resolve(root, "../for ApK/android-content/manifest.json"), "utf8"));
const packageCatalog = JSON.parse(readFileSync(resolve(root, "../for ApK/android-content/catalog.json"), "utf8"));
const overrides = JSON.parse(readFileSync(resolve(root, "../for ApK/android-content/overrides/patches.json"), "utf8"));

function extractAppendFunction(source) {
  const marker = "window.__SHB_BRIDGE.appendQuestionToExistingTopic=function";
  const markerAt = source.indexOf(marker);
  assert.ok(markerAt >= 0, "Android local-topic append method is missing");
  const expressionStart = source.indexOf("=", markerAt) + 1;
  const bodyStart = source.indexOf("{", expressionStart);
  assert.ok(expressionStart > 0 && bodyStart > expressionStart, "append method declaration is malformed");
  let depth = 0;
  for (let i = bodyStart; i < source.length; i += 1) {
    if (source[i] === "{") depth += 1;
    else if (source[i] === "}") {
      depth -= 1;
      if (depth === 0) return source.slice(expressionStart, i + 1);
    }
  }
  throw new Error("append method body is unterminated");
}

test("Android OTA appends into the existing registered topic and synchronizes all question indexes", () => {
  const topicName = "Chronic Abdominal Pain and Infantile Colic";
  const questions = Array.from({ length: 4 }, (_, index) => ({
    id: "existing-" + index, spec: "git", topic: 8400139, bank: "generated-ai",
    q: "Existing question " + index, o: ["A", "B"], k: 0
  }));
  const group = { spec: "git", topicName, questions };
  const bankEntry = {
    questions: 4,
    validation: { questions: 4, registered: 4 },
    systems: [{ spec: "git", name: "Gastrointestinal System", count: 4, groups: [group] }]
  };
  const bridge = { AI_BANK_REGISTRY: { "generated-ai": bankEntry } };
  const context = vm.createContext({
    window: { __SHB_BRIDGE: bridge, __bank: { total: 4 } },
    BANK_KEYS: new Set(["generated-ai"]),
    REAL: { total: 4, spec: { git: { q: 4, topics: [[8400139, topicName, 4, "AI Generated"]] } } },
    SRT: [{ id: 8400139, name: topicName, sy: "Gastrointestinal System", spec: "git" }],
    SRT_Q: new Map([[8400139, questions]]),
    bankOf: (question) => question.bank || "aj",
    QBY: new Map(questions.map((question) => [question.id, question])),
    QB: questions.slice(),
    qmap: new Map(questions.map((question) => [question.id, question])),
    gIdx: 2, srCache: {}, _qsg: {}, _qsgN: 3
  });
  const append = vm.runInContext("(" + extractAppendFunction(core) + ")", context);
  const added = { id: "rc-add-test", q: "New Crohn case", o: ["A", "B", "C"], k: 2 };
  const result = append(added, "generated-ai", "git", topicName, null);

  assert.deepEqual(JSON.parse(JSON.stringify(result)), { added: 1, topicId: 8400139, total: 5 });
  assert.equal(context.QB.length, 5);
  assert.equal(context.QBY.get(added.id), added);
  assert.equal(context.qmap.get(added.id), added);
  assert.equal(context.SRT_Q.get(8400139).length, 5);
  assert.equal(group.questions.length, 5);
  assert.equal(context.REAL.spec.git.topics[0][2], 5);
  assert.equal(context.REAL.spec.git.q, 5);
  assert.equal(context.REAL.total, 5);
  assert.equal(context.window.__bank.total, 5);
  assert.equal(bankEntry.questions, 5);
  assert.equal(bankEntry.validation.questions, 5);
  assert.equal(bankEntry.validation.registered, 5);
  assert.equal(bankEntry.systems[0].count, 5);
  assert.equal(context.gIdx, null);
  assert.equal(context.srCache, null);
  assert.equal(context._qsg, null);
  assert.equal(context._qsgN, -1);
  assert.throws(() => append({ ...added }, "generated-ai", "git", topicName, null), /already exists/);
});

test("questionAdds waits for lazily registered banks and uses bank/topic names rather than unstable generated IDs", () => {
  assert.match(remote, /var pendingQuestionAdds = Object\.create\(null\)/);
  assert.match(remote, /flushPendingQuestionAdds\(String\(key \|\| ''\)\)/);
  assert.match(remote, /originalRegisterExternalBank\.apply\(this, arguments\)/);
  assert.match(adapter, /if\(nativeAndroid\)B\.AI_BANK_REGISTRY=registry/);
  assert.match(core, /if\(!nativeAndroid\)return/);
  assert.equal(packageManifest.version, "1.0.5");
  assert.equal(packageManifest.contentVersionCode, 5);
  assert.equal(packageManifest.minAppVersionCode, 19);
  assert.equal(packageCatalog.version, packageManifest.version);
  const addition = overrides.questionAdds.find((item) => item.id === "crohn-case-001");
  assert.ok(addition);
  assert.equal(addition.targetSpec, "git");
  assert.equal(addition.targetBank, "generated-ai");
  assert.equal(addition.targetTopicName, "Chronic Abdominal Pain and Infantile Colic");
  assert.equal(addition.question.correctIndex, 2);
});

test("remote-added questions with extended explanations render the Read More section", () => {
  assert.match(core, /!q\.remoteBankId\)\|\|!q\.more\)return ''/);
  assert.match(core, /q\.remoteBankId\?String\(q\.src\|\|'Remote question bank source'\)/);
  assert.match(core, /<summary>'\+'Read More'\+'<\/summary>/);
});
