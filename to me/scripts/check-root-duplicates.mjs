import { existsSync, readdirSync } from "node:fs";
import { join } from "node:path";

const root = process.cwd();
const rootEntries = readdirSync(root, { withFileTypes: true });
const problems = [];

for (const directory of ["js", "css"]) {
  const target = join(root, directory);
  if (!existsSync(target)) continue;

  const nestedNames = new Set(
    readdirSync(target, { withFileTypes: true })
      .filter(entry => entry.isFile())
      .map(entry => entry.name.toLowerCase())
  );

  for (const entry of rootEntries) {
    if (!entry.isFile()) continue;
    const name = entry.name.toLowerCase();
    const expectedExtension = directory === "js" ? name.endsWith(".js") : name.endsWith(".css");
    if (expectedExtension && nestedNames.has(name)) {
      problems.push(`Duplicate active filename: ${entry.name} and ${directory}/${entry.name}`);
    }
  }
}

if (problems.length) {
  console.error("Root-level duplicate JS/CSS files are not allowed:");
  for (const item of problems) console.error(" - " + item);
  process.exitCode = 1;
} else {
  console.log("No root-level JS/CSS duplicates.");
}
