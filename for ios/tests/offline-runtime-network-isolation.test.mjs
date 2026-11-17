import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const read = (name) => readFileSync(resolve(here, '..', name), 'utf8');
const index = read('index.html');
const worker = read('sw.js');
const updater = read('js/29-offline-setup.js');

test('question bank startup is local after install and network-enabled only for first install', () => {
  const start = index.indexOf('var dataFetch=');
  const end = index.indexOf("try{performance.mark('shb-boot-start')}", start);
  assert.ok(start >= 0 && end > start, 'question-bank loader block exists');
  const loader = index.slice(start, end);
  assert.match(loader, /hasVerifiedPackage\(\)/);\n  assert.match(loader, /if\(verified\)throw new Error/);\n  assert.match(loader, /first-install download/);
  assert.match(loader, /PACKAGE_CACHE_NAME='shbace-medical-offline-v2'/);
  assert.match(loader, /cacheHit\(packageCache/);
  assert.match(loader, /is missing from the installed offline storage/);
  assert.match(loader, /fetchText\(baseURL,cache,packageCache\)/, 'reviewed bank base must use package cache too');
});

test('service worker is local-only except explicitly tagged updater traffic', () => {
  assert.doesNotMatch(worker, /cache\.addAll\s*\(/, 'worker installation must not download shell files');
  assert.match(worker, /request\.headers\.get\(UPDATE_HEADER\) === '1'/);
  assert.match(worker, /request\.cache === 'no-store' && tagged/);
  assert.match(worker, /if \(integrityRequest && tagged\)/);
  assert.match(worker, /hasVerifiedInstall\(\)/);\n  assert.match(worker, /verified \? localOnly\(request\) : fetch\(request\)/);
  assert.match(worker, /url\.origin !== self\.location\.origin/);
  assert.doesNotMatch(worker, /refreshCachedPwaVersion|networkFirstOnPackageMismatch/);
  assert.match(worker, /if \(request.method !== 'GET'\)/);
  assert.equal((worker.match(/\bfetch\s*\(/g) || []).length, 3, 'tagged updater and bootstrap are the only network paths');
});

test('startup update metadata is local; manual and seven-day checks opt into network', () => {
  assert.match(updater, /function loadManifest\(allowNetwork\)/);
  assert.match(updater, /if\(allowNetwork!==true\)[\s\S]*?c\.match\(MANIFEST_URL\)/);
  assert.match(updater, /fetch\(MANIFEST_URL,[\s\S]*?headers:\{'X-Shbace-Update-Check':'1'\}/);
  assert.match(updater, /function checkDue\(\)[\s\S]*?loadManifest\(true\)/);
  assert.match(updater, /function manualCheck\(\)[\s\S]*?decide\(true\)/);
  assert.match(updater, /function manualRepair\(\)[\s\S]*?decide\(true\)/);
  assert.match(updater, /document\.addEventListener\('shb-splash-complete'/);
  assert.match(updater, /CHECK_EVERY=7\*24\*60\*60\*1000/);
  assert.match(updater, /CHECK_ATTEMPT_KEY='shbace_pkg_check_attempt_v1'/);
  assert.match(updater, /CHECK_ATTEMPT_KEY,Date\.now\(\)-\(CHECK_EVERY-SNOOZE_DAYS\*86400000\)/, 'Later preserves the two-day snooze');
  assert.match(updater, /var last=lsNum\(CHECK_ATTEMPT_KEY\)\|\|lsNum\(CHECK_OK_KEY\)/);
});

test('existing service worker is not automatically updated at startup', () => {
  const start = index.indexOf("navigator.serviceWorker.getRegistration('./')");
  const end = index.indexOf("}).catch", start);
  assert.ok(start >= 0 && end > start, 'service worker registration block exists');
  const registration = index.slice(start, end);
  assert.match(registration, /if\(!reg\)return navigator\.serviceWorker\.register/);
  assert.doesNotMatch(registration, /\.update\s*\(/);
});
