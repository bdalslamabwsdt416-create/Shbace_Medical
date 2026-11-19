import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const source = readFileSync(new URL("../js/29-offline-setup.js", import.meta.url), "utf8");

function blockBetween(start, end) {
  const from = source.indexOf(start);
  assert.notEqual(from, -1, `missing source block: ${start}`);
  const to = source.indexOf(end, from + start.length);
  assert.notEqual(to, -1, `missing source boundary: ${end}`);
  return source.slice(from, to);
}

test("the READY marker is published after a versioned manifest snapshot", () => {
  const save = blockBetween("async function saveInstalled(m)", "/* Download a plan.");
  const snapshot = save.indexOf("manifestSnapshotUrl(m.version)");
  const readyMeta = save.indexOf("dbPut('meta','ready'");
  const readyCache = save.indexOf("c.put(READY_URL");
  assert.ok(snapshot >= 0, "installed manifest snapshot must be cached");
  assert.ok(readyMeta > snapshot, "IndexedDB ready metadata must follow the manifest snapshot");
  assert.ok(readyCache > readyMeta, "Cache Storage READY marker must be the final commit marker");
});

test("cache recovery requires a valid READY marker and matching manifest version", () => {
  const recovery = blockBetween("async function recoverInstalledFromCache()", "async function computePlan");
  assert.match(recovery, /c\.match\(READY_URL\)/);
  assert.match(recovery, /marker\.verified!==true/);
  assert.match(recovery, /manifestSnapshotUrl\(marker\.version\)/);
  assert.match(recovery, /validManifest\(cachedManifest\)/);
  assert.match(recovery, /String\(cachedManifest\.version\)!==String\(marker\.version\)/);
});

test("recovery verifies cached file bytes and SHA-256 before rebuilding metadata", () => {
  const recovery = blockBetween("async function recoverInstalledFromCache()", "async function computePlan");
  const verify = blockBetween("async function verifyCachedFiles", "/* Recover only when IndexedDB metadata is missing.");
  assert.match(recovery, /verifyCachedFiles\(cachedManifest\.files/);
  assert.match(verify, /b\.byteLength===f\.bytes/);
  assert.match(verify, /sha256\(b\)/);
  assert.match(recovery, /fileMap\(checked\.good\)/);
  assert.match(recovery, /checked\.bad\.length===0/);
});

test("boot attempts cache recovery before showing first-install setup", () => {
  const boot = blockBetween("async function boot()", "function kick()");
  const recoveryCall = boot.indexOf("recoverInstalledFromCache()");
  const setupGate = boot.indexOf("if(!hasRec&&!hasReadyMarker&&!recoveredFromCache)");
  assert.ok(recoveryCall >= 0);
  assert.ok(setupGate > recoveryCall);
  assert.match(boot, /recoveryNeedsRepair&&online\(\)/);
});

test("partial recovery remains marked for targeted repair on later launches", () => {
  const boot = blockBetween("async function boot()", "function kick()");
  const kick = blockBetween("function kick()", "function start()");
  assert.match(boot, /rec\.verified===false/);
  assert.match(kick, /if\(recoveryNeedsRepair\)/);
  assert.match(kick, /runFullCheck\(\{force:true\}\)/);
});
