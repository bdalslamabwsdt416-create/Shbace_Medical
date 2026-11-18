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
  // Source-faithful exceptions: two original exam questions have no D option, and three originals contain duplicate options.
  // Their source notes remain in the question stem; do not renumber or silently rewrite exam choices.
  const sourceOptionExceptions = new Set(["NEONATE-003", "NEONATE-053"]);
  const sourceDuplicateExceptions = new Set(["NEONATE-046", "ENDO-NEW-011", "PY-F3-90"]);
  if (letters.join("") !== seq && !sourceOptionExceptions.has(q.id)) warnings.push(q.id + ": option letters are " + letters.join("") + " (expected " + seq + ")");
  if (new Set(q.o.map(o => String(o[1]).trim().toLowerCase())).size !== q.o.length && !sourceDuplicateExceptions.has(q.id)) warnings.push(q.id + ": two options have the same text");
  const e = String(q.e || "").trim();
  if (e.length < 40) warnings.push(`${q.id}: explanation is very short ("${e.slice(0, 30)}")`);
  if (/^see\s+q\s*\d+/i.test(e)) warnings.push(`${q.id}: explanation only points to another question ("${e}")`);
}
const crossBankIds = new Map(bank.filter(q => q && q.id).map(q => [q.id, "base"]));
function resolvedLegacyBank(q) {
  return q.nl === true ? "nelson" :
    q.py === true ? "previous" :
    q.eb === true ? "egyptian" :
    q.cc === true ? "clinical" :
    q.ao === true ? "kasr" : "aj";
}
function registerCrossBankRecord(q, bankName) {
  if (!q || !q.id) return;
  const previousBank = crossBankIds.get(q.id);
  if (previousBank) errors.push(q.id + ": duplicate ID across " + previousBank + " and " + bankName);
  else crossBankIds.set(q.id, bankName);
  const resolved = resolvedLegacyBank(q);
  if (resolved !== bankName) errors.push(q.id + ": legacy flags resolve to " + resolved + ", expected " + bankName);  if (q.bank !== undefined && q.bank !== bankName) errors.push(q.id + ": canonical bank is " + q.bank + ", expected " + bankName);
}
function readConcatBankRecords(directory, pattern, label) {
  const records = [];
  const files = readdirSync(directory).filter(name => pattern.test(name)).sort();
  for (const name of files) {
    const source = readFileSync(join(directory, name), "utf8");
    const shard = source.match(/\.concat\(([\s\S]*)\);\s*$/);
    if (!shard) { errors.push(label + " " + name + ": missing JSON concat payload"); continue; }
    try {
      const parsed = JSON.parse(shard[1]);
      if (!Array.isArray(parsed)) errors.push(label + " " + name + ": payload is not an array");
      else records.push(...parsed);
    } catch (error) {
      errors.push(label + " " + name + ": invalid JSON payload - " + error.message);
    }
  }
  return records;
}
const nelsonRecords = readConcatBankRecords(join(root, "data/nelson"), /^nelson-textbook-bank-\d{2}\.js$/, "Nelson");
const kasrRecords = readConcatBankRecords(join(root, "data/all-once"), /^all-once-bank-\d{2}\.js$/, "Kasr Al-Ainy");
for (const q of nelsonRecords) {
  if (!q || q.nl !== true) errors.push("Nelson " + (q?.id || "(missing id)") + ": missing nl=true");
  registerCrossBankRecord(q, "nelson");
}
for (const q of kasrRecords) {
  if (!q || q.ao !== true || q.eb === true) errors.push("Kasr Al-Ainy " + (q?.id || "(missing id)") + ": invalid legacy bank flags");
  registerCrossBankRecord(q, "kasr");
}if (bank.length !== 1718) errors.push(`base bank changed: expected 1718, found ${bank.length}`);

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
  registerCrossBankRecord(q, "clinical");
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
const egyptianFiles = readdirSync(egyptianDir).filter(name => /^egyptian-book-bank-\d{2}\.js$/.test(name)).sort();
if (egyptianFiles.length !== 16) errors.push(`Egyptian Book expected 16 data shards, found ${egyptianFiles.length}`);
const egyptianIds = new Set();
let egyptianTotal = 0, egyptianReady = 0, egyptianUnresolved = 0;
for (const name of egyptianFiles) {
  const source = readFileSync(join(egyptianDir, name), "utf8");
  const match = source.match(/\.concat\(([\s\S]*)\);\s*$/);
  if (!match) { errors.push(`Egyptian Book ${name}: missing JSON concat payload`); continue; }
  let records = [];
  try { records = JSON.parse(match[1]); }
  catch (e) { errors.push(`Egyptian Book ${name}: invalid JSON — ${e.message}`); continue; }
  for (const q of records) {
    egyptianTotal++;
    if (!q || q.eb !== true || q.aoClass !== "Accepted") errors.push(`Egyptian Book ${q?.id || "(missing id)"}: not an Accepted Egyptian Book record`);
    if (!q.id || egyptianIds.has(q.id)) errors.push(`Egyptian Book duplicate/missing id: ${q.id || "(empty)"}`);
    egyptianIds.add(q.id);
    registerCrossBankRecord(q, "egyptian");
    if (!String(q.q || "").trim() || !Array.isArray(q.o) || q.o.length < 2) errors.push(`Egyptian Book ${q.id}: missing stem or options`);
    if (Array.isArray(q.o) && q.o.length >= 2 && Number.isInteger(q.k) && q.k >= 0 && q.k < q.o.length) egyptianReady++;
    else egyptianUnresolved++;
  }
}
if (egyptianTotal !== 473 || egyptianIds.size !== 473) errors.push(`Egyptian Book expected 473 unique Accepted records, found ${egyptianTotal}/${egyptianIds.size}`);
if (egyptianReady !== 466 || egyptianUnresolved !== 7) errors.push(`Egyptian Book expected 466 answer-verified records and 7 unresolved records, found ${egyptianReady}/${egyptianUnresolved}`);
const appHtml = readFileSync(join(root, "index.html"), "utf8");
for (const name of egyptianFiles) if (!appHtml.includes(`data/egyptian-book/${name}`)) errors.push(`index.html does not load ${name}`);
const hasEgyptianBookStyles = appHtml.includes("css/egyptian-book.css") ||
  (appHtml.includes("css/bundle-late.css") &&
    readFileSync(join(root, "css/bundle-late.css"), "utf8").includes(".eb-systems-page"));
