'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const read = relative => fs.readFileSync(path.join(root, relative), 'utf8');
const offline = read('js/29-offline-setup.js');
const sw = read('sw.js');
const build = read('scripts/restore-ios-packed.js');
const html = read('index.html');
const pkg = JSON.parse(read('package.json'));
const pwa = JSON.parse(read('pwa-version.json'));

test('one-time migration forces a network check for an installed 1.4.10-era package', () => {
  assert.match(offline, /var MIGRATION_KEY='shbace_ios_migrated_1_4_14'/);
  assert.match(offline, /migrationNeeded=hasRecord&&lsNum\\(MIGRATION_KEY\\)!==1/);
  assert.match(offline, /lsDel\\(CHECK_OK_KEY\\);lsDel\\(CHECK_TRY_KEY\\)/);
  assert.match(offline, /if\\(navigator\\.onLine===false\\)return/);
  assert.match(offline, /if\\(!hasRecord\\|\\|migrationNeeded\\|\\|checkDue\\(\\)\\)/);
});

test('migration applies the verified update automatically without the Later sheet', () => {
  const start = offline.indexOf('if(migrationInProgress&&manifestFromNetwork&&res.plan)');
  const end = offline.indexOf("if(res.kind==='prompt')", start);
  assert.ok(start >= 0 && end > start, 'migration branch must precede the ordinary prompt');
  const migrationBranch = offline.slice(start, end);
  assert.match(migrationBranch, /showPlanNeeded\\(res\\.plan\\);runPlan\\(\\)/);
  assert.doesNotMatch(migrationBranch, /showUpdateSheet|shbUpdLater/);
});

test('migration flag is set only after a successful online check or verified commit', () => {
  const networkSuccess = offline.indexOf('if(manifestFromNetwork){');
  const networkFlag = offline.indexOf("lsSet(MIGRATION_KEY,'1')", networkSuccess);
  assert.ok(networkSuccess >= 0 && networkFlag > networkSuccess);
  const commit = offline.indexOf('return commitPlan(target)');
  const cleanup = offline.indexOf('return cleanupPreviousCaches()', commit);
  const commitFlag = offline.indexOf("lsSet(MIGRATION_KEY,'1')", commit);
  assert.ok(commit >= 0 && cleanup > commit && commitFlag > cleanup);
});

test('only retired iOS shell caches are deleted; offline package and student database identities remain stable', () => {
  assert.match(offline, /var CACHE_NAME='shbace-medical-offline-v2'/);
  assert.match(offline, /var DB_NAME='shbace-medical-offline-state-v1'/);
  assert.match(offline, /name\\.indexOf\\('shbace-medical-ios-shell-'\\)===0/);
  assert.match(sw, /const CACHE_NAME = 'shbace-medical-offline-v2'/);
  assert.match(sw, /const DB_NAME = 'shbace-medical-offline-state-v1'/);
  assert.match(sw, /name\\.startsWith\\('shbace-medical-ios-shell-'\\)/);
  assert.doesNotMatch(offline + sw, /indexedDB\\.deleteDatabase|caches\\.delete\\(CACHE_NAME\\)/);
});

test('service worker compares IndexedDB releaseVersion with cached pwa-version and network-firsts stale navigation', () => {
  assert.match(sw, /readInstalledReleaseVersion/);
  assert.match(sw, /indexedDB\\.open\\(DB_NAME\\)/);
  assert.match(sw, /readCachedPwaVersion/);
  assert.match(sw, /results\\[0\\] !== results\\[1\\]/);
  assert.match(sw, /await refreshCachedPwaVersion\\(\\)/);
  assert.match(sw, /request\\.mode === 'navigate' \\|\\|/);
  assert.match(sw, /networkFirstOnPackageMismatch\\(request\\)/);
  assert.match(sw, /cache\\.match\\(INDEX_URL\\)/);
});

test('manifest build embeds releaseVersion and protects the migration/cache invariants', () => {
  assert.match(build, /manifest\\.releaseVersion = pwaVersion\\.version/);
  assert.match(build, /MIGRATION_KEY='shbace_ios_migrated_1_4_14'/);
  assert.match(build, /shbace-medical-ios-shell-/);
  assert.match(build, /networkFirstOnPackageMismatch/);
  assert.match(build, /Retired iOS runtime file must be deleted/);
});

test('retired iOS modules are absent and are not referenced by the live HTML', () => {
  for (const relative of ['js/32-ios-study-tools.js', 'js/33-ios-exam-planner.js']) {
    assert.equal(fs.existsSync(path.join(root, relative)), false, relative + ' must be deleted');
    assert.equal(html.includes(relative), false, relative + ' must not be loaded');
  }
});

test('release remains 1.4.15 and records the mixed-cache repair note', () => {
  assert.equal(pkg.version, '1.4.15');
  assert.equal(pwa.version, '1.4.15');
  assert.equal(pwa.displayVersion, '1.4.15');
  assert.ok(pwa.releaseNotes.includes('Fixes mixed old/new files after updating from 1.4.10; cleans old caches'));
});
