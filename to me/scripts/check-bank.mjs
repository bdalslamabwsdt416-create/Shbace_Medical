import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { spawnSync } from "node:child_process";

/* Read-only QA: preserves the original 1,718-question bank and independently validates Clinical Case. */
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
if (bank.length !== 1718) errors.push(`base bank changed: expected 1718, found ${bank.length}`);

const clinicalPath = join(root, "data/clinical-case/clinical-case-bank-01.js");
const clinicalSource = readFileSync(clinicalPath, "utf8");
const match = clinicalSource.match(/\.concat\(([\s\S]*)\);\s*$/);
if (!match) errors.push("Clinical Case data script does not expose a valid concat payload");
let clinical = [];
if (match) {
  try { clinical = JSON.parse(match[1]); }
  catch (e) { errors.push("Clinical Case data JSON is invalid: " + e.message); }
}
const ccIds = new Set();
for (const q of clinical) {
  if (!q || q.cc !== true) { errors.push("Clinical Case record is missing cc=true"); continue; }
  if (!q.id || ccIds.has(q.id)) errors.push("Clinical Case duplicate/missing id: " + (q.id || "(empty)"));
  ccIds.add(q.id);
  if (!String(q.q || "").trim()) errors.push(q.id + ": missing stem");
  if (!String(q.ex || "").trim()) errors.push(q.id + ": missing Initial Explanation");
  if (!String(q.more || "").trim() || !q.more.includes("High-Yield:")) errors.push(q.id + ": missing Read More / High-Yield");
  if (!String(q.ccSource || "").trim() || !Array.isArray(q.ccSources) || !q.ccSources.length) errors.push(q.id + ": missing source provenance");
  if (!Array.isArray(q.ccOccurrences) || !q.ccOccurrences.length) errors.push(q.id + ": missing original exam/question occurrence provenance");
  if (!String(q.ccSystem || "").trim() || !String(q.ccTopic || "").trim()) errors.push(q.id + ": missing system/topic");
  if (q.o.length) {
    if (!Array.isArray(q.ol) || q.ol.length !== q.o.length) errors.push(q.id + ": option labels do not match options");
    if (!Number.isInteger(q.k) || q.k < 0 || q.k >= q.o.length || q.kx) errors.push(q.id + ": MCQ answer key is invalid or disabled");
  } else {
    if (!q.ccOpen || !q.kx || !String(q.ccAnswer || "").trim()) errors.push(q.id + ": open-ended case needs a model answer and disabled choice controls");
  }
  const mdPath = join(root, "data/clinical-case/explanations", "clinical-case-" + q.spec + ".md");
  try {
    const md = readFileSync(mdPath, "utf8");
    if (!md.includes(q.id)) errors.push(q.id + ": missing from system explanation Markdown");
    for (const occurrence of (q.ccOccurrences || [])) if (!md.includes(occurrence.heading)) errors.push(q.id + ": lost source heading " + occurrence.heading);
  } catch { errors.push(q.id + ": missing system explanation Markdown file"); }
}
const ccAudit = JSON.parse(readFileSync(join(root, "data/clinical-case/audit/clinical-case-audit.json"), "utf8"));
if (clinical.length !== 90 || ccAudit.unique_student_facing_cards_after_exact_deduplication !== 90) errors.push("Clinical Case expected 90 matched student-facing cards");
if (clinical.filter(q => q.o.length).length !== 90) errors.push("Clinical Case expected 90 complete MCQ cards");
if (clinical.filter(q => q.ccOpen || q.kx || q.ccMatchStatus !== "matched").length !== 0) errors.push("Clinical Case contains an unmatched, unverified, or disabled record");
if (ccAudit.mcq_cards !== 90 || ccAudit.mcq_answer_keys_resolved !== 90 || ccAudit.mcq_answer_keys_unresolved !== 0) errors.push("Clinical Case matched answer-key audit counts do not agree");
if (ccAudit.option_arrays_reconstructed_from_accepted_source !== 9) errors.push("Clinical Case source-option reconstruction audit count mismatch");
if (ccAudit.exact_duplicate_records_removed !== 18) errors.push("Clinical Case exact duplicate audit count mismatch");
if (clinical.reduce((sum, q) => sum + (q.ccOccurrences?.length || 0), 0) !== 108 || ccAudit.source_occurrences_preserved !== 108) errors.push("Clinical Case source occurrence provenance count mismatch");
if (ccAudit.accepted_sections_without_dedicated_question_block !== 59) errors.push("Clinical Case pending Accepted record count mismatch");
if (!String(ccAudit.publication_status || "").startsWith("MATCHED-ONLY BANK READY")) errors.push("Clinical Case audit must identify the matched-only bank status");
const pending = readFileSync(join(root, "data/clinical-case/audit/unmapped-accepted-records.md"), "utf8");
if ((pending.match(/^## Pending /gm) || []).length !== 59) errors.push("Clinical Case pending audit file does not preserve all 59 Accepted sections");


const egyptianDir = join(root, "data/egyptian-book");
const egyptianFiles = readdirSync(egyptianDir).filter(name => /^egyptian-book-bank-\\d{2}\\.js$/.test(name)).sort();
if (egyptianFiles.length !== 16) errors.push(`Egyptian Book expected 16 data shards, found ${egyptianFiles.length}`);
const egyptianIds = new Set();
let egyptianTotal = 0, egyptianReady = 0, egyptianUnresolved = 0;
for (const name of egyptianFiles) {
  const source = readFileSync(join(egyptianDir, name), "utf8");
  const match = source.match(/\\.concat\\(([\\s\\S]*)\\);\\s*$/);
  if (!match) { errors.push(`Egyptian Book ${name}: missing JSON concat payload`); continue; }
  let records = [];
  try { records = JSON.parse(match[1]); }
  catch (e) { errors.push(`Egyptian Book ${name}: invalid JSON — ${e.message}`); continue; }
  for (const q of records) {
    egyptianTotal++;
    if (!q || q.eb !== true || q.aoClass !== "Accepted") errors.push(`Egyptian Book ${q?.id || "(missing id)"}: not an Accepted Egyptian Book record`);
    if (!q.id || egyptianIds.has(q.id)) errors.push(`Egyptian Book duplicate/missing id: ${q.id || "(empty)"}`);
    egyptianIds.add(q.id);
    if (!String(q.q || "").trim() || !Array.isArray(q.o) || q.o.length < 2) errors.push(`Egyptian Book ${q.id}: missing stem or options`);
    if (Array.isArray(q.o) && q.o.length >= 2 && Number.isInteger(q.k) && q.k >= 0 && q.k < q.o.length) egyptianReady++;
    else egyptianUnresolved++;
  }
}
if (egyptianTotal !== 473 || egyptianIds.size !== 473) errors.push(`Egyptian Book expected 473 unique Accepted records, found ${egyptianTotal}/${egyptianIds.size}`);
if (egyptianReady !== 466 || egyptianUnresolved !== 7) errors.push(`Egyptian Book expected 466 answer-verified records and 7 unresolved records, found ${egyptianReady}/${egyptianUnresolved}`);
const appHtml = readFileSync(join(root, "index.html"), "utf8");
for (const name of egyptianFiles) if (!appHtml.includes(`data/egyptian-book/${name}`)) errors.push(`index.html does not load ${name}`);
if (!appHtml.includes("js/40-egyptian-book-pediatrics.js") || !appHtml.includes("css/egyptian-book.css")) errors.push("index.html is missing Egyptian Book UI or stylesheet registration");

const jsFiles = [
  ...readdirSync(join(root, "js")).filter(f => f.endsWith(".js")).map(f => join(root, "js", f)),
  clinicalPath,
  join(root, "js/40-egyptian-book-pediatrics.js")
];
for (const file of jsFiles) {
  const r = spawnSync(process.execPath, ["--check", file], { encoding: "utf8" });
  if (r.status !== 0) errors.push(`${file.replace(root + "/", "")}: syntax error\n${r.stderr}`);
}
console.log(`Checked ${bank.length} base questions and ${clinical.length} Clinical Case cards.`);
console.log(`Clinical Case: ${clinical.filter(q => q.o.length).length} matched MCQ, ${clinical.filter(q => q.ccOpen).length} open-ended, ${ccAudit.exact_duplicate_records_removed} exact duplicates removed, ${ccAudit.accepted_sections_without_dedicated_question_block} unmatched Accepted sections excluded.`);
warnings.forEach(w => console.log("WARN  " + w));
errors.forEach(e => console.log("ERROR " + e));
console.log(`${warnings.length} warning(s), ${errors.length} error(s).`);
process.exit(errors.length ? 1 : 0);
