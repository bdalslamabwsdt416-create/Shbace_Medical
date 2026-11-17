/* Unit test for the Arabic/English search normaliser `nz` used by every search box.
   js/09-app-features-v6.js is one closed IIFE, so the two statements are cut out of the real source and evaluated alone;
   the test therefore always checks the code that ships, not a copy. */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const src = readFileSync(join(here, '..', 'js', '09-app-features-v6.js'), 'utf8');

function pick(re, label) {
  const m = src.match(re);
  assert.ok(m, `could not find ${label} in js/09-app-features-v6.js`);
  return m[0];
}

const marks = pick(/^const AR_MARKS=.*;$/m, 'AR_MARKS');
const nzStmt = pick(/^const nz=.*;$/m, 'nz');
// Newer sources hoist the RegExp into AR_MARKS_RE; define it here (the older inline form simply ignores it).
const nz = new Function(`${marks}\nconst AR_MARKS_RE=new RegExp('['+AR_MARKS+']','g');\n${nzStmt}\nreturn nz;`)();

test('English is lower-cased and null-safe', () => {
  assert.equal(nz('ASTHMA'), 'asthma');
  assert.equal(nz(null), '');
  assert.equal(nz(undefined), '');
  assert.equal(nz(42), '42');
});

test('Arabic diacritics and tatweel are removed', () => {
  assert.equal(nz('القلبُ'), nz('القلب'));
  assert.equal(nz('الـقلب'), nz('القلب'));
});

test('Arabic letter variants are unified', () => {
  assert.equal(nz('أحمد'), nz('احمد'));
  assert.equal(nz('إسهال'), nz('اسهال'));
  assert.equal(nz('على'), nz('علي'));
  assert.equal(nz('الرئة'), nz('الرئه'));
});

test('normalised needle matches normalised haystack', () => {
  assert.ok(nz('التهاب الرئةِ الحاد').includes(nz('الرئه')));
});