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
    assert.equal(css.split("SHBACE semantic theme tokens v1.1").length - 1, 1,
      label + " contains one semantic token block");
    for (const token of sharedTokens) {
      assert.ok(css.includes(token), label + " is missing " + token);
    }
    for (const declaration of [
      "--shb-theme-background:var(--bg)",
      "--shb-theme-surface:var(--panel)",
      "--shb-theme-text:var(--text)",
      "--shb-theme-accent:var(--mint)",
      "--shb-theme-success:var(--green)",
      "--shb-theme-danger:var(--red)",
      "--shb-theme-warning:var(--gold)",
      "--shb-theme-background:var(--shb-light-bg)",
      "--shb-theme-surface:var(--shb-light-surface)",
      "--shb-theme-text:var(--shb-light-text)",
      "--shb-theme-accent:var(--shb-light-blue)",
      "--shb-theme-card-text:#203750",
      "color:var(--shb-theme-card-text)!important",
      "background:var(--shb-theme-card-background)!important",
      "border:1px solid var(--shb-theme-card-border)!important",
      "box-shadow:var(--shb-theme-card-shadow)!important"
    ]) {
      assert.ok(css.includes(declaration), label + " is missing " + declaration);
    }
  }
});

test("local dark/light preference remains owned by the existing settings store", () => {
  for (const contract of [
    "const SKEY='shbace_settings_v1'",
    "localStorage.getItem('shbace_theme')",
    "localStorage.setItem('shbace_theme',SET.theme)",
    "ph.classList.toggle('light',SET.theme==='light')",
    "toggleTheme=function(){setSet('theme',SET.theme==='light'?'dark':'light')}"
  ]) {
    assert.ok(settings.includes(contract), "settings is missing " + contract);
  }
  assert.equal(remoteTheme.includes("classList.toggle('light'"), false,
    "remote appearance must not force the student's local theme mode");
});
