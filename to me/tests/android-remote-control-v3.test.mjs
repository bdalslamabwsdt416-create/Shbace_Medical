import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, "..");
const index = readFileSync(resolve(root, "index.html"), "utf8");
const drawer = readFileSync(resolve(root, "js/06-drawer-menu.js"), "utf8");
const features = readFileSync(resolve(root, "js/09-app-features-v6.js"), "utf8");
const remote = readFileSync(resolve(root, "js/47-android-remote-control.js"), "utf8");
const remoteUi = readFileSync(resolve(root, "js/46-android-remote-ui.js"), "utf8");
const validator = readFileSync(resolve(root, "../for ApK/android-content/validate.mjs"), "utf8");

test("Universal remote controller loads after the V2 content/UI engine", () => {
  const v2 = index.indexOf('data-src="js/46-android-remote-ui.js"');
  const v3 = index.indexOf('data-src="js/47-android-remote-control.js"');
  assert.ok(v2 >= 0 && v3 > v2);
});

test("Controller is native Android only and does not execute remote code", () => {
  assert.match(remote, /getPlatform\(\) === 'android'/);
  assert.match(remote, /isNativePlatform\(\)/);
  assert.doesNotMatch(remote, /\beval\s*\(|new Function\s*\(/);
  assert.match(remote, /bottomNavigation/);
  assert.match(remote, /globalBlocks/);
  assert.match(remote, /screens/);
});

test("Drawer retains base groups while supporting remote order and movement", () => {
  assert.match(drawer, /itemOrder/);
  assert.match(drawer, /itemGroups/);
  assert.match(drawer, /const DR=/);
});

test("Quiz and Smart Review expose explicit safe settings bridges", () => {
  assert.match(features, /__shbApplyRemoteQuizOptions/);
  assert.match(features, /__shbApplyRemoteSmartReviewOptions/);
  assert.match(features, /config\.policy!=='enforce'/);
});

test("Remote content validator includes V3 screen, navigation and feature schemas", () => {
  for (const key of ["bottomNavigation", "globalBlocks", "screens", "features", "header", "itemGroups"]) {
    assert.ok(validator.includes(key), "validator covers " + key);
  }
  assert.match(validator, /card/);
  assert.match(validator, /metric/);
});
test("Theme tokens have one runtime owner and support bounded design controls", () => {
  assert.doesNotMatch(remoteUi, /function applyAppearance\s*\(/);
  for (const token of ["surfaceAltColor", "successColor", "dangerColor", "warningColor",
    "fontScale", "cardRadius", "lineHeight", "spacingScale", "density"]) {
    assert.ok(remote.includes(token), "theme engine applies " + token);
    assert.ok(validator.includes(token), "remote content validator checks " + token);
  }
  assert.match(remote, /removeProperty\(token\)/);
  assert.match(remote, /removeAttribute\('data-shb-remote-density'\)/);
  assert.match(remote, /shb-remote-line-height/);
  assert.match(remote, /shb-remote-spacing-scale/);
});
