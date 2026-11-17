import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const appSource = readFileSync(new URL("../js/04-app-main.js", import.meta.url), "utf8");
const aiAdapter = readFileSync(new URL("../js/43-ai-bank-engine-adapter.js", import.meta.url), "utf8");
const indexSource = readFileSync(new URL("../index.html", import.meta.url), "utf8");

function blockBetween(source, start, end) {
  const from = source.indexOf(start);
  assert.notEqual(from, -1, "expected source block: " + start);
  const to = source.indexOf(end, from + start.length);
  assert.notEqual(to, -1, "expected end marker: " + end);
  return source.slice(from, to);
}

test("splash completion cannot reveal the app before deferred scripts are ready", () => {
  const complete = blockBetween(
    appSource,
    "function completeSplashOnce(overlay,instant){",
    "function syncSplashOnForeground()"
  );
  assert.ok(complete.includes("window.__shbBooted!==true"));

  const foreground = blockBetween(
    appSource,
    "function syncSplashOnForeground(){",
    "document.addEventListener('visibilitychange'"
  );
  assert.ok(foreground.includes("window.__shbBooted!==true"));

  const launch = blockBetween(
    appSource,
    "function launchExperience(){",
    "/* The ONLY routing decision after the splash:"
  );
  assert.ok(launch.includes("if(window.__shbBooted!==true){"));
});

test("AI bank adapter does not trigger a second startup Home render", () => {
  assert.ok(!aiAdapter.includes("shb-scripts-ready"));
});

test("deferred scripts are prefetched in parallel but still execute in declared order", () => {
  assert.ok(indexSource.includes("function prefetchDeferredScripts(list)"));
  assert.ok(indexSource.includes("prefetchDeferredScripts(list);"));
  assert.ok(indexSource.includes("link.setAttribute('fetchpriority','low')"));
  assert.ok(indexSource.includes("n.async=false;"), "classic scripts must remain non-async");
  assert.ok(indexSource.includes("setTimeout(next,0);"), "the next script must wait for the current script's load event");
});
