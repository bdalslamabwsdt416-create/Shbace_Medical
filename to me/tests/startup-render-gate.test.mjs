import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const appSource = readFileSync(new URL("../js/04-app-main.js", import.meta.url), "utf8");
const aiAdapter = readFileSync(new URL("../js/43-ai-bank-engine-adapter.js", import.meta.url), "utf8");

test("splash completion cannot reveal the app before deferred scripts are ready", () => {
  const complete = appSource.match(/function completeSplashOnce\\(overlay,instant\\)\\{([\\s\\S]*?)\\n\\}/);
  assert.ok(complete, "the single splash completion function must exist");
  assert.match(complete[1], /window\\.__shbBooted!==true/);

  const foreground = appSource.match(/function syncSplashOnForeground\\(\\)\\{([\\s\\S]*?)\\n\\}/);
  assert.ok(foreground, "foreground resume must use the same startup gate");
  assert.match(foreground[1], /window\\.__shbBooted!==true/);

  const launch = appSource.match(/function launchExperience\\(\\)\\{([\\s\\S]*?)\\n\\}\\n\\/\\* The ONLY routing decision/);
  assert.ok(launch, "launchExperience must own the startup route");
  assert.match(launch[1], /window\\.__shbBooted!==true/);
});

test("AI bank adapter does not trigger a second startup Home render", () => {
  assert.doesNotMatch(aiAdapter, /addEventListener\\(['"]shb-scripts-ready/);
});
