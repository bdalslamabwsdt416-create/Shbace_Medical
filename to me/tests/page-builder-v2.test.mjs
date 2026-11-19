import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import vm from "node:vm";
import test from "node:test";

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, "..");
const rendererSource = readFileSync(resolve(root, "js/52-page-builder-v1.js"), "utf8");
const remoteUi = readFileSync(resolve(root, "js/46-android-remote-ui.js"), "utf8");
const validator = readFileSync(resolve(root, "../for ApK/android-content/validate.mjs"), "utf8");

function runtime(platform = "android", api = {}) {
  const services = new Map();
  const document = {
    getElementById: () => null,
    createElement: () => ({ style: {}, textContent: "" }),
    head: { appendChild() {} },
    addEventListener() {}
  };
  const window = {
    Capacitor: {
      getPlatform: () => platform,
      isNativePlatform: () => platform === "android"
    },
    __SHBACE_REMOTE_CONTENT_API__: api,
    SHBACECore: {
      services: { register: (name, value) => { services.set(name, value); return { ok: true }; } },
      events: { emit() {} },
      diagnostics: { record() {} }
    }
  };
  const context = vm.createContext({
    window, document, console, Number, Array, Object, String, Math, Date, JSON
  });
  vm.runInContext(rendererSource, context, { filename: "52-page-builder-v1.js" });
  return { window, services };
}

test("the shared Page Builder renderer registers only in native Android", () => {
  const native = runtime("android");
  assert.equal(native.window.SHBACEPageBuilder.platform, "android");
  assert.equal(native.services.get("page-builder.renderer"), native.window.SHBACEPageBuilder);
  assert.equal(runtime("web").window.SHBACEPageBuilder, undefined);
  assert.equal(native.window.SHBACEPageBuilder.maxDepth, 4);
  assert.equal(native.window.SHBACEPageBuilder.maxBlocks, 120);
});

test("nested section, row and grid layouts render through one shared renderer", () => {
  const api = runtime().window.SHBACEPageBuilder;
  const html = api.render([
    { type: "stack", gap: 8, children: [
      { type: "section", layout: "row", gap: 12, blocks: [
        { type: "heading", text: "Left" },
        { type: "section", layout: "grid", columns: 2, blocks: [
          { type: "text", text: "One" },
          { type: "text", text: "Two" }
        ] }
      ] },
      { type: "grid", columns: 3, blocks: [
        { type: "text", text: "Three columns" }
      ] }
    ] }
  ], block => "<span>" + block.text + "</span>", "section-test");
  assert.match(html, /shb-pb-stack/);
  assert.match(html, /shb-pb-section-row/);
  assert.match(html, /shb-pb-section-grid/);
  assert.match(html, /--shb-pb-columns:2/);
  assert.match(rendererSource, /grid-template-columns:repeat\(var\(--shb-pb-columns/);
  assert.match(html, /Three columns/);
});

test("tabs support v1 and v2 item shapes with accessible selected state", () => {
  const api = runtime().window.SHBACEPageBuilder;
  const html = api.render([
    { type: "tabs", defaultTab: "overview", items: [
      { id: "overview", label: "Overview", blocks: [{ type: "text", text: "Overview panel" }] },
      { id: "details", label: "Details", blocks: [{ type: "text", text: "Details panel" }] }
    ] },
    { type: "tabs", tabs: [
      { id: "one", label: "One", blocks: [{ type: "text", text: "One panel" }] },
      { id: "two", label: "Two", blocks: [{ type: "text", text: "Two panel" }] }
    ] }
  ], block => "<span>" + block.text + "</span>", "tabs-test");
  assert.match(html, /role="tablist"/);
  assert.match(html, /aria-selected="true"/);
  assert.match(html, /Overview panel/);
  assert.match(html, /One panel/);
});

test("accordion supports title and label entries", () => {
  const api = runtime().window.SHBACEPageBuilder;
  const html = api.render([
    { type: "accordion", items: [
      { label: "Clinical notes", blocks: [{ type: "text", text: "Notes panel" }] },
      { title: "Investigations", blocks: [{ type: "text", text: "Investigation panel" }] }
    ] }
  ], block => "<span>" + block.text + "</span>", "accordion-test");
  assert.match(html, /Clinical notes/);
  assert.match(html, /Investigations/);
  assert.match(html, /Notes panel/);
  assert.match(html, /Investigation panel/);
});

test("safe when conditions work in shared home/screen block rendering", () => {
  const api = runtime("android", {
    getBanks: () => [{ id: "bank-1" }],
    getResources: () => [],
    getFlashcardDecks: () => []
  }).window.SHBACEPageBuilder;
  const html = api.render([
    { type: "when", condition: "hasBanks", blocks: [{ type: "text", text: "Banks available" }] },
    { type: "when", condition: "hasResources", blocks: [{ type: "text", text: "Should be hidden" }] },
    { type: "when", condition: "hasResources", not: true, blocks: [{ type: "text", text: "No resources" }] }
  ], block => "<span>" + block.text + "</span>", "conditions-test");
  assert.match(html, /Banks available/);
  assert.match(html, /No resources/);
  assert.doesNotMatch(html, /Should be hidden/);
});

test("renderer enforces its 120-block budget", () => {
  const api = runtime().window.SHBACEPageBuilder;
  const blocks = Array.from({ length: 121 }, (_, index) => ({ type: "text", text: String(index) }));
  let rendered = 0;
  api.render(blocks, () => { rendered += 1; return "<span>x</span>"; }, "budget-test");
  assert.equal(rendered, 120);
});

test("remote UI template expansion and validator remain declarative and bounded", () => {
  assert.match(remoteUi, /function collectTemplateSlots/);
  assert.match(remoteUi, /function prepareBlocks/);
  assert.match(remoteUi, /templateById/);
  assert.match(remoteUi, /BUILTIN_CONDITIONS/);
  assert.match(remoteUi, /REMOTE_PAGE_RENDER_LIMIT/);
  assert.doesNotMatch(remoteUi, /\beval\s*\(|new Function\s*\(/);
  assert.match(validator, /Remote UI may define at most 20 reusable templates/);
  assert.match(validator, /UI slot is permitted only in a reusable template/);
  assert.match(validator, /Page references an unknown reusable template/);
  assert.match(validator, /Page provides an unknown template slot/);
  assert.match(validator, /Expanded remote page exceeds 120 components/);
  assert.match(validator, /remoteUiBuiltinPageIds/);
});
