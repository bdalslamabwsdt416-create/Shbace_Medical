import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

/* Read-only QA across the separate banks: duplicate ids and identical stems between banks.
   Warnings only by default; pass --strict to fail on duplicate ids. */
const root = process.cwd();
const strict = process.argv.includes("--strict");

function loadChunks(dir) {
  const out = [];
  for (const f of readdirSync(join(root, dir)).filter(n => n.endsWith(".js")).sort()) {
    const src = readFileSync(join(root, dir, f), "utf8");
    const m = src.match(/\.concat\(([\s\S]*)\);\s*$/);
    if (!m) throw new Error(`${dir}/${f}: no concat payload`);
    out.push(...JSON.parse(m[1]));
  }
  return out;
}

const banks = {
  "al-joaki/previous": JSON.parse(readFileSync(join(root, "data/qbData.json"), "utf8")).questions
    .map(q => ({ id: q.id, stem: q.q, spec: q.s })),
  nelson: loadChunks("data/nelson").map(q => ({ id: q.id, stem: q.q, spec: q.spec })),
  "kasr-al-ainy": loadChunks("data/all-once").map(q => ({ id: q.id, stem: q.q, spec: q.spec })),
  "clinical-case": loadChunks("data/clinical-case").map(q => ({ id: q.id, stem: q.q, spec: q.spec })),
  egyptian: loadChunks("data/egyptian-book").map(q => ({ id: q.id, stem: q.q, spec: q.spec }))
};

const norm = s => String(s || "").toLowerCase().replace(/[^a-z0-9؀-ۿ]+/g, " ").trim();
let errors = 0, warns = 0;
const seenId = new Map(), seenStem = new Map();
for (const [bank, list] of Object.entries(banks)) {
  console.log(`${bank}: ${list.length} questions`);
  for (const q of list) {
    if (!q.id) { console.log(`WARN  ${bank}: record without id`); warns++; continue; }
    if (seenId.has(q.id)) {
      console.log(`${strict ? "ERROR" : "WARN "} id ${q.id} appears in ${seenId.get(q.id)} and ${bank}`);
      strict ? errors++ : warns++;
    } else seenId.set(q.id, bank);
    const key = norm(q.stem);
    if (key.length < 25) continue;
    const prev = seenStem.get(key);
    if (prev && prev.bank !== bank) { console.log(`WARN  identical stem in ${prev.bank} (${prev.id}) and ${bank} (${q.id})`); warns++; }
    else if (!prev) seenStem.set(key, { bank, id: q.id });
  }
}
console.log(`cross-bank check: ${warns} warning(s), ${errors} error(s)`);
process.exit(errors ? 1 : 0);
