import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";

const read = (path) => readFileSync(new URL(path, import.meta.url), "utf8");
const scrollSource = read("../js/22-shb-scroll-keep-v17.js");
const core = read("../js/09-app-features-v6.js");
const css = read("../css/bundle-core.css");
const collections = read("../js/35-pediatrics-collections.js");
const iosPlanner = read("../js/33-ios-exam-planner.js");

test("Back is created as a titled control and styled sticky", () => {
  assert.ok(core.includes("className='backb'"));
  assert.ok(core.includes("className='back-context'"));
  assert.ok(css.includes(".backb{position:sticky"));
  assert.ok(css.includes(".backb.is-scroll-down"));
  assert.ok(css.includes(".backb.is-scroll-up"));
  assert.ok(css.includes("backdrop-filter:blur"));
  assert.ok(css.includes(".phone.light .rs .backb"));
});

test("topic list position is restored after opening a topic and returning", () => {
  const classes = new Set();
  const makeClassList = () => ({
    toggle(name, force) { if (force) classes.add(name); else classes.delete(name); },
    contains(name) { return classes.has(name); }
  });
  const makeScroller = (initial = 0) => {
    const back = { classList: makeClassList() };
    return {
      scrollTop: initial,
      classList: { contains(name) { return name === "app-scroll"; } },
      scrollHeight: 2000,
      clientHeight: 600,
      back,
      querySelector(selector) { return selector === ".backb" ? back : null; },
      scrollTo(options) { this.scrollTop = Number(options.top) || 0; }
    };
  };
  let currentScroller = makeScroller();
  let phoneTop = 0;
  function Element() {}
  Object.defineProperty(Element.prototype, "scrollTop", {
    configurable: true,
    get() { return phoneTop; },
    set(value) { phoneTop = Number(value) || 0; }
  });
  const phoneContent = Object.create(Element.prototype);
  const listeners = {};
  const document = {
    querySelector(selector) {
      return selector === "#phoneContent .app-shell>.app-scroll:not(.pg-ghost)" ? currentScroller : null;
    },
    querySelectorAll() { return []; },
    getElementById(id) { return id === "phoneContent" ? phoneContent : null; },
    addEventListener(type, callback) { listeners[type] = callback; }
  };
  const qs = { spec: "respiratory", topic: 0, view: "all" };
  const window = {
    __SHB_BRIDGE: { qs },
    __SHB_PED_COLLECTION__: "aj",
    renderAppDemo() {
      currentScroller = makeScroller(0);
      return currentScroller;
    }
  };
  const context = {
    window, document, Element, mode: "app", appPage: "topics",
    requestAnimationFrame(callback) { callback(); }
  };
  vm.runInNewContext(scrollSource, context, { filename: "22-shb-scroll-keep-v17.js" });

  window.renderAppDemo();
  currentScroller.scrollTop = 472;
  window.renderAppDemo();
  assert.equal(currentScroller.scrollTop, 472, "same-route redraw keeps the list position");

  context.appPage = "questions";
  qs.topic = 12;
  window.renderAppDemo();
  assert.equal(currentScroller.scrollTop, 0, "a new topic opens at the top of its questions");

  context.appPage = "topics";
  window.renderAppDemo();
  assert.equal(currentScroller.scrollTop, 472, "Back restores the exact previous topic-list offset");

  currentScroller.scrollTop = 500;
  listeners.scroll({ target: currentScroller });
  assert.equal(currentScroller.back.classList.contains("is-scroll-down"), true,
    "scrolling down makes the sticky Back control compact and translucent");
  currentScroller.scrollTop = 496;
  listeners.scroll({ target: currentScroller });
  assert.equal(currentScroller.back.classList.contains("is-scroll-up"), true,
    "a slight upward movement immediately makes Back fully visible");
  assert.equal(currentScroller.back.classList.contains("is-scroll-down"), false);

  /* The systems list is the same route even after qs.spec changes to the selected system. */
  context.appPage = "specialties";
  window.__SHB_PED_COLLECTION__ = "aj";
  qs.spec = "endocrinology";
  window.renderAppDemo();
  currentScroller.scrollTop = 238;
  window.renderAppDemo();
  context.appPage = "topics";
  qs.spec = "respiratory";
  window.renderAppDemo();
  context.appPage = "specialties";
  window.renderAppDemo();
  assert.equal(currentScroller.scrollTop, 238,
    "Back restores the system-list position even though qs.spec now names the selected system");
});

test("Previous Questions route key can distinguish its selected medical system", () => {
  assert.ok(collections.includes("__SHB_PED_COLLECTION_SYSTEM__"));
  assert.ok(scrollSource.includes("window.__SHB_PED_COLLECTION_SYSTEM__"));
  assert.ok(scrollSource.includes("String(q.spec||''),String(window.__SHB_PED_COLLECTION_SYSTEM__||'')"));
});

test("iOS Exam Planner navigation does not override route-aware app scroll restoration", () => {
  assert.ok(iosPlanner.includes("var stack=[],lastPage=typeof appPage==='string'?appPage:'subjects',backing=false,popping=false;"),
    "the iOS page-history stack remains active");
  assert.ok(!iosPlanner.includes("scrollMemo"),
    "the legacy page-only scroll memo must not restore phoneContent to zero");
  assert.ok(scrollSource.includes("#phoneContent .app-shell>.app-scroll:not(.pg-ghost)"),
    "the shared route-aware layer owns the actual app scroller");
});