if (!appHtml.includes("js/40-egyptian-book-pediatrics.js") || !hasEgyptianBookStyles) {
  errors.push("index.html is missing Egyptian Book UI or stylesheet registration");
}

const jsFiles = [
  ...readdirSync(join(root, "js")).filter(f => f.endsWith(".js")).map(f => join(root, "js", f)),
  clinicalPath,
  join(root, "js/40-egyptian-book-pediatrics.js")
];
for (const file of jsFiles) {
  const r = spawnSync(process.execPath, ["--check", file], { encoding: "utf8" });
  if (r.status !== 0) errors.push(`${file.replace(root + "/", "")}: syntax error\n${r.stderr}`);
}
console.log("Bank identity audit: " + bank.length + " base, " + nelsonRecords.length + " Nelson, " + kasrRecords.length + " Kasr Al-Ainy, " + clinical.length + " Clinical Case, and " + egyptianTotal + " Egyptian Book records.");
console.log(`Clinical Case: ${clinical.filter(q => q.o.length).length} matched MCQ, ${clinical.filter(q => q.ccOpen).length} open-ended, ${ccAudit.exact_duplicate_records_removed} exact duplicates removed, ${ccAudit.accepted_sections_without_dedicated_question_block} unmatched Accepted sections excluded.`);

/* Additional QA for the AI-generated and shared Clinical Case banks in this folder. */
const generatedDir = join(root, "data/ai-generated");
const generatedFiles = readdirSync(generatedDir).filter(name => name.endsWith(".json")).sort();
if (generatedFiles.length !== 16) errors.push(`AI-generated bank expected 16 JSON files, found ${generatedFiles.length}`);

const auditedQuestionIds = new Set();
let generatedQuestionTotal = 0;
let clinicalQuestionTotal = 0;
let clinicalCaseTotal = 0;

