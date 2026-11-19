import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const targetText = readFileSync(new URL("../data/clinicalCaseBank.json", import.meta.url), "utf8");
const sourceText = readFileSync(new URL("../../to%20me/data/clinicalCaseBank.json", import.meta.url), "utf8");
const bank = JSON.parse(targetText);

test("Clinical Case bank matches the To Me source exactly", () => {
  assert.equal(targetText, sourceText);
});

test("Clinical Case bank preserves the complete shared case and question identity set", () => {
  const caseIds = [];
  const questionIds = [];
  let questionCount = 0;
  for (const system of bank.systems || []) {
    for (const topic of system.topics || []) {
      for (const clinicalCase of topic.cases || []) {
        caseIds.push(clinicalCase.id);
        for (const question of clinicalCase.questions || []) {
          questionCount++;
          questionIds.push(question.id);
          assert.ok(
            question.options?.some(option => option.label === question.correctAnswer),
            `${question.id}: correct answer must match an existing option label`
          );
        }
      }
    }
  }
  assert.equal(bank.systems?.length, 10);
  assert.equal(caseIds.length, 481);
  assert.equal(questionCount, 1840);
  assert.equal(new Set(caseIds).size, caseIds.length, "case IDs must be unique");
  assert.equal(new Set(questionIds).size, questionIds.length, "question IDs must be unique");
});
