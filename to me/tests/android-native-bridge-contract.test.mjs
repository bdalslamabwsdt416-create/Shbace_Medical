import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { dirname, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, "..");
const repositoryRoot = resolve(root, "..");
const javaRoot = resolve(repositoryRoot, "android/app/src/main/java");
const jsDir = resolve(root, "js");
const index = readFileSync(resolve(root, "index.html"), "utf8");
const contract = JSON.parse(readFileSync(
  resolve(root, "modules/native-bridge-contract.v1.json"), "utf8"
));

function walk(directory) {
  const files = [];
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const path = resolve(directory, entry.name);
    if (entry.isDirectory()) files.push(...walk(path));
    else if (entry.isFile()) files.push(path);
  }
  return files;
}

function exposedMethods(source) {
  return [...source.matchAll(
    /@JavascriptInterface\s+public\s+[\w.<>?]+\s+([A-Za-z_]\w*)\s*\(/g
  )].map((match) => match[1]).sort();
}

function sorted(values) {
  return [...values].sort();
}

function scanJavaScriptCalls(sources, interfaceName) {
  const calls = new Set();
  const direct = new RegExp(
    "(?:window\\s*\\.\\s*)?" + interfaceName + "\\s*\\.\\s*([A-Za-z_$][\\w$]*)", "g"
  );
  const aliasDeclaration = new RegExp(
    "\\b(?:var|let|const)\\s+([A-Za-z_][A-Za-z0-9_]*)\\s*=\\s*(?:window\\s*\\.\\s*)?" +
      interfaceName + "\\b", "g"
  );

  for (const source of sources) {
    for (const match of source.content.matchAll(direct)) calls.add(match[1]);

    // Resolve aliases only in the source file where they are declared.
    for (const declaration of source.content.matchAll(aliasDeclaration)) {
      const alias = declaration[1];
      const aliasCalls = new RegExp(
        "\\b" + alias + "\\s*\\.\\s*([A-Za-z_$][\\w$]*)", "g"
      );
      for (const match of source.content.matchAll(aliasCalls)) calls.add(match[1]);
    }
  }
  return sorted(calls);
}

const jsSources = [
  { path: "index.html", content: index },
  ...readdirSync(jsDir)
    .filter((name) => name.endsWith(".js"))
    .sort()
    .map((name) => ({
      path: "js/" + name,
      content: readFileSync(resolve(jsDir, name), "utf8")
    }))
];

test("Android JavaScript bridge contract has unique interface and method identifiers", () => {
  assert.equal(contract.contractVersion, 1);
  assert.equal(contract.target, "android-apk");

  const interfaceNames = contract.interfaces.map((entry) => entry.name);
  assert.ok(interfaceNames.length > 0);
  assert.equal(new Set(interfaceNames).size, interfaceNames.length);

  for (const entry of contract.interfaces) {
    assert.match(entry.name, /^[A-Za-z_$][A-Za-z0-9_$]*$/);
    assert.ok(Array.isArray(entry.methods) && entry.methods.length > 0);
    const names = entry.methods.map((method) => method.name);
    assert.equal(new Set(names).size, names.length, "duplicate method in " + entry.name);
    for (const method of entry.methods) {
      assert.match(method.name, /^[A-Za-z_$][A-Za-z0-9_$]*$/);
      assert.ok(method.capability, "missing capability classification: " + entry.name + "." + method.name);
      assert.ok(method.purpose, "missing purpose: " + entry.name + "." + method.name);
    }
  }
});

test("all @JavascriptInterface methods are declared in the reviewed Android bridge contract", () => {
  const allowedOwners = new Map(contract.interfaces.map((entry) => [entry.owner, entry]));
  const discovered = new Map();

  for (const path of walk(javaRoot).filter((file) => file.endsWith(".java"))) {
    const methods = exposedMethods(readFileSync(path, "utf8"));
    if (!methods.length) continue;

    const owner = relative(repositoryRoot, path);
    const declaration = allowedOwners.get(owner);
    assert.ok(declaration, "unreviewed JavaScript interface owner: " + owner);
    discovered.set(declaration.name, methods);
  }

  for (const entry of contract.interfaces) {
    const actual = discovered.get(entry.name) || [];
    const expected = sorted(entry.methods.map((method) => method.name));
    assert.deepEqual(actual, expected, "Java exposure drift for " + entry.name);
  }
  assert.deepEqual(sorted(discovered.keys()), sorted(contract.interfaces.map((entry) => entry.name)));
});

test("MainActivity registers only the two declared WebView interfaces", () => {
  const activityPath = resolve(repositoryRoot, "android/app/src/main/java/com/shbace/medical/MainActivity.java");
  const activity = readFileSync(activityPath, "utf8");
  assert.equal([...activity.matchAll(/addJavascriptInterface\s*\(/g)].length, 2);
  assert.match(activity, /nativeBridge\s*=\s*new\s+ShbaceNative\(this,\s*web\)/);
  assert.match(activity, /web\.addJavascriptInterface\(nativeBridge,\s*"ShbaceNative"\)/);
  assert.match(activity, /web\.addJavascriptInterface\(new\s+InsetsBridge\(\),\s*"ShbaceInsets"\)/);
});

test("JavaScript call sites use only methods in the corresponding approved bridge", () => {
  for (const entry of contract.interfaces) {
    const actualCalls = scanJavaScriptCalls(jsSources, entry.name);
    const allowedCalls = new Set(entry.methods.map((method) => method.name));
    for (const method of actualCalls) {
      assert.ok(
        allowedCalls.has(method),
        "uncontracted JavaScript call: " + entry.name + "." + method
      );
    }
  }
});