function auditStudentFacingText(value, label) {
  const valueText = String(value || "");
  const hasEducationalSourceReference =
    /\b(?:lecture|sheet|textbook|source material|source PDF|source standard guidance|source clinical guidance)\b/i.test(valueText) ||
    /\b(?:according to|in|from|as stated in|as described in|as listed in|as defined in|as noted in|as recommended in)\s+(?:the\s+)?source(?:\s+(?:table|notes|material|standard guidance|clinical guidance))?\b/i.test(valueText) ||
    /\bthe source(?:'s)?\s+(?:notes?|describes?|states?|lists?|gives?|defines?|identifies?|classifies?|compares?|recommends?|outlines?|divides?|includes?|mentions?|explains?|specifies?|uses?|highlights?|emphasizes?|asks?|provides?|contains?|distinguishes?)\b/i.test(valueText);
  if (hasEducationalSourceReference) {
    errors.push(label + ": contains an educational source reference");
  }
  if (/\*\*/.test(valueText)) errors.push(label + ": contains raw Markdown bold markers");
  if (/case\s*focus/i.test(valueText)) errors.push(label + ": contains a Case focus label or attached text");
}

function auditMcqRecord(q, label) {
  if (!q || !q.id) {
    errors.push(label + ": missing question ID");
    return;
  }
  if (auditedQuestionIds.has(q.id)) errors.push(label + ": duplicate question ID " + q.id);
  auditedQuestionIds.add(q.id);

  for (const field of ["stem", "initialExplanation", "detailedExplanation", "highYieldPoints"]) {
    auditStudentFacingText(q[field], label + " " + field);
  }

  if (!Array.isArray(q.options) || q.options.length < 2) {
    errors.push(label + ": missing MCQ options");
    return;
  }
  const answer = q.options.find(option => option && option.label === q.correctAnswer);
  if (!answer) errors.push(label + ": correctAnswer does not match an option label");
  else {
    if (String(q.correctAnswerText || "").trim() !== String(answer.text || "").trim()) {
      errors.push(label + ": correctAnswerText does not exactly match the selected option");
    }
    const longestDistractor = q.options
      .filter(option => option && option.label !== q.correctAnswer)
      .reduce((longest, option) => Math.max(longest, String(option.text || "").length), 0);
    const answerLengthGap = String(answer.text || "").length - longestDistractor;
    if (answerLengthGap > 80) errors.push(label + ": correct answer is over 80 characters longer than the longest distractor");
  }

  for (const option of q.options) {
    auditStudentFacingText(option?.text, label + " option " + (option?.label || "(unknown)"));
    const optionText = String(option?.text || "").replace(/\bALL\b/g, "");
    if (/\b(?:only|always|never|every|all)\b|\bany age\b|\bin all cases\b/i.test(optionText)) {
      errors.push(label + ": option " + (option?.label || "(unknown)") + " contains a giveaway absolute word");
    }
  }
}

for (const name of generatedFiles) {
  const source = readFileSync(join(generatedDir, name), "utf8");
  let parsed;
  try { parsed = JSON.parse(source); }
  catch (error) {
    errors.push("AI-generated " + name + ": invalid JSON - " + error.message);
    continue;
  }
  if (parsed.schema !== "shbace-ai-generated-mcq-source-v1") errors.push("AI-generated " + name + ": unexpected schema");
  let fileCount = 0;
  for (const system of parsed.systems || []) {
    for (const topic of system.topics || []) {
      for (const q of topic.questions || []) {
        fileCount++;
        auditMcqRecord(q, "AI-generated " + name + " " + (q?.id || "(missing ID)"));
      }
    }
  }
  generatedQuestionTotal += fileCount;
  if (Number.isInteger(parsed.totalQuestions) && parsed.totalQuestions !== fileCount) {
    errors.push("AI-generated " + name + ": totalQuestions does not match the actual question count");
  }
}
if (generatedQuestionTotal !== 1881) errors.push("AI-generated bank expected 1,881 questions, found " + generatedQuestionTotal);

const clinicalBankPath = join(root, "data/clinicalCaseBank.json");
let clinicalBank;
try {
  clinicalBank = JSON.parse(readFileSync(clinicalBankPath, "utf8"));
} catch (error) {
  errors.push("Clinical Case bank: invalid JSON - " + error.message);
  clinicalBank = null;
}
if (clinicalBank) {
  if (clinicalBank.schema !== "shbace-clinical-case-bank-v1") errors.push("Clinical Case bank: unexpected schema");
  for (const system of clinicalBank.systems || []) {
    for (const topic of system.topics || []) {
      for (const clinicalCase of topic.cases || []) {
        clinicalCaseTotal++;
        auditStudentFacingText(clinicalCase.vignette, "Clinical Case " + (clinicalCase.id || "(missing case ID)") + " vignette");
        const vignetteText = String(clinicalCase.vignette || "");
        if (/\b(?:suspects?|considers?|diagnosed with|confirms?)\b/i.test(vignetteText) || /\bechocardiography\s+shows\s+(?:an?\s+)?(?:ASD|VSD|PDA|AVSD|CoA|TOF|TGA|coarctation|pulmonary stenosis|patent ductus arteriosus)\b/i.test(vignetteText)) {
          errors.push("Clinical Case " + clinicalCase.id + ": diagnostic wording remains in the shared case vignette");
        }
        for (const q of clinicalCase.questions || []) {
          clinicalQuestionTotal++;
          auditMcqRecord(q, "Clinical Case " + (q?.id || "(missing question ID)"));
        }
      }
    }
  }
}
if (clinicalCaseTotal !== 481) errors.push("Clinical Case expected 481 shared cases, found " + clinicalCaseTotal);
if (clinicalQuestionTotal !== 1840) errors.push("Clinical Case expected 1,840 questions, found " + clinicalQuestionTotal);

console.log("AI-generated: " + generatedFiles.length + " files, " + generatedQuestionTotal + " questions.");
console.log("Clinical Case: " + clinicalCaseTotal + " shared cases, " + clinicalQuestionTotal + " questions.");

warnings.forEach(w => console.log("WARN  " + w));
errors.forEach(e => console.log("ERROR " + e));
console.log(`${warnings.length} warning(s), ${errors.length} error(s).`);
process.exit(errors.length ? 1 : 0);
