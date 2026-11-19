import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, "..");
const sourceCss = readFileSync(resolve(root, "_layers/css/original/core.css"), "utf8");
const runtimeCss = readFileSync(resolve(root, "css/bundle-core.css"), "utf8");
const settings = readFileSync(resolve(root, "js/09-app-features-v6.js"), "utf8");
const remoteTheme = readFileSync(resolve(root, "js/47-android-remote-control.js"), "utf8");

const sharedTokens = [
  "--shb-theme-background", "--shb-theme-background-alt",
  "--shb-theme-surface", "--shb-theme-surface-alt", "--shb-theme-surface-muted",
  "--shb-theme-text", "--shb-theme-text-strong", "--shb-theme-muted", "--shb-theme-soft",
  "--shb-theme-border", "--shb-theme-border-strong", "--shb-theme-accent",
  "--shb-theme-accent-strong", "--shb-theme-accent-soft", "--shb-theme-accent-wash",
  "--shb-theme-success", "--shb-theme-danger", "--shb-theme-warning",
  "--shb-theme-shadow", "--shb-theme-shadow-raised", "--shb-theme-card-background",
  "--shb-theme-card-border", "--shb-theme-card-text", "--shb-theme-card-muted",
  "--shb-theme-card-shadow", "--shb-theme-card-radius"
];

test("semantic theme token contract is mirrored in the original source and Android runtime bundle", () => {
  for (const [label, css] of [["source", sourceCss], ["runtime", runtimeCss]]) {
    assert.equal((css.match(/SHBACE semantic theme tokens v1\\.1/g) || []).length, 1,
      label + " contains one semantic token block");
    assert.match(css, /--shb-theme-background:var\\(--bg\\)/);
    assert.match(css, /--shb-theme-surface:var\\(--panel\\)/);
    assert.match(css, /--shb-theme-text:var\\(--text\\)/);
    assert.match(css, /--shb-theme-accent:var\\(--mint\\)/);
    assert.match(css, /--shb-theme-success:var\\(--green\\)/);
    assert.match(css, /--shb-theme-danger:var\\(--red\\)/);
    assert.match(css, /--shb-theme-warning:var\\(--gold\\)/);
    for (const token of sharedTokens) {
      assert.ok(css.includes(token), label + " is missing " + token);
    }
    assert.match(css, /--shb-theme-background:var\\(--shb-light-bg\\)/);
    assert.match(css, /--shb-theme-surface:var\\(--shb-light-surface\\)/);
    assert.match(css, /--shb-theme-text:var\\(--shb-light-text\\)/);
    assert.match(css, /--shb-theme-accent:var\\(--shb-light-blue\\)/);
    assert.match(css, /--shb-theme-card-text:#203750/);
    assert.match(css, /color:var\\(--shb-theme-card-text\\)!important/);
    assert.match(css, /background:var\\(--shb-theme-card-background\\)!important/);
    assert.match(css, /border:1px solid var\\(--shb-theme-card-border\\)!important/);
    assert.match(css, /box-shadow:var\\(--shb-theme-card-shadow\\)!important/);
  }
});

test("local dark/light preference remains owned by the existing settings store", () => {
  assert.match(settings, /const SKEY='shbace_settings_v1'/);
  assert.match(settings, /localStorage\\.getItem\\('shbace_theme'\\)/);
  assert.match(settings, /localStorage\\.setItem\\('shbace_theme',SET\\.theme\\)/);
  assert.match(settings, /ph\\.classList\\.toggle\\('light',SET\\.theme==='light'\\)/);
  assert.match(settings, /toggleTheme=function\\(\\)\\{setSet\\('theme',SET\\.theme==='light'\\?'dark':'light'\\)\\}/);
  assert.doesNotMatch(remoteTheme, /classList\\.toggle\\(['"]light['"]/,
    "remote appearance must not force the student's local theme mode");
});
