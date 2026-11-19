import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import vm from "node:vm";
import test from "node:test";

const here = dirname(fileURLToPath(import.meta.url));
const rootPath = resolve(here, "..");
const rendererSource = readFileSync(resolve(rootPath, "js/52-page-builder-v1.js"), "utf8");

function createRuntime(direction = "ltr") {
  const handlers = Object.create(null);
  const document = {
    getElementById: () => null,
    createElement: () => ({ style: {}, textContent: "" }),
    head: { appendChild() {} },
    addEventListener(type, handler) { handlers[type] = handler; }
  };
  const window = {
    Capacitor: {
      getPlatform: () => "android",
      isNativePlatform: () => true
    },
    getComputedStyle: () => ({ direction }),
    SHBACECore: {
      services: { register: () => ({ ok: true }) },
      events: { emit() {} },
      diagnostics: { record() {} }
    }
  };
  const context = vm.createContext({ window, document, Number, Array, Object, String, Math, Date, JSON });
  vm.runInContext(rendererSource, context, { filename: "52-page-builder-v1.js" });

  const html = window.SHBACEPageBuilder.render([{
    type: "tabs",
    defaultTab: "overview",
    tabs: [
      { id: "overview", label: "Overview", blocks: [{ type: "text", text: "Overview panel" }] },
      { id: "details", label: "Details", blocks: [{ type: "text", text: "Details panel" }] },
      { id: "resources", label: "Resources", blocks: [{ type: "text", text: "Resources panel" }] }
    ]
  }], block => "<p>" + block.text + "</p>", "keyboard");

  const group = (html.match(/data-shb-pb-group="([^"]+)"/) || [])[1];
  assert.ok(group, "renderer must assign a tab group");
  const buttons = ["overview", "details", "resources"].map((id, index) => {
    const attrs = {
      "data-shb-pb-tab": id,
      "data-shb-pb-group": group,
      "tabindex": index === 0 ? "0" : "-1",
      "aria-selected": index === 0 ? "true" : "false"
    };
    const classes = new Set(index === 0 ? ["is-active"] : []);
    return {
      attrs,
      classes,
      focusCount: 0,
      getAttribute(name) { return this.attrs[name] == null ? null : this.attrs[name]; },
      setAttribute(name, value) { this.attrs[name] = String(value); },
      classList: {
        toggle(name, enabled) { enabled ? classes.add(name) : classes.delete(name); },
        contains(name) { return classes.has(name); }
      },
      closest(selector) {
        if (selector === ".shb-pb-tabs") return root;
        if (selector.indexOf("data-shb-pb-tab") >= 0) return this;
        return null;
      },
      focus() { this.focusCount += 1; }
    };
  });
  const panels = ["overview", "details", "resources"].map((id, index) => ({
    hidden: index !== 0,
    getAttribute(name) {
      if (name === "data-shb-pb-panel") return id;
      if (name === "data-shb-pb-group") return group;
      return null;
    }
  }));
  const root = {
    querySelectorAll(selector) {
      if (selector.indexOf("data-shb-pb-tab") >= 0) return buttons;
      if (selector.indexOf("data-shb-pb-panel") >= 0) return panels;
      return [];
    }
  };

  function eventTarget(index) {
    return { closest(selector) {
      return selector.indexOf("data-shb-pb-tab") >= 0 ? buttons[index] : null;
    } };
  }
  function key(index, value) {
    let prevented = false;
    handlers.keydown({
      key: value,
      target: eventTarget(index),
      preventDefault() { prevented = true; }
    });
    return { prevented };
  }
  function click(index) {
    let prevented = false;
    handlers.click({
      target: eventTarget(index),
      preventDefault() { prevented = true; }
    });
    return { prevented };
  }
  return { html, buttons, panels, handlers, key, click };
}

test("Page Builder tabs expose a roving tab stop and explicit tab-panel relationships", () => {
  const runtime = createRuntime();
  assert.match(runtime.html, /role="tablist"/);
  assert.match(runtime.html, /role="tab"[^>]*aria-selected="true"[^>]*aria-controls=/);
  assert.match(runtime.html, /tabindex="0"/);
  assert.equal((runtime.html.match(/tabindex="-1"/g) || []).length, 2);
  assert.match(runtime.html, /role="tabpanel"[^>]*aria-labelledby=/);
  assert.match(runtime.html, /id="keyboard-tabs-1-panel-overview"/);
});

test("LTR arrow keys move focus and selection, wrapping at both ends", () => {
  const runtime = createRuntime("ltr");

  assert.equal(runtime.key(0, "ArrowRight").prevented, true);
  assert.equal(runtime.buttons[1].getAttribute("aria-selected"), "true");
  assert.equal(runtime.buttons[1].getAttribute("tabindex"), "0");
  assert.equal(runtime.buttons[0].getAttribute("tabindex"), "-1");
  assert.equal(runtime.buttons[1].focusCount, 1);
  assert.deepEqual(runtime.panels.map(panel => panel.hidden), [true, false, true]);

  assert.equal(runtime.key(1, "ArrowRight").prevented, true);
  assert.equal(runtime.buttons[2].getAttribute("aria-selected"), "true");
  assert.equal(runtime.key(2, "ArrowRight").prevented, true);
  assert.equal(runtime.buttons[0].getAttribute("aria-selected"), "true");
  assert.equal(runtime.key(0, "ArrowLeft").prevented, true);
  assert.equal(runtime.buttons[2].getAttribute("aria-selected"), "true");
});

test("Home and End keys move to the first and last tab", () => {
  const runtime = createRuntime();

  assert.equal(runtime.key(0, "End").prevented, true);
  assert.equal(runtime.buttons[2].getAttribute("aria-selected"), "true");
  assert.equal(runtime.buttons[2].focusCount, 1);

  assert.equal(runtime.key(2, "Home").prevented, true);
  assert.equal(runtime.buttons[0].getAttribute("aria-selected"), "true");
  assert.equal(runtime.buttons[0].focusCount, 1);
});

test("RTL arrow keys follow visual reading direction", () => {
  const runtime = createRuntime("rtl");

  assert.equal(runtime.key(0, "ArrowRight").prevented, true);
  assert.equal(runtime.buttons[2].getAttribute("aria-selected"), "true");
  assert.equal(runtime.key(2, "ArrowLeft").prevented, true);
  assert.equal(runtime.buttons[0].getAttribute("aria-selected"), "true");
});

test("pointer activation updates selected state and roving tabindex without stealing focus", () => {
  const runtime = createRuntime();

  assert.equal(runtime.click(2).prevented, true);
  assert.equal(runtime.buttons[2].getAttribute("aria-selected"), "true");
  assert.equal(runtime.buttons[2].getAttribute("tabindex"), "0");
  assert.equal(runtime.buttons[0].getAttribute("tabindex"), "-1");
  assert.equal(runtime.buttons[2].focusCount, 0);
  assert.deepEqual(runtime.panels.map(panel => panel.hidden), [true, true, false]);
});
