import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import vm from "node:vm";
import test from "node:test";

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, "..");
const feature = readFileSync(resolve(root, "js/09-app-features-v6.js"), "utf8");

const helper = (feature.match(/function qbnNavigateRoute\(route\)\{[\s\S]*?\n\}/) || [])[0];
const start = feature.indexOf("window.openSpec=function(id){");
const end = feature.indexOf(";", start);
assert.ok(helper, "shared Question Bank route helper must exist");
assert.ok(start >= 0 && end > start, "specialty open handler must exist");
const openSpecialty = feature.slice(start, end + 1);

function exerciseOpenSpecialty(id, adapterMode = "ok") {
  const calls = { routes:[], renders:0 };
  const window = {};
  const context = vm.createContext({
    window,
    qs:{spec:"old-specialty",topic:82},
    appPage:"subjects",
    renderAppDemo(){calls.renders++;}
  });
  if (adapterMode !== "missing") {
    window.__shbNavTap = route => {
      calls.routes.push(route);
      if (adapterMode === "throw") throw new Error("shared adapter unavailable");
      context.appPage = route;
      context.renderAppDemo();
    };
  }
  vm.runInContext(helper + "\n" + openSpecialty, context, {filename:"specialty-open-navigation-adapter.js"});
  context.window.openSpec(id);
  return {context,calls};
}

test("opening a specialty resets its topic and dispatches the Topics route once", () => {
  const result = exerciseOpenSpecialty("renal");
  assert.equal(result.context.qs.spec,"renal");
  assert.equal(result.context.qs.topic,0);
  assert.deepEqual(result.calls.routes,["topics"]);
  assert.equal(result.calls.renders,1);
  assert.equal(result.context.appPage,"topics");
  assert.doesNotMatch(openSpecialty,/appPage\s*=/);
});

test("specialty opening retains the local render fallback when the shared adapter is missing or throws", () => {
  const missing = exerciseOpenSpecialty("respiratory","missing");
  assert.deepEqual(missing.calls.routes,[]);
  assert.equal(missing.context.qs.spec,"respiratory");
  assert.equal(missing.context.qs.topic,0);
  assert.equal(missing.context.appPage,"topics");
  assert.equal(missing.calls.renders,1);

  const failed = exerciseOpenSpecialty("cardio","throw");
  assert.deepEqual(failed.calls.routes,["topics"]);
  assert.equal(failed.context.qs.spec,"cardio");
  assert.equal(failed.context.qs.topic,0);
  assert.equal(failed.context.appPage,"topics");
  assert.equal(failed.calls.renders,1);
});
