import test from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");

test("root does not contain duplicate JS/CSS files beside js/ or css/", () => {
  const result = spawnSync(
    process.execPath,
    [resolve(root, "scripts/check-root-duplicates.mjs")],
    { cwd: root, encoding: "utf8" }
  );
  assert.equal(result.status, 0, `${result.stdout || ""}${result.stderr || ""}`);
});
