import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, "..");
const pageBuilder = readFileSync(resolve(root, "js/46-android-remote-ui.js"), "utf8");
const validator = readFileSync(resolve(root, "../for ApK/android-content/validate.mjs"), "utf8");
const index = readFileSync(resolve(root, "index.html"), "utf8");

test("Android page builder remains declarative and Android-native only", () => {
  assert.match(pageBuilder, /getPlatform\(\) === 'android'/);
  assert.match(pageBuilder, /isNativePlatform\(\)/);
  assert.match(pageBuilder, /if \(!isNativeAndroid\(\)/);
  assert.doesNotMatch(pageBuilder, /\beval\s*\(|new Function\s*\(/);
});

test("nested layouts render only allow-listed component types", () => {
  for (const type of ["section", "grid", "tabs", "accordion", "when", "slot", "card", "list", "metric", "spacer"]) {
    assert.ok(pageBuilder.includes("'" + type + "'"), "page builder supports " + type);
    assert.ok(validator.includes("'" + type + "'"), "validator supports " + type);
  }
  assert.match(pageBuilder, /function renderBlocks\(/);
  assert.match(pageBuilder, /renderBlocks\(block\.blocks, page\)/);
  assert.match(pageBuilder, /renderBlocks\(template\.source\.blocks, page\)/);
  assert.match(pageBuilder, /shb-remote-ui-accordion/);
  assert.match(pageBuilder, /data-shb-remote-tab-index/);
});

test("tabs have real local interaction and accessible selected state", () => {
  assert.match(pageBuilder, /role="tablist"/);
  assert.match(pageBuilder, /aria-selected=/);
  assert.match(pageBuilder, /pane\.hidden =/);
  assert.match(pageBuilder, /addEventListener\('click'/);
});

test("reusable page templates have named slots and validated page bindings", () => {
  assert.match(pageBuilder, /templateById/);
  assert.match(pageBuilder, /collectTemplateSlots/);
  assert.match(pageBuilder, /declaredPageIds/);
  assert.match(pageBuilder, /page\.slots\[block\.name\]/);
  assert.match(validator, /Remote UI may define at most 20 reusable templates/);
  assert.match(validator, /slot is permitted only in a reusable template/);
  assert.match(validator, /Page references an unknown reusable template/);
  assert.match(validator, /Page provides an unknown template slot/);
});

test("nested remote component trees have depth and total-node limits", () => {
  assert.match(validator, /maximum nested layout depth of four/);
  assert.match(validator, /maximum total component count of 300/);
  assert.match(pageBuilder, /budget\.count > 300/);
  assert.match(pageBuilder, /depth > 4/);
  assert.match(validator, /blocks\.length <= 60/);
});

test("Page Builder v2 is loaded in the Android source bundle", () => {
  assert.ok(index.includes('data-src="js/46-android-remote-ui.js"'));
});
