import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { spawnSync } from "node:child_process";

/* Read-only quality check for the question bank and the JS files.
   Hard errors (exit 1): duplicate ids, answer letter missing from options, JS syntax errors.
   Warnings (exit 0): gaps in option letters, repeated option text, very short or "See Q" explanations. */
const root = process.cwd();
const bank = JSON.parse(readFileSync(join(root, "data/qbData.json"), "utf8")).questions;
const errors = [], warnings = [];
const ids = new Set();
for (const q of bank) {
  if (ids.has(q.id)) errors.push(`duplicate id ${q.id}`);
  ids.add(q.id);
  const letters = q.o.map(o => o[0]);
  if (!letters.includes(q.a)) errors.push(`${q.id}: answer "${q.a}" is not one of the options (${letters.join("")})`);
  const seq = "ABCDEFGH".slice(0, letters.length);
  if (letters.join("") !== seq) warnings.push(`${q.id}: option letters are ${letters.join("")} (expected ${seq})`);
  if (new Set(q.o.map(o => String(o[1]).trim().toLowerCase())).size !== q.o.length) warnings.push(`${q.id}: two options have the same text`);
  const e = String(q.e || "").trim();
  if (e.length < 40) warnings.push(`${q.id}: explanation is very short ("${e.slice(0, 30)}")`);
  if (/^see\s+q\s*\d+/i.test(e)) warnings.push(`${q.id}: explanation only points to another question ("${e}")`);
}
for (const f of readdirSync(join(root, "js")).filter(f => f.endsWith(".js"))) {
  const r = spawnSync(process.execPath, ["--check", join(root, "js", f)], { encoding: "utf8" });
  if (r.status !== 0) errors.push(`js/${f}: syntax error\n${r.stderr}`);
}
console.log(`Checked ${bank.length} questions.`);
warnings.forEach(w => console.log("WARN  " + w));
errors.forEach(e => console.log("ERROR " + e));
console.log(`${warnings.length} warning(s), ${errors.length} error(s).`);
process.exit(errors.length ? 1 : 0);
